import { InlineKeyboard } from 'grammy';
import { MenuItem } from '@prisma/client';
import { PollMessage, VoteWithDetails } from '../../types/poll.types';

/**
 * Создание компактной клавиатуры с кнопкой "Проголосовать" (для Deep Linking)
 */
export function createCompactPollKeyboard(pollId: number): { inline_keyboard: any[][] } {
  return {
    inline_keyboard: [
      [{ text: '📱 Проголосовать', callback_data: `openpoll:${pollId}` }],
      [{ text: '📊 Результаты', callback_data: `show_results:${pollId}` }]
    ]
  };
}

/**
 * Создание клавиатуры для голосования
 */
export function createPollKeyboard(
  pollId: number, 
  menuItems: MenuItem[], 
  votes: Map<number, VoteWithDetails[]>
): { inline_keyboard: any[][] } {
  const keyboard: any[][] = [];
  
  // Группируем блюда по строкам (максимум 2 в строке для читаемости)
  for (let i = 0; i < menuItems.length; i += 2) {
    const row: any[] = [];
    
    for (let j = i; j < Math.min(i + 2, menuItems.length); j++) {
      const item = menuItems[j];
      const itemVotes = votes.get(item.id) || [];
      const voteText = itemVotes.length > 0 ? ` (${itemVotes.length})` : '';
      
      row.push({
        text: `${item.name}${voteText}`,
        callback_data: `vote:${pollId}:${item.id}`
      });
    }
    
    keyboard.push(row);
  }
  
  // Добавляем дополнительные опции
  keyboard.push([
    { text: '🏠 Принесу из дома', callback_data: `vote:bring_own:${pollId}` },
    { text: '⏭️ Не обедаю', callback_data: `vote:skip:${pollId}` }
  ]);

  // Добавляем кнопки управления
  keyboard.push([
    { text: '🔄 Обновить', callback_data: `refresh_poll:${pollId}` },
    { text: '📊 Результаты', callback_data: `show_results:${pollId}` }
  ]);
  
  return { inline_keyboard: keyboard };
}

/**
 * Создание клавиатуры для завершенного голосования
 */
export function createCompletedPollKeyboard(
  pollId: number,
  hasVotes: boolean = false,
  isRouletteRun: boolean = false
): { inline_keyboard: any[][] } {
  const keyboard: any[][] = [
    [{ text: '📊 Подробные результаты', callback_data: `show_results:${pollId}` }]
  ];

  if (hasVotes && !isRouletteRun) {
    keyboard.push([
      { text: '🎲 Запустить рулетку', callback_data: `run_roulette:${pollId}` }
    ]);
  }

  return { inline_keyboard: keyboard };
}

/**
 * Создание клавиатуры для управления голосованием (для админов)
 */
export function createPollAdminKeyboard(pollId: number, isActive: boolean = true): { inline_keyboard: any[][] } {
  const keyboard: any[][] = [];

  if (isActive) {
    keyboard.push([
      { text: '✅ Завершить голосование', callback_data: `complete_poll:${pollId}` },
      { text: '❌ Отменить', callback_data: `cancel_poll:${pollId}` }
    ]);
    keyboard.push([
      { text: '📊 Промежуточные результаты', callback_data: `show_results:${pollId}` }
    ]);
  } else {
    keyboard.push([
      { text: '📊 Результаты', callback_data: `show_results:${pollId}` },
      { text: '🎲 Рулетка', callback_data: `run_roulette:${pollId}` }
    ]);
  }

  return { inline_keyboard: keyboard };
}

/**
 * Создание расширенной клавиатуры с категориями (если блюд много)
 */
export function createCategorizedPollKeyboard(
  pollId: number,
  menuItemsByCategory: { [category: string]: MenuItem[] },
  votes: Map<number, VoteWithDetails[]>,
  selectedCategory?: string
): { inline_keyboard: any[][] } {
  const keyboard: any[][] = [];
  const categories = Object.keys(menuItemsByCategory);

  if (!selectedCategory && categories.length > 1) {
    // Показываем категории
    for (let i = 0; i < categories.length; i += 2) {
      const row: any[] = [];
      for (let j = i; j < Math.min(i + 2, categories.length); j++) {
        const category = categories[j];
        const categoryItems = menuItemsByCategory[category];
        row.push({
          text: `📂 ${category} (${categoryItems.length})`,
          callback_data: `poll_category:${pollId}:${encodeURIComponent(category)}`
        });
      }
      keyboard.push(row);
    }
    
    // Кнопка "Показать все"
    keyboard.push([
      { text: '📋 Показать все блюда', callback_data: `poll_show_all:${pollId}` }
    ]);
  } else {
    // Показываем блюда из выбранной категории или все
    const itemsToShow = selectedCategory 
      ? menuItemsByCategory[selectedCategory] || []
      : Object.values(menuItemsByCategory).flat();

    for (let i = 0; i < itemsToShow.length; i += 2) {
      const row: any[] = [];
      for (let j = i; j < Math.min(i + 2, itemsToShow.length); j++) {
        const item = itemsToShow[j];
        const itemVotes = votes.get(item.id) || [];
        const voteText = itemVotes.length > 0 ? ` (${itemVotes.length})` : '';
        
        row.push({
          text: `${item.name}${voteText}`,
          callback_data: `vote:${pollId}:${item.id}`
        });
      }
      keyboard.push(row);
    }

    // Кнопка возврата к категориям
    if (selectedCategory && categories.length > 1) {
      keyboard.push([
        { text: '← Назад к категориям', callback_data: `poll_categories:${pollId}` }
      ]);
    }
  }

  // Кнопки управления
  keyboard.push([
    { text: '🔄 Обновить', callback_data: `refresh_poll:${pollId}` },
    { text: '📊 Результаты', callback_data: `show_results:${pollId}` }
  ]);

  return { inline_keyboard: keyboard };
}

/**
 * Создание клавиатуры для результатов голосования
 */
export function createResultsKeyboard(
  pollId: number,
  hasVotes: boolean,
  isActive: boolean,
  isRouletteRun: boolean = false
): { inline_keyboard: any[][] } {
  const keyboard: any[][] = [];

  if (isActive) {
    keyboard.push([
      { text: '🔄 Обновить', callback_data: `refresh_poll:${pollId}` },
      { text: '🗳️ К голосованию', callback_data: `show_poll:${pollId}` }
    ]);
    keyboard.push([
      { text: '✅ Завершить голосование', callback_data: `complete_poll:${pollId}` }
    ]);
  } else {
    if (hasVotes && !isRouletteRun) {
      keyboard.push([
        { text: '🎲 Запустить рулетку', callback_data: `run_roulette:${pollId}` }
      ]);
    }
    keyboard.push([
      { text: '📈 Подробная статистика', callback_data: `poll_detailed_stats:${pollId}` }
    ]);
  }

  return { inline_keyboard: keyboard };
}

/**
 * Создание компактного сообщения для группы (для Deep Linking flow)
 * UX UPGRADE (Фаза 1.5): Вместо 3 сообщений - 1 live-обновляемое
 */
export function createCompactPollMessage(
  poll: any,
  itemCount: number,
  currentVotes: number = 0,
  totalMembers: number = 0
): string {
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
  
  message += `\n📱 Нажмите кнопку ниже для голосования`;
  
  return message;
}

/**
 * Создание сообщения голосования
 */
export function createPollMessage(pollData: {
  poll: any;
  menuItems: MenuItem[];
  votes: Map<number, VoteWithDetails[]>;
  totalVotes: number;
}): string {
  const { poll, menuItems, votes, totalVotes } = pollData;
  
  let message = `🗳️ **${poll.title}**\n\n`;
  
  if (poll.description) {
    message += `📝 ${poll.description}\n\n`;
  }
  
  message += `👥 **Участников:** ${totalVotes}\n`;
  
  if (poll.endTime && poll.status === 'ACTIVE') {
    const timeLeft = Math.max(0, Math.floor((new Date(poll.endTime).getTime() - Date.now()) / 1000 / 60));
    message += `⏰ **Осталось:** ${timeLeft} мин\n`;
  }
  
  message += `\n📋 **Блюда в голосовании:**\n`;
  
  // Сортируем блюда по количеству голосов
  const sortedItems = menuItems
    .map(item => ({
      ...item,
      voteCount: votes.get(item.id)?.length || 0
    }))
    .sort((a, b) => b.voteCount - a.voteCount);

  sortedItems.forEach((item, index) => {
    const voteCount = item.voteCount;
    const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
    const bar = createProgressBar(percentage);
    
    message += `${index + 1}. **${item.name}**\n`;
    if (item.description && item.description.length < 50) {
      message += `   _${item.description}_\n`;
    }
    if (item.price) {
      message += `   💰 ${item.price}₽\n`;
    }
    message += `   ${bar} ${voteCount} голосов (${percentage}%)\n\n`;
  });

  if (totalVotes === 0) {
    message += `💡 _Будьте первыми - проголосуйте за понравившееся блюдо!_\n\n`;
  }

  message += `⚡ Нажмите кнопку ниже, чтобы проголосовать`;
  
  return message;
}

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


