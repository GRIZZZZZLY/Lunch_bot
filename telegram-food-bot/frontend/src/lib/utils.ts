import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Утилита для объединения className
 * Используется в shadcn/ui компонентах
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
