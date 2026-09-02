/**
 * Завершение голосования по таймеру, поставленному при его создании.
 *
 * Вторая ответственность из `poll.service.extensions.ts` (задача 06). Сценарий:
 * прошло время голосования → закрыть → дописать итоги в то же сообщение группы →
 * запустить заказы по категориям и выбор ответственных.
 *
 * Таймер живёт В ПАМЯТИ ПРОЦЕССА (`setTimeout`), поэтому при старте
 * `restoreActiveTimers` ставит его заново, а планировщик ЗАВЕРШАЕТ (не
 * отменяет) просроченные голосования с голосами — решение об этом принимает
 * `closeExpiredPoll`, единственная на планировщик и на ручной скрипт. Пока
 * этого не было, любой рестарт во время голосования превращал завершение в
 * отмену: победителя нет, заказов и долгов нет, обед у группы пропал.
 */
import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import {
  PollCompletionService,
  type ExpiredPollRow,
} from './poll-completion.service';
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
  scheduleAfter(params, params.durationMinutes * 60 * 1000);
}

function scheduleAfter(
  params: { pollId: number; chatId: number; messageId: number },
  delayMs: number
): void {
  setTimeout(() => {
    void completeIfStillActive(params);
  }, Math.max(0, delayMs));
}

/**
 * Восстановить таймеры после рестарта процесса. Вызывается из планировщика
 * ПОСЛЕ захвата advisory-lock — так таймеры живут ровно в одном процессе.
 * Просроченные ставятся на 0 мс: завершатся сразу, а не через минуту cron'а.
 *
 * Голосования без `chatId`/`messageId` не берём: дописывать итоги некуда, и их
 * закроет планировщик через `closeExpiredPoll`.
 */
export async function restoreActiveTimers(
  now: Date = new Date()
): Promise<number> {
  const active = await prisma.poll.findMany({
    where: {
      status: 'ACTIVE',
      chatId: { not: null },
      messageId: { not: null },
    },
    select: {
      id: true,
      chatId: true,
      messageId: true,
      startedAt: true,
      duration: true,
    },
  });

  for (const poll of active) {
    const endsAt = poll.startedAt.getTime() + poll.duration * 60 * 1000;
    scheduleAfter(
      {
        pollId: poll.id,
        chatId: Number(poll.chatId),
        messageId: poll.messageId as number,
      },
      endsAt - now.getTime()
    );
  }

  if (active.length > 0) {
    logger.info(
      `Restored ${active.length} poll completion timer(s) after restart`
    );
  }

  return active.length;
}

export type ExpiredPollOutcome = 'completed' | 'cancelled' | 'skipped';

/**
 * Что делать с просроченным голосованием. ОДНА точка решения для планировщика
 * и для ручного `npm run close-expired-polls`: пока правило было размножено,
 * два пути закрытия давали разный результат — с голосами голосование
 * отменялось вместо завершения, и обед пропадал вместе с долгами.
 *
 * `completeByTimer` глотает `PollAlreadyCompletedError`, поэтому гонка с
 * восстановленным таймером безопасна: проигравший просто ничего не меняет.
 */
export async function closeExpiredPoll(
  poll: ExpiredPollRow
): Promise<ExpiredPollOutcome> {
  if (poll.votesCount === 0) {
    const cancelled = await PollCompletionService.cancelIfStillActive(poll);
    return cancelled ? 'cancelled' : 'skipped';
  }

  if (poll.chatId !== null && poll.messageId !== null) {
    await completeByTimer({
      pollId: poll.id,
      chatId: Number(poll.chatId),
      messageId: poll.messageId,
    });
    return 'completed';
  }

  /* Голосование, созданное не через бота: завершаем без объявления в группу —
     дописывать итоги некуда. */
  await PollCompletionService.completePoll(poll.id);
  return 'completed';
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
