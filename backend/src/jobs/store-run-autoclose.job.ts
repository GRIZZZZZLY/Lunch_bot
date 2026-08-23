import cron from 'node-cron';
import { StoreRunService } from '../services/store-run.service';
import { storeRunNotificationService } from '../services/store-run-notification.service';
import { logger } from '../utils/logger';
import { withDistributedLock } from '../utils/distributed-lock';

/**
 * Инициализация cron-джоба для авто-закрытия магазинных забегов.
 *
 * Каждую минуту находим все COLLECTING забеги с истёкшим collectUntil,
 * переводим в SHOPPING и уведомляем участников, добавивших позиции.
 */
export function initStoreRunAutoCloseJob(): void {
  const cronExpr = process.env.STORE_RUN_AUTOCLOSE_CRON ?? '* * * * *';

  cron.schedule(cronExpr, async () => {
    try {
      await withDistributedLock('job:store-run-autoclose', 5 * 60, async () => {
        // 1) COLLECTING → SHOPPING по истечении collectUntil.
        const closedIds = await StoreRunService.autoCloseExpired();
        if (closedIds.length > 0) {
          logger.info('Auto-closed store runs to SHOPPING', {
            count: closedIds.length,
            ids: closedIds,
          });

          // Notify participants + initiator of each closed run (fire-and-forget, don't fail cron).
          // Participants who added items learn the collection is closed; the initiator —
          // who didn't press the button manually here — is told to go shop and set prices.
          await Promise.allSettled(
            closedIds.flatMap(id => [
              storeRunNotificationService
                .notifyShoppingStarted(id)
                .catch((err: unknown) => {
                  logger.error(
                    'notifyShoppingStarted failed for auto-closed run',
                    {
                      storeRunId: id,
                      err,
                    }
                  );
                }),
              storeRunNotificationService
                .notifyInitiatorCollectionClosed(id)
                .catch((err: unknown) => {
                  logger.error(
                    'notifyInitiatorCollectionClosed failed for auto-closed run',
                    {
                      storeRunId: id,
                      err,
                    }
                  );
                }),
            ])
          );
        }

        // 2) SHOPPING, зависшие дольше таймаута → CANCELLED. Убираем зависшее
        // «жди цены» (групповой пост + ЛС-приглашения) и уведомляем инициатора.
        const expiredIds = await StoreRunService.expireStaleShoppingRuns();
        if (expiredIds.length > 0) {
          await Promise.allSettled(
            expiredIds.flatMap(id => [
              storeRunNotificationService
                .deleteStoreRunMessages(id)
                .catch((err: unknown) => {
                  logger.error(
                    'deleteStoreRunMessages failed for expired run',
                    { storeRunId: id, err }
                  );
                }),
              storeRunNotificationService
                .notifyStoreRunExpired(id)
                .catch((err: unknown) => {
                  logger.error('notifyStoreRunExpired failed for expired run', {
                    storeRunId: id,
                    err,
                  });
                }),
            ])
          );
        }
      });
    } catch (err) {
      logger.error('store-run auto-close job failed', { err });
    }
  });

  logger.info(`Store run auto-close job initialized (cron: "${cronExpr}")`);
}
