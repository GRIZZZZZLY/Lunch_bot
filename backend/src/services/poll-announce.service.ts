/**
 * Сообщения голосования в Telegram-группе.
 *
 * Одна из трёх ответственностей, лежавших в `poll.service.extensions.ts`
 * (задача 06): тот файл назывался «расширениями», а содержал сценарий создания,
 * сценарий завершения и работу с сообщениями бота — сложенные вместе по
 * принципу «в poll.service.ts уже не влезло».
 *
 * Здесь только работа с чатом: объявить новое голосование, дописать в то же
 * сообщение итоги, разослать личные уведомления. Один экран группы — одно
 * сообщение, которое редактируется: до этого на каждое голосование в чат летели
 * три-четыре новых.
 */
import { logger } from '../utils/logger';
import { getBotInstance, getRequiredBotInstance } from '../bot/bot-instance';
import { createVoteWebAppKeyboard } from '../bot/keyboards/webapp.keyboard';
import {
  createCompactPollKeyboard,
  createCompactPollMessage,
  createPollStartedMessage,
} from '../bot/keyboards/poll.keyboard';
import { pluralForm } from '../utils/pluralize';
import { UserService } from './user.service';
import { VoteService } from './vote.service';
import { PollQueryService } from './poll-query.service';
import { PollStatsService } from './poll-stats.service';
import { escapeMarkdown } from '../utils/telegram-html';

/** Кнопка Mini App + текст «голосование началось, до такого-то времени». */
export async function announceNewPoll(params: {
  pollId: number;
  chatId: number;
  endTime: Date;
  title?: string;
}): Promise<number> {
  /* Контракт — вернуть messageId отправленного сообщения. Без бота возвращать
     нечего, поэтому падаем громко, а не выходим тихо. */
  const bot = getRequiredBotInstance();

  const sent = await bot.api.sendMessage(
    params.chatId,
    createPollStartedMessage(params.endTime, params.title),
    {
      parse_mode: 'Markdown',
      reply_markup: createVoteWebAppKeyboard(params.pollId),
    }
  );

  logger.info('Poll message sent to group', {
    pollId: params.pollId,
    messageId: sent.message_id,
  });

  return sent.message_id;
}

/**
 * Дописать итоги в сообщение голосования.
 *
 * Сбой редактирования не считается сбоем завершения: голосование уже закрыто, а
 * сообщение в чате — его отображение. Поэтому здесь `catch`, а не проброс.
 */
export async function announceCompletion(params: {
  pollId: number;
  chatId: number;
  messageId: number;
}): Promise<void> {
  const bot = getBotInstance();
  if (!bot) {
    logger.error('Bot not initialized for poll completion message');
    return;
  }

  try {
    const [poll, breakdown, votes] = await Promise.all([
      PollQueryService.getPollById(params.pollId),
      PollStatsService.getPollVoteBreakdown(params.pollId),
      VoteService.getPollVotes(params.pollId),
    ]);

    if (!poll) {
      logger.error(`Poll ${params.pollId} not found for completion message`);
      return;
    }

    const selectedItems = JSON.parse(poll.selectedMenuItemIds || '[]');

    await bot.api.editMessageText(
      params.chatId,
      params.messageId,
      createCompactPollMessage(poll, selectedItems.length, votes.length, 0, {
        status: 'completed',
        breakdown,
      }),
      {
        parse_mode: 'Markdown',
        reply_markup: createCompactPollKeyboard(params.pollId, 'completed'),
      }
    );

    logger.info(`Poll ${params.pollId} message updated with results`);
  } catch (error) {
    logger.error('Could not edit poll message with results:', error);
  }
}

/**
 * Личные уведомления участникам — запасной путь.
 *
 * Основной путь — `pollNotificationService.sendPollCompletionNotifications` и
 * заказы по категориям. Эта функция вызывается только когда тот путь упал:
 * человек, проголосовавший за обед, должен узнать итог и реквизиты для оплаты
 * даже если сломался сценарий с категориями.
 */
export async function notifyParticipantsLegacy(
  pollId: number,
  breakdown: Array<{ menuItemId: number; menuItemName: string; votes: number }>,
  responsibleUser: {
    id: number;
    firstName: string;
    username?: string | null;
  } | null
): Promise<void> {
  const bot = getBotInstance();
  if (!bot) {
    logger.error('Bot not initialized for notifications');
    return;
  }

  const votes = await VoteService.getPollVotes(pollId);
  if (votes.length === 0) return;

  const winner = breakdown.length > 0 ? breakdown[0] : null;
  const payment = responsibleUser
    ? await UserService.getPaymentInfo(responsibleUser.id)
    : null;

  if (responsibleUser && !payment?.paymentCard && !payment?.paymentPhone) {
    logger.warn('Responsible has no payment details', {
      responsibleId: responsibleUser.id,
      pollId,
    });
  }

  const results = await Promise.all(
    votes.map(async (vote: { menuItemId: number | null; user: { id: number; telegramId: bigint } }) => {
      const chosen = breakdown.find(item => item.menuItemId === vote.menuItemId);
      const message = personalResultMessage({
        winner,
        chosenName: chosen?.menuItemName,
        responsibleUser,
        payment,
      });

      try {
        await bot.api.sendMessage(Number(vote.user.telegramId), message, {
          parse_mode: 'Markdown',
        });
        return true;
      } catch (error) {
        logger.warn(
          `Could not send notification to user ${vote.user.id}:`,
          error instanceof Error ? error.message : error
        );
        return false;
      }
    })
  );

  const delivered = results.filter(Boolean).length;
  logger.info(
    `Personal notifications sent: ${delivered} success, ${results.length - delivered} failed`
  );
}

/** Текст личного уведомления об итогах. */
function personalResultMessage(params: {
  winner: { menuItemName: string; votes: number } | null;
  chosenName?: string;
  responsibleUser: { firstName: string; username?: string | null } | null;
  payment: {
    paymentCard?: string | null;
    paymentPhone?: string | null;
    paymentDetails?: string | null;
  } | null;
}): string {
  const { winner, chosenName, responsibleUser, payment } = params;

  let message = '🎉 **Голосование завершено!**\n\n📊 **Результаты:**\n';

  if (winner) {
    const votesWord = pluralForm(winner.votes, 'голос', 'голоса', 'голосов');
    message += `🏆 Победитель: **${escapeMarkdown(winner.menuItemName ?? '')}** (${winner.votes} ${votesWord})\n\n`;
  }

  message += `👤 **Твой выбор:** ${chosenName ? escapeMarkdown(chosenName) : 'Не указан'}\n\n`;

  if (!responsibleUser) return message;

  const username = responsibleUser.username
    ? escapeMarkdown(responsibleUser.username)
    : null;

  message += '💰 **Информация для оплаты:**\n';
  message += `👤 Ответственный: ${escapeMarkdown(responsibleUser.firstName ?? '')}`;
  if (username) message += ` (@${username})`;
  message += '\n';
  message += `📱 Тег в Telegram: ${username ? `@${username}` : 'тег не указан'}\n`;

  /* Реквизиты уходят в ЛС ДРУГИМ участникам, поэтому экранируются наравне с
     именами. Code-span вокруг карты снят намеренно: обратная кавычка в
     реквизите закрывала его раньше времени и роняла доставку, а
     экранировать внутри code-span нечем — legacy-Markdown отдаёт `\` в текст
     как есть. */
  if (payment?.paymentCard) {
    message += `💳 Карта: ${escapeMarkdown(payment.paymentCard)}\n`;
  }
  if (payment?.paymentPhone) {
    message += `📱 Телефон: ${escapeMarkdown(payment.paymentPhone)}\n`;
  }
  if (payment?.paymentDetails) {
    message += `📝 Детали: ${escapeMarkdown(payment.paymentDetails)}\n`;
  }

  if (!payment?.paymentCard && !payment?.paymentPhone) {
    message +=
      '\n⚠️ Ответственный пока не добавил реквизиты — напиши ему напрямую.';
  }

  return message;
}
