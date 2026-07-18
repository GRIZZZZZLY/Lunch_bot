import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

const RUSSIAN_DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx and tailwind-merge for optimal class handling
 * 
 * @example
 * cn('px-2 py-1', 'px-4') // => 'py-1 px-4' (px-4 overrides px-2)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format date to Russian locale
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return RUSSIAN_DATE_FORMATTER.format(d)
}

/**
 * Format relative time (e.g., "2 минуты назад")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'только что'
  if (diffMins < 60) return `${diffMins} ${pluralize(diffMins, ['минуту', 'минуты', 'минут'])} назад`
  if (diffHours < 24) return `${diffHours} ${pluralize(diffHours, ['час', 'часа', 'часов'])} назад`
  if (diffDays < 7) return `${diffDays} ${pluralize(diffDays, ['день', 'дня', 'дней'])} назад`
  
  return formatDate(d)
}

/**
 * Russian pluralization helper
 */
export function pluralize(count: number, words: [string, string, string]): string {
  const cases = [2, 0, 1, 1, 1, 2]
  return words[(count % 100 > 4 && count % 100 < 20) ? 2 : cases[Math.min(count % 10, 5)]]
}
