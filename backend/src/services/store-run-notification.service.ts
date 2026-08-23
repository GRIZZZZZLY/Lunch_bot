import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import {
  NotificationType,
  NotificationPriority,
  NotificationResult,
} from '../types/notification.types';
import { createDirectLinkMiniAppUrl } from '../bot/keyboards/webapp.keyboard';
import { escapeHtml } from '../utils/telegram-html';
import { getBotInstance } from '../bot/bot-instance';
import { notificationService } from './notification.service';

/**
 * Уведомления домена «иду в магазин» (store run): приглашение участникам,
 * групповой пост, закрытие сбора, авто-отмена, уборка сообщений и расчёт.
 *
 * Это самый крупный кусок бывшего god-файла `notification.service.ts` — он
 * приехал в файл про опросы по признаку «уведомления же» и не пересекался с
 * ними ничем, кроме `send`. Транспорт теперь импортируется.
 *
 * Все тексты уходят с `parse_mode: 'HTML'`, поэтому каждое подставляемое
 * значение (название магазина, имя инициатора) обязано пройти `escapeHtml`:
 * магазин вида «Пятёрочка & <Магнит>» иначе даёт от Telegram
 * `400 Bad Request: can't parse entities`, и сообщение не доставляется вообще.
 *
 * Состояния у класса нет: бот берётся из общего синглтона.
 */
export class StoreRunNotificationService {
  /**
   * Уведомить всех членов группы (кроме инициатора) о новом магазинном забеге.
   * Отправляется в личку с web_app кнопкой + инструкцией про текстовый ответ.
   */
  async notifyGroupMembersAboutStoreRun(
    storeRunId: number,
  ): Promise<NotificationResult[]> {
    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      include: { initiator: true },
    });
    if (!storeRun) {
      logger.warn('notifyGroupMembersAboutStoreRun: run not found', { storeRunId });
      return [];
    }

    const members = await prisma.groupMember.findMany({
      where: {
        groupId: storeRun.groupId,
        isActive: true,
        participatesInPolls: true,
        userId: { not: storeRun.initiatorId },
        user: {
          isActive: true,
        },
      },
      include: { user: true },
    });
    if (members.length === 0) {
      logger.warn('notifyGroupMembersAboutStoreRun: no eligible recipients', {
        storeRunId,
        groupId: storeRun.groupId,
      });
      return [];
    }
    if (!getBotInstance()) {
      logger.error('notifyGroupMembersAboutStoreRun: bot not initialized', { storeRunId });
      return [];
    }

    const webappUrl = process.env.WEBAPP_URL ?? '';
    const initiatorName = storeRun.initiator.firstName;
    const storeName = storeRun.storeName;
    const collectUntilStr = storeRun.collectUntil.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const message =
      `🛒 <b>${escapeHtml(initiatorName)}</b> идёт в «${escapeHtml(storeName)}»\n\n` +
      `Напиши что тебе взять — сбор до ${collectUntilStr}.\n\n` +
      `<i>Нажми «📱 Заполнить заказ», чтобы открыть список.</i>`;

    const replyMarkup = webappUrl
      ? {
          inline_keyboard: [
            [
              {
                text: '📱 Заполнить заказ',
                web_app: { url: `${webappUrl}?storeRunId=${storeRunId}` },
              },
            ],
          ],
        }
      : undefined;

    const results: NotificationResult[] = [];
    const dmRefs: Array<{ chatId: number; messageId: number }> = [];
    for (const member of members) {
      const tgId = Number(member.user.telegramId);
      const result = await notificationService.send({
        userId: tgId,
        type: NotificationType.STORE_RUN_STARTED,
        priority: NotificationPriority.NORMAL,
        message,
        parseMode: 'HTML',
        replyMarkup,
      });
      if (!result.success) {
        logger.warn('Store run DM failed for user', {
          storeRunId,
          internalUserId: member.userId,
          telegramId: tgId,
          firstName: member.user.firstName,
          error: result.error,
        });
      }
      results.push(result);
      if (result.success && result.messageId != null) {
        dmRefs.push({ chatId: tgId, messageId: result.messageId });
      }
    }

    try {
      await prisma.storeRun.update({
        where: { id: storeRunId },
        data: { dmMessages: JSON.stringify(dmRefs) },
      });
    } catch (persistError: any) {
      logger.warn('notifyGroupMembersAboutStoreRun: failed to persist dmMessages', {
        storeRunId,
        error: persistError?.message ?? persistError,
      });
    }

    const successful = results.filter((r) => r.success).length;
    logger.info('Store run start notifications sent', {
      storeRunId,
      recipients: members.length,
      successful,
      failed: members.length - successful,
    });

    return results;
  }

  /**
   * Уведомить участников, уже добавивших позиции, что инициатор в магазине
   * и приём заказов закрыт.
   */
  async notifyShoppingStarted(storeRunId: number): Promise<NotificationResult[]> {
    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      include: { initiator: true },
    });
    if (!storeRun) return [];

    const items = await prisma.storeItem.findMany({
      where: { storeRunId },
      select: { userId: true },
    });
    const participantIds = Array.from(
      new Set(items.map((i) => i.userId).filter((id) => id !== storeRun.initiatorId)),
    );
    if (participantIds.length === 0) return [];

    const users = await prisma.user.findMany({
      where: {
        id: { in: participantIds },
        isActive: true,
      },
      select: { id: true, telegramId: true, firstName: true },
    });
    if (users.length === 0) return [];
    if (!getBotInstance()) {
      logger.error('notifyShoppingStarted: bot not initialized', { storeRunId });
      return [];
    }

    const initiatorName = storeRun.initiator.firstName;
    const storeName = storeRun.storeName;
    const message =
      `🛍 <b>${escapeHtml(initiatorName)}</b> пошёл в «${escapeHtml(storeName)}».\n` +
      `Сбор заказов закрыт, скоро будут цены.`;

    const results: NotificationResult[] = [];
    for (const u of users) {
      const result = await notificationService.send({
        userId: Number(u.telegramId),
        type: NotificationType.STORE_RUN_SHOPPING,
        priority: NotificationPriority.NORMAL,
        message,
        parseMode: 'HTML',
      });
      results.push(result);
    }

    logger.info('Store run shopping-started notifications sent', {
      storeRunId,
      recipients: users.length,
    });

    return results;
  }

  /**
   * Уведомить инициатора, что его забег авто-отменён по таймауту SHOPPING
   * (ушёл в магазин, не внёс цены вовремя). Групповой пост и ЛС-приглашения
   * убирает deleteStoreRunMessages отдельно.
   */
  async notifyStoreRunExpired(storeRunId: number): Promise<void> {
    if (!getBotInstance()) {
      logger.error('notifyStoreRunExpired: bot not initialized', { storeRunId });
      return;
    }
    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      include: { initiator: true },
    });
    if (!storeRun) return;

    const message =
      `⏱ Забег «${escapeHtml(storeRun.storeName)}» авто-отменён — ` +
      `цены не внесены вовремя. Запусти новый, если ещё актуально.`;

    await notificationService.send({
      userId: Number(storeRun.initiator.telegramId),
      type: NotificationType.STORE_RUN_SHOPPING,
      priority: NotificationPriority.NORMAL,
      message,
      parseMode: 'HTML',
    });

    logger.info('Store run expired notification sent to initiator', { storeRunId });
  }

  /**
   * Опубликовать сообщение о новом забеге в групповой чат.
   * web_app кнопки в группах запрещены, поэтому даём URL-deep-link
   * t.me/<bot>?start=storerun_<id> — он открывает личку, где /start
   * присылает web_app кнопку. Так о забеге узнают даже те, кто ещё ни разу
   * не писал боту в личку (DM-рассылка их не достанет).
   */
  async postStoreRunToGroup(storeRunId: number): Promise<NotificationResult> {
    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      include: {
        initiator: true,
        group: { select: { telegramId: true } },
      },
    });
    if (!storeRun) {
      logger.warn('postStoreRunToGroup: run not found', { storeRunId });
      return { success: false, error: 'run_not_found', sentAt: new Date() };
    }
    const bot = getBotInstance();
    if (!bot) {
      logger.error('postStoreRunToGroup: bot not initialized', { storeRunId });
      return { success: false, error: 'bot_not_initialized', sentAt: new Date() };
    }

    const initiatorName = storeRun.initiator.firstName;
    const storeName = storeRun.storeName;
    const collectUntilStr = storeRun.collectUntil.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const message =
      `🛒 <b>${escapeHtml(initiatorName)}</b> идёт в «${escapeHtml(storeName)}»\n\n` +
      `Напиши, что тебе взять — сбор заказов до ${collectUntilStr}.`;

    try {
      const sent = await bot.api.sendMessage(
        Number(storeRun.group.telegramId),
        message,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🛒 Заказать',
                  url: createDirectLinkMiniAppUrl(`storerun_${storeRunId}`),
                },
              ],
            ],
          },
        },
      );
      try {
        await prisma.storeRun.update({
          where: { id: storeRunId },
          data: { groupMessageId: sent.message_id },
        });
      } catch (persistError: any) {
        logger.warn('postStoreRunToGroup: failed to persist groupMessageId', {
          storeRunId,
          error: persistError?.message ?? persistError,
        });
      }
      logger.info('Store run posted to group', { storeRunId, messageId: sent.message_id });
      return { success: true, messageId: sent.message_id, sentAt: new Date() };
    } catch (error: any) {
      logger.error('postStoreRunToGroup: failed to send', {
        storeRunId,
        groupTelegramId: String(storeRun.group.telegramId),
        error: error?.message ?? error,
      });
      return { success: false, error: error?.message ?? 'send_failed', sentAt: new Date() };
    }
  }

  /**
   * Уведомить инициатора, что приём заказов закрылся по таймеру.
   * При ручном старте инициатор сам нажал кнопку и так знает — этот метод
   * вызывается только из cron авто-закрытия.
   */
  async notifyInitiatorCollectionClosed(storeRunId: number): Promise<NotificationResult> {
    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      include: { initiator: true },
    });
    if (!storeRun) {
      return { success: false, error: 'run_not_found', sentAt: new Date() };
    }
    if (!getBotInstance()) {
      logger.error('notifyInitiatorCollectionClosed: bot not initialized', { storeRunId });
      return { success: false, error: 'bot_not_initialized', sentAt: new Date() };
    }

    const itemsCount = await prisma.storeItem.count({ where: { storeRunId } });
    const webappUrl = process.env.WEBAPP_URL ?? '';
    const storeName = storeRun.storeName;

    const message =
      `🛍 Сбор заказов по «${escapeHtml(storeName)}» закрыт по таймеру.\n` +
      `Набралось позиций: ${itemsCount}. Открой список, иди в магазин и проставь цены.`;

    const replyMarkup = webappUrl
      ? {
          inline_keyboard: [
            [
              {
                text: '📱 Открыть список',
                web_app: { url: `${webappUrl}?storeRunId=${storeRunId}` },
              },
            ],
          ],
        }
      : undefined;

    return notificationService.send({
      userId: Number(storeRun.initiator.telegramId),
      type: NotificationType.STORE_RUN_COLLECTION_CLOSED,
      priority: NotificationPriority.NORMAL,
      message,
      parseMode: 'HTML',
      replyMarkup,
    });
  }

  /**
   * Удалить разосланные сообщения забега (групповой пост + личные приглашения).
   * Вызывается при отмене забега. Толерантен к ошибкам: сообщение могло быть
   * удалено вручную или устареть (>48ч) — такие падения логируем и пропускаем.
   *
   * Цикл с вызовом на итерацию здесь неустраним, и это не недосмотр: Telegram
   * не даёт батч-удаления — `deleteMessages` работает только внутри одного
   * чата, а приглашения ушли в разные личные чаты. Параллелить тоже нельзя:
   * лимиты API считаются по чатам, и залп удалений возвращает 429.
   * Статические анализаторы будут показывать это место как N+1 — пометка
   * стоит здесь, чтобы к находке не возвращались.
   */
  async deleteStoreRunMessages(storeRunId: number): Promise<void> {
    const bot = getBotInstance();
    if (!bot) {
      logger.error('deleteStoreRunMessages: bot not initialized', { storeRunId });
      return;
    }

    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      select: {
        groupMessageId: true,
        dmMessages: true,
        group: { select: { telegramId: true } },
      },
    });
    if (!storeRun) {
      logger.warn('deleteStoreRunMessages: run not found', { storeRunId });
      return;
    }

    let deleted = 0;
    let failed = 0;

    if (storeRun.groupMessageId != null) {
      try {
        await bot.api.deleteMessage(
          Number(storeRun.group.telegramId),
          storeRun.groupMessageId,
        );
        deleted++;
      } catch (error: any) {
        failed++;
        logger.warn('deleteStoreRunMessages: group message delete failed', {
          storeRunId,
          error: error?.message ?? error,
        });
      }
    }

    if (storeRun.dmMessages) {
      let refs: Array<{ chatId: number; messageId: number }> = [];
      try {
        refs = JSON.parse(storeRun.dmMessages);
      } catch {
        logger.warn('deleteStoreRunMessages: invalid dmMessages JSON', { storeRunId });
        refs = [];
      }
      for (const ref of refs) {
        try {
          await bot.api.deleteMessage(ref.chatId, ref.messageId);
          deleted++;
        } catch (error: any) {
          failed++;
          logger.warn('deleteStoreRunMessages: dm delete failed', {
            storeRunId,
            chatId: ref.chatId,
            error: error?.message ?? error,
          });
        }
      }
    }

    logger.info('Store run messages cleaned up', { storeRunId, deleted, failed });
  }

  /**
   * Отредактировать групповой пост завершённого забега: текст «завершён» +
   * убрать inline-кнопку (reply_markup НЕ передаём ⇒ Telegram её снимает).
   * Толерантен к ошибкам (старое сообщение / not modified / удалено).
   */
  async markStoreRunGroupCompleted(storeRunId: number): Promise<void> {
    const bot = getBotInstance();
    if (!bot) {
      logger.error('markStoreRunGroupCompleted: bot not initialized', { storeRunId });
      return;
    }

    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      select: {
        groupMessageId: true,
        storeName: true,
        group: { select: { telegramId: true } },
      },
    });
    if (!storeRun) {
      logger.warn('markStoreRunGroupCompleted: run not found', { storeRunId });
      return;
    }
    if (storeRun.groupMessageId == null) {
      logger.info('markStoreRunGroupCompleted: no group message to edit', { storeRunId });
      return;
    }

    const text =
      `✅ Забег в «${escapeHtml(storeRun.storeName)}» завершён.\n` +
      `Должникам ушли суммы и реквизиты в личку.`;

    try {
      await bot.api.editMessageText(
        Number(storeRun.group.telegramId),
        storeRun.groupMessageId,
        text,
        { parse_mode: 'HTML' },
      );
      logger.info('Store run group message marked completed', { storeRunId });
    } catch (error: any) {
      logger.warn('markStoreRunGroupCompleted: edit failed', {
        storeRunId,
        error: error?.message ?? error,
      });
    }
  }

  /**
   * Уведомить участников забега, у которых НЕ возникло долга (их позиции не
   * куплены), что забег завершён и платить не нужно. Должникам отдельный ДМ с
   * долгом шлёт BudgetService — их сюда не включаем.
   */
  async notifyStoreRunParticipantsNoDebt(
    storeRunId: number,
  ): Promise<NotificationResult[]> {
    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      select: { initiatorId: true, storeName: true },
    });
    if (!storeRun) return [];

    const items = await prisma.storeItem.findMany({
      where: { storeRunId },
      select: { userId: true },
    });
    const participantIds = Array.from(
      new Set(items.map((i) => i.userId).filter((id) => id !== storeRun.initiatorId)),
    );
    if (participantIds.length === 0) return [];

    const debtorRows = await prisma.transaction.findMany({
      where: { storeRunId, status: 'PENDING' },
      select: { fromUserId: true },
    });
    const debtorIds = new Set(debtorRows.map((t) => t.fromUserId));

    const noDebtIds = participantIds.filter((id) => !debtorIds.has(id));
    if (noDebtIds.length === 0) return [];

    const users = await prisma.user.findMany({
      where: {
        id: { in: noDebtIds },
        isActive: true,
      },
      select: { id: true, telegramId: true },
    });
    if (users.length === 0) return [];
    if (!getBotInstance()) {
      logger.error('notifyStoreRunParticipantsNoDebt: bot not initialized', { storeRunId });
      return [];
    }

    const message =
      `✅ Забег в «${escapeHtml(storeRun.storeName)}» завершён.\n` +
      `Из твоего ничего не куплено — платить не надо.`;

    const results: NotificationResult[] = [];
    for (const u of users) {
      const result = await notificationService.send({
        userId: Number(u.telegramId),
        type: NotificationType.STORE_RUN_SETTLED,
        priority: NotificationPriority.NORMAL,
        message,
        parseMode: 'HTML',
      });
      results.push(result);
    }

    logger.info('Store run no-debt notifications sent', {
      storeRunId,
      recipients: users.length,
    });

    return results;
  }
}

export const storeRunNotificationService =
  new StoreRunNotificationService();
