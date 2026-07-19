/**
 * SQLite → PostgreSQL Migration Script
 * 
 * Миграция данных из SQLite в PostgreSQL с учётом FK-зависимостей,
 * маппинга типов и возможностью отката.
 * 
 * Использование:
 *   npm run db:migrate:sqlite-to-postgres -- --sqlite=./prisma/dev.db
 *   npm run db:migrate:sqlite-to-postgres -- --sqlite=./prisma/dev.db --truncate
 *   npm run db:migrate:sqlite-to-postgres -- --sqlite=./prisma/dev.db --batch-size=500
 * 
 * Опции:
 *   --sqlite=<path>       Путь к SQLite файлу (обязательно)
 *   --truncate            Очистить Postgres перед миграцией
 *   --batch-size=<n>      Размер батча для вставки (по умолчанию 100)
 *   --skip-backup         Пропустить создание бэкапа (не рекомендуется)
 *   --dry-run             Только проверка, без записи в Postgres
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import type { PrismaClient } from '@prisma/client';

// Load environment variables BEFORE importing prisma client
dotenv.config();

// Import prisma client AFTER env is loaded
import { prisma } from '../database/client';
import { Prisma } from '@prisma/client';

// ============================================================================
// Schema-aware column mapping (uses Prisma DMMF as source of truth)
// ============================================================================

interface FieldMeta {
  name: string;       // camelCase Prisma field
  type: string;       // Boolean / Int / String / DateTime / Decimal / BigInt / Json
  isList: boolean;
}

/**
 * For each Prisma model, build dbColumn → FieldMeta lookup.
 * Handles @@map / @map so totalXp (sqlite column total_xp) → totalXP (Prisma field).
 */
const buildSchemaCache = (): Map<string, Map<string, FieldMeta>> => {
  const cache = new Map<string, Map<string, FieldMeta>>();
  for (const model of Prisma.dmmf.datamodel.models) {
    const fieldByDbColumn = new Map<string, FieldMeta>();
    for (const field of model.fields) {
      if (field.relationName) continue; // skip relation virtuals
      const dbCol = (field as any).dbName ?? field.name;
      fieldByDbColumn.set(dbCol, {
        name: field.name,
        type: field.type,
        isList: field.isList,
      });
    }
    cache.set(model.name, fieldByDbColumn);
  }
  return cache;
};

const SCHEMA_CACHE = buildSchemaCache();

/**
 * Map a single SQLite row to a Prisma createMany input object.
 * Converts SQLite ints to booleans where the schema says Boolean.
 * Skips columns the Prisma model doesn't know about.
 */
const mapRowForPrisma = (row: Record<string, any>, modelName: string) => {
  const fieldMap = SCHEMA_CACHE.get(modelName);
  if (!fieldMap) {
    throw new Error(`No schema cache entry for model ${modelName}`);
  }
  const out: Record<string, any> = {};
  for (const [dbCol, raw] of Object.entries(row)) {
    const meta = fieldMap.get(dbCol);
    if (!meta) continue; // column dropped from current schema
    if (raw === null || raw === undefined) {
      out[meta.name] = null;
      continue;
    }
    if (meta.type === 'Boolean') {
      out[meta.name] = raw === 1 || raw === '1' || raw === true;
    } else if (meta.type === 'BigInt') {
      out[meta.name] = typeof raw === 'bigint' ? raw : BigInt(raw);
    } else {
      out[meta.name] = raw;
    }
  }
  return out;
};

// ============================================================================
// Configuration
// ============================================================================

interface MigrationConfig {
  sqlitePath: string;
  truncate: boolean;
  batchSize: number;
  skipBackup: boolean;
  dryRun: boolean;
}

interface MigrationStats {
  tableName: string;
  sourceCount: number;
  migratedCount: number;
  errors: number;
  duration: number;
}

// ============================================================================
// Parse CLI Arguments
// ============================================================================

function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {
    sqlitePath: '',
    truncate: false,
    batchSize: 100,
    skipBackup: false,
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--sqlite=')) {
      config.sqlitePath = arg.split('=')[1];
    } else if (arg === '--truncate') {
      config.truncate = true;
    } else if (arg.startsWith('--batch-size=')) {
      config.batchSize = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--skip-backup') {
      config.skipBackup = true;
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    }
  }

  if (!config.sqlitePath) {
    console.error('❌ Error: --sqlite=<path> is required');
    console.log('\nUsage:');
    console.log('  npm run db:migrate:sqlite-to-postgres -- --sqlite=./prisma/dev.db');
    process.exit(1);
  }

  if (!fs.existsSync(config.sqlitePath)) {
    console.error(`❌ Error: SQLite file not found: ${config.sqlitePath}`);
    process.exit(1);
  }

  return config;
}

// ============================================================================
// Backup Functions
// ============================================================================

function createBackup(sqlitePath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${sqlitePath}.backup-${timestamp}`;
  
  console.log(`📦 Creating SQLite backup: ${backupPath}`);
  fs.copyFileSync(sqlitePath, backupPath);
  console.log('✅ Backup created successfully\n');
  
  return backupPath;
}

// ============================================================================
// Type Mapping Functions
// ============================================================================

function mapSqliteValue(value: any, columnType: string): any {
  if (value === null || value === undefined) {
    return null;
  }

  // Boolean: SQLite stores as 0/1, Postgres needs true/false
  if (columnType === 'BOOLEAN') {
    return value === 1 || value === true;
  }

  // BigInt: Ensure proper conversion
  if (columnType === 'BIGINT') {
    return BigInt(value);
  }

  // JSON: Parse if string
  if (columnType === 'JSON' || columnType === 'JSONB') {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  // DateTime: Ensure ISO format
  if (columnType === 'TIMESTAMP' || columnType === 'DATETIME') {
    if (typeof value === 'string') {
      return new Date(value);
    }
    return value;
  }

  return value;
}

// ============================================================================
// Migration Order (respects FK dependencies)
// ============================================================================

/**
 * [Prisma model name, SQLite/Postgres table name (@@map value)]
 * Order matters — respects FK dependencies (parents before children).
 */
const MIGRATION_ORDER: Array<[string, string]> = [
  // 1. Independent tables (no FK dependencies)
  ['User', 'users'],
  ['Group', 'groups'],

  // 2. Tables depending on User/Group
  ['MenuItem', 'menu_items'],
  ['GroupMember', 'group_members'],
  ['RecurringPoll', 'recurring_polls'],
  ['DebtReminderSettings', 'debt_reminder_settings'],
  ['AdminNotificationSettings', 'admin_notification_settings'],
  ['Donation', 'donations'],

  // 3. Tables depending on MenuItem/Group
  ['Poll', 'polls'],
  ['MenuSuggestion', 'menu_suggestions'],

  // 4. Tables depending on Poll
  ['PollParticipant', 'poll_participants'],
  ['Vote', 'votes'],
  ['PollResult', 'poll_results'],
  ['ResponsibleSelection', 'responsible_selections'],
  ['PollOrderCosts', 'poll_order_costs'],
  ['CategoryOrder', 'category_orders'],

  // 5. Store run feature
  ['StoreRun', 'store_runs'],
  ['StoreItem', 'store_items'],

  // 6. Tables depending on multiple entities
  ['Transaction', 'transactions'],
  ['OrderItem', 'order_items'],
  ['OrderItemEditLog', 'order_item_edit_logs'],
  ['PaymentReminder', 'payment_reminders'],
  ['AdminReminder', 'admin_reminders'],

  // 7. User progress/stats / gamification
  ['UserProgress', 'user_progress'],
  ['UserStats', 'user_stats'],
  ['UserAchievement', 'user_achievements'],
  ['UserChallengeProgress', 'user_challenge_progress'],
  ['UserQuest', 'user_quests'],
  ['XPHistory', 'xp_history'],
  ['Achievement', 'achievements'],
  ['Challenge', 'challenges'],
  ['Quest', 'quests'],
];

// ============================================================================
// Main Migration Logic
// ============================================================================

async function migrateTable(
  tableName: string,
  sqliteTableName: string,
  sqlite: Database.Database,
  prisma: PrismaClient,
  config: MigrationConfig
): Promise<MigrationStats> {
  const startTime = Date.now();
  const stats: MigrationStats = {
    tableName,
    sourceCount: 0,
    migratedCount: 0,
    errors: 0,
    duration: 0,
  };

  try {
    // sqliteTableName is now passed in by caller (read from MIGRATION_ORDER tuple)
    // — was previously derived via naive CamelCase→snake_case which missed
    // pluralization (User → user, but real table is `users`).
    // See migrateAll loop.

    // Check if table exists in SQLite
    const tableExists = sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
      )
      .get(sqliteTableName);

    if (!tableExists) {
      console.log(`⏭️  Skipping ${tableName} (not found in SQLite)`);
      return stats;
    }

    // Get row count
    const countResult = sqlite
      .prepare(`SELECT COUNT(*) as count FROM ${sqliteTableName}`)
      .get() as { count: number };
    
    stats.sourceCount = countResult.count;

    if (stats.sourceCount === 0) {
      console.log(`⏭️  Skipping ${tableName} (empty table)`);
      return stats;
    }

    console.log(`\n📊 Migrating ${tableName}: ${stats.sourceCount} rows`);

    // Truncate if requested
    if (config.truncate && !config.dryRun) {
      console.log(`🗑️  Truncating ${tableName}...`);
      await (prisma as any)[tableName.charAt(0).toLowerCase() + tableName.slice(1)].deleteMany();
    }

    // Fetch all rows
    const rows = sqlite.prepare(`SELECT * FROM ${sqliteTableName}`).all();

    // Migrate in batches
    const batches = Math.ceil(rows.length / config.batchSize);
    
    for (let i = 0; i < batches; i++) {
      const start = i * config.batchSize;
      const end = Math.min(start + config.batchSize, rows.length);
      const batch = rows.slice(start, end);

      if (!config.dryRun) {
        try {
          // Schema-aware mapping: use Prisma DMMF for column → field name and
          // SQLite int → Boolean conversion.
          const mappedBatch = batch.map((row: any) => mapRowForPrisma(row, tableName));

          // Insert batch
          await (prisma as any)[tableName.charAt(0).toLowerCase() + tableName.slice(1)].createMany({
            data: mappedBatch,
            skipDuplicates: true,
          });

          stats.migratedCount += batch.length;
        } catch (error: any) {
          console.error(`❌ Error in batch ${i + 1}/${batches} of ${tableName}:`);
          console.error('   message:', error.message || '<empty>');
          console.error('   name:', error.name);
          console.error('   code:', (error).code);
          if ((error).meta) console.error('   meta:', JSON.stringify((error).meta, null, 2));
          if (i === 0) {
            // Dump first row of failing batch for diagnosis
            console.error('   first row sample:', JSON.stringify(batch[0], (_k, v) =>
              typeof v === 'bigint' ? v.toString() : v, 2));
          }
          stats.errors += batch.length;
        }
      } else {
        stats.migratedCount += batch.length;
      }

      // Progress indicator
      const progress = Math.round((end / rows.length) * 100);
      process.stdout.write(`\r   Progress: ${progress}% (${end}/${rows.length})`);
    }

    console.log(''); // New line after progress
    console.log(`✅ ${tableName}: ${stats.migratedCount}/${stats.sourceCount} rows migrated`);

  } catch (error: any) {
    console.error(`❌ Error migrating ${tableName}:`, error.message);
    stats.errors = stats.sourceCount;
  }

  stats.duration = Date.now() - startTime;
  return stats;
}

// ============================================================================
// Verification Functions
// ============================================================================

async function verifyMigration(
  sqlite: Database.Database,
  prisma: PrismaClient
): Promise<boolean> {
  console.log('\n🔍 Verifying migration...\n');

  let allValid = true;

  for (const [tableName, sqliteTableName] of MIGRATION_ORDER) {
    try {
      const tableExists = sqlite
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        )
        .get(sqliteTableName);

      if (!tableExists) continue;

      const sqliteCount = (
        sqlite
          .prepare(`SELECT COUNT(*) as count FROM ${sqliteTableName}`)
          .get() as { count: number }
      ).count;

      const prismaCount = await (prisma as any)[
        tableName.charAt(0).toLowerCase() + tableName.slice(1)
      ].count();

      const match = sqliteCount === prismaCount;
      const icon = match ? '✅' : '❌';

      console.log(
        `${icon} ${tableName}: SQLite=${sqliteCount}, Postgres=${prismaCount}`
      );

      if (!match) {
        allValid = false;
      }
    } catch (error: any) {
      console.error(`❌ Error verifying ${tableName}:`, error.message);
      allValid = false;
    }
  }

  return allValid;
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  console.log('🚀 SQLite → PostgreSQL Migration\n');

  const config = parseArgs();
  
  console.log('Configuration:');
  console.log(`  SQLite: ${config.sqlitePath}`);
  console.log(`  Truncate: ${config.truncate}`);
  console.log(`  Batch Size: ${config.batchSize}`);
  console.log(`  Dry Run: ${config.dryRun}`);
  console.log('');

  // Create backup
  let backupPath: string | null = null;
  if (!config.skipBackup && !config.dryRun) {
    backupPath = createBackup(config.sqlitePath);
  }

  // Initialize connections
  const sqlite = new Database(config.sqlitePath, { readonly: true });
  
  // Validate DATABASE_URL for PostgreSQL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://'))) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string');
  }
  
  // Use existing prisma client from database/client.ts

  try {
    // Test Postgres connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ PostgreSQL connection successful\n');

    // Migrate tables in order
    const allStats: MigrationStats[] = [];

    for (const [tableName, sqliteTableName] of MIGRATION_ORDER) {
      const stats = await migrateTable(tableName, sqliteTableName, sqlite, prisma, config);
      allStats.push(stats);
    }

    // Summary
    console.log(`\n${  '='.repeat(60)}`);
    console.log('📊 Migration Summary\n');

    const totalSource = allStats.reduce((sum, s) => sum + s.sourceCount, 0);
    const totalMigrated = allStats.reduce((sum, s) => sum + s.migratedCount, 0);
    const totalErrors = allStats.reduce((sum, s) => sum + s.errors, 0);
    const totalDuration = allStats.reduce((sum, s) => sum + s.duration, 0);

    console.log(`Total rows in SQLite: ${totalSource}`);
    console.log(`Total rows migrated: ${totalMigrated}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);

    // Sync Postgres sequences (otherwise next insert collides with migrated PKs)
    if (!config.dryRun) {
      console.log('\n🔧 Syncing Postgres sequences to MAX(id)+1...');
      await prisma.$executeRawUnsafe(`
        DO $$
        DECLARE r RECORD;
        BEGIN
          FOR r IN SELECT table_name, column_name
                   FROM information_schema.columns
                   WHERE column_default LIKE 'nextval%' AND table_schema='public'
          LOOP
            EXECUTE format(
              'SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE((SELECT MAX(%I) FROM %I), 0) + 1, false)',
              r.table_name, r.column_name, r.column_name, r.table_name
            );
          END LOOP;
        END$$;
      `);
      console.log('✅ Sequences synchronized');
    }

    // Verification
    if (!config.dryRun) {
      const isValid = await verifyMigration(sqlite, prisma);
      
      if (isValid) {
        console.log('\n✅ Migration completed successfully!');
        if (backupPath) {
          console.log(`\n💡 Backup saved at: ${backupPath}`);
          console.log('   You can delete it after verifying the migration.');
        }
      } else {
        console.log('\n⚠️  Migration completed with discrepancies!');
        console.log('   Please review the verification results above.');
        if (backupPath) {
          console.log(`\n🔄 To rollback, restore from: ${backupPath}`);
        }
      }
    } else {
      console.log('\n✅ Dry run completed (no data written to Postgres)');
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    if (backupPath) {
      console.log(`\n🔄 To rollback, restore from: ${backupPath}`);
    }
    process.exit(1);
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

// ============================================================================
// Execute
// ============================================================================

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
