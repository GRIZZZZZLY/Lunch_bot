/**
 * Insights Service - персональные инсайты о предпочтениях пользователя
 * Анализирует историю голосований и показывает интересные паттерны
 */

export interface UserVoteHistory {
  menuItemId: number;
  menuItemName: string;
  pollId: number;
  votedAt: string;
}

export interface PersonalInsight {
  id: string;
  type: 'favorite_dish' | 'voting_pattern' | 'taste_match' | 'achievement' | 'streak';
  title: string;
  description: string;
  icon: string;
  color: string;
  data?: any;
}

/**
 * Получить историю голосов пользователя из localStorage
 */
function getVoteHistory(userId: number): UserVoteHistory[] {
  const key = `vote_history_${userId}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Добавить новый голос в историю
 */
export function recordVote(
  userId: number,
  menuItemId: number,
  menuItemName: string,
  pollId: number
): void {
  const history = getVoteHistory(userId);
  
  history.push({
    menuItemId,
    menuItemName,
    pollId,
    votedAt: new Date().toISOString(),
  });

  // Храним только последние 100 голосов
  const trimmed = history.slice(-100);
  localStorage.setItem(`vote_history_${userId}`, JSON.stringify(trimmed));
}

/**
 * Получить топ любимых блюд
 */
export function getFavoriteDishes(userId: number, limit: number = 3): Array<{
  name: string;
  count: number;
  percentage: number;
}> {
  const history = getVoteHistory(userId);
  
  if (history.length === 0) return [];

  // Подсчитываем частоту выбора каждого блюда
  const dishCounts = history.reduce((acc, vote) => {
    acc[vote.menuItemName] = (acc[vote.menuItemName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Сортируем по убыванию
  const sorted = Object.entries(dishCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / history.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  return sorted.slice(0, limit);
}

/**
 * Проверить паттерны голосования по дням недели
 */
export function getWeekdayPattern(userId: number): {
  weekday: string;
  pattern: string;
} | null {
  const history = getVoteHistory(userId);
  
  if (history.length < 10) return null; // Минимум 10 голосов для анализа

  // Группируем по дням недели
  const weekdays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const byWeekday: Record<number, string[]> = {};

  history.forEach(vote => {
    const date = new Date(vote.votedAt);
    const day = date.getDay();
    
    if (!byWeekday[day]) byWeekday[day] = [];
    byWeekday[day].push(vote.menuItemName);
  });

  // Ищем интересные паттерны
  for (const [dayIndex, dishes] of Object.entries(byWeekday)) {
    const day = parseInt(dayIndex);
    
    // Проверяем если в пятницу выбирают более калорийное
    if (day === 5 && dishes.length >= 3) {
      const hasPizzaOrBurger = dishes.some(d => 
        d.toLowerCase().includes('пицца') || 
        d.toLowerCase().includes('бургер') ||
        d.toLowerCase().includes('стейк')
      );
      
      if (hasPizzaOrBurger) {
        return {
          weekday: weekdays[day],
          pattern: 'В пятницу предпочитаешь более сытные блюда 🍕',
        };
      }
    }

    // Проверяем если в понедельник выбирают легкое
    if (day === 1 && dishes.length >= 3) {
      const hasSalad = dishes.some(d => 
        d.toLowerCase().includes('салат') || 
        d.toLowerCase().includes('овощ')
      );
      
      if (hasSalad) {
        return {
          weekday: weekdays[day],
          pattern: 'В понедельник предпочитаешь легкие блюда 🥗',
        };
      }
    }
  }

  return null;
}

/**
 * Получить процент совпадения вкусов с другим пользователем
 * (mock данные для демонстрации концепции)
 */
export function getTasteMatch(userId: number): {
  userName: string;
  matchPercentage: number;
} | null {
  // В реальности будет API запрос для сравнения с другими пользователями
  // Сейчас возвращаем mock данные если есть достаточно голосов
  
  const history = getVoteHistory(userId);
  if (history.length < 5) return null;

  // Mock: случайный процент совпадения
  const mockNames = ['Иван', 'Мария', 'Алексей', 'Анна', 'Петр'];
  const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
  const matchPercentage = 70 + Math.floor(Math.random() * 25); // 70-95%

  return {
    userName: randomName,
    matchPercentage,
  };
}

/**
 * Генерировать персональные инсайты для пользователя
 */
export function generatePersonalInsights(userId: number): PersonalInsight[] {
  const insights: PersonalInsight[] = [];
  
  // 1. Любимое блюдо
  const favorites = getFavoriteDishes(userId, 1);
  if (favorites.length > 0 && favorites[0].count >= 3) {
    const fav = favorites[0];
    insights.push({
      id: 'favorite_dish',
      type: 'favorite_dish',
      title: `Любитель ${fav.name}`,
      description: `Ты выбрал это блюдо ${fav.count} раз (${fav.percentage}% голосов)`,
      icon: getDishEmoji(fav.name),
      color: 'orange',
      data: fav,
    });
  }

  // 2. Паттерн по дням недели
  const pattern = getWeekdayPattern(userId);
  if (pattern) {
    insights.push({
      id: 'weekday_pattern',
      type: 'voting_pattern',
      title: 'Твой паттерн',
      description: pattern.pattern,
      icon: '📊',
      color: 'blue',
    });
  }

  // 3. Совпадение вкусов
  const tasteMatch = getTasteMatch(userId);
  if (tasteMatch && tasteMatch.matchPercentage >= 75) {
    insights.push({
      id: 'taste_match',
      type: 'taste_match',
      title: 'Единомышленник',
      description: `У вас с ${tasteMatch.userName} ${tasteMatch.matchPercentage}% совпадений вкусов`,
      icon: '👥',
      color: 'purple',
      data: tasteMatch,
    });
  }

  // 4. Разнообразие выбора
  const history = getVoteHistory(userId);
  const uniqueDishes = new Set(history.map(v => v.menuItemName)).size;
  if (uniqueDishes >= 10) {
    insights.push({
      id: 'variety',
      type: 'achievement',
      title: 'Гурман',
      description: `Попробовал ${uniqueDishes} разных блюд. Любишь разнообразие!`,
      icon: '🌟',
      color: 'green',
    });
  }

  return insights;
}

/**
 * Получить эмодзи для блюда (heuristic)
 */
function getDishEmoji(dishName: string): string {
  const name = dishName.toLowerCase();
  
  if (name.includes('пицца')) return '🍕';
  if (name.includes('бургер')) return '🍔';
  if (name.includes('салат')) return '🥗';
  if (name.includes('суп')) return '🍲';
  if (name.includes('паста') || name.includes('спагетти')) return '🍝';
  if (name.includes('суши') || name.includes('ролл')) return '🍣';
  if (name.includes('стейк') || name.includes('мясо')) return '🥩';
  if (name.includes('курица')) return '🍗';
  if (name.includes('рыба')) return '🐟';
  if (name.includes('овощ')) return '🥕';
  
  return '🍽️';
}

/**
 * Получить краткую статистику для быстрого просмотра
 */
export function getQuickStats(userId: number): {
  totalVotes: number;
  uniqueDishes: number;
  topDish: string | null;
} {
  const history = getVoteHistory(userId);
  const favorites = getFavoriteDishes(userId, 1);
  
  return {
    totalVotes: history.length,
    uniqueDishes: new Set(history.map(v => v.menuItemName)).size,
    topDish: favorites[0]?.name || null,
  };
}
