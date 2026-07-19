/**
 * Утилиты для безопасной обработки пользовательского ввода
 * SECURITY: XSS protection
 */

import DOMPurify from 'dompurify';

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
const _MAX_FILE_SIZE = 5 * 1024 * 1024;

// Разрешенные MIME types
const _ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];
