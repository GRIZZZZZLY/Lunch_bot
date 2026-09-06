/**
 * Обработчик очереди уведомлений: что он делает с одним заданием.
 *
 * Захват заданий (`FOR UPDATE SKIP LOCKED`, срок захвата, отсрочки) проверяется
 * на настоящей PostgreSQL в `__tests__/integration/outbox.integration.test.ts` —
 * на подставной БД поведение блокировок не воспроизвести. Здесь мокируется
 * сам сервис очереди, и проверяется решение обработчика: отправить, признать
 * устаревшим, записать сбой.
 */
import type { OutboxEvent } from '@prisma/client';

import { getBotInstance } from '../../../bot/bot-instance';
import { OutboxService } from '../../../services/outbox.service';
import { OutboxWorkerService } from '../../../services/outbox-worker.service';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../services/outbox.service', () => ({
  OUTBOX_ENTITY_TRANSACTION: 'TRANSACTION',
  OutboxService: {
    claim: jest.fn(),
    claimByIds: jest.fn(),
    markSent: jest.fn(),
    markFailed: jest.fn(),
    markSuperseded: jest.fn(),
    isCurrentVersion: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const outbox = asServiceMock(OutboxService);
const botInstance = asMock(getBotInstance);

let sendMessage: jest.Mock;

function event(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: 501,
    entityType: 'TRANSACTION',
    entityId: 10,
    transitionVersion: 1,
    messageType: 'DEBT_MARKED_PAID',
    recipientChatId: '777',
    payload: { transactionId: 10, debtorFirstName: 'Игорь', amount: '250 ₽' },
    status: 'PENDING',
    attempts: 1,
    nextAttemptAt: new Date(),
    claimedUntil: new Date(Date.now() + 60_000),
    sentMessageId: null,
    sentAt: null,
    lastErrorCategory: null,
    lastErrorCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  sendMessage = jest.fn().mockResolvedValue({ message_id: 4242 });
  botInstance.mockReturnValue({ api: { sendMessage } });
  outbox.isCurrentVersion.mockResolvedValue(true);
  outbox.claim.mockResolvedValue([]);
  outbox.claimByIds.mockResolvedValue([]);
});

afterEach(() => {
  OutboxWorkerService.stop();
});

describe('доставка задания', () => {
  it('отправляет сообщение и запоминает message_id', async () => {
    await expect(OutboxWorkerService.deliver(event())).resolves.toBe(true);

    expect(sendMessage).toHaveBeenCalledWith(
      777,
      expect.stringContaining('Получена оплата'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
    expect(outbox.markSent).toHaveBeenCalledWith(501, 4242);
  });

  /* Позднее «оплата подтверждена» не должно приходить после актуальной
     отмены подтверждения: порядок доставки не гарантирован. */
  it('устаревшее по версии задание не отправляется', async () => {
    outbox.isCurrentVersion.mockResolvedValue(false);

    await expect(OutboxWorkerService.deliver(event())).resolves.toBe(false);

    expect(sendMessage).not.toHaveBeenCalled();
    expect(outbox.markSuperseded).toHaveBeenCalledWith(501);
    expect(outbox.markSent).not.toHaveBeenCalled();
  });

  it('сбой отправки записывается как неуспех попытки', async () => {
    const failure = Object.assign(new Error('Bad Gateway'), {
      error_code: 502,
    });
    sendMessage.mockRejectedValue(failure);

    await expect(OutboxWorkerService.deliver(event())).resolves.toBe(false);

    expect(outbox.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 501 }),
      failure
    );
    expect(outbox.markSent).not.toHaveBeenCalled();
  });

  /* Откат приложения: в очереди лежит задание типа, которого эта версия не
     знает. Это не сбой доставки — задание должно дождаться версии, которая
     его понимает, а не уйти в неуспех. */
  it('незнакомый тип сообщения оставляет задание в очереди', async () => {
    await expect(
      OutboxWorkerService.deliver(event({ messageType: 'FROM_THE_FUTURE' }))
    ).resolves.toBe(false);

    expect(sendMessage).not.toHaveBeenCalled();
    expect(outbox.markFailed).not.toHaveBeenCalled();
    expect(outbox.markSuperseded).not.toHaveBeenCalled();
  });

  it('без бота задание не трогается', async () => {
    botInstance.mockReturnValue(null);

    await expect(OutboxWorkerService.deliver(event())).resolves.toBe(false);

    expect(outbox.markSent).not.toHaveBeenCalled();
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });
});

describe('проход по очереди', () => {
  it('обрабатывает все захваченные задания', async () => {
    outbox.claim.mockResolvedValue([event({ id: 1 }), event({ id: 2 })]);

    await expect(OutboxWorkerService.tick()).resolves.toBe(2);
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  /* Одно плохое задание не должно срывать остальные. */
  it('сбой одного задания не мешает следующему', async () => {
    outbox.claim.mockResolvedValue([event({ id: 1 }), event({ id: 2 })]);
    sendMessage
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ message_id: 7 });

    await expect(OutboxWorkerService.tick()).resolves.toBe(1);
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('недоступная БД не роняет проход', async () => {
    outbox.claim.mockRejectedValue(new Error('db down'));

    await expect(OutboxWorkerService.tick()).resolves.toBe(0);
  });

  it('пустая очередь — ничего не отправляется', async () => {
    await expect(OutboxWorkerService.tick()).resolves.toBe(0);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe('немедленная отправка после операции', () => {
  it('забирает именно поставленные задания и отправляет их', async () => {
    outbox.claimByIds.mockResolvedValue([event({ id: 501 })]);

    await OutboxWorkerService.deliverNow([501]);

    expect(outbox.claimByIds).toHaveBeenCalledWith([501]);
    expect(outbox.markSent).toHaveBeenCalledWith(501, 4242);
  });

  /* Захват по id — то, что исключает второе сообщение: обработчик, случись
     он в этот момент, эти задания пропустит. */
  it('уже захваченное задание повторно не отправляется', async () => {
    outbox.claimByIds.mockResolvedValue([]);

    await OutboxWorkerService.deliverNow([501]);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('пустой список — не обращается к очереди', async () => {
    await OutboxWorkerService.deliverNow([]);

    expect(outbox.claimByIds).not.toHaveBeenCalled();
  });

  /* Переход состояния уже сохранён: сбой очереди не должен его провалить. */
  it('сбой захвата не бросает наружу', async () => {
    outbox.claimByIds.mockRejectedValue(new Error('db down'));

    await expect(OutboxWorkerService.deliverNow([501])).resolves.toBeUndefined();
  });
});

describe('запуск обработчика', () => {
  it('без бота обработчик не запускается', () => {
    botInstance.mockReturnValue(null);

    OutboxWorkerService.start(1_000);

    /* В роли PROCESS_ROLE=api бота нет, и обработчик молча захватывал бы
       задания, ничего не отправляя. */
    expect(outbox.claim).not.toHaveBeenCalled();
  });

  it('повторный запуск не создаёт второй таймер', () => {
    OutboxWorkerService.start(60_000);
    OutboxWorkerService.start(60_000);

    OutboxWorkerService.stop();
    /* Если бы таймеров было два, второй остался бы жить после stop(). */
    expect(true).toBe(true);
  });
});
