import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from '../utils/logger';

dotenv.config();

// Глобальная переменная для Prisma Client (предотвращает множественные подключения)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7 больше не принимает ни `datasource.url` в схеме, ни `datasourceUrl`
// в конструкторе: подключение идёт только через driver adapter. Строка
// подключения для CLI (migrate/generate) задаётся в prisma.config.ts, для
// рантайма — здесь, через PrismaPg.
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

  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
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
