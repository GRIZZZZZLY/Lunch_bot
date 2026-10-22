/**
 * Забег в магазин. Права, статусы, деньги и гонки проверяют интеграционные
 * тесты забегов и ежеминутной задачи автозакрытия на тестовой БД. Здесь
 * остаётся то, что через эндпоинт не увидеть: обрезка длинной заметки,
 * настройка таймаута переменной окружения, адресаты события и устойчивость к
 * сбоям побочных действий.
 */
import { StoreRunService } from '../../../services/store-run.service';
import { StoreRunBudgetService } from '../../../services/store-run-budget.service';
import { GroupService } from '../../../services/group.service';
import { eventBus } from '../../../services/event-bus.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/store-run-budget.service', () => ({
  StoreRunBudgetService: { createTransactionsForStoreRun: jest.fn() },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupMember: jest.fn() },
}));

/* Пополнение личного списка товаров разобрано в user-item-preset.service.test;
   здесь важно лишь то, что забег не зависит от его исхода. */
jest.mock('../../../services/user-item-preset.service', () => ({
  UserItemPresetService: { recordUsage: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../services/event-bus.service', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { UserItemPresetService } = jest.requireMock(
  '../../../services/user-item-preset.service'
);
const budget = asServiceMock(StoreRunBudgetService);
const groups = asServiceMock(GroupService);
const bus = asServiceMock(eventBus);

const NOW = new Date('2026-08-03T12:00:00.000Z');

function run(over: Record<string, unknown> = {}) {
  return {
    id: 30,
    groupId: 100,
    initiatorId: 1,
    storeName: 'Пятёрочка',
    status: 'COLLECTING',
    collectUntil: new Date('2026-08-03T12:30:00.000Z'),
    items: [],
    ...over,
  };
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  groups.isUserGroupMember.mockResolvedValue(true);
  budget.createTransactionsForStoreRun.mockResolvedValue([{ id: 500 }]);

  asMock(prismaMock.groupMember.findUnique).mockResolvedValue({
    isActive: true,
  });
  asMock(prismaMock.storeRun.findUnique).mockResolvedValue(run());
  asMock(prismaMock.storeRun.updateMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.storeRun.updateManyAndReturn).mockResolvedValue([]);
  asMock(prismaMock.storeItem.createManyAndReturn).mockImplementation((async (args: {
    data: Array<Record<string, unknown>>;
  }) => args.data.map((row, index) => ({ id: 10 + index, ...row }))) as never);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('addItemsBulk', () => {
  it('длинная заметка обрезается до 500 символов', async () => {
    const [saved] = await StoreRunService.addItemsBulk(30, 2, [
      { name: 'Хлеб', notes: 'з'.repeat(600) },
    ]);

    expect(saved.notes).toHaveLength(500);
  });

  it('сбой пополнения личного списка не отменяет добавленные позиции', async () => {
    UserItemPresetService.recordUsage.mockRejectedValueOnce(new Error('boom'));

    await expect(
      StoreRunService.addItemsBulk(30, 2, [{ name: 'Хлеб' }])
    ).resolves.toHaveLength(1);
  });
});

describe('автоматические переходы по времени', () => {
  it('о каждом закрытом забеге сообщается его участникам', async () => {
    asMock(prismaMock.storeRun.updateManyAndReturn).mockResolvedValue([
      { id: 30 },
    ]);

    await StoreRunService.autoCloseExpired();

    expect(bus.emit).toHaveBeenCalledWith(
      'store_run_updated',
      expect.objectContaining({ storeRunId: 30 })
    );
  });

  it('таймаут настраивается переменной окружения', async () => {
    const backup = process.env.STORE_RUN_SHOPPING_TIMEOUT_MIN;
    process.env.STORE_RUN_SHOPPING_TIMEOUT_MIN = '60';

    await StoreRunService.expireStaleShoppingRuns();

    expect(
      (
        asMock(prismaMock.storeRun.updateManyAndReturn).mock.calls[0][0] as {
          where: { shoppingAt: { lt: Date } };
        }
      ).where.shoppingAt.lt
    ).toEqual(new Date('2026-08-03T11:00:00.000Z'));

    process.env.STORE_RUN_SHOPPING_TIMEOUT_MIN = backup;
  });
});

describe('оповещение участников', () => {
  it('адресаты — инициатор и все, кто заказал, без повторов', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(
      run({ items: [{ userId: 2 }, { userId: 2 }, { userId: 1 }] })
    );

    await StoreRunService.addItemsBulk(30, 2, [{ name: 'Хлеб' }]);

    expect(bus.emit).toHaveBeenCalledWith(
      'store_run_updated',
      expect.objectContaining({ audience: [1, 2] })
    );
  });

  it('сбой рассылки не отменяет уже совершённое действие', async () => {
    bus.emit.mockImplementation(() => {
      throw new Error('bus down');
    });

    await expect(
      StoreRunService.addItemsBulk(30, 2, [{ name: 'Хлеб' }])
    ).resolves.toHaveLength(1);
  });
});
