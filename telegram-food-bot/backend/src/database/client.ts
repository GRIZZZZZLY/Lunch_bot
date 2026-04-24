import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { logger } from '../utils/logger';

dotenv.config();

// Глобальная переменная для Prisma Client (предотвращает множественные подключения)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Создание Prisma Client с настройками
const createPrismaClient = (): PrismaClient => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

  const prisma = new PrismaClient({ adapter });

  return prisma;
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

// Обработка сигналов завершения процесса
process.on('SIGINT', async () => {
  await disconnect();
});

process.on('SIGTERM', async () => {
  await disconnect();
});

export default prisma;
