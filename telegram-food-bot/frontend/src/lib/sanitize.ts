/**
 * Утилиты для безопасной обработки пользовательского ввода
 * SECURITY: XSS protection
 */

import DOMPurify from 'dompurify';

/**
 * Очищает HTML от потенциально опасных элементов
 * 
 * @param dirty - неочищенная строка HTML
 * @returns безопасная строка HTML
 * 
 * @example
 * ```ts
 * const clean = sanitizeHTML('<script>alert("xss")</script><p>Hello</p>');
 * // Result: '<p>Hello</p>'
 * ```
 */
export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'span'],
    ALLOWED_ATTR: ['class'],
  });
}

/**
 * Очищает текст от HTML тегов
 * 
 * @param dirty - неочищенная строка
 * @returns чистая строка без HTML
 * 
 * @example
 * ```ts
 * const clean = sanitizeText('<script>alert("xss")</script>Hello');
 * // Result: 'Hello'
 * ```
 */
export function sanitizeText(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Очищает строку для использования в URL
 * 
 * @param dirty - неочищенная строка
 * @returns безопасная строка для URL
 */
export function sanitizeURL(dirty: string): string {
  const cleaned = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
  
  try {
    const url = new URL(cleaned);
    // Разрешаем только http и https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    return cleaned;
  } catch {
    return '';
  }
}

/**
 * Валидация файла изображения
 * SECURITY: File type and size validation
 * 
 * @param file - файл для валидации
 * @returns объект с результатом валидации
 * 
 * @example
 * ```ts
 * const result = validateImageFile(file);
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * ```
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// 5MB максимум
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Разрешенные MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

export function validateImageFile(file: File): FileValidationResult {
  // Проверка размера файла
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Файл слишком большой. Максимальный размер: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Проверка MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Неподдерживаемый формат файла. Разрешены: JPEG, PNG, WebP, GIF`,
    };
  }

  // Проверка расширения файла (дополнительная защита)
  const fileName = file.name.toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  if (!hasValidExtension) {
    return {
      valid: false,
      error: 'Неверное расширение файла',
    };
  }

  return { valid: true };
}

/**
 * Безопасное извлечение текста из объекта (защита от prototype pollution)
 * 
 * @param obj - объект
 * @param key - ключ
 * @returns значение или пустая строка
 */
export function safeGetString(obj: Record<string, unknown>, key: string): string {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) {
    return '';
  }
  
  const value = obj[key];
  if (typeof value === 'string') {
    return sanitizeText(value);
  }
  
  return '';
}

/**
 * Экранирование специальных символов для SQL (дополнительная защита)
 * Note: Основная защита должна быть на backend через prepared statements
 * 
 * @param str - строка для экранирования
 * @returns экранированная строка
 */
export function escapeSQLString(str: string): string {
  return str
    .replace(/'/g, "''")
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

/**
 * Валидация email адреса
 * 
 * @param email - email для проверки
 * @returns true если email валидный
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Валидация номера телефона (базовая)
 * 
 * @param phone - номер телефона
 * @returns true если номер валидный
 */
export function validatePhone(phone: string): boolean {
  // Убираем все не-цифры
  const digits = phone.replace(/\D/g, '');
  // Проверяем длину (от 10 до 15 цифр)
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Очистка номера телефона до только цифр
 * 
 * @param phone - номер телефона
 * @returns только цифры
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}
