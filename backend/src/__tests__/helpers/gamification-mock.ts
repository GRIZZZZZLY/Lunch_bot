/**
 * Общий мок GamificationService.
 *
 * Часть сервисов подтягивает его динамически — `await import('./gamification.service.js')`
 * (с расширением .js, как требует скомпилированный CJS). Для jest это ДРУГОЙ
 * путь модуля, чем `../services/gamification.service`, поэтому один jest.mock
 * не покрывает оба: вызовы уходили в настоящий сервис, падали на Prisma и
 * тонули в try/catch — тест «проходил», ничего не проверив.
 *
 * Оба специфера мокаются на этот модуль, поэтому jest.fn один и тот же.
 */
export const awardXP = jest.fn();
export const recalculateRatings = jest.fn();
export const getUserStats = jest.fn();

export const GamificationService = {
  awardXP,
  recalculateRatings,
  getUserStats,
};
