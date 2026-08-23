import { Request, Response } from 'express';
import { AdminService } from '../../services/admin.service';
import { ReminderSettingsService } from '../../services/reminder-settings.service';
import { GroupService } from '../../services/group.service';
import { PollService } from '../../services/poll.service';
import { logger } from '../../utils/logger';
import { collapseRepeatedValue, respondIfInvalidInput } from '../middleware/validate';
import {
  adminCleanupQuery,
  adminDebtIdParam,
  adminGroupIdParam,
  adminNotificationSettingsBody,
  adminPollIdParam,
  adminPollParticipantParams,
  adminUserIdParam,
  reminderSettingsBody,
  setPollParticipantBody,
  toggleActiveBody,
  toggleAdminBody,
  toggleParticipatesBody,
} from '../schemas/admin';
import { requireAuthUser } from '../middleware/require-auth-user';
import { PollQueryService } from '../../services/poll-query.service';

export class AdminController {
  private adminService: AdminService;
  private reminderSettingsService: ReminderSettingsService;

  constructor() {
    this.adminService = new AdminService();
    this.reminderSettingsService = new ReminderSettingsService();
  }

  /**
   * Порядок источников `groupId`: query → params → body. Форму значения в
   * каждом из них проверяют контракты на маршруте; здесь остаётся только
   * выбор источника — правило домена, схемой не выражаемое.
   */
  private getGroupId(req: Request, res: Response): number | null {
    /* Тип `unknown`, а не `string`: приведение `as string` здесь стало БЫ
       ложью — контракт тела уже привёл `groupId` к числу, а `query` и `params`
       остаются строками. `Number` принимает и то, и другое; молчаливый каст
       скрыл бы, что три источника несут три разных типа. */
    const raw: unknown = collapseRepeatedValue(
      req.query.groupId ?? req.params.groupId ?? (req.body as { groupId?: unknown })?.groupId
    );

    if (raw === undefined || raw === null || raw === '') {
      res.status(400).json({
        success: false,
        error: 'Missing groupId',
        code: 'INVALID_GROUP_ID',
      });
      return null;
    }

    const groupId = Number(raw);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid group ID',
        code: 'INVALID_GROUP_ID',
      });
      return null;
    }

    return groupId;
  }

  /* Параметр allowGlobalRead и ветка по users.is_admin удалены: администратор
     отвечает только за группу, в которой состоит. Право на чтение и право на
     изменение теперь выводятся из одного источника — роли в group_members. */
  private async requireGroupAdmin(
    req: Request,
    res: Response,
    groupId: number
  ): Promise<boolean> {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
      return false;
    }

    const hasAccess = await GroupService.isUserGroupAdmin(user.id, groupId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: 'Требуются права администратора группы',
        code: 'FORBIDDEN',
      });
      return false;
    }

    return true;
  }

  /**
   * Получение списка всех пользователей с их активностью
   */
  async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const groupId = this.getGroupId(req, res);
      if (!groupId) return;

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const users = await this.adminService.getAllUsers(groupId);
      
      res.json({
        success: true,
        data: users,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error getting all users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get users',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Получение статистики пользователя
   */
  async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = adminUserIdParam.get(req);

      const groupId = this.getGroupId(req, res);
      if (!groupId) return;

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const stats = await this.adminService.getUserStats(userId, groupId);
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error getting user stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user stats',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Назначение/снятие админ-прав
   */
  async toggleAdmin(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = adminUserIdParam.get(req);
      const { isAdmin } = toggleAdminBody.get(req);

      const groupId = this.getGroupId(req, res);
      if (!groupId) return;

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const user = await this.adminService.toggleAdmin(userId, isAdmin, groupId);
      
      res.json({
        success: true,
        data: user,
        message: isAdmin ? 'Админ-права назначены' : 'Админ-права сняты',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error toggling admin:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle admin',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Блокировка/разблокировка пользователя
   */
  async toggleActive(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = adminUserIdParam.get(req);
      const { isActive } = toggleActiveBody.get(req);

      const groupId = this.getGroupId(req, res);
      if (!groupId) return;

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const user = await this.adminService.toggleActive(userId, isActive, groupId);

      res.json({
        success: true,
        data: user,
        message: isActive ? 'Пользователь активирован' : 'Пользователь заблокирован',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error toggling active:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle active',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * PUT /api/admin/users/:userId/participates-in-polls
   * Body: { participates: boolean }
   */
  async toggleParticipatesInPolls(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = adminUserIdParam.get(req);
      const { participates } = toggleParticipatesBody.get(req);

      const groupId = this.getGroupId(req, res);
      if (!groupId) return;
      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const user = await this.adminService.toggleParticipatesInPolls(
        userId,
        participates,
        groupId
      );
      res.json({
        success: true,
        data: user,
        message: participates
          ? 'Пользователь участвует в голосованиях'
          : 'Пользователь исключён из голосований',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error toggling participatesInPolls:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle participatesInPolls',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/admin/polls/:pollId/participants
   */
  async getPollParticipants(req: Request, res: Response): Promise<void> {
    try {
      const { pollId } = adminPollIdParam.get(req);

      const pollGroupId = await PollQueryService.getPollGroupId(pollId);
      if (!pollGroupId) {
        res.status(404).json({ success: false, error: 'Poll not found', code: 'POLL_NOT_FOUND' });
        return;
      }
      const hasAccess = await this.requireGroupAdmin(req, res, pollGroupId);
      if (!hasAccess) return;

      const participants = await this.adminService.getPollParticipants(pollId);
      res.json({ success: true, data: participants, timestamp: new Date().toISOString() });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error getting poll participants:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get poll participants',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * PUT /api/admin/polls/:pollId/participants/:userId
   * Body: { status: 'EXPECTED' | 'EXCLUDED', reason?: string }
   */
  async setPollParticipantStatus(req: Request, res: Response): Promise<void> {
    try {
      const { pollId, userId } = adminPollParticipantParams.get(req);
      const { status, reason } = setPollParticipantBody.get(req);

      const pollGroupId = await PollQueryService.getPollGroupId(pollId);
      if (!pollGroupId) {
        res.status(404).json({ success: false, error: 'Poll not found', code: 'POLL_NOT_FOUND' });
        return;
      }
      const hasAccess = await this.requireGroupAdmin(req, res, pollGroupId);
      if (!hasAccess) return;

      const result = await this.adminService.setPollParticipantStatus(
        pollId,
        userId,
        status,
        typeof reason === 'string' ? reason : undefined
      );

      // Проверяем кворум — если исключили последнего невыпаленного, голосование закроется
      const autoClosed = await PollService.checkQuorumAndComplete(pollId);

      res.json({
        success: true,
        data: result,
        autoClosed,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error setting poll participant status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to set poll participant status',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Получение списка всех должников
   */
  async getAllDebtors(req: Request, res: Response): Promise<void> {
    try {
      const groupId = this.getGroupId(req, res);
      if (!groupId) return;

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const debtors = await this.adminService.getAllDebtors(groupId);
      
      res.json({
        success: true,
        data: debtors,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error getting debtors:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get debtors',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Статистика по задолженностям
   */
  async getDebtStats(req: Request, res: Response): Promise<void> {
    try {
      const groupId = this.getGroupId(req, res);
      if (!groupId) return;

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const stats = await this.adminService.getDebtStats(groupId);
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error getting debt stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get debt stats',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Принудительное списание долга
   */
  async forgiveDebt(req: Request, res: Response): Promise<void> {
    try {
      const { debtId } = adminDebtIdParam.get(req);

      const groupId = this.getGroupId(req, res);
      if (!groupId) return;

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const adminUser = requireAuthUser(req, res);
      if (!adminUser) return;
      const transaction = await this.adminService.forgiveDebt(
        debtId,
        adminUser.id,
        groupId
      );
      
      res.json({
        success: true,
        data: transaction,
        message: 'Долг списан администратором',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error forgiving debt:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to forgive debt',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Отправка напоминаний всем должникам
   */
  async remindAllDebtors(req: Request, res: Response): Promise<void> {
    try {
      const groupId = this.getGroupId(req, res);
      if (!groupId) return;

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const result = await this.adminService.remindAllDebtors(groupId);
      
      res.json({
        success: true,
        data: result,
        message: `Отправлено ${result.sent} напоминаний`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error reminding all debtors:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send reminders',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Отправка напоминания конкретному должнику
   */
  async remindDebtor(req: Request, res: Response): Promise<void> {
    try {
      const { debtId } = adminDebtIdParam.get(req);

      const groupId = this.getGroupId(req, res);
      if (!groupId) return;

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      await this.adminService.remindDebtor(debtId, groupId);
      
      res.json({
        success: true,
        message: 'Напоминание отправлено',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error reminding debtor:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send reminder',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Очистка старых завершённых голосований
   */
  async cleanupOldPolls(req: Request, res: Response): Promise<void> {
    try {
      const { daysOld = 30 } = adminCleanupQuery.get(req);

      const groupId = this.getGroupId(req, res);
      if (!groupId) return;

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;
      
      const result = await this.adminService.cleanupOldPolls(daysOld, groupId);
      
      /* Пропущенные называем вслух: молча удалить меньше, чем просили, — это
         то же враньё, что молча удалить лишнее. */
      const skippedNote = result.skipped
        ? `, пропущено ${result.skipped} — за ними ещё висят непогашенные долги`
        : '';

      res.json({
        success: true,
        data: result,
        message: `Удалено ${result.deleted} голосований старше ${daysOld} дней${skippedNote}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error cleaning old polls:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup polls',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Очистка старых оплаченных транзакций
   */
  async cleanupOldTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { daysOld = 90 } = adminCleanupQuery.get(req);

      const groupId = this.getGroupId(req, res);
      if (!groupId) return;

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;
      
      const result = await this.adminService.cleanupOldTransactions(daysOld, groupId);
      
      res.json({
        success: true,
        data: result,
        message: `Удалено ${result.deleted} транзакций старше ${daysOld} дней`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error cleaning old transactions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup transactions',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Статистика для очистки
   */
  async getCleanupStats(req: Request, res: Response): Promise<void> {
    try {
      const groupId = this.getGroupId(req, res);
      if (!groupId) return;

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const stats = await this.adminService.getCleanupStats(groupId);
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error getting cleanup stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cleanup stats',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Что удалит очистка за конкретный срок.
   *
   * Статистика отдаёт срезы 30/60/90, а поле в интерфейсе принимает любое
   * число: админ подтверждал необратимое удаление за 45 дней, не зная объёма.
   */
  async previewCleanup(req: Request, res: Response): Promise<void> {
    try {
      const { daysOld = 30, kind = 'polls' } = adminCleanupQuery.get(req);

      const groupId = this.getGroupId(req, res);
      if (!groupId) return;

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const data =
        kind === 'polls'
          ? await this.adminService.previewPollCleanup(daysOld, groupId)
          : await this.adminService.previewTransactionCleanup(daysOld, groupId);

      res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error previewing cleanup:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to preview cleanup',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Получение настроек автоматических напоминаний о долгах
   * GET /api/admin/reminder-settings/:groupId
   */
  async getReminderSettings(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = adminGroupIdParam.get(req);

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const requestingUserId: number | undefined = req.user?.id;
      const settings = await this.reminderSettingsService.getReminderSettings(groupId, requestingUserId);
      
      res.json({
        success: true,
        data: settings,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error getting reminder settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get reminder settings',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Обновление настроек автоматических напоминаний о долгах
   * PUT /api/admin/reminder-settings/:groupId
   */
  async updateReminderSettings(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = adminGroupIdParam.get(req);

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const adminUser = requireAuthUser(req, res);
      if (!adminUser) return;
      /* Тело уходит в Prisma целиком, поэтому и схема строгая: см.
         `reminderSettingsBody` в `api/schemas/admin.ts`. */
      const settings = await this.reminderSettingsService.updateReminderSettings(
        groupId,
        reminderSettingsBody.get(req),
        adminUser.id
      );
      
      res.json({
        success: true,
        data: settings,
        message: 'Настройки напоминаний обновлены',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error updating reminder settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update reminder settings',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Получение настроек уведомлений для администраторов
   * GET /api/admin/notification-settings/:groupId
   */
  async getAdminNotificationSettings(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = adminGroupIdParam.get(req);

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const settings = await this.reminderSettingsService.getAdminNotificationSettings(groupId);
      
      res.json({
        success: true,
        data: settings,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error getting admin notification settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get notification settings',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Обновление настроек уведомлений для администраторов
   * PUT /api/admin/notification-settings/:groupId
   */
  async updateAdminNotificationSettings(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = adminGroupIdParam.get(req);

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const settings = await this.reminderSettingsService.updateAdminNotificationSettings(
        groupId,
        adminNotificationSettingsBody.get(req)
      );
      
      res.json({
        success: true,
        data: settings,
        message: 'Настройки уведомлений обновлены',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[AdminController] Error updating admin notification settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update notification settings',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}
