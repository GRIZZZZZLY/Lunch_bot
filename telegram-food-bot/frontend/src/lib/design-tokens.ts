/**
 * 🎨 ЦЕНТРАЛИЗОВАННЫЕ ДИЗАЙН-ТОКЕНЫ
 * 
 * Single source of truth для всех дизайн-значений.
 * Использовать вместо magic numbers в компонентах.
 * 
 * @version 2.0.0
 * @date 2025-11-10
 */

/**
 * 🎯 ICON_SIZES - Tailwind классы для иконок
 * Используйте вместо inline размеров (size-3, w-5 h-5, etc.)
 * 
 * @example
 * // ❌ OLD:
 * <Icon className="size-5" />
 * <Icon className="w-6 h-6" />
 * 
 * // ✅ NEW:
 * import { ICON_SIZES } from '@/lib/design-tokens';
 * <Icon className={ICON_SIZES.md} />
 * <Icon className={ICON_SIZES.lg} />
 */
export const ICON_SIZES = {
  xs: 'size-3',     // 12px (0.75rem) - inline badges, metadata icons
  sm: 'size-4',     // 16px (1rem) - inline text, small buttons
  md: 'size-5',     // 20px (1.25rem) - DEFAULT - standard buttons, list items
  lg: 'size-6',     // 24px (1.5rem) - headers, emphasized actions
  xl: 'size-8',     // 32px (2rem) - hero sections, feature icons
  '2xl': 'size-12', // 48px (3rem) - empty states, celebrations, large illustrations
} as const;

/**
 * 🎯 TYPE HELPERS
 */

/**
 * 🔧 UTILITY FUNCTIONS
 */

/**
 * Получить значение spacing по ключу
 */

/**
 * Получить значение radius по ключу
 */

/**
 * Получить градиент по ключу
 */

/**
 * Создать CSS переменную для градиента
 */
