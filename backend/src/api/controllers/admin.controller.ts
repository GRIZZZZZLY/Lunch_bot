import { Request, Response } from 'express';
import { AdminService } from '../../services/admin.service';
import { ReminderSettingsService } from '../../services/reminder-settings.service';
import { GroupService } from '../../services/group.service';
import { PollService } from '../../services/poll.service';
import { logger } from '../../utils/logger';
import { getParam } from '../../utils/request-params';
import { requireAuthUser } from '../middleware/require-auth-user';

export class AdminController {
  private adminService: AdminService;
  private reminderSettingsService: ReminderSettingsService;

  constructor() {
    this.adminService = new AdminService();
    this.reminderSettingsService = new ReminderSettingsService();
  }

  private getGroupId(req: Request, res: Response): number | null {
    const groupIdRaw =
      (req.query.groupId as string | undefined) ||
      (req.params.groupId as string | undefined) ||
      (req.body?.groupId as string | undefined);

    if (!groupIdRaw) {
      res.status(400).json({
        success: false,
        error: 'Missing groupId',
        code: 'INVALID_GROUP_ID',
      });
      return null;
    }

    const groupId = parseInt(groupIdRaw, 10);
    if (isNaN(groupId)) {
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
      const userId = parseInt(getParam(req.params, 'userId'), 10);
      
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
          code: 'INVALID_USER_ID',
        });
        return;
      }

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
      const userId = parseInt(getParam(req.params, 'userId'), 10);
      const { isAdmin } = req.body;

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
          code: 'INVALID_USER_ID',
        });
        return;
      }

      if (typeof isAdmin !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'isAdmin must be boolean',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

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
      const userId = parseInt(getParam(req.params, 'userId'), 10);
      const { isActive } = req.body;

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
          code: 'INVALID_USER_ID',
        });
        return;
      }

      if (typeof isActive !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'isActive must be boolean',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

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
      const userId = parseInt(getParam(req.params, 'userId'), 10);
      const { participates } = req.body;

      if (isNaN(userId)) {
        res.status(400).json({ success: false, error: 'Invalid user ID', code: 'INVALID_USER_ID' });
        return;
      }
      if (typeof participates !== 'boolean') {
        res.status(400).json({ success: false, error: 'participates must be boolean', code: 'VALIDATION_ERROR' });
        return;
      }

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
      const pollId = parseInt(getParam(req.params, 'pollId'), 10);
      if (isNaN(pollId)) {
        res.status(400).json({ success: false, error: 'Invalid poll ID', code: 'INVALID_POLL_ID' });
        return;
      }

      const pollGroupId = await PollService.getPollGroupId(pollId);
      if (!pollGroupId) {
        res.status(404).json({ success: false, error: 'Poll not found', code: 'POLL_NOT_FOUND' });
        return;
      }
      const hasAccess = await this.requireGroupAdmin(req, res, pollGroupId);
      if (!hasAccess) return;

      const participants = await this.adminService.getPollParticipants(pollId);
      res.json({ success: true, data: participants, timestamp: new Date().toISOString() });
    } catch (error) {
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
      const pollId = parseInt(getParam(req.params, 'pollId'), 10);
      const userId = parseInt(getParam(req.params, 'userId'), 10);
      const { status, reason } = req.body;

      if (isNaN(pollId) || isNaN(userId)) {
        res.status(400).json({ success: false, error: 'Invalid IDs', code: 'VALIDATION_ERROR' });
        return;
      }
      if (status !== 'EXPECTED' && status !== 'EXCLUDED') {
        res.status(400).json({
          success: false,
          error: 'status must be EXPECTED or EXCLUDED',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const pollGroupId = await PollService.getPollGroupId(pollId);
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
      const debtId = parseInt(getParam(req.params, 'debtId'), 10);

      if (isNaN(debtId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid debt ID',
          code: 'INVALID_DEBT_ID',
        });
        return;
      }

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
      const debtId = parseInt(getParam(req.params, 'debtId'), 10);

      if (isNaN(debtId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid debt ID',
          code: 'INVALID_DEBT_ID',
        });
        return;
      }

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
      const daysOld = parseInt(req.query.daysOld as string) || 30;

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
      const daysOld = parseInt(req.query.daysOld as string) || 90;

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
      const daysOld = parseInt(req.query.daysOld as string) || 30;
      const kind = req.query.kind === 'transactions' ? 'transactions' : 'polls';

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
      const groupId = parseInt(getParam(req.params, 'groupId'), 10);

      if (isNaN(groupId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid group ID',
          code: 'INVALID_GROUP_ID',
        });
        return;
      }

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
      const groupId = parseInt(getParam(req.params, 'groupId'), 10);

      if (isNaN(groupId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid group ID',
          code: 'INVALID_GROUP_ID',
        });
        return;
      }

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const adminUser = requireAuthUser(req, res);
      if (!adminUser) return;
      const settings = await this.reminderSettingsService.updateReminderSettings(
        groupId,
        req.body,
        adminUser.id
      );
      
      res.json({
        success: true,
        data: settings,
        message: 'Настройки напоминаний обновлены',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
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
      const groupId = parseInt(getParam(req.params, 'groupId'), 10);

      if (isNaN(groupId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid group ID',
          code: 'INVALID_GROUP_ID',
        });
        return;
      }

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const settings = await this.reminderSettingsService.getAdminNotificationSettings(groupId);
      
      res.json({
        success: true,
        data: settings,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
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
      const groupId = parseInt(getParam(req.params, 'groupId'), 10);

      if (isNaN(groupId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid group ID',
          code: 'INVALID_GROUP_ID',
        });
        return;
      }

      const hasAccess = await this.requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      const settings = await this.reminderSettingsService.updateAdminNotificationSettings(
        groupId,
        req.body
      );
      
      res.json({
        success: true,
        data: settings,
        message: 'Настройки уведомлений обновлены',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[AdminController] Error updating admin notification settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update notification settings',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}
