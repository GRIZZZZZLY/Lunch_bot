import type { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';

/**
 * Глубокий мок Prisma Client.
 *
 * Ручное перечисление моделей (`jest.mock('../../database/client', () => ({ prisma: { poll: { findUnique: jest.fn() } } }))`)
 * приходилось расширять на каждый новый вызов, и падение выглядело как
 * `Cannot read properties of undefined (reading 'findMany')` вместо внятного
 * «этот вызов не замокан». mockDeep отдаёт любую модель и любой метод сразу.
 */
export const prismaMock = mockDeep<PrismaClient>();

/**
 * Форма модуля `src/database/client.ts` для фабрики `jest.mock`.
 *
 * Использование (фабрика поднимается выше импортов, поэтому require внутри):
 *   jest.mock('@/database/client', () => require('...helpers/prisma-mock').databaseClientMock());
 */
export const databaseClientMock = (): Record<string, unknown> => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
  testConnection: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(undefined),
});

type TransactionArg =
  | ((tx: unknown) => unknown)
  | Array<Promise<unknown> | unknown>;

/**
 * Сбрасывает мок и заново ставит поведение `$transaction`: колбэк исполняется
 * на том же моке, массив — через Promise.all. Без этого каждый сервис,
 * обёрнутый в транзакцию, возвращал бы undefined и тест проверял бы пустоту.
 */
export function resetPrismaMock(): void {
  mockReset(prismaMock);

  (prismaMock.$transaction as unknown as jest.Mock).mockImplementation(
    async (arg: TransactionArg) => {
      if (typeof arg === 'function') {
        return arg(prismaMock);
      }
      return Promise.all(arg);
    }
  );

  (prismaMock.$queryRaw as unknown as jest.Mock).mockResolvedValue([]);
  (prismaMock.$executeRaw as unknown as jest.Mock).mockResolvedValue(0);
  (prismaMock.$connect as unknown as jest.Mock).mockResolvedValue(undefined);
  (prismaMock.$disconnect as unknown as jest.Mock).mockResolvedValue(undefined);
}
