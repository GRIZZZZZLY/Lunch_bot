import { BotContext } from '../../types/bot.types';
import { Bot } from 'grammy';
import { logger } from '../../utils/logger';
import { GroupService } from '../../services/group.service';
import { UserService } from '../../services/user.service';
import { createGroupWelcomeKeyboard } from '../keyboards/webapp.keyboard';
import { WELCOME_GREETING } from '../handlers/group.handlers';

/**
 * Маппинг Telegram chat-member статуса в роль участника группы в нашей БД.
 */
export function mapChatMemberStatusToRole(status: string): 'CREATOR' | 'ADMIN' | 'MEMBER' {
  if (status === 'creator') return 'CREATOR';
  if (status === 'administrator') return 'ADMIN';
  return 'MEMBER';
}

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
          const group = await GroupService.upsertGroup({
            telegramId: chat.id.toString(),
            title: chat.title || 'Unknown Group',
            type: chat.type,
          });

          // Тот, кто добавил бота, становится per-group админом (CREATOR).
          // ctx.myChatMember.from — пользователь, выполнивший действие.
          const adder = ctx.myChatMember.from;
          if (adder && !adder.is_bot) {
            try {
              const adderUser = await UserService.upsertUser({
                telegramId: adder.id.toString(),
                username: adder.username,
                firstName: adder.first_name,
                lastName: adder.last_name,
              });
              await GroupService.ensureMemberRole(group.id, adderUser.id, 'CREATOR');
              logger.info('Bot adder promoted to group CREATOR', {
                chatId: chat.id,
                adderId: adder.id,
              });
            } catch (adderError) {
              logger.warn('Failed to promote bot adder', {
                chatId: chat.id,
                error: adderError instanceof Error ? adderError.message : String(adderError),
              });
            }
          }

          // Сразу регистрируем админов и создателя группы.
          // Bot API не даёт получить полный список участников — только админов.
          // Остальных подхватим через chat_member / new_chat_members / authMiddleware.
          try {
            const admins = await ctx.api.getChatAdministrators(chat.id);
            let synced = 0;
            for (const admin of admins) {
              if (admin.user.is_bot) continue;
              const dbUser = await UserService.upsertUser({
                telegramId: admin.user.id.toString(),
                username: admin.user.username,
                firstName: admin.user.first_name,
                lastName: admin.user.last_name,
              });
              await GroupService.ensureMemberRole(
                group.id,
                dbUser.id,
                mapChatMemberStatusToRole(admin.status)
              );
              synced++;
            }
            logger.info('Synced group admins on bot join', {
              chatId: chat.id,
              syncedCount: synced,
              totalAdmins: admins.length,
            });
          } catch (adminError) {
            logger.warn('Failed to sync group admins on bot join', {
              chatId: chat.id,
              error: adminError instanceof Error ? adminError.message : String(adminError),
            });
          }

          // Настраиваем Menu Button для этой группы
          await setupMenuButtonForGroup(bot, chat.id);

          // Приветственное сообщение: callback «Я обедаю» (ловит клик, регистрирует, дописывает
          // имя в список) + Direct Link «Открыть Mini App» (открывает апп напрямую из группы;
          // web_app в группах запрещён, а ?start=… вёл бы в личку бота).
          await ctx.reply(WELCOME_GREETING, {
            reply_markup: createGroupWelcomeKeyboard(chat.id),
          });
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
   * Обработка изменений статуса участников группы.
   * Требует подписки `chat_member` в allowed_updates (см. bot.ts) +
   * админский статус бота — иначе Telegram не присылает событие.
   *
   * Регистрирует приглашённых участников в БД (upsert), даже если они
   * никогда не писали сообщений и не нажимали /start.
   */
  bot.on('chat_member', async (ctx) => {
    try {
      const chat = ctx.chat;
      if (chat.type !== 'group' && chat.type !== 'supergroup') return;

      const oldStatus = ctx.chatMember.old_chat_member.status;
      const newStatus = ctx.chatMember.new_chat_member.status;
      const memberUser = ctx.chatMember.new_chat_member.user;
      if (!memberUser?.id || memberUser.is_bot) return;

      // Гарантируем существование группы (на случай пропущенного my_chat_member)
      const group = await GroupService.upsertGroup({
        telegramId: chat.id.toString(),
        title: chat.title || 'Unknown Group',
        type: chat.type,
      });

      // Обновим название, если изменилось
      if (chat.title) {
        await GroupService.updateGroup(group.id, { title: chat.title });
      }

      const ACTIVE_STATUSES = ['member', 'administrator', 'creator', 'restricted'];
      const INACTIVE_STATUSES = ['left', 'kicked'];

      const isJoining =
        INACTIVE_STATUSES.includes(oldStatus) && ACTIVE_STATUSES.includes(newStatus);
      const isLeaving =
        ACTIVE_STATUSES.includes(oldStatus) && INACTIVE_STATUSES.includes(newStatus);

      if (isJoining) {
        const dbUser = await UserService.upsertUser({
          telegramId: memberUser.id.toString(),
          username: memberUser.username,
          firstName: memberUser.first_name,
          lastName: memberUser.last_name,
        });
        await GroupService.addMemberToGroup(group.id, dbUser.id);
        logger.info('Member joined group via chat_member', {
          chatId: chat.id,
          userId: memberUser.id,
          username: memberUser.username,
        });
      } else if (isLeaving) {
        const dbUser = await UserService.getUserByTelegramId(BigInt(memberUser.id));
        if (dbUser) {
          await GroupService.removeMemberFromGroup(group.id, dbUser.id);
          logger.info('Member left group via chat_member', {
            chatId: chat.id,
            userId: memberUser.id,
          });
        }
      }
    } catch (error) {
      logger.error('Error handling chat_member event:', error);
    }
  });

  /**
   * Резервный путь регистрации: сервисное сообщение new_chat_members.
   * Срабатывает при добавлении участника через "Add Member" — даже если
   * у бота нет прав на chat_member updates. Требует privacy mode OFF
   * у бота (через @BotFather: /setprivacy → Disable).
   */
  bot.on('message:new_chat_members', async (ctx) => {
    try {
      const chat = ctx.chat;
      if (chat.type !== 'group' && chat.type !== 'supergroup') return;

      const newMembers = ctx.message.new_chat_members ?? [];
      if (newMembers.length === 0) return;

      const group = await GroupService.upsertGroup({
        telegramId: chat.id.toString(),
        title: chat.title || 'Unknown Group',
        type: chat.type,
      });

      for (const memberUser of newMembers) {
        if (memberUser.is_bot) continue;
        const dbUser = await UserService.upsertUser({
          telegramId: memberUser.id.toString(),
          username: memberUser.username,
          firstName: memberUser.first_name,
          lastName: memberUser.last_name,
        });
        await GroupService.addMemberToGroup(group.id, dbUser.id);
        logger.info('Member joined group via new_chat_members', {
          chatId: chat.id,
          userId: memberUser.id,
          username: memberUser.username,
        });
      }
    } catch (error) {
      logger.error('Error handling new_chat_members:', error);
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
