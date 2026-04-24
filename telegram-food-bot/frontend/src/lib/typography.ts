/**
 * Typography Scale - Централизованная типографическая система
 * 
 * Основана на дизайн-документации (DESIGN_SYSTEM.md)
 * Все размеры следуют шкале 1.25× для чёткой иерархии
 */

/**
 * Display / Hero - Главный эмоциональный заголовок (Greeting)
 * Использование: "Доброе утро, Иван!", hero-тайтлы
 * Redesign 2026-04-24: 28px / 800 / -0.7px / 1.1
 */
export const TYPOGRAPHY_DISPLAY = {
  size: 'text-[28px]',
  lineHeight: 'leading-[1.1]',
  weight: 'font-extrabold',
  letterSpacing: 'tracking-[-0.7px]',
  className: 'text-[28px] leading-[1.1] font-extrabold tracking-[-0.7px]',
} as const;

export const TYPOGRAPHY_HERO = TYPOGRAPHY_DISPLAY;

/**
 * H1 - Page Title
 * Redesign: 22px / 700 / -0.4px / snug
 */
export const TYPOGRAPHY_H1 = {
  size: 'text-[22px]',
  lineHeight: 'leading-snug',
  weight: 'font-bold',
  letterSpacing: 'tracking-[-0.4px]',
  className: 'text-[22px] leading-snug font-bold tracking-[-0.4px]',
} as const;

/**
 * H2 - Section Title
 * Redesign: 17px / 600 / -0.2px
 */
export const TYPOGRAPHY_H2 = {
  size: 'text-[17px]',
  lineHeight: 'leading-snug',
  weight: 'font-semibold',
  letterSpacing: 'tracking-[-0.2px]',
  className: 'text-[17px] leading-snug font-semibold tracking-[-0.2px]',
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
 * Redesign: 15px / 1.6 — минимальный комфортный размер body в mobile
 */
export const TYPOGRAPHY_BODY = {
  size: 'text-[15px]',
  lineHeight: 'leading-[1.6]',
  weight: 'font-normal',
  className: 'text-[15px] leading-[1.6] font-normal',
} as const;

/**
 * Small / Caption
 * Redesign: 13px
 */
export const TYPOGRAPHY_SMALL = {
  size: 'text-[13px]',
  lineHeight: 'leading-[1.5]',
  weight: 'font-normal',
  className: 'text-[13px] leading-[1.5] font-normal',
} as const;

/**
 * Label — UPPERCASE helpers (платёжные данные, секции)
 * Redesign: 11px 700 0.8px uppercase
 */
export const TYPOGRAPHY_LABEL = {
  size: 'text-[11px]',
  lineHeight: 'leading-[1.4]',
  weight: 'font-bold',
  letterSpacing: 'tracking-[0.8px]',
  className: 'text-[11px] leading-[1.4] font-bold tracking-[0.8px] uppercase',
} as const;

/**
 * Mono-num — цифры в статистике, ценах
 */
export const TYPOGRAPHY_NUM = {
  size: 'text-base',
  weight: 'font-bold',
  className: 'font-mono font-bold tabular-nums',
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
