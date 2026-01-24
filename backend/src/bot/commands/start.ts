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
    const dbUser = await UserService.upsertUser({
      telegramId: user.id.toString(),
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    const isNewUser = ctx.session?.step !== 'registered';
    ctx.session.step = 'registered';

    // Обработка deep links (параметры после /start)
    const startParam = ctx.match; // Например: "menu_-1001234567"
    const webappUrl = process.env.WEBAPP_URL || 'https://ergodic-genevieve-unsulphurized.ngrok-free.dev';

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
        '3. Используйте /help для списка команд'
      : `👋 С возвращением, ${user.first_name}!`;

    const isGroup = ctx.chat?.type !== 'private';
    
    // Проверяем доступность WebApp (только HTTPS URL)
    const isWebAppAvailable = webappUrl && 
      webappUrl.startsWith('https://') && 
      !webappUrl.includes('localhost');
    
    // В группах web_app кнопки не работают (ограничение Telegram)
    const keyboard = {
      inline_keyboard: isGroup ? [
        // Для групп - обычные кнопки
        [
          { text: '🍽️ Меню', callback_data: 'menu' },
          { text: '📖 Команды', callback_data: 'help' }
        ],
        [
          { text: '👥 О боте', callback_data: 'about' },
          { text: '👑 Админы', callback_data: 'show_admins' }
        ]
      ] : isWebAppAvailable ? [
        // Для личных чатов с HTTPS - с кнопкой Mini App
        [
          {
            text: '🚀 Открыть Mini App',
            web_app: { url: webappUrl }
          }
        ],
        [
          { text: '🍽️ Меню', callback_data: 'menu' },
          { text: '📖 Команды', callback_data: 'help' }
        ],
        [
          { text: '👥 О боте', callback_data: 'about' },
          { text: '👑 Админы', callback_data: 'show_admins' }
        ]
      ] : [
        // Для личных чатов без HTTPS - только обычные кнопки
        [
          { text: '🍽️ Меню', callback_data: 'menu' },
          { text: '📖 Команды', callback_data: 'help' }
        ],
        [
          { text: '👥 О боте', callback_data: 'about' },
          { text: '👑 Админы', callback_data: 'show_admins' }
        ]
      ]
    };

    await ctx.reply(welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    // Логируем регистрацию
    logger.info('User started bot', {
      userId: dbUser.id,
      telegramId: user.id.toString(),
      username: user.username,
      firstName: user.first_name,
      isNewUser
    });

    // Если это группа, объясняем функционал
    if (isGroup) {
      setTimeout(async () => {
        await ctx.reply(
          '👥 **Групповой режим активирован!**\n\n' +
          '🔧 **Для полного функционала:**\n' +
          '1. Сделайте меня администратором группы\n' +
          '2. Используйте /startpoll для запуска голосования\n' +
          '3. Участники смогут голосовать за блюда\n\n' +
          '📱 **Для управления меню:**\n' +
          '• Откройте бота [@rocket_lunch_bot](https://t.me/rocket_lunch_bot) в личных сообщениях\n' +
          '• Нажмите на кнопку Menu внизу экрана\n' +
          '• Или используйте команду /menu в личке\n\n' +
          '⚡ Попробуйте /help для списка команд',
          { parse_mode: 'Markdown' }
        );
      }, 1000);
    }

  } catch (error) {
    logger.error('Error in start command:', error);
    await ctx.reply('❌ Произошла ошибка при регистрации. Попробуйте позже.');
  }
}


