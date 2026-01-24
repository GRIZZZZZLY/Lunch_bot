/**
 * Централизованный маппинг технических ошибок в человечные сообщения
 * 
 * Принципы:
 * - Говорить что случилось простыми словами
 * - Предлагать решение или следующий шаг
 * - Не использовать технические термины
 */

export const ERROR_MESSAGES = {
  // Network errors
  NETWORK_ERROR: '🌐 Проблема с интернетом. Проверьте подключение и попробуйте ещё раз',
  TIMEOUT: '⏱️ Запрос выполняется слишком долго. Попробуйте ещё раз',
  
  // Authentication
  AUTH_FAILED: '🔐 Не удалось войти. Попробуйте перезапустить бота',
  UNAUTHORIZED: '🔐 Нужно войти заново. Перезапустите бота',
  
  // Voting errors
  VOTE_FAILED: '🗳️ Не удалось проголосовать. Попробуйте ещё раз',
  POLL_ENDED: '⏰ Голосование уже завершено',
  POLL_NOT_FOUND: '🔍 Голосование не найдено или было удалено',
  ALREADY_VOTED: '✅ Вы уже проголосовали в этом опросе',
  
  // Menu errors
  MENU_LOAD_FAILED: '📋 Не удалось загрузить меню. Попробуйте обновить страницу',
  MENU_ITEM_CREATE_FAILED: '❌ Не удалось добавить блюдо. Проверьте все поля и попробуйте ещё раз',
  MENU_ITEM_UPDATE_FAILED: '❌ Не удалось обновить блюдо. Попробуйте ещё раз',
  MENU_ITEM_DELETE_FAILED: '❌ Не удалось удалить блюдо. Попробуйте ещё раз',
  
  // Payment errors
  PAYMENT_UPDATE_FAILED: '💳 Не удалось сохранить платёжные данные. Проверьте правильность ввода',
  INVALID_CARD: '💳 Некорректный номер карты. Проверьте и попробуйте снова',
  INVALID_PHONE: '📱 Некорректный номер телефона. Используйте формат: +7 (999) 123-45-67',
  
  // Admin errors
  POLL_CREATE_FAILED: '❌ Не удалось создать голосование. Попробуйте ещё раз',
  POLL_COMPLETE_FAILED: '❌ Не удалось завершить голосование. Попробуйте ещё раз',
  ADMIN_REMINDER_FAILED: '📢 Не удалось отправить напоминание администратору',
  
  // Generic errors
  UNKNOWN_ERROR: '❌ Что-то пошло не так. Попробуйте ещё раз',
  SERVER_ERROR: '🔧 Проблема на сервере. Мы уже работаем над исправлением',
  
  // Data errors
  DATA_LOAD_FAILED: '📊 Не удалось загрузить данные. Попробуйте обновить страницу',
  DATA_SAVE_FAILED: '💾 Не удалось сохранить изменения. Попробуйте ещё раз',
} as const;

/**
 * Маппинг технических ошибок API в человечные сообщения
 */
export function getHumanErrorMessage(error: any): string {
  // Если это уже человечное сообщение (начинается с emoji или русских букв)
  const errorMessage = error?.message || error?.error || String(error);
  if (/^[🔐🗳️📋❌💳📱📢🌐⏱️⏰🔍✅🔧💾📊]/u.test(errorMessage)) {
    return errorMessage;
  }
  
  // Network errors
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
    return ERROR_MESSAGES.TIMEOUT;
  }
  if (error?.code === 'ERR_NETWORK' || !navigator.onLine) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  
  // HTTP status codes
  if (error?.response?.status === 401 || error?.response?.status === 403) {
    return ERROR_MESSAGES.UNAUTHORIZED;
  }
  if (error?.response?.status >= 500) {
    return ERROR_MESSAGES.SERVER_ERROR;
  }
  
  // API error messages - mapping
  const apiError = error?.response?.data?.error || error?.message || '';
  
  if (apiError.includes('Poll not found') || apiError.includes('не найден')) {
    return ERROR_MESSAGES.POLL_NOT_FOUND;
  }
  if (apiError.includes('Poll has expired') || apiError.includes('завершен')) {
    return ERROR_MESSAGES.POLL_ENDED;
  }
  if (apiError.includes('already voted') || apiError.includes('уже проголосовал')) {
    return ERROR_MESSAGES.ALREADY_VOTED;
  }
  if (apiError.includes('Failed to create vote')) {
    return ERROR_MESSAGES.VOTE_FAILED;
  }
  if (apiError.includes('Failed to create poll')) {
    return ERROR_MESSAGES.POLL_CREATE_FAILED;
  }
  if (apiError.includes('Failed to create') || apiError.includes('Failed to add')) {
    return ERROR_MESSAGES.MENU_ITEM_CREATE_FAILED;
  }
  if (apiError.includes('Failed to update')) {
    return ERROR_MESSAGES.MENU_ITEM_UPDATE_FAILED;
  }
  if (apiError.includes('Failed to delete') || apiError.includes('Failed to remove')) {
    return ERROR_MESSAGES.MENU_ITEM_DELETE_FAILED;
  }
  if (apiError.includes('Invalid card') || apiError.includes('Некорректный номер карты')) {
    return ERROR_MESSAGES.INVALID_CARD;
  }
  if (apiError.includes('Invalid phone') || apiError.includes('Некорректный номер телефона')) {
    return ERROR_MESSAGES.INVALID_PHONE;
  }
  
  // Default fallback
  return ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Хелпер для форматирования ошибки в объект для toast/notification
 */
export function formatErrorForNotification(error: any): { type: 'error'; message: string } {
  return {
    type: 'error',
    message: getHumanErrorMessage(error),
  };
}
