/**
 * Централизованный экспорт всех анимационных компонентов
 */

export * from './AnimatedPage';
export * from './MotionComponents';

// Re-export framer-motion для удобства
export { motion, AnimatePresence } from 'framer-motion';
export type { MotionProps, Variants } from 'framer-motion';
