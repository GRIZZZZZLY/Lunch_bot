/**
 * Очередь исходящих уведомлений на НАСТОЯЩЕЙ PostgreSQL.
 *
 * Эти свойства принципиально нельзя проверить на подставной БД:
 *
 * 1. `FOR UPDATE SKIP LOCKED` в `claim` — два обработчика не должны забрать
 *    одно задание. Мок проверил бы только текст запроса, а не поведение
 *    блокировок; именно так в проекте уже был сырой SQL, ни разу локально не
 *    исполнявшийся.
 * 2. Уникальный индекс события: повтор постановки того же перехода не создаёт
 *    второе задание, а новая версия перехода — создаёт.
 * 3. Атомарность: откат транзакции перехода уносит и задание.
 */
import { prisma } from '../../database/client';
import {
  CLAIM_LEASE_MS,
  MAX_ATTEMPTS,
  OUTBOX_ENTITY_TRANSACTION,
  OutboxService,
} from '../../services/outbox.service';

function uniqueTelegramId(): bigint {
  return BigInt(
    `92${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`
  );
}

/** Долг с людьми и группой — минимум, который принимают внешние ключи. */
async function createDebt(): Promise<{ txId: number; cleanup: () => Promise<void> }> {
  const debtor = await prisma.user.create({
    data: { telegramId: uniqueTelegramId(), firstName: 'Outbox debtor' },
  });
  const payee = await prisma.user.create({
    data: { telegramId: uniqueTelegramId(), firstName: 'Outbox payee' },
  });
  const group = await prisma.group.create({
    data: { telegramId: uniqueTelegramId(), title: 'Outbox group' },
  });
  const poll = await prisma.poll.create({
    data: { groupId: group.id, status: 'COMPLETED', createdBy: debtor.id },
  });
  const tx = await prisma.transaction.create({
    data: {
      pollId: poll.id,
      fromUserId: debtor.id,
      toUserId: payee.id,
      amount: 250,
      status: 'PENDING',
    },
  });

  return {
    txId: tx.id,
    cleanup: async () => {
      await prisma.outboxEvent.deleteMany({
        where: { entityType: OUTBOX_ENTITY_TRANSACTION, entityId: tx.id },
      });
      await prisma.transaction.delete({ where: { id: tx.id } });
      await prisma.poll.delete({ where: { id: poll.id } });
      await prisma.group.delete({ where: { id: group.id } });
      await prisma.user.delete({ where: { id: debtor.id } });
      await prisma.user.delete({ where: { id: payee.id } });
    },
  };
}

/** Задание на уведомление одного адресата. */
async function enqueueOne(
  id: number,
  transitionVersion = 1,
  chatId = '777'
): Promise<number[]> {
  /* Явная аннотация: у `$transaction` есть перегрузка для МАССИВА обещаний, и
     колбэк, возвращающий `Promise<number[]>`, попадает в неё вместо
     интерактивной. */
  const ids: number[] = await prisma.$transaction(async tx =>
    OutboxService.enqueue(tx, {
      entityType: OUTBOX_ENTITY_TRANSACTION,
      entityId: id,
      transitionVersion,
      messageType: 'DEBT_MARKED_PAID',
      recipients: [{ chatId, payload: { amount: '250' } }],
    })
  );

  return ids;
}

/**
 * Захват СВОЕГО задания.
 *
 * Не `claim()`: очередь общая на весь прогон, и при параллельных воркерах
 * jest (`maxWorkers: '50%'` локально) соседний тест забрал бы задание себе.
 * `claimByIds` использует то же условие блокировки, поэтому проверяемое
 * свойство не меняется, а тест перестаёт зависеть от чужих заданий.
 */
async function claimMine(id: number) {
  const [event] = await OutboxService.claimByIds([id]);
  return event;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('постановка задания', () => {
  it('повтор того же перехода не создаёт второе задание', async () => {
    const debt = await createDebt();
    try {
      await expect(enqueueOne(debt.txId, 1)).resolves.toHaveLength(1);
      /* Повтор API-запроса: тот же переход, тот же адресат. */
      await expect(enqueueOne(debt.txId, 1)).resolves.toHaveLength(0);

      const rows = await prisma.outboxEvent.count({
        where: { entityType: OUTBOX_ENTITY_TRANSACTION, entityId: debt.txId },
      });
      expect(rows).toBe(1);
    } finally {
      await debt.cleanup();
    }
  });

  /* Цепочка CONFIRMED → PAID → CONFIRMED содержит два РАЗНЫХ законных
     подтверждения. Пара «id долга + статус» их не различает, версия — да. */
  it('новая версия перехода создаёт новое задание', async () => {
    const debt = await createDebt();
    try {
      const ids = await enqueueOne(debt.txId, 1);
      await expect(enqueueOne(debt.txId, 2)).resolves.toHaveLength(1);

      const rows = await prisma.outboxEvent.count({
        where: { entityType: OUTBOX_ENTITY_TRANSACTION, entityId: debt.txId },
      });
      expect(rows).toBe(2);
    } finally {
      await debt.cleanup();
    }
  });

  it('у каждого адресата своё задание', async () => {
    const debt = await createDebt();
    try {
      const created: number[] = await prisma.$transaction(async tx =>
        OutboxService.enqueue(tx, {
          entityType: OUTBOX_ENTITY_TRANSACTION,
          entityId: debt.txId,
          transitionVersion: 1,
          messageType: 'DEBT_MARKED_PAID',
          recipients: [
            { chatId: '777', payload: {} },
            { chatId: '888', payload: {} },
          ],
        })
      );

      expect(created).toHaveLength(2);
    } finally {
      await debt.cleanup();
    }
  });

  /* Смысл всей затеи: задание живёт в транзакции перехода. Если переход
     откатился, задания быть не должно — иначе уведомим о том, чего не было. */
  it('откат транзакции перехода уносит задание', async () => {
    const debt = await createDebt();
    try {
      await expect(
        prisma.$transaction(async tx => {
          await OutboxService.enqueue(tx, {
            entityType: OUTBOX_ENTITY_TRANSACTION,
            entityId: debt.txId,
            transitionVersion: 1,
            messageType: 'DEBT_MARKED_PAID',
            recipients: [{ chatId: '777', payload: {} }],
          });
          throw new Error('переход не удался');
        })
      ).rejects.toThrow('переход не удался');

      const rows = await prisma.outboxEvent.count({
        where: { entityType: OUTBOX_ENTITY_TRANSACTION, entityId: debt.txId },
      });
      expect(rows).toBe(0);
    } finally {
      await debt.cleanup();
    }
  });
});

describe('захват заданий', () => {
  it('два одновременных обработчика не берут одно задание', async () => {
    const debt = await createDebt();
    try {
      const [id] = await enqueueOne(debt.txId, 1, '777');

      const [first, second] = await Promise.all([
        OutboxService.claimByIds([id]),
        OutboxService.claimByIds([id]),
      ]);

      /* Ровно один из двух получил задание. Это и есть смысл
         `FOR UPDATE SKIP LOCKED`: второй не ждёт на той же строке и не
         забирает её повторно, иначе сообщение ушло бы дважды. */
      expect(first.length + second.length).toBe(1);
    } finally {
      await debt.cleanup();
    }
  });

  /* Путь обработчика: `claim` без списка id. Утверждение сформулировано о
     СТРОКЕ, а не о возвращённом наборе: очередь общая на весь прогон, и при
     параллельных воркерах задание мог забрать соседний тест. Кто бы его ни
     забрал, в строке останется след захвата — именно это и проверяется. */
  it('обработчик забирает ожидающее задание', async () => {
    const debt = await createDebt();
    try {
      const ids = await enqueueOne(debt.txId, 1);

      await OutboxService.claim(100);

      const row = await prisma.outboxEvent.findUnique({
        where: { id: ids[0] },
      });
      expect(row!.attempts).toBe(1);
      expect(row!.claimedUntil).not.toBeNull();
    } finally {
      await debt.cleanup();
    }
  });

  it('захваченное задание не выдаётся повторно, пока держится срок', async () => {
    const debt = await createDebt();
    try {
      const ids = await enqueueOne(debt.txId, 1);

      const claimed = await OutboxService.claimByIds([ids[0]]);
      expect(claimed).toHaveLength(1);

      const again = await OutboxService.claimByIds([ids[0]]);
      expect(again).toHaveLength(0);
    } finally {
      await debt.cleanup();
    }
  });

  /* Перезапуск посреди обработки не должен оставлять задание захваченным
     навсегда: срок истекает, и оно снова свободно. */
  it('истёкший срок захвата освобождает задание', async () => {
    const debt = await createDebt();
    try {
      const ids = await enqueueOne(debt.txId, 1);
      const claimed = await claimMine(ids[0]);
      expect(claimed).toBeDefined();

      await prisma.outboxEvent.update({
        where: { id: claimed.id },
        data: { claimedUntil: new Date(Date.now() - 1_000) },
      });

      const again = await OutboxService.claimByIds([claimed.id]);
      expect(again).toHaveLength(1);
    } finally {
      await debt.cleanup();
    }
  });

  it('захват увеличивает счётчик попыток', async () => {
    const debt = await createDebt();
    try {
      const ids = await enqueueOne(debt.txId, 1);
      const claimed = await claimMine(ids[0]);

      expect(claimed.attempts).toBe(1);
      expect(claimed.claimedUntil!.getTime()).toBeGreaterThan(Date.now());
      expect(claimed.claimedUntil!.getTime()).toBeLessThanOrEqual(
        Date.now() + CLAIM_LEASE_MS + 5_000
      );
    } finally {
      await debt.cleanup();
    }
  });

  it('задание с отложенной попыткой не берётся раньше срока', async () => {
    const debt = await createDebt();
    try {
      const ids = await enqueueOne(debt.txId, 1);
      await prisma.outboxEvent.updateMany({
        where: { entityId: debt.txId },
        data: { nextAttemptAt: new Date(Date.now() + 60_000) },
      });

      const claimed = await OutboxService.claimByIds([ids[0]]);
      expect(claimed).toHaveLength(0);
    } finally {
      await debt.cleanup();
    }
  });
});

describe('итог обработки', () => {
  it('доставленное задание запоминает message_id', async () => {
    const debt = await createDebt();
    try {
      const ids = await enqueueOne(debt.txId, 1);
      const claimed = await claimMine(ids[0]);

      await OutboxService.markSent(claimed.id, 4242);

      const row = await prisma.outboxEvent.findUnique({
        where: { id: claimed.id },
      });
      expect(row!.status).toBe('SENT');
      expect(row!.sentMessageId).toBe(4242);
      expect(row!.claimedUntil).toBeNull();
      expect(row!.sentAt).not.toBeNull();
    } finally {
      await debt.cleanup();
    }
  });

  it('временная ошибка возвращает задание в очередь с отсрочкой', async () => {
    const debt = await createDebt();
    try {
      const ids = await enqueueOne(debt.txId, 1);
      const claimed = await claimMine(ids[0]);

      await OutboxService.markFailed(
        claimed,
        Object.assign(new Error('Bad Gateway'), { error_code: 502 })
      );

      const row = await prisma.outboxEvent.findUnique({
        where: { id: claimed.id },
      });
      expect(row!.status).toBe('PENDING');
      expect(row!.lastErrorCategory).toBe('telegram_unavailable');
      expect(row!.lastErrorCode).toBe(502);
      expect(row!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
      expect(row!.claimedUntil).toBeNull();
    } finally {
      await debt.cleanup();
    }
  });

  /* Адресат заблокировал бота — повторять бессмысленно. Задание уходит в
     диагностируемое конечное состояние, а не крутится вечно. */
  it('постоянная ошибка адресата закрывает задание', async () => {
    const debt = await createDebt();
    try {
      const ids = await enqueueOne(debt.txId, 1);
      const claimed = await claimMine(ids[0]);

      await OutboxService.markFailed(
        claimed,
        Object.assign(new Error('Forbidden'), { error_code: 403 })
      );

      const row = await prisma.outboxEvent.findUnique({
        where: { id: claimed.id },
      });
      expect(row!.status).toBe('FAILED');
      expect(row!.lastErrorCategory).toBe('blocked_by_recipient');
    } finally {
      await debt.cleanup();
    }
  });

  it('исчерпанные попытки закрывают задание даже при временной ошибке', async () => {
    const debt = await createDebt();
    try {
      const ids = await enqueueOne(debt.txId, 1);
      const claimed = await claimMine(ids[0]);
      const exhausted = { ...claimed, attempts: MAX_ATTEMPTS };

      await OutboxService.markFailed(
        exhausted,
        Object.assign(new Error('Bad Gateway'), { error_code: 502 })
      );

      const row = await prisma.outboxEvent.findUnique({
        where: { id: claimed.id },
      });
      expect(row!.status).toBe('FAILED');
    } finally {
      await debt.cleanup();
    }
  });

  it('окончательно неуспешное задание можно вернуть в очередь', async () => {
    const debt = await createDebt();
    try {
      const ids = await enqueueOne(debt.txId, 1);
      const claimed = await claimMine(ids[0]);
      await OutboxService.markFailed(
        claimed,
        Object.assign(new Error('Forbidden'), { error_code: 403 })
      );

      await expect(OutboxService.retryFailed([claimed.id])).resolves.toBe(1);

      const row = await prisma.outboxEvent.findUnique({
        where: { id: claimed.id },
      });
      expect(row!.status).toBe('PENDING');
      expect(row!.attempts).toBe(0);
    } finally {
      await debt.cleanup();
    }
  });
});

describe('устаревшие версии', () => {
  it('задание отстающей версии признаётся устаревшим', async () => {
    const debt = await createDebt();
    try {
      const ids = await enqueueOne(debt.txId, 1);
      const claimed = await claimMine(ids[0]);

      /* Долг успел уйти вперёд: например, подтверждение уже отменили. */
      await prisma.transaction.update({
        where: { id: debt.txId },
        data: { transitionVersion: 2 },
      });

      await expect(OutboxService.isCurrentVersion(claimed)).resolves.toBe(false);

      await OutboxService.markSuperseded(claimed.id);
      const row = await prisma.outboxEvent.findUnique({
        where: { id: claimed.id },
      });
      expect(row!.status).toBe('SUPERSEDED');
    } finally {
      await debt.cleanup();
    }
  });

  it('актуальная версия проходит проверку', async () => {
    const debt = await createDebt();
    try {
      await prisma.transaction.update({
        where: { id: debt.txId },
        data: { transitionVersion: 1 },
      });
      const ids = await enqueueOne(debt.txId, 1);
      const claimed = await claimMine(ids[0]);

      await expect(OutboxService.isCurrentVersion(claimed)).resolves.toBe(true);
    } finally {
      await debt.cleanup();
    }
  });

  it('удалённый долг снимает задание с обработки', async () => {
    const debt = await createDebt();
    const ids = await enqueueOne(debt.txId, 1);
    const claimed = await claimMine(ids[0]);
    await debt.cleanup();

    await expect(OutboxService.isCurrentVersion(claimed)).resolves.toBe(false);
  });
});

describe('показатели', () => {
  it('ожидающие задания видны в показателях', async () => {
    const debt = await createDebt();
    try {
      const before = await OutboxService.stats();
      const ids = await enqueueOne(debt.txId, 1);
      const after = await OutboxService.stats();

      expect(after.pending).toBe(before.pending + 1);
      expect(after.oldestPendingAgeSeconds).toBeGreaterThanOrEqual(0);
    } finally {
      await debt.cleanup();
    }
  });
});
