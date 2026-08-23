/**
 * Завершение голосования по таймеру, поставленному при его создании.
 *
 * Вторая ответственность из `poll.service.extensions.ts` (задача 06). Сценарий:
 * прошло время голосования → закрыть → дописать итоги в то же сообщение группы →
 * запустить заказы по категориям и выбор ответственных.
 *
 * ВАЖНО, и это не косметика: таймер живёт В ПАМЯТИ ПРОЦЕССА (`setTimeout`).
 * Перезапуск процесса его теряет, и голосование остаётся `ACTIVE` до
 * планировщика (`poll-scheduler.service` → `cancelExpiredPolls`), который
 * ОТМЕНЯЕТ такое голосование, а не завершает. То есть два механизма закрытия
 * дают разный результат в зависимости от того, был ли перезапуск. Это записано
 * в `tech_debt/06` как продуктовое решение, а не устранено здесь: выбор между
 * «дожать в планировщике» и «оставить отмену» меняет то, что видит группа.
 */
import { logger } from '../utils/logger';
import { PollCompletionService } from './poll-completion.service';
import { PollQueryService } from './poll-query.service';
import { PollStatsService } from './poll-stats.service';
import { PollService } from './poll.service';
import { announceCompletion, notifyParticipantsLegacy } from './poll-announce.service';
import { CategoryOrderService } from './category-order.service';
import { MultiCategoryResponsibleService } from './multi-category-responsible.service';

/** Поставить таймер автозавершения на длительность голосования. */
export function scheduleTimerCompletion(params: {
  pollId: number;
  chatId: number;
  messageId: number;
  durationMinutes: number;
}): void {
  setTimeout(
    () => {
      void completeIfStillActive(params);
    },
    params.durationMinutes * 60 * 1000
  );
}

async function completeIfStillActive(params: {
  pollId: number;
  chatId: number;
  messageId: number;
}): Promise<void> {
  try {
    const poll = await PollQueryService.getPollById(params.pollId);
    if (poll?.status !== 'ACTIVE') return;

    await completeByTimer(params);
  } catch (error) {
    logger.error('Error in poll auto-completion timeout:', error);
  }
}

/**
 * Закрыть голосование и показать итоги в группе.
 *
 * Исключения не пробрасываются: вызывающий — таймер, и упавшее исключение
 * никто не поймает.
 */
export async function completeByTimer(params: {
  pollId: number;
  chatId: number;
  messageId: number;
}): Promise<void> {
  const { pollId } = params;

  try {
    logger.info(`Auto-completing poll ${pollId} by timer`);

    const result = await PollCompletionService.completePoll(pollId);
    await announceCompletion(params);

    if (result.totalVotes > 0) {
      await startNextStep(pollId);
    }
  } catch (error) {
    logger.error('Error in timer completion:', error);
  }
}

/**
 * Следующий шаг обеда: заказы по категориям и выбор ответственных.
 *
 * Запасной путь при сбое — рулетка и личные уведомления. Он остался с прежней
 * схемы «один ответственный на всё голосование» и включается флагом
 * `AUTO_ROULETTE_ENABLED`; без флага участники всё равно получают итоги личным
 * сообщением.
 */
async function startNextStep(pollId: number): Promise<void> {
  try {
    const categoryOrders =
      await CategoryOrderService.createCategoryOrders(pollId);
    logger.info(
      `Created ${categoryOrders.length} category orders for poll ${pollId}`
    );

    await MultiCategoryResponsibleService.startMultiCategorySelection(pollId);
    logger.info(
      `Multi-category responsible selection started for poll ${pollId}`
    );
  } catch (error) {
    logger.error(
      'Failed to start multi-category flow in auto-complete, falling back to legacy flow:',
      error
    );

    await legacyResponsibleFlow(pollId);
  }
}

async function legacyResponsibleFlow(pollId: number): Promise<void> {
  const breakdown = await PollStatsService.getPollVoteBreakdown(pollId);
  let responsibleUser = null;

  if (process.env.AUTO_ROULETTE_ENABLED === 'true') {
    /* Пауза перед рулеткой — чтобы участники успели прочитать итоги до того,
       как придёт «ты идёшь за заказом». */
    await new Promise(resolve => setTimeout(resolve, 2000));
    const rouletteResult = await PollService.runRoulette(pollId);
    responsibleUser =
      (rouletteResult as { responsibleUser?: { id: number; firstName: string; username?: string | null } })
        .responsibleUser ?? null;
  }

  await notifyParticipantsLegacy(pollId, breakdown, responsibleUser);
}
