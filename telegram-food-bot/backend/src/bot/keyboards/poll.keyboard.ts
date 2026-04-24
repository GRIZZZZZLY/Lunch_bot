import { InlineKeyboard } from 'grammy';

/**
 * Создание компактной клавиатуры с кнопкой "Проголосовать" (для Deep Linking)
 * UX UPGRADE (Фаза 2.0): Поддержка разных состояний
 */
export function createCompactPollKeyboard(
  pollId: number,
  status: 'active' | 'completed' | 'with_responsible' = 'active'
): { inline_keyboard: any[][] } {
  if (status === 'active') {
    return {
      inline_keyboard: []
    };
  }

  if (status === 'completed') {
    return {
      inline_keyboard: []
    };
  }

  if (status === 'with_responsible') {
    return {
      inline_keyboard: []
    };
  }

  return { inline_keyboard: [] };
}

/**
 * Создание компактного сообщения для группы (для Deep Linking flow)
 * UX UPGRADE (Фаза 1.5): Вместо 3 сообщений - 1 live-обновляемое
 * UX UPGRADE (Фаза 2.0): Поддержка всех состояний - active/completed/with_responsible
 */
export function createCompactPollMessage(
  poll: any,
  itemCount: number,
  currentVotes: number = 0,
  totalMembers: number = 0,
  options?: {
    status?: 'active' | 'completed' | 'with_responsible';
    breakdown?: any[];
    responsibleUser?: any;
    suppressResponsiblePrompt?: boolean;
  }
): string {
  const status = options?.status || 'active';

  // ФАЗА 1: АКТИВНОЕ ГОЛОСОВАНИЕ
  if (status === 'active') {
    // Вычисляем оставшееся время
    let timeRemaining = poll.duration || 0;
    if (poll.startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(poll.startedAt).getTime()) / 1000 / 60);
      timeRemaining = Math.max(0, (poll.duration || 0) - elapsed);
    }

    // Определяем emoji на основе оставшегося времени (live indicator)
    let timeEmoji = '⏰';
    if (timeRemaining <= 2) {
      timeEmoji = '🔥'; // < 2 мин - HOT!
    } else if (timeRemaining <= 5) {
      timeEmoji = '⚠️'; // < 5 мин - срочно
    }

    let message = `🗳️ **Голосование за обед**\n\n`;

    if (poll.title && poll.title !== 'Голосование за обед') {
      message += `📋 ${poll.title}\n`;
    }

    message += `🍽️ Блюд в меню: ${itemCount}\n`;
    message += `${timeEmoji} Осталось: ${timeRemaining} мин\n`;

    if (totalMembers > 0) {
      message += `👥 Участвуют: ${currentVotes} из ${totalMembers}\n`;
    } else {
      message += `👥 Проголосовало: ${currentVotes}\n`;
    }

    message += `\n📱 Откройте Mini App для голосования`;

    return message;
  }

  // ФАЗА 2: ЗАВЕРШЕННОЕ ГОЛОСОВАНИЕ С РЕЗУЛЬТАТАМИ
  if (status === 'completed') {
    const breakdown = options?.breakdown || [];

    let message = `✅ **Голосование завершено!**\n\n`;

    if (poll.title && poll.title !== 'Голосование за обед') {
      message += `📋 ${poll.title}\n`;
    }

    message += `🍽️ Блюд в меню: ${itemCount}\n`;
    message += `⏰ Длилось: ${poll.duration} мин\n`;

    if (totalMembers > 0) {
      message += `👥 Проголосовало: ${currentVotes} из ${totalMembers}\n`;
    } else {
      message += `👥 Проголосовало: ${currentVotes}\n`;
    }

    // Добавляем топ-3 результата
    if (breakdown.length > 0) {
      message += `\n📊 **Результаты:**\n`;

      breakdown.slice(0, 3).forEach((item: any, index: number) => {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${emoji} ${item.menuItemName} — ${item.votes} ${getPluralForm(item.votes, 'голос', 'голоса', 'голосов')} (${item.percentage}%)\n`;
      });

      if (!options?.suppressResponsiblePrompt) {
        message += `\n🎲 Выбираем ответственного...`;
      }
    } else {
      message += `\n😔 Никто не проголосовал`;
    }

    return message;
  }

  // ФАЗА 3: С ИНФОРМАЦИЕЙ ОБ ОТВЕТСТВЕННОМ
  if (status === 'with_responsible') {
    const breakdown = options?.breakdown || [];
    const responsibleUser = options?.responsibleUser;

    let message = `✅ **Голосование завершено!**\n\n`;

    if (poll.title && poll.title !== 'Голосование за обед') {
      message += `📋 ${poll.title}\n`;
    }

    message += `🍽️ Блюд в меню: ${itemCount}\n`;
    message += `⏰ Длилось: ${poll.duration} мин\n`;

    if (totalMembers > 0) {
      message += `👥 Проголосовало: ${currentVotes} из ${totalMembers}\n`;
    } else {
      message += `👥 Проголосовало: ${currentVotes}\n`;
    }

    // Добавляем топ-3 результата
    if (breakdown.length > 0) {
      message += `\n📊 **Результаты:**\n`;

      breakdown.slice(0, 3).forEach((item: any, index: number) => {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${emoji} ${item.menuItemName} — ${item.votes} ${getPluralForm(item.votes, 'голос', 'голоса', 'голосов')} (${item.percentage}%)\n`;
      });
    }

    // Добавляем информацию об ответственном
    if (responsibleUser) {
      message += `\n🎯 **Ответственный:** ${responsibleUser.firstName}`;
      if (responsibleUser.username) {
        message += ` (@${responsibleUser.username})`;
      }
      message += `\n💳 Детали отправлены в личные сообщения`;
    }

    message += `\n\n📱 Просмотреть детали ↓`;

    return message;
  }

  return '';
}

/**
 * Создание сообщения голосования
 */
/**
 * Создание прогресс-бара для результатов
 */
function createProgressBar(percentage: number, length: number = 10): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Вспомогательная функция для множественного числа
 */
function getPluralForm(
  count: number,
  one: string,
  few: string,
  many: string
): string {
  if (count % 10 === 1 && count % 100 !== 11) return one;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return few;
  }
  return many;
}

/**
 * Форматирование результатов Multi-Winner для Telegram
 * 
 * @param resultData - MultiWinnerResultData из rouletteData
 * @returns HTML-форматированное сообщение для Telegram
 */
export function formatMultiWinnerResults(resultData: any): string {
  let message = '🍽 <b>Результаты голосования:</b>\n\n';

  // Winners
  if (resultData.winners.length > 0) {
    resultData.winners.forEach((winner: any, index: number) => {
      const emoji = index === 0 ? '🏆' : '🍴';
      const plural = getPluralForm(winner.voteCount, 'человек', 'человека', 'человек');

      message += `${emoji} <b>${winner.menuItemName}</b> — ${winner.voteCount} ${plural}\n`;

      // Прогрессивное раскрытие: Если > 5 человек - показываем первых 5 + "еще N"
      const voterNames = winner.voters.map((v: any) => v.firstName);
      if (voterNames.length <= 5) {
        message += `   👤 ${voterNames.join(', ')}\n`;
      } else {
        const shown = voterNames.slice(0, 5).join(', ');
        const remaining = voterNames.length - 5;
        message += `   👤 ${shown} и еще ${remaining}\n`;
      }

      message += '\n';
    });
  } else {
    message += '   <i>Нет голосов за блюда</i>\n\n';
  }

  // Bring Own
  if (resultData.bringOwn.count > 0) {
    const plural = getPluralForm(
      resultData.bringOwn.count,
      'человек',
      'человека',
      'человек'
    );
    message += `🏠 <b>Принесу своё</b> — ${resultData.bringOwn.count} ${plural}\n`;

    const names = resultData.bringOwn.voters.map((v: any) => v.firstName);
    if (names.length <= 5) {
      message += `   ${names.join(', ')}\n\n`;
    } else {
      message += `   ${names.slice(0, 5).join(', ')} и еще ${names.length - 5}\n\n`;
    }
  }

  // Skipped
  if (resultData.skipped.count > 0) {
    const plural = getPluralForm(
      resultData.skipped.count,
      'человек',
      'человека',
      'человек'
    );
    message += `🚫 <b>Пропускаю</b> — ${resultData.skipped.count} ${plural}\n\n`;
  }

  // Tie-break
  if (resultData.meta.tieBreak) {
    message += `ℹ️ <i>${resultData.meta.tieBreak.reason}, выбрано по методу: ${resultData.meta.tieBreak.method}</i>\n\n`;
  }

  // Telegram Message Length Limit: 4096 символов
  if (message.length > 3500) {
    message = message.substring(0, 3500);
    message += `\n\n📊 Смотреть полные результаты в приложении`;
  }

  // Footer
  const completedAt = new Date(resultData.meta.completedAt).toLocaleString('ru-RU');
  message += `⏱ Завершено: ${completedAt}`;

  return message;
}

/**
 * Создание сообщения с результатами голосования
 */
export function createResultsMessage(pollData: {
  poll: any;
  result?: any;
  breakdown: any[];
  totalVotes: number;
  voteTypeStats?: { menuItemVotes: number; bringOwnVotes: number; skipVotes: number; total: number };
}): string {
  const { poll, result, breakdown, totalVotes, voteTypeStats } = pollData;
  
  let message = `📊 **Результаты голосования**\n\n`;
  message += `🎯 **"${poll.title}"**\n`;
  message += `👥 Участников: ${totalVotes}\n`;
  
  if (poll.status === 'ACTIVE') {
    message += `🔴 Голосование активно\n`;
    if (poll.endTime) {
      const timeLeft = Math.max(0, Math.floor((new Date(poll.endTime).getTime() - Date.now()) / 1000 / 60));
      message += `⏰ Осталось: ${timeLeft} мин\n`;
    }
  } else {
    message += `✅ Голосование завершено\n`;
    if (result?.winnerItem) {
      message += `🏆 **Победитель:** ${result.winnerMenuItem.name}\n`;
    }
  }
  
  // Статистика по типам голосов
  if (voteTypeStats && voteTypeStats.total > 0) {
    message += `\n📈 **Статистика:**\n`;
    message += `🍽️ Заказывают: ${voteTypeStats.menuItemVotes}\n`;
    if (voteTypeStats.bringOwnVotes > 0) {
      message += `🏠 Принесут из дома: ${voteTypeStats.bringOwnVotes}\n`;
    }
    if (voteTypeStats.skipVotes > 0) {
      message += `⏭️ Не обедают: ${voteTypeStats.skipVotes}\n`;
    }
  }
  
  message += `\n📋 **Результаты по блюдам:**\n\n`;
  
  if (breakdown.length === 0) {
    message += `😔 _Никто не проголосовал_`;
    return message;
  }
  
  breakdown.forEach((item, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    const bar = createProgressBar(item.percentage);
    
    message += `${medal} **${item.menuItemName}**\n`;
    message += `   ${bar} ${item.votes} голосов (${item.percentage}%)\n`;
    
    if (item.voters.length <= 5) {
      const voterNames = item.voters.map((v: { firstName: string }) => v.firstName).join(', ');
      message += `   👤 ${voterNames}\n`;
    } else {
      const firstVoters = item.voters.slice(0, 3).map((v: { firstName: string }) => v.firstName).join(', ');
      message += `   👤 ${firstVoters} и ещё ${item.voters.length - 3}\n`;
    }
    message += `\n`;
  });
  
  if (result?.responsible) {
    message += `🎲 **Ответственный за заказ:** ${result.responsibleUser.firstName}\n`;
  }
  
  return message;
}


