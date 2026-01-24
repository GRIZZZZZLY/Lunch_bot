/**
 * Typography Scale - Централизованная типографическая система
 * 
 * Основана на дизайн-документации (DESIGN_SYSTEM.md)
 * Все размеры следуют шкале 1.25× для чёткой иерархии
 */

/**
 * Display - Главный заголовок на странице (Hero text)
 * Использование: "ГОЛОСОВАНИЕ АКТИВНО", главные заголовки страниц
 */
export const TYPOGRAPHY_DISPLAY = {
  size: 'text-4xl',        // 40px (2.5rem)
  lineHeight: 'leading-tight', // 1.2
  weight: 'font-semibold', // 600
  letterSpacing: 'tracking-tight', // -0.02em
  className: 'text-4xl leading-tight font-semibold tracking-tight',
} as const;

/**
 * H1 - Page Title
 * Использование: Заголовки страниц (Статистика, Меню, Профиль)
 */
export const TYPOGRAPHY_H1 = {
  size: 'text-3xl',        // 32px (2rem)
  lineHeight: 'leading-tight', // 1.2
  weight: 'font-semibold', // 600
  letterSpacing: 'tracking-tight', // -0.01em
  className: 'text-3xl leading-tight font-semibold tracking-tight',
} as const;

/**
 * H2 - Section Title
 * Использование: Заголовки секций (Completed Polls, Budget)
 */
export const TYPOGRAPHY_H2 = {
  size: 'text-2xl',        // 24px (1.5rem)
  lineHeight: 'leading-snug', // 1.3
  weight: 'font-semibold', // 600
  className: 'text-2xl leading-snug font-semibold',
} as const;

/**
 * H3 - Card Title
 * Использование: Заголовки карточек, подзаголовки
 */
export const TYPOGRAPHY_H3 = {
  size: 'text-xl',         // 20px (1.25rem)
  lineHeight: 'leading-normal', // 1.4
  weight: 'font-semibold', // 600
  className: 'text-xl leading-normal font-semibold',
} as const;

/**
 * Body - Default текст
 * Использование: Основной текст, descriptions, paragraphs
 */
export const TYPOGRAPHY_BODY = {
  size: 'text-base',       // 16px (1rem)
  lineHeight: 'leading-relaxed', // 1.5
  weight: 'font-normal',   // 400
  className: 'text-base leading-relaxed font-normal',
} as const;

/**
 * Small - Secondary текст
 * Использование: Метаинформация, captions, labels
 */
export const TYPOGRAPHY_SMALL = {
  size: 'text-sm',         // 14px (0.875rem)
  lineHeight: 'leading-normal', // 1.4
  weight: 'font-normal',   // 400
  className: 'text-sm leading-normal font-normal',
} as const;

/**
 * Tiny - Tertiary текст
 * Использование: Timestamps, fine print, legal text
 */
export const TYPOGRAPHY_TINY = {
  size: 'text-xs',         // 12px (0.75rem)
  lineHeight: 'leading-snug', // 1.3
  weight: 'font-normal',   // 400
  className: 'text-xs leading-snug font-normal',
} as const;

/**
 * Helper: Получить className для типографики
 */
export const getTypographyClassName = (
  variant: 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny'
): string => {
  const map = {
    display: TYPOGRAPHY_DISPLAY.className,
    h1: TYPOGRAPHY_H1.className,
    h2: TYPOGRAPHY_H2.className,
    h3: TYPOGRAPHY_H3.className,
    body: TYPOGRAPHY_BODY.className,
    small: TYPOGRAPHY_SMALL.className,
    tiny: TYPOGRAPHY_TINY.className,
  };
  return map[variant];
};

/**
 * Typography Component Props
 * Использование в React компонентах
 */
export interface TypographyProps {
  variant?: 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny';
  className?: string;
  children: React.ReactNode;
}

/**
 * Примеры использования:
 * 
 * 1. Прямое использование констант:
 *    <h1 className={TYPOGRAPHY_H1.className}>Page Title</h1>
 * 
 * 2. Через helper функцию:
 *    <h2 className={getTypographyClassName('h2')}>Section Title</h2>
 * 
 * 3. Комбинирование с custom классами:
 *    <p className={cn(TYPOGRAPHY_BODY.className, 'text-gray-600')}>
 *      Body text with custom color
 *    </p>
 * 
 * 4. Отдельные свойства:
 *    <div className={cn(TYPOGRAPHY_H3.size, TYPOGRAPHY_H3.weight)}>
 *      Only size and weight
 *    </div>
 */

/**
 * Migration Guide - Замена старых классов на новую систему:
 * 
 * text-xl font-bold       → TYPOGRAPHY_H3 (или text-4xl для display)
 * text-2xl font-bold      → TYPOGRAPHY_H2
 * text-3xl font-bold      → TYPOGRAPHY_H1
 * text-4xl font-bold      → TYPOGRAPHY_DISPLAY
 * text-base               → TYPOGRAPHY_BODY
 * text-sm                 → TYPOGRAPHY_SMALL
 * text-xs                 → TYPOGRAPHY_TINY
 * 
 * ВАЖНО: Везде font-bold (700) меняем на font-semibold (600)
 */
