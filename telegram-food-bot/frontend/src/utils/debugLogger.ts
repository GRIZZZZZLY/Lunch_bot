/**
 * Debug Logger для детальной диагностики проблем
 * Включается через localStorage: localStorage.setItem('debug', 'true')
 */

export const DEBUG_ENABLED = typeof window !== 'undefined' && localStorage.getItem('debug') === 'true';

export const DEBUG_STYLES = {
  api: 'background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px;',
  poll: 'background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px;',
  cache: 'background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px;',
  error: 'background: #F44336; color: white; padding: 2px 6px; border-radius: 3px;',
  success: 'background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px;',
  warning: 'background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px;',
  info: 'background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px;',
  data: 'color: #9C27B0; font-weight: bold;',
};

class DebugLogger {
  private enabled: boolean;

  constructor() {
    this.enabled = DEBUG_ENABLED;
    if (this.enabled) {
      console.log('%c🐛 Debug Mode ENABLED', DEBUG_STYLES.success);
      console.log('To disable: localStorage.removeItem("debug")');
    }
  }

  /**
   * Логирование API запросов
   */
  api(method: string, url: string, data?: any) {
    if (!this.enabled) return;
    
    console.group(`%c API ${method} %c ${url}`, DEBUG_STYLES.api, 'color: #666');
    if (data) {
      console.log('%cRequest Data:', DEBUG_STYLES.data, data);
    }
    console.log('Time:', new Date().toISOString());
    console.trace('Called from:');
    console.groupEnd();
  }

  /**
   * Логирование ответов API
   */
  apiResponse(method: string, url: string, response: any, duration?: number) {
    if (!this.enabled) return;
    
    const style = response.success ? DEBUG_STYLES.success : DEBUG_STYLES.error;
    console.group(`%c API Response ${method} %c ${url}`, style, 'color: #666');
    console.log('%cResponse:', DEBUG_STYLES.data, response);
    if (duration) {
      console.log(`Duration: ${duration}ms`);
    }
    console.groupEnd();
  }

  /**
   * Логирование состояния Poll
   */
  poll(action: string, poll: any) {
    if (!this.enabled) return;
    
    console.group(`%c POLL ${action}`, DEBUG_STYLES.poll);
    console.log('%cPoll ID:', DEBUG_STYLES.data, poll?.id);
    console.log('%cStatus:', DEBUG_STYLES.data, poll?.status);
    console.log('%cselectedMenuItemIds:', DEBUG_STYLES.data, poll?.selectedMenuItemIds);
    
    if (poll?.selectedMenuItemIds) {
      try {
        const parsed = JSON.parse(poll.selectedMenuItemIds);
        console.log('%cParsed IDs:', DEBUG_STYLES.data, parsed);
      } catch (_e) {
        console.warn('Failed to parse selectedMenuItemIds');
      }
    }
    
    console.log('%cFull Poll:', DEBUG_STYLES.data, poll);
    console.groupEnd();
  }

  /**
   * Логирование фильтрации menu items
   */
  filter(component: string, before: number, after: number, selectedIds?: number[]) {
    if (!this.enabled) return;
    
    console.group(`%c FILTER ${component}`, DEBUG_STYLES.warning);
    console.log('%cBefore filtering:', DEBUG_STYLES.data, `${before} items`);
    console.log('%cAfter filtering:', DEBUG_STYLES.data, `${after} items`);
    if (selectedIds) {
      console.log('%cSelected IDs:', DEBUG_STYLES.data, selectedIds);
    }
    console.log('%cReduction:', DEBUG_STYLES.data, `${((1 - after/before) * 100).toFixed(1)}%`);
    console.groupEnd();
  }

  /**
   * Логирование кэша
   */
  cache(action: string, key: string, data?: any) {
    if (!this.enabled) return;
    
    console.group(`%c CACHE ${action}`, DEBUG_STYLES.cache);
    console.log('%cKey:', DEBUG_STYLES.data, key);
    if (data) {
      console.log('%cData:', DEBUG_STYLES.data, data);
    }
    console.groupEnd();
  }

  /**
   * Логирование ошибок
   */
  error(component: string, error: any, context?: any) {
    if (!this.enabled) return;
    
    console.group(`%c ERROR ${component}`, DEBUG_STYLES.error);
    console.error('Error:', error);
    if (context) {
      console.log('%cContext:', DEBUG_STYLES.data, context);
    }
    console.trace('Stack trace:');
    console.groupEnd();
  }

  /**
   * Логирование компонентов
   */
  component(name: string, action: string, data?: any) {
    if (!this.enabled) return;
    
    console.group(`%c ${name} %c ${action}`, DEBUG_STYLES.info, 'color: #666');
    if (data) {
      console.log('%cData:', DEBUG_STYLES.data, data);
    }
    console.groupEnd();
  }

  /**
   * Логирование состояния
   */
  state(component: string, stateName: string, oldValue: any, newValue: any) {
    if (!this.enabled) return;
    
    console.group(`%c STATE ${component}.${stateName}`, DEBUG_STYLES.warning);
    console.log('%cOld:', DEBUG_STYLES.data, oldValue);
    console.log('%cNew:', DEBUG_STYLES.data, newValue);
    console.log('%cChanged:', DEBUG_STYLES.data, oldValue !== newValue);
    console.groupEnd();
  }

  /**
   * Логирование таймингов
   */
  time(label: string) {
    if (!this.enabled) return;
    console.time(`⏱️ ${label}`);
  }

  timeEnd(label: string) {
    if (!this.enabled) return;
    console.timeEnd(`⏱️ ${label}`);
  }

  /**
   * Групповое логирование
   */
  group(label: string, style?: string) {
    if (!this.enabled) return;
    console.group(`%c ${label}`, style || DEBUG_STYLES.info);
  }

  groupEnd() {
    if (!this.enabled) return;
    console.groupEnd();
  }

  /**
   * Простое логирование
   */
  log(message: string, data?: any) {
    if (!this.enabled) return;
    console.log(message, data);
  }
}

export const debugLogger = new DebugLogger();

// Экспорт для использования в window (для отладки в консоли)
if (typeof window !== 'undefined') {
  (window as any).__debug = debugLogger;
  (window as any).__enableDebug = () => {
    localStorage.setItem('debug', 'true');
    window.location.reload();
  };
  (window as any).__disableDebug = () => {
    localStorage.removeItem('debug');
    window.location.reload();
  };
}
