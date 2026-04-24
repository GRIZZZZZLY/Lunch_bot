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

const MIGRATION_ORDER = [
  // 1. Independent tables (no FK dependencies)
  'User',
  'Group',
  
  // 2. Tables depending on User/Group
  'MenuItem',
  'GroupMember',
  'RecurringPoll',
  'DebtReminderSettings',
  'AdminNotificationSettings',
  
  // 3. Tables depending on MenuItem/Group
  'Poll',
  'MenuSuggestion',
  
  // 4. Tables depending on Poll
  'Vote',
  'PollResult',
  'ResponsibleSelection',
  'PollOrderCosts',
  'CategoryOrder',
  
  // 5. Tables depending on multiple entities
  'Transaction',
  'OrderItem',
  'OrderItemEditLog',
  'PaymentReminder',
  'AdminReminder',
  
  // 6. User progress/stats
  'UserProgress',
  'UserStats',
  'UserAchievement',
  'UserChallengeProgress',
  'UserQuest',
  'XPHistory',
  'Achievement',
  'Challenge',
  'Quest',
];

// ============================================================================
// Main Migration Logic
// ============================================================================

async function migrateTable(
  tableName: string,
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
    // Get table name in snake_case for SQLite
    const sqliteTableName = tableName
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');

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
          // Map values to proper types
          const mappedBatch = batch.map((row: any) => {
            const mapped: any = {};
            for (const [key, value] of Object.entries(row)) {
              // Convert snake_case to camelCase
              const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
              mapped[camelKey] = mapSqliteValue(value, typeof value);
            }
            return mapped;
          });

          // Insert batch
          await (prisma as any)[tableName.charAt(0).toLowerCase() + tableName.slice(1)].createMany({
            data: mappedBatch,
            skipDuplicates: true,
          });

          stats.migratedCount += batch.length;
        } catch (error: any) {
          console.error(`❌ Error in batch ${i + 1}/${batches}:`, error.message);
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

  for (const tableName of MIGRATION_ORDER) {
    try {
      const sqliteTableName = tableName
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');

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

    for (const tableName of MIGRATION_ORDER) {
      const stats = await migrateTable(tableName, sqlite, prisma, config);
      allStats.push(stats);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary\n');

    const totalSource = allStats.reduce((sum, s) => sum + s.sourceCount, 0);
    const totalMigrated = allStats.reduce((sum, s) => sum + s.migratedCount, 0);
    const totalErrors = allStats.reduce((sum, s) => sum + s.errors, 0);
    const totalDuration = allStats.reduce((sum, s) => sum + s.duration, 0);

    console.log(`Total rows in SQLite: ${totalSource}`);
    console.log(`Total rows migrated: ${totalMigrated}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);

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

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
