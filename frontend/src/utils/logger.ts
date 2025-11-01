/**
 * Production-safe logger utility
 * 
 * In production: only errors and warnings are logged
 * In development: all logs are enabled
 */

const isDevelopment = import.meta.env.DEV;
const isDebugEnabled = isDevelopment || localStorage.getItem('debug') === 'true';

export const logger = {
  /**
   * Info logs - only in development
   */
  info: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  
  /**
   * Warning logs - always enabled
   */
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  
  /**
   * Error logs - always enabled
   */
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  
  /**
   * Debug logs - only when debug flag is enabled
   */
  debug: (message: string, ...args: any[]) => {
    if (isDebugEnabled) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Performance logs - only in development
   */
  perf: (message: string, duration?: number) => {
    if (isDevelopment && duration !== undefined) {
      console.log(`⏱️ [PERF] ${message}: ${duration.toFixed(2)}ms`);
    }
  },
};
