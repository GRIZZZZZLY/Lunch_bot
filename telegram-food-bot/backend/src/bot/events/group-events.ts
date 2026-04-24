import { BotContext } from '../../types/bot.types';
import { Bot } from 'grammy';
import { logger } from '../../utils/logger';
import { GroupService } from '../../services/group.service';
import { UserService } from '../../services/user.service';

/**
 * Настройка обработчиков событий группы
 */
export function setupGroupEvents(bot: Bot<BotContext>) {
  /**
   * Обработка добавления бота в группу
   */
  bot.on('my_chat_member', async (ctx) => {
    try {
      const oldStatus = ctx.myChatMember.old_chat_member.status;
      const newStatus = ctx.myChatMember.new_chat_member.status;
      const chat = ctx.chat;

      // Бот был добавлен в группу
      if (
        (oldStatus === 'left' || oldStatus === 'kicked') &&
        (newStatus === 'member' || newStatus === 'administrator')
      ) {
        logger.info('Bot added to group', {
          chatId: chat.id,
          title: chat.title,
          type: chat.type,
        });

        // Сохраняем группу в базу данных
        if (chat.type === 'group' || chat.type === 'supergroup') {
          await GroupService.upsertGroup({
            telegramId: chat.id.toString(),
            title: chat.title || 'Unknown Group',
            type: chat.type,
          });

          // Настраиваем Menu Button для этой группы
          await setupMenuButtonForGroup(bot, chat.id);

          // Отправляем приветственное сообщение
          const deepLink = `https://t.me/${ctx.me.username}?start=menu_${chat.id}`;
          
          await ctx.reply(
            '👋 Бот активен. Откройте Mini App для меню и голосований.',
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🍽 Открыть Mini App',
                      url: deepLink,
                    },
                  ],
                ],
              },
            }
          );
        }
      }

      // Бот был удален из группы
      if (
        (oldStatus === 'member' || oldStatus === 'administrator') &&
        (newStatus === 'left' || newStatus === 'kicked')
      ) {
        logger.info('Bot removed from group', {
          chatId: chat.id,
          title: chat.title,
        });

        // Деактивируем группу
        if (chat.type === 'group' || chat.type === 'supergroup') {
          const group = await GroupService.getGroupByTelegramId(chat.id.toString());
          if (group) {
            await GroupService.deactivateGroup(group.id);
          }
        }
      }
    } catch (error) {
      logger.error('Error handling my_chat_member event:', error);
    }
  });

  /**
   * Обработка изменений в группе (название, участники и т.д.)
   */
  bot.on('chat_member', async (ctx) => {
    try {
      const chat = ctx.chat;
      const oldStatus = ctx.chatMember.old_chat_member.status;
      const newStatus = ctx.chatMember.new_chat_member.status;
      const memberUser = ctx.chatMember.new_chat_member.user;
      
      // Если изменилось название группы
      if (chat.type === 'group' || chat.type === 'supergroup') {
        const group = await GroupService.getGroupByTelegramId(chat.id.toString());
        if (group) {
          await GroupService.updateGroup(group.id, {
            title: chat.title,
          });

          if (memberUser?.id) {
            const user = await UserService.getUserByTelegramId(
              BigInt(memberUser.id)
            );

            if (user) {
              if (
                (oldStatus === 'member' || oldStatus === 'administrator') &&
                (newStatus === 'left' || newStatus === 'kicked')
              ) {
                await GroupService.removeMemberFromGroup(group.id, user.id);
              }

              if (
                (oldStatus === 'left' || oldStatus === 'kicked') &&
                (newStatus === 'member' || newStatus === 'administrator')
              ) {
                await GroupService.addMemberToGroup(group.id, user.id);
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error handling chat_member event:', error);
    }
  });
}

/**
 * Настройка Menu Button для конкретной группы
 */
export async function setupMenuButtonForGroup(bot: Bot<BotContext>, chatId: number) {
  try {
    const webappUrl = process.env.WEBAPP_URL || 'http://localhost:5173';
    
    await bot.api.setChatMenuButton({
      chat_id: chatId,
      menu_button: {
        type: 'web_app',
        text: '🍽 Обед',
        web_app: {
          url: `${webappUrl}?groupId=${chatId}`,
        },
      },
    });

    logger.info('Menu button set for group', { chatId });
  } catch (error) {
    logger.error('Error setting menu button for group:', error);
  }
}

/**
 * Настройка Menu Button для личных чатов (по умолчанию)
 */
export async function setupDefaultMenuButton(bot: Bot<BotContext>) {
  try {
    const webappUrl = process.env.WEBAPP_URL || 'http://localhost:5173';
    
    // Проверяем что URL использует HTTPS (требование Telegram WebApp)
    if (!webappUrl.startsWith('https://')) {
      logger.warn('Menu button не установлен: WebApp URL должен использовать HTTPS', { webappUrl });
      return;
    }
    
    await bot.api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: '🍽 Обед',
        web_app: {
          url: webappUrl,
        },
      },
    });

    logger.info('Default menu button set for private chats', { webappUrl });
  } catch (error) {
    logger.error('Error setting default menu button:', error);
  }
}
