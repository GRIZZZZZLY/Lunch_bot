/**
 * PollFlowService: превращение результатов голосования в долги и рассылка
 * уведомлений (ответственному, должникам, группе). Это деньги, поэтому
 * закреплены именно те свойства, потеря которых стоит денег:
 *
 * - создание транзакций идемпотентно: повторный вызов не удваивает долги;
 * - ответственный не платит сам себе;
 * - падение уведомлений (best-effort) не откатывает уже созданные долги.
 *
 * Переходы статусов долга (markAsPaid/confirmPayment/undoConfirmation/...)
 * остались на BudgetService — покрыты в budget-static.service.test.ts.
 */
import { PollFlowService } from '../../../services/poll-flow.service';
import { PollService } from '../../../services/poll.service';
import { UserService } from '../../../services/user.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';
import { PollQueryService } from '../../../services/poll-query.service';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/poll.service', () => ({
  PollService: { getPollById: jest.fn() },
}));

jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: {
    getPollById: jest.fn(),
  },
}));


jest.mock('../../../services/user.service', () => ({
  UserService: { getPaymentInfo: jest.fn(), getUserById: jest.fn() },
}));

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const pollService = asServiceMock(PollService);
const pollQuery = asServiceMock(PollQueryService);
const userService = asServiceMock(UserService);
const botInstance = asMock(getBotInstance);

const NOW = new Date('2026-08-03T12:00:00.000Z');

/** Результаты голосования: Плов на двоих, один принёс своё. */
const RESULT_DATA = {
  winners: [
    {
      menuItemId: 1,
      menuItemName: 'Плов',
      voteCount: 2,
      menuItemSnapshot: { price: 250 },
      voters: [
        { userId: 1, firstName: 'Игорь' },
        { userId: 2, firstName: 'Аня' },
      ],
    },
  ],
  bringOwn: { count: 1, voters: [{ firstName: 'Оля' }] },
};

function pollFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    groupId: 100,
    result: { rouletteData: JSON.stringify(RESULT_DATA) },
    ...overrides,
  };
}

function txFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    pollId: 5,
    fromUserId: 1,
    toUserId: 2,
    amount: 250,
    status: 'PENDING',
    confirmedAt: null,
    debtMessageId: null,
    debtChatId: null,
    fromUser: { id: 1, firstName: 'Игорь', username: 'igor', telegramId: BigInt(555) },
    toUser: { id: 2, firstName: 'Аня', telegramId: BigInt(777) },
    menuItem: { id: 1, name: 'Плов', price: 250 },
    ...overrides,
  };
}

let sendMessage: jest.Mock;
let editMessageText: jest.Mock;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  sendMessage = jest.fn().mockResolvedValue({ message_id: 42 });
  editMessageText = jest.fn().mockResolvedValue(undefined);
  botInstance.mockReturnValue({ api: { sendMessage, editMessageText } });

  pollQuery.getPollById.mockResolvedValue(pollFixture());
  userService.getPaymentInfo.mockResolvedValue({
    paymentCard: '1234567890123456',
    paymentPhone: '+79990001122',
    paymentDetails: 'СБП',
  });
  userService.getUserById.mockResolvedValue({
    id: 2,
    firstName: 'Аня',
    lastName: null,
    telegramId: BigInt(777),
  });

  asMock(prismaMock.transaction.count).mockResolvedValue(0);
  asMock(prismaMock.transaction.createMany).mockResolvedValue({
    count: 1,
  });
  asMock(prismaMock.transaction.findMany).mockResolvedValue([
    txFixture(),
  ] as never);
  asMock(prismaMock.responsibleSelection.findUnique).mockResolvedValue({
    messageId: 42,
    chatId: BigInt(-1001),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('createTransactionsFromPoll', () => {
  it('создаёт долг каждому, кроме ответственного', async () => {
    await PollFlowService.createTransactionsFromPoll(5, 2);

    expect(prismaMock.transaction.createMany).toHaveBeenCalledWith({
      data: [
        {
          pollId: 5,
          fromUserId: 1,
          toUserId: 2,
          amount: 250,
          menuItemId: 1,
          status: 'PENDING',
        },
      ],
    });
  });

  it('повторный вызов не удваивает долги', async () => {
    asMock(prismaMock.transaction.count).mockResolvedValue(2);

    await PollFlowService.createTransactionsFromPoll(5, 2);

    expect(prismaMock.transaction.createMany).not.toHaveBeenCalled();
  });

  it('без должников (все — ответственный) вставки нет', async () => {
    pollQuery.getPollById.mockResolvedValue(
      pollFixture({
        result: {
          rouletteData: JSON.stringify({
            winners: [
              {
                menuItemId: 1,
                menuItemName: 'Плов',
                voteCount: 1,
                menuItemSnapshot: { price: 250 },
                voters: [{ userId: 2, firstName: 'Аня' }],
              },
            ],
            bringOwn: { count: 0, voters: [] },
          }),
        },
      })
    );

    await PollFlowService.createTransactionsFromPoll(5, 2);

    expect(prismaMock.transaction.createMany).not.toHaveBeenCalled();
  });

  it('без результатов голосования — понятная ошибка', async () => {
    pollQuery.getPollById.mockResolvedValue(pollFixture({ result: null }));

    await expect(
      PollFlowService.createTransactionsFromPoll(5, 2)
    ).rejects.toThrow('Poll result data not found');
  });
});

describe('calculateTotals', () => {
  it('считает сумму заказа, долю ответственного и возврат', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture({ amount: 250 }),
    ] as never);

    const totals = await PollFlowService.calculateTotals(5, 2);

    expect(totals).toEqual({
      totalOrder: 500,
      totalToReturn: 250,
      responsibleShare: 250,
      netCost: 250,
    });
  });

  it('ответственный без заказа имеет нулевую долю', async () => {
    const totals = await PollFlowService.calculateTotals(5, 99);

    expect(totals.responsibleShare).toBe(0);
  });

  it('без результатов — ошибка', async () => {
    pollQuery.getPollById.mockResolvedValue(pollFixture({ result: null }));

    await expect(PollFlowService.calculateTotals(5, 2)).rejects.toThrow(
      'Poll result data not found'
    );
  });
});

describe('processResponsibleSelected', () => {
  it('создаёт долги и рассылает уведомления', async () => {
    await PollFlowService.processResponsibleSelected(5, 2);

    expect(prismaMock.transaction.createMany).toHaveBeenCalled();
    // Ответственному и должнику.
    expect(sendMessage).toHaveBeenCalled();
  });

  it('падение записи в базу выбрасывается наружу — вызывающий повторит', async () => {
    asMock(prismaMock.transaction.createMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      PollFlowService.processResponsibleSelected(5, 2)
    ).rejects.toThrow('db down');
  });

  it('падение уведомлений не откатывает уже созданные долги', async () => {
    sendMessage.mockRejectedValue(new Error('telegram down'));

    await expect(
      PollFlowService.processResponsibleSelected(5, 2)
    ).resolves.toBeUndefined();
    expect(prismaMock.transaction.createMany).toHaveBeenCalled();
  });
});

describe('sendBudgetNotifications', () => {
  it('ответственный получает список заказов и итоги', async () => {
    await PollFlowService.sendBudgetNotifications(5, 2, [txFixture()]);

    const responsibleMessage = sendMessage.mock.calls[0][1] as string;
    expect(responsibleMessage).toContain('Ты оформляешь заказ');
    expect(responsibleMessage).toContain('Плов — 2 чел. (500.00₽)');
    expect(responsibleMessage).toContain('Своё: Оля');
    expect(responsibleMessage).toContain('Сумма заказа: 500.00₽');
  });

  it('карта ответственного показывается ему замаскированной', async () => {
    await PollFlowService.sendBudgetNotifications(5, 2, [txFixture()]);

    const responsibleMessage = sendMessage.mock.calls[0][1] as string;
    expect(responsibleMessage).not.toContain('1234567890123456');
  });

  it('должник получает сумму и реквизиты', async () => {
    await PollFlowService.sendBudgetNotifications(5, 2, [txFixture()]);

    const debtMessage = sendMessage.mock.calls[1][1] as string;
    expect(debtMessage).toContain('Твой заказ: Плов');
    expect(debtMessage).toContain('Ответственный:* Аня');
    expect(debtMessage).toContain('+79990001122');
    expect(debtMessage).toContain('СБП');
  });

  it('должник получает кнопку со ссылкой СБП, а не маску карты, когда реквизит — ссылка', async () => {
    userService.getPaymentInfo.mockResolvedValue({
      paymentCard: 'https://qr.nspk.ru/AS1A00',
      paymentPhone: null,
      paymentDetails: null,
    });

    await PollFlowService.sendBudgetNotifications(5, 2, [txFixture()]);

    const debtCall = sendMessage.mock.calls[1];
    const debtMessage = debtCall[1] as string;
    const debtOptions = debtCall[2] as {
      reply_markup: { inline_keyboard: { text: string; url?: string; callback_data?: string }[][] };
    };
    expect(debtMessage).not.toContain('****');
    expect(debtOptions.reply_markup.inline_keyboard[0][0]).toEqual({
      text: '💳 Перевести по ссылке',
      url: 'https://qr.nspk.ru/AS1A00',
    });
    expect(debtOptions.reply_markup.inline_keyboard[1][0]).toEqual({
      text: 'Оплатил(а) ✅',
      callback_data: `budget:mark_paid:${txFixture().id}`,
    });
  });

  it('групповое сообщение обновляется итогами', async () => {
    await PollFlowService.sendBudgetNotifications(5, 2, [txFixture()]);

    expect(editMessageText).toHaveBeenCalledWith(
      -1001,
      42,
      expect.stringContaining('Ответственный:* Аня'),
      { parse_mode: 'Markdown' }
    );
  });

  it('без сообщения выбора группу не правим', async () => {
    asMock(prismaMock.responsibleSelection.findUnique).mockResolvedValue(
      null
    );

    await PollFlowService.sendBudgetNotifications(5, 2, [txFixture()]);

    expect(editMessageText).not.toHaveBeenCalled();
  });

  it('неизвестный ответственный останавливает рассылку', async () => {
    userService.getUserById.mockResolvedValue(null);

    await PollFlowService.sendBudgetNotifications(5, 2, [txFixture()]);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('ответственный без реквизитов всё равно получает сводку', async () => {
    userService.getPaymentInfo.mockResolvedValue(null);

    await PollFlowService.sendBudgetNotifications(5, 2, [txFixture()]);

    expect(sendMessage.mock.calls[0][1]).toContain('Ты оформляешь заказ');
  });
});

/**
 * Guard «бота нет» проверял ССЫЛКУ на локальный хелпер `botInstance`, а не
 * результат вызова, поэтому ветка отказа была недостижима и код падал ниже
 * на `botInstance()!.api` с TypeError. Долги уже созданы — рассылка
 * best-effort и обязана тихо пропускаться.
 */
describe('бота нет', () => {
  beforeEach(() => {
    botInstance.mockReturnValue(null);
  });

  it('sendBudgetNotifications выходит тихо и не читает БД', async () => {
    await expect(
      PollFlowService.sendBudgetNotifications(5, 2, [txFixture()])
    ).resolves.toBeUndefined();

    expect(userService.getPaymentInfo).not.toHaveBeenCalled();
    expect(pollQuery.getPollById).not.toHaveBeenCalled();
  });

  it('каждое уведомление проверяет бота само', async () => {
    await expect(
      PollFlowService.sendResponsibleNotification(
        5,
        { id: 2, telegramId: BigInt(777), firstName: 'Аня' } as never,
        [txFixture() as never],
        { totalOrder: 500, responsibleShare: 250, totalToReturn: 250 }
      )
    ).resolves.toBeUndefined();

    await expect(
      PollFlowService.updateGroupMessage(
        5,
        { id: 2, telegramId: BigInt(777), firstName: 'Аня' } as never,
        { totalOrder: 500 }
      )
    ).resolves.toBeUndefined();
  });
});
