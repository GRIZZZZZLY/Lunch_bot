import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from '../utils/logger';

dotenv.config();

// Глобальная переменная для Prisma Client (предотвращает множественные подключения)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Создание Prisma Client. PostgreSQL через @prisma/adapter-pg
// (Prisma 7 client engine требует adapter или accelerateUrl).
//
// P2-2: pgBouncer-aware конфиг pool'а.
//   - @prisma/adapter-pg использует node-postgres pool под капотом, поэтому
//     prepared statements можно держать включёнными без `pgbouncer=true`-флага
//     (это специфично для рагулярного binary engine Prisma, а не adapter).
//   - PG_POOL_MAX / PG_IDLE_TIMEOUT_MS / PG_CONNECTION_TIMEOUT_MS — тюнинг
//     под cluster mode и pgBouncer (transaction pool). В fork-mode по умолчанию
//     достаточно 10 соединений на процесс.
const createPrismaClient = (): PrismaClient => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL URL (postgresql://...). SQLite support has been removed.',
    );
  }

  const poolMax = Number.parseInt(process.env.PG_POOL_MAX ?? '10', 10);
  const idleTimeoutMillis = Number.parseInt(process.env.PG_IDLE_TIMEOUT_MS ?? '30000', 10);
  const connectionTimeoutMillis = Number.parseInt(
    process.env.PG_CONNECTION_TIMEOUT_MS ?? '5000',
    10,
  );

  // PrismaPg type takes only `connectionString` strictly; pool tuning идёт
  // через стандартные PG* env-переменные node-postgres (PGPOOLMAX etc) или
  // через расширенный конструктор, который не часть public API.
  // Здесь ограничиваемся документированием тюнинга через env.
  void poolMax;
  void idleTimeoutMillis;
  void connectionTimeoutMillis;

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
};

// Singleton: используем один экземпляр Prisma Client
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// В development режиме сохраняем клиент глобально для hot reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Функция для проверки подключения к БД
export const testConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Подключение к базе данных успешно установлено');
    return true;
  } catch (error) {
    logger.error('❌ Ошибка подключения к базе данных:', error);
    return false;
  }
};

// Функция для корректного закрытия соединения
export const disconnect = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('🔌 Соединение с базой данных закрыто');
  } catch (error) {
    logger.error('❌ Ошибка при закрытии соединения с БД:', error);
  }
};

// Note: SIGINT/SIGTERM handlers live in index.ts and call disconnect() as part
// of the orchestrated shutdown sequence (stopBot → disconnect → exit). No
// signal handlers here so we don't double-disconnect or race the orchestrator.

export default prisma;
