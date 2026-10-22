import { UserService } from '../../../services/user.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../../../database/client';

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['админ', { isAdmin: true }, true],
    ['не админ', { isAdmin: false }, false],
    ['пользователя нет', null, false],
  ])('isAdmin: %s', async (_case, row, expected) => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(row);

    await expect(UserService.isAdmin(BigInt(12345678))).resolves.toBe(expected);
  });

  /**
   * Пакетный вариант нужен рассылкам: раньше они спрашивали реквизиты внутри
   * цикла по должникам — запрос на итерацию.
   */
  describe('getPaymentInfoMany', () => {
    it('ключ карты — id пользователя', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 1, paymentCard: '1111', paymentPhone: null, paymentDetails: null },
        { id: 2, paymentCard: null, paymentPhone: '+7 999', paymentDetails: null },
      ]);

      const result = await UserService.getPaymentInfoMany([1, 2]);

      expect(result.get(1)?.paymentCard).toBe('1111');
      expect(result.get(2)?.paymentPhone).toBe('+7 999');
    });

    /* Пустой список — не повод ходить в базу: `id: { in: [] }` вернул бы
       пустоту, но платой за это был бы запрос на каждую рассылку без
       должников. */
    it('пустой список не идёт в базу', async () => {
      const result = await UserService.getPaymentInfoMany([]);

      expect(result.size).toBe(0);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    /* Пропавший пользователь просто отсутствует в карте — вызывающий код
       обязан отличать «нет реквизитов» от «нет пользователя» сам, как и с
       одиночным null. */
    it('ненайденные id в карту не попадают', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const result = await UserService.getPaymentInfoMany([7]);

      expect(result.has(7)).toBe(false);
    });
  });
});
