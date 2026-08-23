/**
 * Создать голосование и отправить его в группу.
 *
 * Третья ответственность из `poll.service.extensions.ts` (задача 06): доставка.
 * Сценарий (что проверить перед созданием) живёт в `poll-creation.service.ts`,
 * текст и правка сообщений — в `poll-announce.service.ts`, таймер — в
 * `poll-timer.service.ts`. Здесь порядок шагов: запись, настройки кворума,
 * сообщение, таймер.
 *
 * Отдельный файл, а не функция внутри сценария, по практической причине: так
 * сценарий можно проверять, не поднимая бота, а доставку — не выдумывая
 * сценарий.
 */
import { MenuItem } from '@prisma/client';

import { logger } from '../utils/logger';
import { GroupService } from './group.service';
import { PollService } from './poll.service';
import { announceNewPoll } from './poll-announce.service';
import { scheduleTimerCompletion } from './poll-timer.service';
import { getRequiredBotInstance } from '../bot/bot-instance';
import { PollGroupNotFoundError } from './poll.errors';

/** Предел одновременно выбираемых блюд — правило продукта. */
const MAX_SELECTIONS_LIMIT = 3;

/**
 * Создать голосование и отправить его в группу.
 *
 * Порядок важен и он не произволен: запись в БД первой, сообщение в чат —
 * последним. Иначе при сбое создания в группе висело бы приглашение голосовать
 * за голосование, которого нет.
 *
 * `expectedParticipants` обновляется по реальному числу участников чата: от него
 * зависит кворум автозакрытия. Сбой этого шага не отменяет создание — кворум
 * тогда считается по прежней оценке, и это лучше, чем отказ создать голосование.
 */
export async function createAndSendPoll(params: {
  groupId: number;
  duration: number;
  createdBy: number;
  title?: string;
  menuItems: MenuItem[];
  selectedMenuItemIds?: number[];
  isMultiSelect?: boolean;
  maxSelections?: number;
}): Promise<{ pollId: number; messageId: number }> {
  /* Бот нужен ДО создания записи: без него отправлять итог некуда, а
     голосование, о котором группа не узнала, бессмысленно. */
  const bot = getRequiredBotInstance();

  const group = await GroupService.getGroupById(params.groupId);
  if (!group) throw new PollGroupNotFoundError();

  const poll = await PollService.createPoll({
    groupId: params.groupId,
    duration: params.duration,
    createdBy: params.createdBy,
    isMultiSelect: params.isMultiSelect ?? true,
    maxSelections: params.maxSelections ?? MAX_SELECTIONS_LIMIT,
  });

  if (params.selectedMenuItemIds && params.selectedMenuItemIds.length > 0) {
    await PollService.updatePoll(poll.id, {
      selectedMenuItemIds: JSON.stringify(params.selectedMenuItemIds),
    });
  }

  await syncExpectedParticipants(poll.groupId, group.telegramId, bot);

  /* BigInt → number: Grammy принимает числовой chat_id. */
  const chatId = Number(group.telegramId);
  const messageId = await announceNewPoll({
    pollId: poll.id,
    chatId,
    endTime: new Date(Date.now() + params.duration * 60 * 1000),
    title: params.title,
  });

  // chatId и messageId нужны, чтобы позже дописать итоги в то же сообщение.
  await PollService.updatePoll(poll.id, {
    chatId: BigInt(chatId),
    messageId,
  });

  scheduleTimerCompletion({
    pollId: poll.id,
    chatId,
    messageId,
    durationMinutes: params.duration,
  });

  logger.info('Poll created and sent to group', {
    pollId: poll.id,
    groupId: params.groupId,
    messageId,
  });

  return { pollId: poll.id, messageId };
}

/**
 * Сколько человек в чате — столько и ожидается голосов.
 *
 * Боту передаётся сам экземпляр, а не ссылка на хелпер: раньше сюда уезжала
 * функция без `.api`, и метод молча отдавал null, то есть кворум оставался
 * на прежней оценке без единого сообщения об этом.
 */
async function syncExpectedParticipants(
  groupId: number,
  telegramId: bigint,
  bot: Parameters<typeof GroupService.getRealMemberCount>[1]
): Promise<void> {
  try {
    const realCount = await GroupService.getRealMemberCount(
      telegramId.toString(),
      bot
    );

    if (!realCount || realCount <= 0) {
      logger.warn(
        `Could not get real member count for group ${groupId}, keeping previous estimate`
      );
      return;
    }

    const settings = await GroupService.getGroupSettings(groupId);
    await GroupService.updateGroupSettings(groupId, {
      ...settings,
      expectedParticipants: realCount,
    });
    logger.info(
      `Set expectedParticipants for group ${groupId}: ${realCount} members`
    );
  } catch (error) {
    logger.error('Error updating expectedParticipants on poll creation:', error);
  }
}
