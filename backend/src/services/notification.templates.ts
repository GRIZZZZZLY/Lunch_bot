/**
 * Реестр шаблонов уведомлений — данные, а не код.
 *
 * Раньше эти 180 строк лежали внутри приватного метода `initializeTemplates()`,
 * который конструктор `NotificationService` вызывал на каждый `new`. Отсюда два
 * следствия, и оба неприятные:
 *
 * 1. Текст сообщений нельзя было проверить, не подняв сервис целиком — с
 *    моками Prisma и бота. Именно поэтому порча кодировки (UTF-8 байты,
 *    прочитанные как windows-1251) дожила до продакшена: ни один тест не
 *    смотрел на сам текст, все проверяли, кому и сколько раз ушло сообщение.
 * 2. Карта была состоянием экземпляра. При разрезании сервиса на домены это
 *    означало бы три независимые копии одного и того же справочника.
 *
 * Теперь это модульная константа: её читает тест напрямую, а всем сервисам
 * достаётся один экземпляр.
 *
 * Экранирование подставляемых данных живёт ЗДЕСЬ, в шаблонах, а не в
 * транспорте: транспорт не знает, где в строке разметка, а где данные, и
 * применить `escapeMarkdown` ко всему сообщению нельзя — сам `*жирный*`
 * шаблона перестал бы быть разметкой.
 */
import {
  NotificationType,
  NotificationPriority,
  NotificationTemplate,
  PollEndedNotificationData,
  PollStartedNotificationData,
  PollCancelledNotificationData,
  RouletteWinnerNotificationData,
} from '../types/notification.types';
import { toNumber } from '../utils/decimal';
import { pluralForm } from '../utils/pluralize';
import { escapeMarkdown } from '../utils/telegram-html';

/**
 * Дата для текста сообщения. Часовой пояс задан явно: сервер живёт в UTC, а
 * читают сообщение люди в Москве — без `timeZone` время в уведомлении
 * расходилось бы с временем в интерфейсе на три часа.
 */
function formatMoscowDateTime(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  };

  return new Intl.DateTimeFormat('ru-RU', options).format(date);
}

const templates = new Map<NotificationType, NotificationTemplate>();

// Шаблон для начала голосования
templates.set(NotificationType.POLL_STARTED, {
  type: NotificationType.POLL_STARTED,
  getTitle: () => '🗳️ Началось голосование!',
  getMessage: (data: PollStartedNotificationData) => {
    let message = `📢 В группе *${data.groupTitle}* началось новое голосование!\n\n`;
    message += `🍽️ Доступно блюд: ${data.menuItems.length}\n`;
    if (data.endTime) {
      message += `⏰ Завершится: ${formatMoscowDateTime(data.endTime)}\n`;
    }
    message += `\n👉 Проголосуй в чате группы!`;
    return message;
  },
  parseMode: 'Markdown',
  priority: NotificationPriority.NORMAL,
});

// Шаблон для завершения голосования
templates.set(NotificationType.POLL_ENDED, {
  type: NotificationType.POLL_ENDED,
  getTitle: () => '✅ Голосование завершено!',
  getMessage: (data: PollEndedNotificationData) => {
    // Проверка на пустое голосование
    if (data.totalVotes === 0) {
      return `🍃 Никто не проголосовал. Все на диете? Запусти новое голосование.`;
    }

    let message = `🗳️ Голосование завершилось!\n\n`;
    message += `👥 Всего голосов: ${data.totalVotes}\n\n`;

    // Multi-Winner режим
    if (data.mode === 'multi-winner' && data.winners) {
      if (data.winners.length > 0) {
        message += `🍽️ *Кто что заказывает:*\n\n`;
        data.winners.forEach((winner, index) => {
          const voterCount = winner.voters?.length || 0;
          const votersText = pluralForm(voterCount, 'человек', 'человека', 'человек');
          message += `${index + 1}. *${escapeMarkdown(winner.menuItemName)}* — ${voterCount} ${votersText}\n`;

          if (winner.voters && winner.voters.length > 0) {
            const displayVoters = winner.voters.slice(0, 3);
            const voterNames = displayVoters
              .map(v => escapeMarkdown(v.firstName))
              .join(', ');
            message += `   👤 ${voterNames}`;
            if (winner.voters.length > 3) {
              message += ` и ещё ${winner.voters.length - 3}`;
            }
            message += `\n`;
          }
          message += `\n`;
        });
      }

      if (data.bringOwn && data.bringOwn.count > 0) {
        const bringOwnText = pluralForm(data.bringOwn.count, 'человек', 'человека', 'человек');
        message += `🥪 *Принесу своё:* ${data.bringOwn.count} ${bringOwnText}\n`;
        if (data.bringOwn.voters && data.bringOwn.voters.length > 0) {
          const names = data.bringOwn.voters
            .slice(0, 3)
            .map(v => escapeMarkdown(v.firstName))
            .join(', ');
          message += `   👤 ${names}`;
          if (data.bringOwn.voters.length > 3) {
            message += ` и ещё ${data.bringOwn.voters.length - 3}`;
          }
          message += `\n`;
        }
        message += `\n`;
      }

      if (data.skipped && data.skipped.count > 0) {
        const skippedText = pluralForm(data.skipped.count, 'человек', 'человека', 'человек');
        message += `⏭️ *Пропустили:* ${data.skipped.count} ${skippedText}\n\n`;
      }

      message += `✅ Заказ оформлен!`;
    }
    // Single-Winner режим
    else {
      if (data.winnerItem) {
        message += `🏆 *Победитель:* ${escapeMarkdown(data.winnerItem.name)}\n`;
        if (data.winnerItem.price) {
          message += `💰 Цена: ${toNumber(data.winnerItem.price).toFixed(2)} руб.\n`;
        }
      }

      if (data.topItems && data.topItems.length > 0) {
        message += `\n📊 *Топ блюд:*\n`;
        data.topItems.slice(0, 3).forEach((item, index) => {
          const emoji = ['🥇', '🥈', '🥉'][index] || '•';
          message += `${emoji} ${escapeMarkdown(item.item.name)} - ${item.votes} ${pluralForm(item.votes, 'голос', 'голоса', 'голосов')} (${item.percentage}%)\n`;
        });
      }

      message += `\n🎲 Сейчас запустится рулетка для выбора ответственного...`;
    }

    return message;
  },
  parseMode: 'Markdown',
  priority: NotificationPriority.HIGH,
});

// Шаблон для победителя рулетки
templates.set(NotificationType.ROULETTE_WINNER, {
  type: NotificationType.ROULETTE_WINNER,
  getTitle: () => '🎉 Вы выбраны ответственным!',
  getMessage: (data: RouletteWinnerNotificationData) => {
    let message = `🎉 *Поздравляем, ${data.winner.firstName}!*\n\n`;
    message += `Рулетка выбрала тебя ответственным за заказ.\n\n`;

    if (data.winnerItem) {
      message += `🍽️ Заказываем: ${data.winnerItem.name}\n`;
      if (data.winnerItem.price) {
        message += `💰 Цена: ${toNumber(data.winnerItem.price).toFixed(2)} руб.\n`;
      }
    }

    message += `👥 Участников: ${data.voters.length}\n`;

    message += `\n*Что дальше:*\n`;
    message += `1. Собери заказы у участников\n`;
    message += `2. Оформи и собери деньги\n`;

    message += `\nРеквизиты и суммы уже у всех в личке.`;

    return message;
  },
  parseMode: 'Markdown',
  priority: NotificationPriority.URGENT,
});

// Шаблон для отмены голосования
templates.set(NotificationType.POLL_CANCELLED, {
  type: NotificationType.POLL_CANCELLED,
  getTitle: () => '❌ Голосование отменено',
  getMessage: (data: PollCancelledNotificationData) => {
    let message = `❌ Голосование отменено администратором ${data.cancelledBy.firstName}\n\n`;

    if (data.reason) {
      message += `📝 Причина: ${data.reason}\n\n`;
    }

    message += `👥 Проголосовало: ${data.totalVotes} чел.\n`;

    if (data.voters.length > 0) {
      message += `\n✅ Участники:\n`;
      data.voters.slice(0, 10).forEach(v => {
        message += `• ${v.firstName}${v.lastName ? ` ${  v.lastName}` : ''}\n`;
      });

      if (data.voters.length > 10) {
        message += `... и еще ${data.voters.length - 10}\n`;
      }
    }

    return message;
  },
  parseMode: 'Markdown',
  priority: NotificationPriority.NORMAL,
});

// Шаблон для напоминания о заказе
templates.set(NotificationType.ORDER_REMINDER, {
  type: NotificationType.ORDER_REMINDER,
  getTitle: () => '⏰ Напоминание о заказе',
  getMessage: (data: { deadline?: Date }) => {
    let message = `⏰ *Напоминание!*\n\n`;
    message += `Не забудь сделать заказ еды.\n`;
    if (data.deadline) {
      message += `⏱️ Крайний срок: ${formatMoscowDateTime(data.deadline)}\n`;
    }
    return message;
  },
  parseMode: 'Markdown',
  priority: NotificationPriority.NORMAL,
});

/**
 * Справочник шаблонов. `ReadonlyMap` намеренно: карта общая для всех сервисов,
 * и запись в неё из одного домена меняла бы текст сообщений в другом.
 */
export const notificationTemplates: ReadonlyMap<
  NotificationType,
  NotificationTemplate
> = templates;
