import cron from 'node-cron';
import { prisma } from '../database/client';
import { ReminderSettingsService } from '../services/reminder-settings.service';
import { getBotInstance } from '../bot/bot-instance';
import { logger } from '../utils/logger';
import { withDistributedLock } from '../utils/distributed-lock';

/**
 * Форматирование возраста долга
 */
function formatDebtAge(daysOld: number): string {
  if (daysOld === 0) return 'сегодня';
  if (daysOld === 1) return 'вчера';
  if (daysOld < 5) return `${daysOld} дня назад`;
  if (daysOld < 21) return `${daysOld} дней назад`;
  if (daysOld < 31) return `${daysOld} день назад`;

  const weeks = Math.floor(daysOld / 7);
  if (weeks === 1) return '1 неделю назад';
  if (weeks < 5) return `${weeks} недели назад`;

  const months = Math.floor(daysOld / 30);
  if (months === 1) return '1 месяц назад';
  return `${months} месяца назад`;
}

/**
 * Форматирование списка долгов пользователя
 */
function formatDebtsList(debts: any[]): string {
  return debts
    .map(debt => {
      const creditor = debt.creditor;
      const amount = Number(debt.amount).toFixed(2);
      const daysOld = Math.floor(
        (Date.now() - new Date(debt.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return `• ${creditor.firstName} ${creditor.lastName || ''}: ${amount} руб. (${formatDebtAge(daysOld)})`;
    })
    .join('\n');
}

/**
 * Форматирование сообщения с использованием шаблона
 */
function formatReminderMessage(
  template: string,
  debtor: any,
  totalAmount: number,
  debts: any[],
  oldestDebtAge: number
): string {
  const debtsList = formatDebtsList(debts);

  return template
    .replace('{userName}', debtor.firstName)
    .replace('{totalAmount}', totalAmount.toFixed(2))
    .replace('{debtsList}', debtsList)
    .replace('{oldestDebtAge}', formatDebtAge(oldestDebtAge));
}

/**
 * Получение информации о должниках группы
 */
async function getGroupDebtors(
  groupId: number,
  minDebtAge: number,
  intervalDays: number,
  maxReminders: number
) {
  const minDebtDate = new Date();
  minDebtDate.setDate(minDebtDate.getDate() - minDebtAge);

  const lastReminderDate = new Date();
  lastReminderDate.setDate(lastReminderDate.getDate() - intervalDays);

  // Получаем неоплаченные транзакции (долги) для пользователей группы
  const transactions = await prisma.transaction.findMany({
    where: {
      status: 'PENDING',
      createdAt: {
        lte: minDebtDate,
      },
      fromUser: {
        groupMemberships: {
          some: {
            groupId,
            isActive: true,
          },
        },
      },
      OR: [
        { lastReminderAt: null },
        { lastReminderAt: { lte: lastReminderDate } },
      ],
      reminderCount: {
        lt: maxReminders,
      },
    },
    include: {
      fromUser: true,
      toUser: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Группировка долгов по должникам
  const debtorMap = new Map<number, any>();

  for (const transaction of transactions) {
    const debtorId = transaction.fromUserId;

    if (!debtorMap.has(debtorId)) {
      debtorMap.set(debtorId, {
        debtor: transaction.fromUser,
        debts: [],
        totalAmount: 0,
        oldestDebtAge: 0,
      });
    }

    const debtorData = debtorMap.get(debtorId)!;
    debtorData.debts.push({
      ...transaction,
      creditor: transaction.toUser,
    });
    debtorData.totalAmount += Number(transaction.amount);

    const debtAge = Math.floor(
      (Date.now() - new Date(transaction.createdAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    debtorData.oldestDebtAge = Math.max(debtorData.oldestDebtAge, debtAge);
  }

  return Array.from(debtorMap.values());
}

/**
 * Отправка напоминаний должникам группы
 */
async function sendRemindersForGroup(
  groupId: number,
  settings: any
): Promise<{ sent: number; failed: number }> {
  const bot = getBotInstance();
  if (!bot) {
    logger.error('[DebtReminderJob] Bot instance not available');
    return { sent: 0, failed: 0 };
  }

  const debtors = await getGroupDebtors(
    groupId,
    settings.minDebtAge,
    settings.intervalDays,
    settings.maxReminders
  );

  let sent = 0;
  let failed = 0;

  // Должники — разные Telegram-чаты, поэтому рассылку можно вести с ограниченной
  // параллельностью. CONCURRENCY=4 заметно ускоряет задачу при большом числе
  // должников и остаётся в пределах лимитов Telegram (глобально ~30 msg/s).
  const CONCURRENCY = 4;

  const sendOne = async (
    debtorData: (typeof debtors)[number]
  ): Promise<boolean> => {
    try {
      const message = formatReminderMessage(
        settings.messageTemplate,
        debtorData.debtor,
        debtorData.totalAmount,
        debtorData.debts,
        debtorData.oldestDebtAge
      );

      await bot.api.sendMessage(String(debtorData.debtor.telegramId), message, {
        parse_mode: 'Markdown',
      });

      // Обновление счетчиков напоминаний для всех транзакций (долгов) должника
      const transactionIds = debtorData.debts.map((d: any) => d.id);
      await prisma.transaction.updateMany({
        where: {
          id: { in: transactionIds },
        },
        data: {
          reminderCount: { increment: 1 },
          lastReminderAt: new Date(),
        },
      });

      logger.info(
        `[DebtReminderJob] Sent reminder to user ${debtorData.debtor.id} (${debtorData.debtor.firstName}) for ${debtorData.totalAmount.toFixed(2)} руб.`
      );
      return true;
    } catch (error) {
      logger.error(
        `[DebtReminderJob] Failed to send reminder to user ${debtorData.debtor.id}:`,
        error
      );
      return false;
    }
  };

  for (let i = 0; i < debtors.length; i += CONCURRENCY) {
    const chunk = debtors.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(sendOne));
    for (const ok of results) {
      if (ok) sent++;
      else failed++;
    }
  }

  return { sent, failed };
}

/**
 * Основная функция крон-задачи
 */
async function runDebtReminderJob(): Promise<void> {
  logger.info('[DebtReminderJob] Starting automatic debt reminder job');

  try {
    const reminderService = new ReminderSettingsService();
    const groupsWithReminders =
      await reminderService.getGroupsWithEnabledReminders();

    if (groupsWithReminders.length === 0) {
      logger.info('[DebtReminderJob] No groups with enabled reminders found');
      return;
    }

    logger.info(
      `[DebtReminderJob] Processing ${groupsWithReminders.length} groups with enabled reminders`
    );

    let totalSent = 0;
    let totalFailed = 0;

    for (const settings of groupsWithReminders) {
      logger.info(
        `[DebtReminderJob] Processing group ${settings.groupId} (interval: ${settings.intervalDays} days, min age: ${settings.minDebtAge} days, max reminders: ${settings.maxReminders})`
      );

      const result = await sendRemindersForGroup(settings.groupId, settings);
      totalSent += result.sent;
      totalFailed += result.failed;

      logger.info(
        `[DebtReminderJob] Group ${settings.groupId}: sent ${result.sent}, failed ${result.failed}`
      );
    }

    logger.info(
      `[DebtReminderJob] Job completed. Total sent: ${totalSent}, total failed: ${totalFailed}`
    );
  } catch (error) {
    logger.error('[DebtReminderJob] Error running debt reminder job:', error);
  }
}

/**
 * Инициализация крон-задачи
 * Запускается каждый день в 10:00 утра
 */
export function initDebtReminderJob(): void {
  // Cron pattern: '0 10 * * *' = каждый день в 10:00
  const cronPattern = '0 10 * * *';

  cron.schedule(cronPattern, async () => {
    try {
      await withDistributedLock(
        'job:debt-reminder',
        55 * 60,
        runDebtReminderJob
      );
    } catch (error) {
      logger.error('[DebtReminderJob] Distributed lock failed:', error);
    }
  });

  logger.info(
    `[DebtReminderJob] Debt reminder cron job initialized (schedule: ${cronPattern})`
  );
}

/**
 * Экспорт для ручного запуска (для тестирования)
 */
export async function runDebtReminderJobManually(): Promise<void> {
  await runDebtReminderJob();
}
