import { CommandContext } from 'grammy';
import { BotContext } from '../../types/bot.types';
import { PollService } from '../../services/poll.service';
import { VoteService } from '../../services/vote.service';
import { UserService } from '../../services/user.service';
import { MenuService } from '../../services/menu.service';
import { logger } from '../../utils/logger';
import { createResultsMessage } from '../keyboards/poll.keyboard';

/**
 * Команда /q - быстрое голосование
 * Голосует за последнее блюдо пользователя в активном голосовании группы
 */
export async function quickVoteCommand(ctx: CommandContext<BotContext>): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      await ctx.reply('❌ Не удалось определить пользователя');
      return;
    }

    // Проверяем, что это групповой чат
    if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
      await ctx.reply('⚠️ Команда /q доступна только в группах');
      return;
    }

    const groupId = ctx.chat.id;

    // Получаем пользователя из БД
    let dbUser = await UserService.getUserByTelegramId(BigInt(user.id));
    if (!dbUser) {
      await ctx.reply('⚠️ Сначала нужно проголосовать обычным способом');
      return;
    }

    // Получаем активное голосование в группе
    const activePoll = await PollService.getActivePollInGroup(groupId);
    if (!activePoll) {
      await ctx.reply('⚠️ В этой группе нет активных голосований');
      return;
    }

    const poll = activePoll; // Используем активное голосование

    // Получаем последний голос пользователя
    const userVote = await VoteService.getUserVoteInPoll(poll.id, dbUser.id);
    
    if (!userVote || !userVote.menuItemId) {
      await ctx.reply('⚠️ У вас нет предыдущего голоса. Выберите блюдо через обычное голосование');
      return;
    }

    // Проверяем, что блюдо еще доступно
    const menuItem = await MenuService.getMenuItemById(userVote.menuItemId);
    if (!menuItem || !menuItem.isActive) {
      await ctx.reply('⚠️ Ваше предыдущее блюдо больше недоступно');
      return;
    }

    // Подтверждаем голос (обновляем время)
    await VoteService.upsertVote({
      pollId: poll.id,
      userId: dbUser.id,
      menuItemId: userVote.menuItemId,
    });

    await ctx.reply(`✅ Ваш голос за "${menuItem.name}" подтвержден!`, {
      reply_to_message_id: ctx.message?.message_id,
    });

    logger.info(`Quick vote: user ${dbUser.id} voted for ${menuItem.id} in poll ${poll.id}`);

  } catch (error) {
    logger.error('Error in quickVoteCommand:', error);
    await ctx.reply('❌ Ошибка при быстром голосовании');
  }
}

/**
 * Команда /r - просмотр результатов
 * Показывает результаты активного голосования в группе
 */
export async function resultsCommand(ctx: CommandContext<BotContext>): Promise<void> {
  try {
    // Проверяем, что это групповой чат
    if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
      await ctx.reply('⚠️ Команда /r доступна только в группах');
      return;
    }

    const groupId = ctx.chat.id;

    // Получаем активное голосование в группе
    const activePoll = await PollService.getActivePollInGroup(groupId);
    if (!activePoll) {
      await ctx.reply('⚠️ В этой группе нет активных голосований');
      return;
    }

    const poll = activePoll;

    // Получаем результаты
    const votes = await VoteService.getPollVotes(poll.id);
    const breakdown = await VoteService.getVoteBreakdown(poll.id);
    const voteTypeStats = await VoteService.getVoteTypeStats(poll.id);

    let message = `📊 **Текущие результаты**\n\n`;
    message += `🎯 "${poll.title || 'Голосование'}"\n`;
    message += `👥 Проголосовало: ${votes.length}\n`;

    if (poll.endTime) {
      const timeLeft = Math.max(0, Math.floor((new Date(poll.endTime).getTime() - Date.now()) / 1000 / 60));
      message += `⏰ Осталось: ${timeLeft} мин\n`;
    }

    // Статистика по типам
    if (voteTypeStats.total > 0) {
      message += `\n📈 **Статистика:**\n`;
      message += `🍽️ Заказывают: ${voteTypeStats.menuItemVotes}\n`;
      if (voteTypeStats.bringOwnVotes > 0) {
        message += `🏠 Принесут из дома: ${voteTypeStats.bringOwnVotes}\n`;
      }
      if (voteTypeStats.skipVotes > 0) {
        message += `⏭️ Не обедают: ${voteTypeStats.skipVotes}\n`;
      }
    }

    if (breakdown.length === 0) {
      message += `\n😔 _Пока никто не проголосовал_`;
    } else {
      message += `\n📋 **Топ-5:**\n`;
      
      breakdown.slice(0, 5).forEach((item, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} ${item.menuItemName} - ${item.votes} (${item.percentage}%)\n`;
      });
    }

    message += `\n_Используйте кнопки голосования для выбора блюда_`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message?.message_id,
    });

    logger.info(`Results shown via /r command in group ${groupId}`);

  } catch (error) {
    logger.error('Error in resultsCommand:', error);
    await ctx.reply('❌ Ошибка при получении результатов');
  }
}
