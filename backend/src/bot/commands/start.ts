import { BotContext } from '../../types/bot.types';
import { UserService } from '../../services/user.service';
import { PollService } from '../../services/poll.service';
import { logger } from '../../utils/logger';

/**
 * Команда /start - регистрация пользователя + обработка deep links
 */
export async function startCommand(ctx: BotContext): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      await ctx.reply('❌ Не удалось получить информацию о пользователе');
      return;
    }

    // Создаем или обновляем пользователя в БД
    // isNewUser определяется по createdAt: если запись создана менее 10 секунд назад — новый пользователь.
    // Это надёжнее сессии, которая сбрасывается при рестарте бота.
    const dbUser = await UserService.upsertUser({
      telegramId: user.id.toString(),
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    const ageMs = Date.now() - new Date(dbUser.createdAt).getTime();
    const isNewUser = ageMs < 10_000; // менее 10 секунд назад — только что создан

    // Обработка deep links (параметры после /start)
    const startParam = ctx.match; // Например: "menu_-1001234567"
    const webappUrl = process.env.WEBAPP_URL ?? '';
    if (!webappUrl) {
      logger.warn('WEBAPP_URL is not set — web_app buttons will be unavailable');
    }

    // Deep link для меню группы: /start menu_GROUP_ID
    if (startParam && startParam.toString().startsWith('menu_')) {
      const groupId = startParam.toString().replace('menu_', '');
      
      await ctx.reply(
        '🍽 *Открываю управление меню...*\n\n' +
        'Нажмите кнопку ниже чтобы открыть Mini App:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              {
                text: '📱 Открыть меню группы',
                web_app: { url: `${webappUrl}?groupId=${groupId}` }
              }
            ]]
          }
        }
      );
      return;
    }

    // Deep link для добавления блюда: /start add_GROUP_ID
    if (startParam && startParam.toString().startsWith('add_')) {
      const groupId = startParam.toString().replace('add_', '');
      
      await ctx.reply(
        '➕ *Добавление блюда в меню*\n\n' +
        'Нажмите кнопку ниже чтобы открыть Mini App:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              {
                text: '➕ Добавить блюдо',
                web_app: { url: `${webappUrl}?groupId=${groupId}&action=add` }
              }
            ]]
          }
        }
      );
      return;
    }

    // Deep link для голосования в активном poll: /start vote_POLL_ID
    // НОВОЕ: Прямое открытие Mini App без промежуточных экранов
    if (startParam && startParam.toString().startsWith('vote_')) {
      const pollIdStr = startParam.toString().replace('vote_', '');
      const pollId = parseInt(pollIdStr);

      if (isNaN(pollId)) {
        await ctx.reply(
          '❌ **Неверная ссылка на голосование**',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Проверяем, что голосование существует и активно
      const poll = await PollService.getPollById(pollId);

      if (!poll) {
        await ctx.reply(
          '❌ **Голосование не найдено**\n\n' +
          '💡 Возможно, голосование было удалено или ссылка устарела',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      if (poll.status !== 'ACTIVE') {
        await ctx.reply(
          '⚠️ **Голосование завершено**\n\n' +
          '📊 Результаты были отправлены в группу',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Проверяем, не проголосовал ли пользователь уже
      const { VoteService } = await import('../../services/vote.service');
      const existingVote = await VoteService.getUserVoteInPoll(pollId, dbUser.id);

      if (existingVote) {
        await ctx.reply(
          '✅ **Вы уже проголосовали**\n\n' +
          'Ваш голос учтён. Результаты будут объявлены после завершения голосования.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // ПРЯМОЕ открытие Mini App с pollId в URL
      // Отправляем ТОЛЬКО кнопку Web App без лишнего текста
      await ctx.reply(
        '🗳️ Голосование',
        {
          reply_markup: {
            inline_keyboard: [[
              {
                text: '📱 Открыть голосование',
                web_app: { url: `${webappUrl}?pollId=${pollId}` }
              }
            ]]
          }
        }
      );

      logger.info(`Direct deep link: Mini App button sent for poll ${pollId}, user ${user.id}`);
      return;
    }

    // Deep link для быстрого голосования: /start poll_GROUP_ID
    if (startParam && startParam.toString().startsWith('poll_')) {
      const groupId = startParam.toString().replace('poll_', '');
      
      // Проверяем доступность WebApp (только HTTPS URL)
      const isWebAppAvailable = webappUrl && 
        webappUrl.startsWith('https://') && 
        !webappUrl.includes('localhost');
      
      if (isWebAppAvailable) {
        await ctx.reply(
          '🗳 *Быстрое голосование*\n\n' +
          'Нажмите кнопку ниже чтобы открыть Mini App и настроить голосование:',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '🗳 Создать голосование',
                  web_app: { url: `${webappUrl}?groupId=${groupId}&action=poll` }
                }
              ]]
            }
          }
        );
      } else {
        // Fallback без WebApp
        await ctx.reply(
          '🗳 *Быстрое голосование*\n\n' +
          '⚠️ Mini App недоступен в режиме разработки.\n\n' +
          '📱 Используйте команду `/startpoll` в группе для создания голосования.',
          { parse_mode: 'Markdown' }
        );
      }
      return;
    }

    const welcomeText = isNewUser 
      ? `🎉 Добро пожаловать, ${user.first_name}!\n\n` +
        '🤖 Я помогу вашей команде выбирать еду для заказа.\n\n' +
        '✨ **Что я умею:**\n' +
        '• 🗳️ Организовывать голосования за блюда\n' +
        '• 🎲 Выбирать ответственного за заказ\n' +
        '• 🍽️ Управлять меню блюд\n' +
        '• 📊 Показывать статистику\n\n' +
        '💡 **Для начала:**\n' +
        '1. Добавьте меня в группу\n' +
        '2. Дайте мне права администратора\n' +
        '3. Откройте Mini App через кнопку Menu'
      : `👋 С возвращением, ${user.first_name}!`;

    const isGroup = ctx.chat?.type !== 'private';
    
    // Проверяем доступность WebApp (только HTTPS URL)
    const isWebAppAvailable = webappUrl && 
      webappUrl.startsWith('https://') && 
      !webappUrl.includes('localhost');
    
    // В группах web_app кнопки не работают (ограничение Telegram)
    const replyOptions: any = { parse_mode: 'Markdown' };

    if (!isGroup && isWebAppAvailable) {
      replyOptions.reply_markup = {
        inline_keyboard: [
          [
            {
              text: '🚀 Открыть Mini App',
              web_app: { url: webappUrl },
            },
          ],
        ],
      };
    }

    await ctx.reply(welcomeText, replyOptions);

    // Логируем регистрацию
    logger.info('User started bot', {
      userId: dbUser.id,
      telegramId: user.id.toString(),
      username: user.username,
      firstName: user.first_name,
      isNewUser
    });

  } catch (error) {
    logger.error('Error in start command:', error);
    await ctx.reply('❌ Произошла ошибка при регистрации. Попробуйте позже.');
  }
}


