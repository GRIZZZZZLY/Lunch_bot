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
      await ctx.reply('❌ Не удалось распознать пользователя. Перезапусти бота командой /start');
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
        'Нажми кнопку ниже, чтобы открыть приложение:',
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
        'Нажми кнопку ниже, чтобы открыть приложение:',
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

      // Проверяем, не проголосовал ли пользователь уже.
      // Здесь важен только факт наличия голоса: голосование мультивыборное,
      // и «первый голос» отдельного смысла не имеет.
      const { VoteService } = await import('../../services/vote.service');
      const existingVotes = await VoteService.getUserVotes(pollId, dbUser.id);

      if (existingVotes.length > 0) {
        await ctx.reply(
          '✅ **Ты уже проголосовал**\n\n' +
          'Твой голос учтён. Результаты объявим после завершения голосования.',
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

      logger.info('Poll Mini App button sent', { pollId });
      return;
    }

    // Deep link для магазинного забега: /start storerun_<STORE_RUN_ID>
    if (startParam && startParam.toString().startsWith('storerun_')) {
      const storeRunIdStr = startParam.toString().replace('storerun_', '');
      const storeRunId = parseInt(storeRunIdStr);

      if (isNaN(storeRunId)) {
        await ctx.reply('❌ Неверная ссылка на забег', { parse_mode: 'Markdown' });
        return;
      }

      await ctx.reply(
        '🛒 Открываю заказ...',
        {
          reply_markup: {
            inline_keyboard: [[
              {
                text: '📱 Заполнить заказ',
                web_app: { url: `${webappUrl}?storeRunId=${storeRunId}` },
              },
            ]],
          },
        },
      );
      logger.info('Store run Mini App button sent', { storeRunId });
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
          'Нажми кнопку ниже, чтобы открыть приложение и настроить голосование:',
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
          '📱 Используй команду `/startpoll` в группе, чтобы создать голосование.',
          { parse_mode: 'Markdown' }
        );
      }
      return;
    }

    const welcomeText = isNewUser
      ? `🎉 Привет, ${user.first_name}!\n\n` +
        'Я Rocket Lunch — помогаю команде выбирать, что заказать на обед.\n\n' +
        '*Что умею:*\n' +
        '• голосования за блюда\n' +
        '• выбор ответственного за заказ\n' +
        '• меню и статистика\n\n' +
        '*Чтобы начать:*\n' +
        '1. Добавь меня в группу\n' +
        '2. Дай права администратора\n' +
        '3. Открой приложение кнопкой Menu'
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
    await ctx.reply('❌ Произошла ошибка при регистрации. Попробуй позже.');
  }
}


