import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Jest globalSetup: создаёт/обновляет схему в SQLite-тестовой БД (prisma/test.db)
 * перед прогоном тестов. Запускается один раз на весь test-run.
 */
export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db';

  const backendDir = path.resolve(__dirname, '..', '..');
  const testDbPath = path.join(backendDir, 'prisma', 'test.db');

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  execSync(`npx prisma db push --accept-data-loss --url=${process.env.DATABASE_URL}`, {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
}
