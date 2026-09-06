/**
 * Обработчик очереди уведомлений.
 *
 * Забирает задания, отправляет сообщения, записывает результат. Живёт в том же
 * процессе, что и бот, но захват идёт через БД (`FOR UPDATE SKIP LOCKED`),
 * поэтому два процесса можно поднять одновременно — они не возьмут одно
 * задание. Разделять процессы сейчас незачем: очередь обслуживает
 * уведомления одного бота, и без экземпляра бота обработчик всё равно
 * бесполезен.
 *
 * Запускать ТОЛЬКО там, где есть бот: `PROCESS_ROLE=full` или `bot`
 * (см. `src/index.ts`). В роли `api` `getBotInstance()` возвращает null, и
 * обработчик молча захватывал бы задания, ничего не отправляя.
 */
import { type OutboxEvent } from '@prisma/client';

import { getBotInstance } from '../bot/bot-instance';
import { logger } from '../utils/logger';
import { OutboxService } from './outbox.service';
import { renderOutboxMessage } from './outbox.templates';

/** Как часто заглядывать в очередь. */
const TICK_INTERVAL_MS = 10_000;
/** Сколько заданий за один проход. */
const BATCH_SIZE = 20;

export class OutboxWorkerService {
  private static timer: NodeJS.Timeout | null = null;
  /** Проходы не должны накладываться: медленный Telegram иначе даст лавину. */
  private static running = false;

  static start(intervalMs: number = TICK_INTERVAL_MS): void {
    if (OutboxWorkerService.timer) return;

    if (!getBotInstance()) {
      logger.info('Outbox worker not started: no bot in this process role');
      return;
    }

    OutboxWorkerService.timer = setInterval(() => {
      void OutboxWorkerService.tick();
    }, intervalMs);
    /* unref: незавершённый таймер не должен держать процесс при остановке. */
    OutboxWorkerService.timer.unref?.();

    logger.info('Outbox worker started', { intervalMs });
  }

  static stop(): void {
    if (!OutboxWorkerService.timer) return;
    clearInterval(OutboxWorkerService.timer);
    OutboxWorkerService.timer = null;
    logger.info('Outbox worker stopped');
  }

  /**
   * Один проход. Публичный, потому что его вызывают и тесты, и путь
   * немедленной отправки сразу после операции.
   *
   * Ошибка на одном задании не срывает остальные: каждое обрабатывается
   * самостоятельно и само записывает свой итог.
   */
  static async tick(batchSize: number = BATCH_SIZE): Promise<number> {
    if (OutboxWorkerService.running) return 0;
    OutboxWorkerService.running = true;

    try {
      const events = await OutboxService.claim(batchSize);
      let delivered = 0;

      for (const event of events) {
        if (await OutboxWorkerService.deliver(event)) delivered += 1;
      }

      return delivered;
    } catch (error) {
      /* Сюда попадает только сбой самого захвата (БД недоступна). Проход
         пропускаем, следующий тик попробует снова. */
      logger.error('Outbox worker tick failed', {
        category: 'claim_failed',
      });
      return 0;
    } finally {
      OutboxWorkerService.running = false;
    }
  }

  /**
   * Немедленно попытаться отправить только что поставленные задания.
   *
   * Вызывается сразу после фиксации перехода состояния: ждать тика значило бы
   * задерживать уведомление без причины. Задания захватываются по id, поэтому
   * обработчик их не продублирует. Никогда не бросает: переход уже сохранён.
   */
  static async deliverNow(ids: number[]): Promise<void> {
    if (ids.length === 0) return;

    try {
      const events = await OutboxService.claimByIds(ids);
      for (const event of events) {
        await OutboxWorkerService.deliver(event);
      }
    } catch {
      /* Не смогли даже захватить — задания остались PENDING, их возьмёт
         обработчик. Ронять из-за этого сохранённую операцию нельзя. */
      logger.warn('Immediate outbox delivery skipped', { count: ids.length });
    }
  }

  /**
   * Отправить одно задание и записать итог.
   *
   * @returns доставлено ли сообщение.
   */
  static async deliver(event: OutboxEvent): Promise<boolean> {
    const bot = getBotInstance();
    if (!bot) return false;

    /* Состояние могло уйти вперёд, пока задание лежало в очереди. Позднее
       «оплата подтверждена» не должно приходить после актуальной отмены
       подтверждения. */
    if (!(await OutboxService.isCurrentVersion(event))) {
      await OutboxService.markSuperseded(event.id);
      return false;
    }

    const message = renderOutboxMessage(event.messageType, event.payload);
    if (!message) {
      /* Тип неизвестен этой версии кода — это откат приложения, а не сбой
         доставки. Оставляем задание ждать: версия, которая его понимает,
         вернётся и отправит. */
      logger.warn('Outbox event type is unknown to this build', {
        outboxId: event.id,
        messageType: event.messageType,
      });
      return false;
    }

    try {
      const sent = await bot.api.sendMessage(
        Number(event.recipientChatId),
        message.text,
        {
          ...(message.parseMode ? { parse_mode: message.parseMode } : {}),
          ...(message.replyMarkup ? { reply_markup: message.replyMarkup } : {}),
        }
      );

      await OutboxService.markSent(event.id, sent?.message_id);
      return true;
    } catch (error) {
      await OutboxService.markFailed(event, error);
      return false;
    }
  }
}
