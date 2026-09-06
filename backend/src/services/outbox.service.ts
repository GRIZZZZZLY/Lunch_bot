/**
 * Очередь исходящих уведомлений (transactional outbox).
 *
 * Зачем. Переход статуса долга писался в PostgreSQL, а сообщение уходило в
 * Telegram отдельным вызовом сразу после. `utils/post-commit.ts` закрыл худшее
 * следствие сбоя в этом окне — операция больше не выглядит проваленной, — но
 * само уведомление всё равно терялось безвозвратно: ни повтора, ни следа.
 * Здесь задание на уведомление сохраняется В ТОЙ ЖЕ транзакции, что и переход
 * состояния, поэтому «статус записан, а уведомить некому» становится
 * невозможным состоянием.
 *
 * Что этот слой НЕ обещает. Между отправкой в Telegram и записью результата в
 * БД остаётся окно, в котором падение процесса приведёт к повторной отправке
 * того же сообщения. Гарантия здесь «хотя бы один раз», и обещать «ровно один»
 * нельзя. Дубль уменьшается сохранением `sentMessageId`: следующее уведомление
 * по тому же долгу правит существующее сообщение вместо отправки нового.
 *
 * Внешние вызовы Telegram внутри транзакции БД не делаются никогда: транзакция
 * держала бы соединение всё время сетевого запроса.
 */
import { Prisma, type OutboxEvent } from '@prisma/client';

import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { classifyDeliveryError } from '../utils/post-commit';

/** Клиент внутри `prisma.$transaction` — у него нет вложенных транзакций. */
export type PrismaTransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** Сущность, чей переход состояния порождает уведомления. */
export const OUTBOX_ENTITY_TRANSACTION = 'TRANSACTION';

/**
 * Тип сообщения. Строкой, а не enum в БД: добавление нового типа не должно
 * требовать миграции схемы, а старые задания в очереди должны оставаться
 * читаемыми после отката кода.
 *
 * Здесь перечислено ровно то, что система СЕЙЧАС ставит в очередь. Остальные
 * переходы долга (подтверждение, обе отмены, массовое подтверждение) и
 * магазинные долги пока уведомляют напрямую, через `utils/post-commit.ts`:
 * их сбой не проваливает операцию, но повторной доставки у них нет. Перевод
 * каждого из них — отдельная задача; тип пополняется вместе с ним, а не
 * заранее, иначе шаблоны обещали бы то, чего нет.
 */
export type OutboxMessageType = 'DEBT_MARKED_PAID';

export type OutboxStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SUPERSEDED';

export interface OutboxRecipient {
  /** Telegram chat id. Строкой: BigInt не переживает JSON без обёрток. */
  chatId: string;
  payload: Prisma.InputJsonValue;
}

export interface OutboxEnqueueInput {
  entityType: string;
  entityId: number;
  /** `Transaction.transitionVersion` ПОСЛЕ перехода. */
  transitionVersion: number;
  messageType: OutboxMessageType;
  recipients: OutboxRecipient[];
}

/** Сколько ждать до следующей попытки. */
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 10 * 60_000;
/** Столько живёт захват задания обработчиком. */
export const CLAIM_LEASE_MS = 60_000;
/** Больше — задание уходит в FAILED как неисправимое. */
export const MAX_ATTEMPTS = 8;

/**
 * Пауза перед следующей попыткой: 5с, 10с, 20с… до 10 минут.
 *
 * `retryAfter` от Telegram уважается: игнорировать его — верный способ
 * продлить лимит. Берём максимум из своей паузы и запрошенной.
 */
export function backoffMs(attempts: number, retryAfterSeconds?: number): number {
  const exponential = Math.min(
    BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1),
    BACKOFF_MAX_MS
  );
  const requested = (retryAfterSeconds ?? 0) * 1000;
  return Math.max(exponential, requested);
}

export class OutboxService {
  /**
   * Поставить задания в очередь ВНУТРИ транзакции перехода состояния.
   *
   * Принимает клиент транзакции, а не берёт глобальный: иначе задание
   * оказалось бы вне транзакции перехода, и весь смысл пропал бы.
   *
   * `skipDuplicates` — это и есть идемпотентность события: повтор
   * API-запроса не создаёт второе задание того же перехода, потому что
   * уникальный индекс совпадает. Новая законная смена статуса приходит с
   * новым `transitionVersion` и потому создаёт новое задание.
   *
   * @returns id созданных заданий. Пустой массив означает, что задание уже
   *   было — это повтор, а не ошибка. Id нужны для немедленной попытки
   *   отправки сразу после фиксации: она забирает ровно эти задания, поэтому
   *   обработчик не отправит их вторично.
   */
  static async enqueue(
    tx: PrismaTransactionClient,
    input: OutboxEnqueueInput
  ): Promise<number[]> {
    if (input.recipients.length === 0) return [];

    const created = await tx.outboxEvent.createManyAndReturn({
      data: input.recipients.map(recipient => ({
        entityType: input.entityType,
        entityId: input.entityId,
        transitionVersion: input.transitionVersion,
        messageType: input.messageType,
        recipientChatId: recipient.chatId,
        payload: recipient.payload,
      })),
      skipDuplicates: true,
      select: { id: true },
    });

    return created.map(row => row.id);
  }

  /**
   * Забрать задания в работу.
   *
   * `FOR UPDATE SKIP LOCKED` — единственная причина сырого SQL здесь: у
   * Prisma нет для него API, а без него два обработчика выбирают одни и те же
   * строки и отправляют сообщение дважды. `SKIP LOCKED` заставляет второго
   * взять следующие строки вместо ожидания на тех же.
   *
   * `attempts` растёт при ЗАХВАТЕ, а не при ошибке: обработчик, умерший
   * посреди отправки, иначе не увеличивал бы счётчик, и «отравленное»
   * задание крутилось бы вечно.
   */
  static async claim(
    limit: number,
    leaseMs: number = CLAIM_LEASE_MS
  ): Promise<OutboxEvent[]> {
    const leaseUntil = new Date(Date.now() + leaseMs);

    /* Сырой SQL возвращает ИМЕНА КОЛОНОК, а не поля Prisma: `RETURNING *` дал
       бы `entity_id` вместо `entityId`, и весь дальнейший код читал бы
       undefined. Поэтому здесь только идентификаторы, а сами задания
       вычитываются типизированным запросом ниже. Список алиасов было бы
       нужно вручную держать в согласии со схемой — лишний запрос дешевле:
       захват выполняется раз в несколько секунд. */
    const claimed = await prisma.$queryRaw<Array<{ id: number }>>`
      UPDATE outbox_events
         SET claimed_until = ${leaseUntil},
             attempts = attempts + 1,
             updated_at = NOW()
       WHERE id IN (
             SELECT id
               FROM outbox_events
              WHERE status = 'PENDING'
                AND next_attempt_at <= NOW()
                AND (claimed_until IS NULL OR claimed_until < NOW())
              ORDER BY id
              LIMIT ${limit}
                FOR UPDATE SKIP LOCKED
             )
   RETURNING id;
    `;

    if (claimed.length === 0) return [];

    return prisma.outboxEvent.findMany({
      where: { id: { in: claimed.map(row => row.id) } },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Забрать в работу КОНКРЕТНЫЕ задания.
   *
   * Нужно для немедленной попытки сразу после операции: ждать тика
   * обработчика значило бы задерживать уведомление на секунды без причины.
   * Захват тот же, что в `claim`, поэтому обработчик, случись он в этот
   * момент, эти задания пропустит — второго сообщения не будет.
   *
   * Условие `next_attempt_at` здесь тоже проверяется, хотя только что
   * созданное задание ему заведомо удовлетворяет: без него вызов по id
   * обошёл бы отсрочку и продолжил бы стучать в Telegram во время лимита.
   */
  static async claimByIds(
    ids: number[],
    leaseMs: number = CLAIM_LEASE_MS
  ): Promise<OutboxEvent[]> {
    if (ids.length === 0) return [];

    const leaseUntil = new Date(Date.now() + leaseMs);

    const claimed = await prisma.$queryRaw<Array<{ id: number }>>`
      UPDATE outbox_events
         SET claimed_until = ${leaseUntil},
             attempts = attempts + 1,
             updated_at = NOW()
       WHERE id IN (
             SELECT id
               FROM outbox_events
              WHERE id = ANY(${ids})
                AND status = 'PENDING'
                AND next_attempt_at <= NOW()
                AND (claimed_until IS NULL OR claimed_until < NOW())
              ORDER BY id
                FOR UPDATE SKIP LOCKED
             )
   RETURNING id;
    `;

    if (claimed.length === 0) return [];

    return prisma.outboxEvent.findMany({
      where: { id: { in: claimed.map(row => row.id) } },
      orderBy: { id: 'asc' },
    });
  }

  /** Доставлено. `sentMessageId` нужен, чтобы потом править это сообщение. */
  static async markSent(id: number, sentMessageId?: number): Promise<void> {
    await prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        claimedUntil: null,
        ...(sentMessageId === undefined ? {} : { sentMessageId }),
      },
    });
  }

  /**
   * Не доставлено.
   *
   * Постоянная ошибка адресата (заблокировал бота, чата нет) и исчерпанные
   * попытки уводят задание в FAILED — диагностируемое конечное состояние.
   * Временная ошибка возвращает задание в PENDING с отложенной попыткой.
   */
  static async markFailed(event: OutboxEvent, error: unknown): Promise<void> {
    const failure = classifyDeliveryError(error);
    const exhausted = event.attempts >= MAX_ATTEMPTS;
    const giveUp = failure.permanent || exhausted;

    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: giveUp ? 'FAILED' : 'PENDING',
        claimedUntil: null,
        nextAttemptAt: giveUp
          ? event.nextAttemptAt
          : new Date(Date.now() + backoffMs(event.attempts, failure.retryAfterSeconds)),
        lastErrorCategory: failure.category,
        ...(failure.errorCode === undefined
          ? {}
          : { lastErrorCode: failure.errorCode }),
      },
    });

    if (giveUp) {
      logger.warn('Outbox event will not be retried', {
        outboxId: event.id,
        messageType: event.messageType,
        attempts: event.attempts,
        category: failure.category,
        exhausted,
      });
    }
  }

  /**
   * Задание устарело: состояние сущности ушло вперёд.
   *
   * Без этого задержавшееся «оплата подтверждена» приходило бы ПОСЛЕ
   * актуальной отмены подтверждения и оставляло человека с ложным знанием.
   * Порядок доставки не гарантируется, поэтому вместо строгой очереди по
   * долгу отбрасываем устаревшие версии — результат тот же, механики меньше.
   */
  static async markSuperseded(id: number): Promise<void> {
    await prisma.outboxEvent.update({
      where: { id },
      data: { status: 'SUPERSEDED', claimedUntil: null },
    });
  }

  /**
   * Актуальна ли версия задания.
   *
   * Читается перед отправкой: между постановкой и отправкой долг мог сменить
   * статус ещё раз.
   */
  static async isCurrentVersion(event: OutboxEvent): Promise<boolean> {
    if (event.entityType !== OUTBOX_ENTITY_TRANSACTION) return true;

    const entity = await prisma.transaction.findUnique({
      where: { id: event.entityId },
      select: { transitionVersion: true },
    });
    /* Долга больше нет — уведомлять не о чем. */
    if (!entity) return false;

    return entity.transitionVersion <= event.transitionVersion;
  }

  /**
   * Показатели для наблюдения: сколько ждёт, насколько старое самое старое,
   * сколько окончательно не доставлено.
   *
   * Возраст считается по самому старому ожидающему заданию: именно он говорит
   * «обработчик встал», а количество само по себе — нет.
   */
  static async stats(): Promise<{
    pending: number;
    failed: number;
    oldestPendingAgeSeconds: number;
    retrying: number;
  }> {
    const [pending, failed, retrying, oldest] = await Promise.all([
      prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
      prisma.outboxEvent.count({ where: { status: 'FAILED' } }),
      prisma.outboxEvent.count({ where: { status: 'PENDING', attempts: { gt: 0 } } }),
      prisma.outboxEvent.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      pending,
      failed,
      retrying,
      oldestPendingAgeSeconds: oldest
        ? Math.max(0, Math.floor((Date.now() - oldest.createdAt.getTime()) / 1000))
        : 0,
    };
  }

  /**
   * Вернуть в очередь окончательно неуспешные задания.
   *
   * Операционное средство для разбора инцидента: бот был заблокирован, потом
   * разблокирован — заданиям можно дать ещё один шанс. Счётчик попыток
   * обнуляется, иначе они сразу снова упрутся в предел.
   */
  static async retryFailed(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;

    const result = await prisma.outboxEvent.updateMany({
      where: { id: { in: ids }, status: 'FAILED' },
      data: {
        status: 'PENDING',
        attempts: 0,
        nextAttemptAt: new Date(),
        claimedUntil: null,
      },
    });

    logger.info('Failed outbox events queued again', { count: result.count });
    return result.count;
  }
}
