import cron from 'node-cron';
import { GroupService } from '../services/group.service';
import { logger } from '../utils/logger';

/**
 * Инициализация cron-джоба сверки активных групп с реальным членством бота.
 *
 * Раз в N часов спрашиваем Telegram, остался ли бот в каждой активной группе,
 * и деактивируем те, откуда его убрали. Лечит пропущенные my_chat_member-события
 * (например, когда webhook был недоступен во время простоя/смены IP).
 */
export function initGroupReconcileJob(): void {
  const cronExpr = process.env.GROUP_RECONCILE_CRON ?? '0 */6 * * *'; // каждые 6 часов

  cron.schedule(cronExpr, async () => {
    try {
      const deactivated = await GroupService.reconcileActiveGroups();
      if (deactivated.length > 0) {
        logger.info('Group reconcile deactivated stale groups', {
          count: deactivated.length,
          ids: deactivated,
        });
      }
    } catch (err) {
      logger.error('group reconcile job failed', { err });
    }
  });

  logger.info(`Group reconcile job initialized (cron: "${cronExpr}")`);
}
