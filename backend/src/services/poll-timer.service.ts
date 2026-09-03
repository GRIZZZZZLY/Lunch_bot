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
import { pollEndsAt } from '../utils/date';
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
 *
 * Берутся только голосования, у которых срок ЕЩЁ НЕ вышел. Просроченные
 * восстановление не трогает намеренно: таймерный путь всегда завершает, а
 * пустое просроченное голосование положено отменять — поставь ему таймер, и
 * исход снова начнёт зависеть от того, был ли рестарт (ровно та болезнь, от
 * которой лечили). Их закрывает `closeExpiredPoll`, единственный владелец
 * правила «завершить или отменить», и планировщик зовёт его сразу после
 * восстановления, не дожидаясь тика.
 *
 * Голосования без `chatId`/`messageId` не берём: дописывать итоги некуда.
 *
 * Конец считается через `pollEndsAt`, а не `startedAt + duration`: у активного
 * голосования может быть проставлен `ended_at`, и он главнее. Своя копия
 * правила разошлась бы и с чтением, и с SQL в `findExpiredActivePolls`.
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
      endedAt: true,
    },
  });

  let restored = 0;
  for (const poll of active) {
    const { chatId, messageId } = poll;
    /* `where` это уже гарантирует, но сужение честнее приведения типа: если
       условие однажды изменят, здесь не появится `null` под видом числа. */
    if (chatId === null || messageId === null) continue;

    const delayMs = pollEndsAt(poll).getTime() - now.getTime();
    if (delayMs <= 0) continue;

    scheduleAfter(
      { pollId: poll.id, chatId: Number(chatId), messageId },
      delayMs
    );
    restored += 1;
  }

  if (restored > 0) {
    logger.info(`Restored ${restored} poll completion timer(s) after restart`);
  }

  return restored;
}

export type ExpiredPollOutcome =
  | 'completed'
  | 'cancelled'
  | 'skipped'
  | 'failed';

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
  } else {
    /* Голосование, созданное не через бота: без объявления в группу —
       дописывать итоги некуда. Но следующий шаг обязателен, как и в ветке с
       чатом: заказы по категориям, ответственные и долги от наличия чата не
       зависят. Пока здесь звали `completePoll` напрямую, у такой группы обед
       заканчивался закрытым голосованием и ничем больше. */
    await completeAndAdvance(poll.id);
  }

  /* Оба пути завершения по контракту НЕ пробрасывают исключения (их штатный
     вызывающий — таймер, где throw уронил бы процесс), поэтому «завершено»
     подтверждается чтением статуса. Без этой проверки проглоченный сбой уезжал
     в отчёт как успех: скрипт печатал «Завершено: N» и отдавал код 0, то есть
     тихая потеря обеда возвращалась с другой стороны. */
  const after = await PollQueryService.getPollById(poll.id);
  return after?.status === 'ACTIVE' ? 'failed' : 'completed';
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
  await completeAndAdvance(params.pollId, () => announceCompletion(params));
}

/**
 * Ядро завершения: закрыть голосование, при непустом итоге запустить следующий
 * шаг обеда. Объявление в группу — необязательный шаг, а не условие: у
 * голосования может не быть `chatId`/`messageId` (`schema.prisma`: колонка
 * допускает NULL), и тогда дописывать итоги просто некуда.
 *
 * Одна функция на оба пути намеренно: пока их было два, ветка без чата теряла
 * `startNextStep` — заказы по категориям не создавались, ответственные не
 * выбирались, долги не появлялись.
 *
 * Исключения не пробрасываются: штатный вызывающий — таймер, там throw никто
 * не поймает.
 */
async function completeAndAdvance(
  pollId: number,
  announce?: () => Promise<unknown>
): Promise<void> {
  try {
    logger.info(`Auto-completing poll ${pollId} by timer`);

    const result = await PollCompletionService.completePoll(pollId);
    if (announce) {
      await announce();
    }

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
