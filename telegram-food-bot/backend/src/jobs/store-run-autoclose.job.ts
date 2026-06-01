import cron from 'node-cron';
import { StoreRunService } from '../services/store-run.service';
import { notificationService } from '../services/notification.service';
import { logger } from '../utils/logger';

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
      const closedIds = await StoreRunService.autoCloseExpired();
      if (closedIds.length === 0) return;

      logger.info('Auto-closed store runs to SHOPPING', {
        count: closedIds.length,
        ids: closedIds,
      });

      // Notify participants + initiator of each closed run (fire-and-forget, don't fail cron).
      // Participants who added items learn the collection is closed; the initiator —
      // who didn't press the button manually here — is told to go shop and set prices.
      await Promise.allSettled(
        closedIds.flatMap((id) => [
          notificationService.notifyShoppingStarted(id).catch((err) => {
            logger.error('notifyShoppingStarted failed for auto-closed run', {
              storeRunId: id,
              err,
            });
          }),
          notificationService.notifyInitiatorCollectionClosed(id).catch((err) => {
            logger.error('notifyInitiatorCollectionClosed failed for auto-closed run', {
              storeRunId: id,
              err,
            });
          }),
        ]),
      );
    } catch (err) {
      logger.error('store-run auto-close job failed', { err });
    }
  });

  logger.info(`Store run auto-close job initialized (cron: "${cronExpr}")`);
}
