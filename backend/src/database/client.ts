import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Глобальная переменная для Prisma Client (предотвращает множественные подключения)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Создание Prisma Client с настройками
const createPrismaClient = (): PrismaClient => {
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
    errorFormat: 'pretty',
  });

  // Логирование SQL запросов в development
  if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
      logger.debug('Prisma Query:', {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
        target: e.target,
      });
    });
  }

  // Логирование ошибок
  prisma.$on('error', (e) => {
    logger.error('Prisma Error:', {
      message: e.message,
      target: e.target,
      timestamp: e.timestamp,
    });
  });

  // Логирование информационных сообщений
  prisma.$on('info', (e) => {
    logger.info('Prisma Info:', {
      message: e.message,
      target: e.target,
      timestamp: e.timestamp,
    });
  });

  // Логирование предупреждений
  prisma.$on('warn', (e) => {
    logger.warn('Prisma Warning:', {
      message: e.message,
      target: e.target,
      timestamp: e.timestamp,
    });
  });

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
