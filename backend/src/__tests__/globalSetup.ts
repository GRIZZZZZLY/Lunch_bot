import { execSync } from 'child_process';
import path from 'path';
import { Client } from 'pg';

/**
 * Jest globalSetup
 *
 * Готовит выделенную PostgreSQL-БД для тестов:
 *   1. Подключается к maintenance-БД `postgres`, создаёт test-БД если её нет.
 *   2. Через `prisma db push --force-reset` накатывает актуальную схему,
 *      попутно сбрасывая всё содержимое (чтобы каждый прогон стартовал с чистого листа).
 *
 * Переменные окружения:
 *   - TEST_DATABASE_URL — если задано, используется как есть.
 *   - Иначе берётся дефолт `postgresql://foodbot:foodbot_password@localhost:5432/foodbot_test_db`
 *     (совпадает по credentials с dev-БД из .env, отличается именем).
 *
 * Запускается один раз на весь test-run.
 */
export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';

  const testDatabaseUrl =
    process.env.TEST_DATABASE_URL ||
    'postgresql://foodbot:foodbot_password@localhost:5432/foodbot_test_db';

  process.env.DATABASE_URL = testDatabaseUrl;

  try {
    await ensureTestDatabaseExists(testDatabaseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot prepare PostgreSQL test database at ${redactDatabaseUrl(testDatabaseUrl)}. ` +
        'Start PostgreSQL or set TEST_DATABASE_URL to a reachable test database. ' +
        `Original error: ${message}`
    );
  }

  const backendDir = path.resolve(__dirname, '..', '..');

  // --url переопределяет DATABASE_URL из prisma.config.ts (который читает .env)
  // и гарантирует, что push идёт именно в test-БД.
  execSync(
    `npx prisma db push --force-reset --accept-data-loss --url="${testDatabaseUrl}"`,
    {
      cwd: backendDir,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    }
  );
}

function redactDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return '<invalid database url>';
  }
}

/**
 * Создаёт test-БД если её нет. CREATE DATABASE в PostgreSQL не поддерживает
 * `IF NOT EXISTS`, поэтому сначала проверяем через pg_database.
 */
async function ensureTestDatabaseExists(testDatabaseUrl: string): Promise<void> {
  const url = new URL(testDatabaseUrl);
  const testDbName = url.pathname.replace(/^\//, '');

  if (!testDbName) {
    throw new Error(`TEST_DATABASE_URL has no database name: ${testDatabaseUrl}`);
  }

  // Подключаемся к maintenance-БД `postgres` тем же пользователем.
  const adminUrl = new URL(testDatabaseUrl);
  adminUrl.pathname = '/postgres';

  const client = new Client({ connectionString: adminUrl.toString() });

  try {
    await client.connect();
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      testDbName,
    ]);
    if (existing.rowCount === 0) {
      // Имя БД нельзя параметризовать в CREATE DATABASE; экранируем кавычки вручную.
      const safeName = testDbName.replace(/"/g, '""');
      await client.query(`CREATE DATABASE "${safeName}"`);
    }
  } finally {
    await client.end();
  }
}
