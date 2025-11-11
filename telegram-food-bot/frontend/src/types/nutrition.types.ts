/**
 * Nutrition Types
 * Sprint 5.1 - Nutrition Balance Widget
 */

export interface NutritionInfo {
  calories: number;
  protein: number; // граммы
  carbs: number; // граммы
  fats: number; // граммы
  fiber?: number; // граммы (опционально)
}

export interface DailyNutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface NutritionBalance {
  current: NutritionInfo;
  goal: DailyNutritionGoals;
  percentage: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
}

export interface NutritionStats {
  today: NutritionBalance;
  thisWeek: {
    average: NutritionInfo;
    total: NutritionInfo;
  };
  thisMonth: {
    average: NutritionInfo;
    total: NutritionInfo;
  };
  trends: {
    caloriesTrend: 'up' | 'down' | 'stable';
    proteinTrend: 'up' | 'down' | 'stable';
  };
}

// Mock data для разработки
export const mockNutritionBalance: NutritionBalance = {
  current: {
    calories: 450,
    protein: 28,
    carbs: 52,
    fats: 15,
    fiber: 8,
  },
  goal: {
    calories: 800, // цель на обед
    protein: 40,
    carbs: 80,
    fats: 25,
  },
  percentage: {
    calories: 56, // 450/800 * 100
    protein: 70, // 28/40 * 100
    carbs: 65, // 52/80 * 100
    fats: 60, // 15/25 * 100
  },
};

// Рекомендуемые дневные нормы (общие)
export const DEFAULT_DAILY_GOALS: DailyNutritionGoals = {
  calories: 2000,
  protein: 150, // ~1.5г на кг веса для активных людей
  carbs: 250,
  fats: 70,
};

// Нормы для обеда (примерно 40% от дневной нормы)
export const LUNCH_GOALS: DailyNutritionGoals = {
  calories: 800,
  protein: 40,
  carbs: 80,
  fats: 25,
};

/**
 * Вычислить процент выполнения нормы
 */
export function calculateNutritionPercentage(
  current: NutritionInfo,
  goal: DailyNutritionGoals
): NutritionBalance['percentage'] {
  return {
    calories: Math.round((current.calories / goal.calories) * 100),
    protein: Math.round((current.protein / goal.protein) * 100),
    carbs: Math.round((current.carbs / goal.carbs) * 100),
    fats: Math.round((current.fats / goal.fats) * 100),
  };
}

/**
 * Получить статус по проценту
 */
export function getNutritionStatus(percentage: number): 'low' | 'optimal' | 'high' {
  if (percentage < 70) return 'low';
  if (percentage > 110) return 'high';
  return 'optimal';
}

/**
 * Получить цвет по статусу
 */
export function getNutritionColor(status: 'low' | 'optimal' | 'high'): string {
  switch (status) {
    case 'low':
      return 'text-yellow-500';
    case 'high':
      return 'text-orange-500';
    case 'optimal':
      return 'text-green-500';
  }
}

/**
 * Получить рекомендацию по макронутриенту
 */
export function getNutritionRecommendation(
  nutrient: keyof NutritionInfo,
  percentage: number
): string {
  const status = getNutritionStatus(percentage);
  
  if (status === 'optimal') {
    return 'Отлично! 👍';
  }
  
  const nutrientNames = {
    calories: 'калорий',
    protein: 'белка',
    carbs: 'углеводов',
    fats: 'жиров',
    fiber: 'клетчатки',
  };
  
  const name = nutrientNames[nutrient as keyof typeof nutrientNames];
  
  if (status === 'low') {
    return `Маловато ${name}. Можно добавить 🍽️`;
  } else {
    return `Многовато ${name}. Лучше умерить 😅`;
  }
}
