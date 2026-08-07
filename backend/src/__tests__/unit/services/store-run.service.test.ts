/**
 * Забег в магазин: сбор позиций → покупка → расчёт. Авторизация разобрана в
 * store-run-authz, автозакрытие — в store-run-autoclose и store-run-expire;
 * здесь состояния, границы ввода и то, что нельзя потерять.
 *
 * Главное правило расчёта: купленную позицию без цены нельзя просто пропустить.
 * «Купил» отмечают одним касанием в магазине, а цену вносят по чеку — значит
 * между этими моментами позиция существует без суммы. Если в такой момент
 * закрыть забег, чужая покупка молча выпала бы из денег. Поэтому settle
 * пересчитывает позиции ПОСЛЕ перевода статуса (строка забега уже заблокирована,
 * параллельный setItemPrice не проскочит) и откатывает транзакцию целиком —
 * забег остаётся SHOPPING, и его можно завершить повторно.
 *
 * Второе правило: все переходы статуса — условные updateMany со статусом в
 * WHERE. Гонка двух нажатий не должна дать двух переходов.
 */
import { Prisma } from '@prisma/client';
import {
  StoreRunService,
  StoreRunError,
} from '../../../services/store-run.service';
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

jest.mock('../../../services/event-bus.service', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logger } = jest.requireMock('../../../utils/logger');
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

function item(over: Record<string, unknown> = {}) {
  return {
    id: 10,
    storeRunId: 30,
    userId: 2,
    name: 'Хлеб',
    quantity: 1,
    notes: null,
    status: 'PENDING',
    price: null,
    storeRun: { id: 30, status: 'COLLECTING', initiatorId: 1 },
    ...over,
  };
}

/** Код ошибки StoreRunError у отклонённого вызова. */
async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(StoreRunError);
    return (error as StoreRunError).code;
  }
  throw new Error('expected the call to be rejected');
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
  asMock(prismaMock.groupMember.findMany).mockResolvedValue([]);
  asMock(prismaMock.storeRun.findFirst).mockResolvedValue(null);
  asMock(prismaMock.storeRun.findUnique).mockResolvedValue(run());
  asMock(prismaMock.storeRun.findUniqueOrThrow).mockResolvedValue(run());
  asMock(prismaMock.storeRun.findMany).mockResolvedValue([]);
  asMock(prismaMock.storeRun.create).mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: 30, ...args.data })) as never);
  asMock(prismaMock.storeRun.updateMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.storeRun.updateManyAndReturn).mockResolvedValue([]);
  asMock(prismaMock.storeItem.findUnique).mockResolvedValue(item());
  asMock(prismaMock.storeItem.createManyAndReturn).mockImplementation((async (args: {
    data: Array<Record<string, unknown>>;
  }) => args.data.map((row, index) => ({ id: 10 + index, ...row }))) as never);
  asMock(prismaMock.storeItem.update).mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: 10, ...args.data })) as never);
  asMock(prismaMock.storeItem.delete).mockResolvedValue({ id: 10 });
  asMock(prismaMock.storeItem.count).mockResolvedValue(0);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('createStoreRun', () => {
  const input = {
    initiatorId: 1,
    groupId: 100,
    storeName: 'Пятёрочка',
    collectMinutes: 20,
  };

  it('забег создаётся с окном сбора от текущего момента', async () => {
    await StoreRunService.createStoreRun(input);

    expect(asMock(prismaMock.storeRun.create)).toHaveBeenCalledWith({
      data: {
        groupId: 100,
        initiatorId: 1,
        storeName: 'Пятёрочка',
        collectUntil: new Date('2026-08-03T12:20:00.000Z'),
      },
    });
  });

  it('пробелы в названии магазина срезаются', async () => {
    await StoreRunService.createStoreRun({ ...input, storeName: '  Магнит  ' });

    expect(
      (
        asMock(prismaMock.storeRun.create).mock.calls[0][0] as {
          data: { storeName: string };
        }
      ).data.storeName
    ).toBe('Магнит');
  });

  it.each([
    ['пустое название', { storeName: '   ' }],
    ['слишком длинное название', { storeName: 'м'.repeat(101) }],
    ['нулевое окно сбора', { collectMinutes: 0 }],
    ['отрицательное окно', { collectMinutes: -5 }],
    ['окно на сутки', { collectMinutes: 1440 }],
    ['нечисловое окно', { collectMinutes: Number.NaN }],
  ])('%s отклоняется', async (_name, over) => {
    await expect(
      errorCode(StoreRunService.createStoreRun({ ...input, ...over }))
    ).resolves.toBe('INVALID_INPUT');
    expect(asMock(prismaMock.storeRun.create)).not.toHaveBeenCalled();
  });

  it('не участник группы забег не запускает', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue(null);

    await expect(
      errorCode(StoreRunService.createStoreRun(input))
    ).resolves.toBe('FORBIDDEN');
  });

  it('вышедший из группы забег не запускает', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue({
      isActive: false,
    });

    await expect(
      errorCode(StoreRunService.createStoreRun(input))
    ).resolves.toBe('FORBIDDEN');
  });

  it('второй забег того же человека не запускается', async () => {
    asMock(prismaMock.storeRun.findFirst).mockResolvedValue({
      id: 29,
      storeName: 'Магнит',
      status: 'SHOPPING',
    });

    await expect(
      errorCode(StoreRunService.createStoreRun(input))
    ).resolves.toBe('ACTIVE_RUN_EXISTS');
  });

  it('гонка на уникальном индексе трактуется как «уже есть активный»', async () => {
    asMock(prismaMock.storeRun.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '5',
      })
    );

    await expect(
      errorCode(StoreRunService.createStoreRun(input))
    ).resolves.toBe('ACTIVE_RUN_EXISTS');
  });

  it('прочие ошибки БД пробрасываются как есть', async () => {
    asMock(prismaMock.storeRun.create).mockRejectedValue(new Error('db down'));

    await expect(StoreRunService.createStoreRun(input)).rejects.toThrow(
      'db down'
    );
  });
});

describe('чтение забегов', () => {
  it('участник группы видит забег с позициями', async () => {
    await expect(StoreRunService.getStoreRunById(30, 2)).resolves.toMatchObject({
      id: 30,
    });
  });

  it('не участник группы забег не видит', async () => {
    groups.isUserGroupMember.mockResolvedValue(false);

    await expect(errorCode(StoreRunService.getStoreRunById(30, 99))).resolves.toBe(
      'FORBIDDEN'
    );
  });

  it('несуществующий забег — null, а не ошибка', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(null);

    await expect(StoreRunService.getStoreRunById(30, 2)).resolves.toBeNull();
    expect(groups.isUserGroupMember).not.toHaveBeenCalled();
  });

  it('человек без групп активных забегов не получает', async () => {
    await expect(
      StoreRunService.getActiveStoreRunsForUser(2)
    ).resolves.toEqual([]);
    expect(asMock(prismaMock.storeRun.findMany)).not.toHaveBeenCalled();
  });

  it('видны активные забеги всех его групп, со своими позициями', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { groupId: 100 },
      { groupId: 200 },
    ]);
    asMock(prismaMock.storeRun.findMany).mockResolvedValue([run()]);

    await StoreRunService.getActiveStoreRunsForUser(2);

    const call = asMock(prismaMock.storeRun.findMany).mock.calls[0][0] as {
      where: { groupId: { in: number[] } };
      include: { items: { where: { userId: number } } };
    };
    expect(call.where.groupId.in).toEqual([100, 200]);
    expect(call.include.items.where).toEqual({ userId: 2 });
  });
});

describe('addItemsBulk', () => {
  it('позиции добавляются с автором и количеством', async () => {
    const created = await StoreRunService.addItemsBulk(30, 2, [
      { name: 'Хлеб', quantity: 2 },
      { name: 'Молоко' },
    ]);

    expect(created).toHaveLength(2);
    const rows = (
      asMock(prismaMock.storeItem.createManyAndReturn).mock.calls[0][0] as {
        data: Array<Record<string, unknown>>;
      }
    ).data;
    expect(rows[0]).toMatchObject({ userId: 2, name: 'Хлеб', quantity: 2 });
    expect(rows[1]).toMatchObject({ name: 'Молоко', quantity: 1 });
  });

  it('заметка обрезается по длине, а пустая становится null', async () => {
    await StoreRunService.addItemsBulk(30, 2, [
      { name: 'Хлеб', notes: 'з'.repeat(600) },
      { name: 'Молоко', notes: '   ' },
    ]);

    const rows = (
      asMock(prismaMock.storeItem.createManyAndReturn).mock.calls[0][0] as {
        data: Array<{ notes: string | null }>;
      }
    ).data;
    expect(rows[0].notes).toHaveLength(500);
    expect(rows[1].notes).toBeNull();
  });

  it('пустой список отклоняется', async () => {
    await expect(errorCode(StoreRunService.addItemsBulk(30, 2, []))).resolves.toBe(
      'INVALID_INPUT'
    );
  });

  it.each([
    ['без названия', { name: '   ' }],
    ['слишком длинное название', { name: 'х'.repeat(201) }],
    ['нулевое количество', { name: 'Хлеб', quantity: 0 }],
    ['дробное количество', { name: 'Хлеб', quantity: 1.5 }],
    ['количество больше 99', { name: 'Хлеб', quantity: 100 }],
  ])('%s отбрасывается при санитизации', async (_name, raw) => {
    await expect(
      errorCode(StoreRunService.addItemsBulk(30, 2, [raw]))
    ).resolves.toBe('INVALID_INPUT');
  });

  it('негодные позиции отбрасываются, годные сохраняются', async () => {
    await StoreRunService.addItemsBulk(30, 2, [
      { name: '   ' },
      { name: 'Хлеб' },
    ]);

    const rows = (
      asMock(prismaMock.storeItem.createManyAndReturn).mock.calls[0][0] as {
        data: Array<{ name: string }>;
      }
    ).data;
    expect(rows.map(row => row.name)).toEqual(['Хлеб']);
  });

  it('в несуществующий забег позиции не добавляются', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(null);

    await expect(
      errorCode(StoreRunService.addItemsBulk(30, 2, [{ name: 'Хлеб' }]))
    ).resolves.toBe('NOT_FOUND');
  });

  it('после окончания сбора позиции не добавляются', async () => {
    asMock(prismaMock.storeRun.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      errorCode(StoreRunService.addItemsBulk(30, 2, [{ name: 'Хлеб' }]))
    ).resolves.toBe('WRONG_STATUS');
  });

  it('не участник группы позиции не добавляет', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue({
      isActive: false,
    });

    await expect(
      errorCode(StoreRunService.addItemsBulk(30, 2, [{ name: 'Хлеб' }]))
    ).resolves.toBe('FORBIDDEN');
  });

  it('участники забега узнают об изменении', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(
      run({ items: [{ userId: 2 }, { userId: 3 }] })
    );

    await StoreRunService.addItemsBulk(30, 2, [{ name: 'Хлеб' }]);

    expect(bus.emit).toHaveBeenCalledWith(
      'store_run_updated',
      expect.objectContaining({ storeRunId: 30, audience: [1, 2, 3] })
    );
  });
});

describe('updateItem', () => {
  it('своя позиция правится', async () => {
    await StoreRunService.updateItem(10, 2, { name: 'Батон', quantity: 3 });

    expect(asMock(prismaMock.storeItem.update)).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { name: 'Батон', quantity: 3 },
    });
  });

  it('переданы только изменённые поля', async () => {
    await StoreRunService.updateItem(10, 2, { quantity: 5 });

    expect(
      (
        asMock(prismaMock.storeItem.update).mock.calls[0][0] as {
          data: Record<string, unknown>;
        }
      ).data
    ).toEqual({ quantity: 5 });
  });

  it('чужую позицию править нельзя', async () => {
    await expect(
      errorCode(StoreRunService.updateItem(10, 99, { quantity: 2 }))
    ).resolves.toBe('FORBIDDEN');
  });

  it('несуществующую позицию править нельзя', async () => {
    asMock(prismaMock.storeItem.findUnique).mockResolvedValue(null);

    await expect(
      errorCode(StoreRunService.updateItem(10, 2, { quantity: 2 }))
    ).resolves.toBe('NOT_FOUND');
  });

  it('после начала покупки править нельзя', async () => {
    asMock(prismaMock.storeItem.findUnique).mockResolvedValue(
      item({ storeRun: { id: 30, status: 'SHOPPING', initiatorId: 1 } })
    );

    await expect(
      errorCode(StoreRunService.updateItem(10, 2, { quantity: 2 }))
    ).resolves.toBe('WRONG_STATUS');
  });

  it('гонка: сбор закончился между проверкой и записью', async () => {
    asMock(prismaMock.storeRun.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      errorCode(StoreRunService.updateItem(10, 2, { quantity: 2 }))
    ).resolves.toBe('WRONG_STATUS');
    expect(asMock(prismaMock.storeItem.update)).not.toHaveBeenCalled();
  });

  it.each([
    ['пустое имя', { name: '   ' }],
    ['слишком длинное имя', { name: 'х'.repeat(201) }],
    ['нулевое количество', { quantity: 0 }],
    ['дробное количество', { quantity: 2.5 }],
    ['количество больше 99', { quantity: 100 }],
  ])('%s отклоняется', async (_name, data) => {
    await expect(errorCode(StoreRunService.updateItem(10, 2, data))).resolves.toBe(
      'INVALID_INPUT'
    );
  });

  it('пустая заметка стирается', async () => {
    await StoreRunService.updateItem(10, 2, { notes: '  ' });

    expect(
      (
        asMock(prismaMock.storeItem.update).mock.calls[0][0] as {
          data: { notes: string | null };
        }
      ).data.notes
    ).toBeNull();
  });
});

describe('deleteItem', () => {
  it('своя позиция удаляется', async () => {
    await StoreRunService.deleteItem(10, 2);

    expect(asMock(prismaMock.storeItem.delete)).toHaveBeenCalledWith({
      where: { id: 10 },
    });
  });

  it('чужую позицию удалить нельзя', async () => {
    await expect(errorCode(StoreRunService.deleteItem(10, 99))).resolves.toBe(
      'FORBIDDEN'
    );
  });

  it('несуществующую позицию удалить нельзя', async () => {
    asMock(prismaMock.storeItem.findUnique).mockResolvedValue(null);

    await expect(errorCode(StoreRunService.deleteItem(10, 2))).resolves.toBe(
      'NOT_FOUND'
    );
  });

  it('после начала покупки удалить нельзя', async () => {
    asMock(prismaMock.storeItem.findUnique).mockResolvedValue(
      item({ storeRun: { id: 30, status: 'SHOPPING', initiatorId: 1 } })
    );

    await expect(errorCode(StoreRunService.deleteItem(10, 2))).resolves.toBe(
      'WRONG_STATUS'
    );
  });

  it('гонка: сбор закончился между проверкой и удалением', async () => {
    asMock(prismaMock.storeRun.updateMany).mockResolvedValue({ count: 0 });

    await expect(errorCode(StoreRunService.deleteItem(10, 2))).resolves.toBe(
      'WRONG_STATUS'
    );
    expect(asMock(prismaMock.storeItem.delete)).not.toHaveBeenCalled();
  });
});

describe('startShopping', () => {
  it('инициатор переводит забег в покупку', async () => {
    await StoreRunService.startShopping(30, 1);

    expect(asMock(prismaMock.storeRun.updateMany)).toHaveBeenCalledWith({
      where: { id: 30, initiatorId: 1, status: 'COLLECTING' },
      data: { status: 'SHOPPING', shoppingAt: NOW },
    });
  });

  it('не инициатор перевести не может', async () => {
    await expect(errorCode(StoreRunService.startShopping(30, 99))).resolves.toBe(
      'FORBIDDEN'
    );
  });

  it('несуществующий забег перевести нельзя', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(null);

    await expect(errorCode(StoreRunService.startShopping(30, 1))).resolves.toBe(
      'NOT_FOUND'
    );
  });

  it('повторный переход отклоняется', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(
      run({ status: 'SHOPPING' })
    );

    await expect(errorCode(StoreRunService.startShopping(30, 1))).resolves.toBe(
      'WRONG_STATUS'
    );
  });

  it('гонка двух нажатий даёт один переход', async () => {
    asMock(prismaMock.storeRun.updateMany).mockResolvedValue({ count: 0 });

    await expect(errorCode(StoreRunService.startShopping(30, 1))).resolves.toBe(
      'WRONG_STATUS'
    );
  });
});

describe('setItemPrice', () => {
  function shopping(over: Record<string, unknown> = {}) {
    asMock(prismaMock.storeItem.findUnique).mockResolvedValue(
      item({ storeRun: { id: 30, status: 'SHOPPING', initiatorId: 1 }, ...over })
    );
  }

  it('цена сохраняется вместе со статусом BOUGHT', async () => {
    shopping();

    await StoreRunService.setItemPrice(10, 1, 150, 'BOUGHT');

    const call = asMock(prismaMock.storeItem.update).mock.calls[0][0] as {
      data: { status: string; price: Prisma.Decimal | null };
    };
    expect(call.data.status).toBe('BOUGHT');
    expect(Number(call.data.price)).toBe(150);
  });

  it('«купил» без цены — легальное промежуточное состояние', async () => {
    shopping();

    await StoreRunService.setItemPrice(10, 1, null, 'BOUGHT');

    expect(
      (
        asMock(prismaMock.storeItem.update).mock.calls[0][0] as {
          data: { price: unknown };
        }
      ).data.price
    ).toBeNull();
  });

  it('«не нашёл» цену не хранит, даже если её передали', async () => {
    shopping();

    await StoreRunService.setItemPrice(10, 1, 150, 'NOT_FOUND');

    expect(
      (
        asMock(prismaMock.storeItem.update).mock.calls[0][0] as {
          data: { price: unknown };
        }
      ).data.price
    ).toBeNull();
  });

  it('нулевая цена допустима: товар мог достаться бесплатно', async () => {
    shopping();

    await expect(
      StoreRunService.setItemPrice(10, 1, 0, 'BOUGHT')
    ).resolves.toBeDefined();
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 100_001])(
    'цена %p отклоняется',
    async price => {
      shopping();

      await expect(
        errorCode(StoreRunService.setItemPrice(10, 1, price, 'BOUGHT'))
      ).resolves.toBe('INVALID_INPUT');
    }
  );

  it('цены ставит только инициатор', async () => {
    shopping();

    await expect(
      errorCode(StoreRunService.setItemPrice(10, 99, 150, 'BOUGHT'))
    ).resolves.toBe('FORBIDDEN');
  });

  it('несуществующей позиции цену не поставить', async () => {
    asMock(prismaMock.storeItem.findUnique).mockResolvedValue(null);

    await expect(
      errorCode(StoreRunService.setItemPrice(10, 1, 150, 'BOUGHT'))
    ).resolves.toBe('NOT_FOUND');
  });

  it('до начала покупки цену не поставить', async () => {
    asMock(prismaMock.storeItem.findUnique).mockResolvedValue(item());

    await expect(
      errorCode(StoreRunService.setItemPrice(10, 1, 150, 'BOUGHT'))
    ).resolves.toBe('WRONG_STATUS');
  });

  it('после расчёта цену уже не поменять', async () => {
    shopping();
    asMock(prismaMock.storeRun.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      errorCode(StoreRunService.setItemPrice(10, 1, 150, 'BOUGHT'))
    ).resolves.toBe('WRONG_STATUS');
    expect(asMock(prismaMock.storeItem.update)).not.toHaveBeenCalled();
  });
});

describe('settle', () => {
  beforeEach(() => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(
      run({ status: 'SHOPPING' })
    );
    asMock(prismaMock.storeRun.findUniqueOrThrow).mockResolvedValue(
      run({ status: 'SETTLED' })
    );
  });

  it('забег закрывается и создаются долги', async () => {
    await StoreRunService.settle(30, 1);

    expect(asMock(prismaMock.storeRun.updateMany)).toHaveBeenCalledWith({
      where: { id: 30, initiatorId: 1, status: 'SHOPPING' },
      data: { status: 'SETTLED', settledAt: NOW },
    });
    /* Долги создаются ВНУТРИ транзакции забега: сюда передаётся tx-клиент, а не
       глобальный prisma. Проверяем через сами аргументы — deep-мок Prisma нельзя
       сравнивать через expect.anything(): у него авто-мокается любое свойство,
       включая asymmetricMatch, и jest принимает его за матчер. */
    const [runId, tx] = budget.createTransactionsForStoreRun.mock.calls[0];
    expect(runId).toBe(30);
    expect(tx).toBeDefined();
  });

  it('купленное без цены закрыть не даёт: чужая позиция не потеряется', async () => {
    asMock(prismaMock.storeItem.count).mockResolvedValue(2);

    await expect(errorCode(StoreRunService.settle(30, 1))).resolves.toBe(
      'INVALID_INPUT'
    );
    expect(budget.createTransactionsForStoreRun).not.toHaveBeenCalled();
  });

  it('позиции без цены считаются после перевода статуса — строка уже заблокирована', async () => {
    await StoreRunService.settle(30, 1);

    const updateOrder = asMock(prismaMock.storeRun.updateMany).mock
      .invocationCallOrder[0];
    const countOrder = asMock(prismaMock.storeItem.count).mock
      .invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(countOrder);
    expect(asMock(prismaMock.storeItem.count)).toHaveBeenCalledWith({
      where: { storeRunId: 30, status: 'BOUGHT', price: null },
    });
  });

  it('до начала покупки закрывать нечего', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(run());

    await expect(errorCode(StoreRunService.settle(30, 1))).resolves.toBe(
      'WRONG_STATUS'
    );
  });

  it('закрывает только инициатор', async () => {
    await expect(errorCode(StoreRunService.settle(30, 99))).resolves.toBe(
      'FORBIDDEN'
    );
  });

  it('гонка двух нажатий даёт один расчёт', async () => {
    asMock(prismaMock.storeRun.updateMany).mockResolvedValue({ count: 0 });

    await expect(errorCode(StoreRunService.settle(30, 1))).resolves.toBe(
      'WRONG_STATUS'
    );
    expect(budget.createTransactionsForStoreRun).not.toHaveBeenCalled();
  });

  it('сбой создания долгов оставляет забег незакрытым', async () => {
    budget.createTransactionsForStoreRun.mockRejectedValue(
      new Error('db down')
    );

    await expect(StoreRunService.settle(30, 1)).rejects.toThrow('db down');
  });
});

describe('cancelStoreRun', () => {
  it('забег на сборе отменяется', async () => {
    await StoreRunService.cancelStoreRun(30, 1);

    expect(asMock(prismaMock.storeRun.updateMany)).toHaveBeenCalledWith({
      where: { id: 30, initiatorId: 1, status: 'COLLECTING' },
      data: { status: 'CANCELLED', cancelledAt: NOW },
    });
  });

  it('после начала покупки отменять нельзя: деньги уже потрачены', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(
      run({ status: 'SHOPPING' })
    );

    await expect(errorCode(StoreRunService.cancelStoreRun(30, 1))).resolves.toBe(
      'WRONG_STATUS'
    );
  });

  it('отменяет только инициатор', async () => {
    await expect(errorCode(StoreRunService.cancelStoreRun(30, 99))).resolves.toBe(
      'FORBIDDEN'
    );
  });

  it('гонка: забег изменился до отмены', async () => {
    asMock(prismaMock.storeRun.updateMany).mockResolvedValue({ count: 0 });

    await expect(errorCode(StoreRunService.cancelStoreRun(30, 1))).resolves.toBe(
      'WRONG_STATUS'
    );
  });
});

describe('автоматические переходы по времени', () => {
  it('истёкший сбор переводится в покупку одним условным апдейтом', async () => {
    asMock(prismaMock.storeRun.updateManyAndReturn).mockResolvedValue([
      { id: 30 },
      { id: 31 },
    ]);

    await expect(StoreRunService.autoCloseExpired()).resolves.toEqual([30, 31]);
    expect(asMock(prismaMock.storeRun.updateManyAndReturn)).toHaveBeenCalledWith({
      where: { status: 'COLLECTING', collectUntil: { lt: NOW } },
      data: { status: 'SHOPPING', shoppingAt: NOW },
      select: { id: true },
    });
  });

  it('нечего закрывать — событий нет', async () => {
    await expect(StoreRunService.autoCloseExpired()).resolves.toEqual([]);

    expect(bus.emit).not.toHaveBeenCalled();
  });

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

  it('зависший в покупке забег отменяется по таймауту', async () => {
    asMock(prismaMock.storeRun.updateManyAndReturn).mockResolvedValue([
      { id: 30 },
    ]);

    await expect(StoreRunService.expireStaleShoppingRuns()).resolves.toEqual([
      30,
    ]);
    expect(asMock(prismaMock.storeRun.updateManyAndReturn)).toHaveBeenCalledWith({
      where: {
        status: 'SHOPPING',
        shoppingAt: { lt: new Date('2026-08-03T09:00:00.000Z') },
      },
      data: { status: 'CANCELLED', cancelledAt: NOW },
      select: { id: true },
    });
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

  it('нечего отменять — событий нет', async () => {
    await expect(StoreRunService.expireStaleShoppingRuns()).resolves.toEqual([]);

    expect(bus.emit).not.toHaveBeenCalled();
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
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to emit store_run_updated',
      expect.objectContaining({ storeRunId: 30 })
    );
  });

  it('исчезнувший забег события не порождает', async () => {
    asMock(prismaMock.storeRun.updateManyAndReturn).mockResolvedValue([
      { id: 30 },
    ]);
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(null);

    await StoreRunService.autoCloseExpired();

    expect(bus.emit).not.toHaveBeenCalled();
  });
});
