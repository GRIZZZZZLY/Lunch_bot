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
export function getStoredVoteHistory(userId: number): UserVoteHistory[] {
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
  const history = getStoredVoteHistory(userId);
  
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
  const history = getStoredVoteHistory(userId);
  
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
  const history = getStoredVoteHistory(userId);
  
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
  
  const history = getStoredVoteHistory(userId);
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
      description: `У тебя с ${tasteMatch.userName} ${tasteMatch.matchPercentage}% совпадений вкусов`,
      icon: '👥',
      color: 'purple',
      data: tasteMatch,
    });
  }

  // 4. Разнообразие выбора
  const history = getStoredVoteHistory(userId);
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
  const history = getStoredVoteHistory(userId);
  const favorites = getFavoriteDishes(userId, 1);
  
  return {
    totalVotes: history.length,
    uniqueDishes: new Set(history.map(v => v.menuItemName)).size,
    topDish: favorites[0]?.name || null,
  };
}

// ============================================
// РЕКОМЕНДАЦИИ (3 алгоритма с ежедневной ротацией)
// ============================================

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  icon: string;
  algorithm: 'category' | 'collaborative' | 'diversity';
}

/**
 * Определить "категорию" блюда по ключевым словам
 */
function inferDishCategory(name: string): string {
  const lower = name.toLowerCase();

  if (lower.includes('пицца') || lower.includes('паста') || lower.includes('спагетти') || lower.includes('ризотто'))
    return 'Итальянская кухня';
  if (lower.includes('суши') || lower.includes('ролл') || lower.includes('рамен') || lower.includes('вок'))
    return 'Азиатская кухня';
  if (lower.includes('бургер') || lower.includes('стейк') || lower.includes('фри'))
    return 'Фастфуд';
  if (lower.includes('салат') || lower.includes('овощ') || lower.includes('боул'))
    return 'Здоровое питание';
  if (lower.includes('суп') || lower.includes('борщ') || lower.includes('щи') || lower.includes('солянка'))
    return 'Супы';
  if (lower.includes('шаурма') || lower.includes('гирос') || lower.includes('кебаб') || lower.includes('фалафель'))
    return 'Стрит-фуд';
  if (lower.includes('курица') || lower.includes('мясо') || lower.includes('свинина') || lower.includes('говядина'))
    return 'Мясные блюда';

  return 'Другое';
}

/**
 * Алгоритм А: Рекомендации по категории
 * "Вы часто выбираете итальянскую кухню — попробуйте новое итальянское блюдо"
 */
function getRecommendationsByCategory(
  userId: number
): Recommendation[] {
  const history = getStoredVoteHistory(userId);
  if (history.length < 1) return [];

  const categoryCounts: Record<string, number> = {};
  history.forEach(vote => {
    const cat = inferDishCategory(vote.menuItemName);
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  const sorted = Object.entries(categoryCounts)
    .filter(([cat]) => cat !== 'Другое')
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return [];

  const [topCategory, topCount] = sorted[0];
  const percentage = Math.round((topCount / history.length) * 100);

  const recommendations: Recommendation[] = [
    {
      id: 'cat_top',
      title: `Фанат: ${topCategory}`,
      description: `${percentage}% твоих голосов — ${topCategory.toLowerCase()}. Попробуй что-то новое в этой категории!`,
      icon: getCategoryEmoji(topCategory),
      algorithm: 'category',
    },
  ];

  if (sorted.length >= 2) {
    const [secondCategory] = sorted[1];
    recommendations.push({
      id: 'cat_second',
      title: `Также нравится: ${secondCategory}`,
      description: `Твой второй фаворит. Может, сегодня попробовать что-то отсюда?`,
      icon: getCategoryEmoji(secondCategory),
      algorithm: 'category',
    });
  }

  return recommendations;
}

/**
 * Алгоритм Б: Collaborative filtering (mock)
 * "Пользователи с похожими вкусами также выбирали..."
 */
function getRecommendationsByPeers(
  userId: number
): Recommendation[] {
  const history = getStoredVoteHistory(userId);
  if (history.length < 1) return [];

  const favorites = getFavoriteDishes(userId, 3);
  if (favorites.length === 0) return [];

  // Стабильный "случайный" выбор на основе дня
  const today = new Date();
  const dayHash = today.getFullYear() * 1000 + today.getMonth() * 31 + today.getDate();

  const mockPeerDishes = [
    'Том Ям', 'Цезарь с курицей', 'Фо Бо',
    'Карбонара', 'Греческий салат', 'Бургер Классик',
    'Рамен', 'Шаурма XL', 'Боул с лососем',
  ];

  const mockPeerNames = [
    'Иван', 'Мария', 'Алексей', 'Анна', 'Дмитрий',
  ];

  // Исключаем блюда, которые пользователь уже выбирал
  const userDishNames = new Set(
    history.map(v => v.menuItemName.toLowerCase())
  );
  const newDishes = mockPeerDishes.filter(
    d => !userDishNames.has(d.toLowerCase())
  );

  if (newDishes.length === 0) return [];

  const peerName = mockPeerNames[dayHash % mockPeerNames.length];
  const suggestedDish = newDishes[dayHash % newDishes.length];

  return [
    {
      id: 'peer_suggest',
      title: `${peerName} рекомендует`,
      description: `Коллеги с похожими вкусами часто выбирают "${suggestedDish}"`,
      icon: '👥',
      algorithm: 'collaborative',
    },
    {
      id: 'peer_popular',
      title: 'Популярно у единомышленников',
      description: `Те, кто любит ${favorites[0].name}, также выбирают "${newDishes[(dayHash + 1) % newDishes.length]}"`,
      icon: '🔥',
      algorithm: 'collaborative',
    },
  ];
}

/**
 * Алгоритм В: Разнообразие
 * "Вы давно не пробовали азиатскую кухню"
 */
function getRecommendationsByDiversity(
  userId: number
): Recommendation[] {
  const history = getStoredVoteHistory(userId);
  if (history.length < 1) return [];

  // Считаем давность последнего голоса по категориям
  const lastVoteByCategory: Record<string, Date> = {};
  history.forEach(vote => {
    const cat = inferDishCategory(vote.menuItemName);
    const voteDate = new Date(vote.votedAt);
    if (!lastVoteByCategory[cat] || voteDate > lastVoteByCategory[cat]) {
      lastVoteByCategory[cat] = voteDate;
    }
  });

  const allCategories = [
    'Итальянская кухня', 'Азиатская кухня', 'Фастфуд',
    'Здоровое питание', 'Супы', 'Стрит-фуд', 'Мясные блюда',
  ];

  const now = new Date();
  const recommendations: Recommendation[] = [];

  // Категории, которые пользователь никогда не пробовал
  const neverTried = allCategories.filter(
    cat => !lastVoteByCategory[cat]
  );

  if (neverTried.length > 0) {
    const dayHash = now.getDate();
    const suggested = neverTried[dayHash % neverTried.length];
    recommendations.push({
      id: 'div_new',
      title: `Новый опыт: ${suggested}`,
      description: `Ты ещё не пробовал ${suggested.toLowerCase()}. Время для эксперимента!`,
      icon: '✨',
      algorithm: 'diversity',
    });
  }

  // Категории, которые давно не выбирали (> 7 дней)
  const stale = Object.entries(lastVoteByCategory)
    .filter(([cat, date]) => {
      const daysSince = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSince > 7 && cat !== 'Другое';
    })
    .sort((a, b) => a[1].getTime() - b[1].getTime());

  if (stale.length > 0) {
    const [staleCat, staleDate] = stale[0];
    const daysSince = Math.floor(
      (now.getTime() - staleDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    recommendations.push({
      id: 'div_stale',
      title: `Давно не пробовали`,
      description: `${staleCat} — уже ${daysSince} дней. Может, вернуться?`,
      icon: '🔄',
      algorithm: 'diversity',
    });
  }

  // Общая статистика разнообразия
  const triedCount = Object.keys(lastVoteByCategory).filter(
    c => c !== 'Другое'
  ).length;
  const totalCategories = allCategories.length;

  if (triedCount < totalCategories) {
    recommendations.push({
      id: 'div_progress',
      title: `Разнообразие: ${triedCount}/${totalCategories}`,
      description: `Ты попробовал ${triedCount} из ${totalCategories} категорий. Продолжай исследовать!`,
      icon: '🗺️',
      algorithm: 'diversity',
    });
  }

  return recommendations;
}

/**
 * Получить эмодзи для категории
 */
function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    'Итальянская кухня': '🇮🇹',
    'Азиатская кухня': '🥢',
    'Фастфуд': '🍔',
    'Здоровое питание': '🥗',
    'Супы': '🍲',
    'Стрит-фуд': '🌯',
    'Мясные блюда': '🥩',
  };
  return map[category] || '🍽️';
}

/**
 * Получить рекомендации с ежедневной ротацией алгоритмов
 *
 * Каждый день используется другой алгоритм:
 * - День 0, 3, 6... → По категории (А)
 * - День 1, 4, 7... → Collaborative filtering (Б)
 * - День 2, 5, 8... → Разнообразие (В)
 */
export function getRotatingRecommendations(
  userId: number
): Recommendation[] {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  const algorithms = [
    getRecommendationsByCategory,
    getRecommendationsByPeers,
    getRecommendationsByDiversity,
  ];

  const selectedAlgorithm = algorithms[dayOfYear % 3];
  return selectedAlgorithm(userId);
}
