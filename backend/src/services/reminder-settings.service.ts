import { prisma } from '../database/client';
import { logger } from '../utils/logger';

export interface ReminderSettingsData {
  isEnabled: boolean;
  intervalDays: number;
  messageTemplate: string;
  minDebtAge: number;
  maxReminders: number;
}

export interface AdminNotificationSettingsData {
  notifyOnNewUser: boolean;
  notifyOnNewPoll: boolean;
  notifyOnPollEnd: boolean;
  notifyOnDebtPaid: boolean;
}

export class ReminderSettingsService {
  /**
   * Получение настроек напоминаний для группы
   */
  async getReminderSettings(groupId: number, adminId?: number) {
    try {
      let settings = await prisma.debtReminderSettings.findUnique({
        where: { groupId },
      });

      // Если настроек нет — создаём с дефолтными значениями
      if (!settings) {
        if (!adminId) {
          logger.warn(
            `[ReminderSettingsService] Creating default settings for group ${groupId} without adminId`
          );
        }
        settings = await prisma.debtReminderSettings.create({
          data: {
            groupId,
            isEnabled: true,
            intervalDays: 3,
            messageTemplate: this.getDefaultMessageTemplate(),
            minDebtAge: 1,
            maxReminders: 5,
            createdBy: adminId ?? 0,
          },
        });
      }

      return settings;
    } catch (error) {
      logger.error('[ReminderSettingsService] Error getting settings:', error);
      throw error;
    }
  }

  /**
   * Обновление настроек напоминаний
   */
  /**
   * `Partial`, а не полный объект: PUT приходит частичным (интерфейс сохраняет
   * то, что менял пользователь), и Prisma в `update` частичный объект принимает.
   */
  async updateReminderSettings(
    groupId: number,
    data: Partial<ReminderSettingsData>,
    adminId: number
  ) {
    try {
      const settings = await prisma.debtReminderSettings.upsert({
        where: { groupId },
        update: data,
        create: {
          groupId,
          ...data,
          /* `messageTemplate` — единственное поле этой таблицы без значения по
             умолчанию. При частичном PUT по группе, где записи ещё нет,
             создание падало ошибкой Prisma, и клиент получал 500 вместо
             сохранённых настроек. Подставляется тот же шаблон, что и при первом
             чтении настроек. */
          messageTemplate: data.messageTemplate ?? this.getDefaultMessageTemplate(),
          createdBy: adminId,
        },
      });

      logger.info(`[ReminderSettingsService] Settings updated for group ${groupId}`);
      return settings;
    } catch (error) {
      logger.error('[ReminderSettingsService] Error updating settings:', error);
      throw error;
    }
  }

  /**
   * Получение настроек уведомлений админа
   */
  async getAdminNotificationSettings(groupId: number) {
    try {
      let settings = await prisma.adminNotificationSettings.findUnique({
        where: { groupId },
      });

      // Если настроек нет - создаём с дефолтными значениями
      if (!settings) {
        settings = await prisma.adminNotificationSettings.create({
          data: {
            groupId,
            notifyOnNewUser: true,
            notifyOnNewPoll: false,
            notifyOnPollEnd: false,
            notifyOnDebtPaid: false,
          },
        });
      }

      return settings;
    } catch (error) {
      logger.error('[ReminderSettingsService] Error getting admin settings:', error);
      throw error;
    }
  }

  /**
   * Обновление настроек уведомлений админа
   */
  /** `Partial` по той же причине: каждый тумблер отправляет одно поле. */
  async updateAdminNotificationSettings(
    groupId: number,
    data: Partial<AdminNotificationSettingsData>
  ) {
    try {
      const settings = await prisma.adminNotificationSettings.upsert({
        where: { groupId },
        update: data,
        create: {
          groupId,
          ...data,
        },
      });

      logger.info(`[ReminderSettingsService] Admin settings updated for group ${groupId}`);
      return settings;
    } catch (error) {
      logger.error('[ReminderSettingsService] Error updating admin settings:', error);
      throw error;
    }
  }

  /**
   * Дефолтный шаблон сообщения
   */
  private getDefaultMessageTemplate(): string {
    return `💰 Напоминание об оплате

Привет, {userName}!

За тобой обед на {totalAmount}₽:
{debtsList}

Старейший — с {oldestDebtAge}.

Отметь оплату в приложении после перевода 👍`;
  }

  /**
   * Получение всех групп с включенными напоминаниями
   */
  async getGroupsWithEnabledReminders() {
    try {
      const settings = await prisma.debtReminderSettings.findMany({
        where: { isEnabled: true },
        include: {
          group: true,
        },
      });

      return settings;
    } catch (error) {
      logger.error('[ReminderSettingsService] Error getting enabled groups:', error);
      throw error;
    }
  }
}
