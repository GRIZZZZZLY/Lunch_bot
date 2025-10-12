/**
 * Analytics Event Tracking
 * P1 Task: User behavior tracking + Conversion funnels
 */

/**
 * Analytics Events типы
 */
export const ANALYTICS_EVENTS = {
  // Voting Events
  VOTE_STARTED: 'vote_started',
  VOTE_SUBMITTED: 'vote_submitted',
  VOTE_CHANGED: 'vote_changed',
  VOTE_CANCELED: 'vote_canceled',
  
  // Poll Events
  POLL_VIEWED: 'poll_viewed',
  POLL_CREATED: 'poll_created',
  POLL_CLOSED: 'poll_closed',
  POLL_SHARED: 'poll_shared',
  
  // Menu Events
  MENU_VIEWED: 'menu_viewed',
  MENU_ITEM_VIEWED: 'menu_item_viewed',
  MENU_ITEM_ADDED: 'menu_item_added',
  MENU_ITEM_EDITED: 'menu_item_edited',
  MENU_ITEM_DELETED: 'menu_item_deleted',
  MENU_ITEM_TOGGLED: 'menu_item_toggled',
  
  // Search & Filter Events
  MENU_SEARCHED: 'menu_searched',
  MENU_FILTERED: 'menu_filtered',
  
  // Navigation Events
  PAGE_VIEWED: 'page_viewed',
  QUICK_ACTION_CLICKED: 'quick_action_clicked',
  
  // User Events
  USER_ONBOARDED: 'user_onboarded',
  USER_PROFILE_UPDATED: 'user_profile_updated',
  
  // Error Events
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error',
} as const;

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS];

/**
 * Analytics Provider Type
 * Можно подключить разные провайдеры (Google Analytics, Mixpanel, PostHog)
 */
type AnalyticsProvider = 'console' | 'api' | 'gtag' | 'mixpanel';

interface AnalyticsConfig {
  enabled: boolean;
  provider: AnalyticsProvider;
  debug: boolean;
}

/**
 * Конфигурация Analytics
 */
const config: AnalyticsConfig = {
  // Включаем только в production
  enabled: import.meta.env.MODE === 'production',
  
  // Provider: 'api' - отправляем на наш backend
  provider: 'api',
  
  // Debug mode - логируем события в консоль
  debug: import.meta.env.MODE === 'development',
};

/**
 * Track event
 * 
 * @param event - название события
 * @param data - дополнительные данные
 * 
 * @example
 * ```ts
 * trackEvent('vote_submitted', {
 *   pollId: 123,
 *   menuItemId: 456,
 *   duration: 1500, // ms
 * });
 * ```
 */
export function trackEvent(
  event: AnalyticsEvent,
  data?: Record<string, any>
) {
  // Debug logging
  if (config.debug) {
    console.log('📊 [Analytics]', event, data);
  }

  // Если analytics отключен - пропускаем
  if (!config.enabled) {
    return;
  }

  // Добавляем метаданные
  const eventData = {
    event,
    data,
    timestamp: Date.now(),
    sessionId: getSessionId(),
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };

  // Отправляем в зависимости от провайдера
  switch (config.provider) {
    case 'api':
      sendToAPI(eventData);
      break;
    case 'gtag':
      sendToGoogleAnalytics(event, data);
      break;
    case 'console':
      console.log('[Analytics Event]', eventData);
      break;
    default:
      console.warn('[Analytics] Unknown provider:', config.provider);
  }
}

/**
 * Track page view
 * 
 * @param pageName - название страницы
 * @param referrer - откуда пришел
 */
export function trackPageView(
  pageName: string,
  referrer?: string
) {
  trackEvent(ANALYTICS_EVENTS.PAGE_VIEWED, {
    page: pageName,
    referrer,
    url: window.location.href,
  });
}

/**
 * Track timing (для performance метрик)
 * 
 * @example
 * ```ts
 * const startTime = Date.now();
 * await loadData();
 * trackTiming('data_load', Date.now() - startTime);
 * ```
 */
export function trackTiming(
  name: string,
  duration: number,
  category?: string
) {
  if (config.debug) {
    console.log(`⏱️ [Analytics Timing] ${name}: ${duration}ms`);
  }

  trackEvent('timing' as AnalyticsEvent, {
    name,
    duration,
    category,
  });
}

/**
 * Track error
 * 
 * @param error - ошибка
 * @param context - контекст
 */
export function trackError(
  error: Error | unknown,
  context?: {
    component?: string;
    action?: string;
    extra?: Record<string, any>;
  }
) {
  const errorData = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    component: context?.component,
    action: context?.action,
    ...context?.extra,
  };

  trackEvent(ANALYTICS_EVENTS.ERROR_OCCURRED, errorData);
}

/**
 * Conversion funnel tracking
 * Помогает понять где пользователи "отваливаются"
 * 
 * @example
 * ```ts
 * trackFunnel('voting', 'started');
 * // ... user votes
 * trackFunnel('voting', 'submitted');
 * ```
 */
export function trackFunnel(
  funnelName: string,
  step: string,
  data?: Record<string, any>
) {
  trackEvent('funnel_step' as AnalyticsEvent, {
    funnel: funnelName,
    step,
    ...data,
  });
}

/**
 * A/B Test tracking
 * 
 * @example
 * ```ts
 * trackABTest('quick_vote_button', 'variant_a');
 * ```
 */
export function trackABTest(
  testName: string,
  variant: string
) {
  trackEvent('ab_test' as AnalyticsEvent, {
    test: testName,
    variant,
  });
}

// ========== INTERNAL HELPERS ==========

/**
 * Get or create session ID
 */
function getSessionId(): string {
  const SESSION_KEY = 'analytics_session_id';
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * Send event to our API
 */
async function sendToAPI(eventData: any) {
  try {
    // Используем navigator.sendBeacon для надежной отправки
    // (работает даже если пользователь закрывает вкладку)
    const success = navigator.sendBeacon(
      '/api/analytics',
      JSON.stringify(eventData)
    );

    if (!success) {
      // Fallback to fetch
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
        // keepalive для отправки при закрытии страницы
        keepalive: true,
      }).catch(err => {
        console.error('[Analytics] Failed to send event:', err);
      });
    }
  } catch (error) {
    console.error('[Analytics] Error sending event:', error);
  }
}

/**
 * Send to Google Analytics (gtag)
 */
function sendToGoogleAnalytics(
  event: string,
  data?: Record<string, any>
) {
  if (typeof (window as any).gtag === 'function') {
    (window as any).gtag('event', event, data);
  }
}

/**
 * Batch events для оптимизации
 * Отправляем пачками каждые 5 секунд
 */
let eventQueue: any[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

export function trackEventBatched(
  event: AnalyticsEvent,
  data?: Record<string, any>
) {
  eventQueue.push({ event, data, timestamp: Date.now() });

  // Флашим каждые 5 секунд или при 10 событиях
  if (eventQueue.length >= 10) {
    flushEvents();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(flushEvents, 5000);
  }
}

function flushEvents() {
  if (eventQueue.length === 0) return;

  const events = [...eventQueue];
  eventQueue = [];
  
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  // Отправляем batch
  if (config.enabled) {
    fetch('/api/analytics/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
    }).catch(err => {
      console.error('[Analytics] Failed to send batch:', err);
    });
  }

  if (config.debug) {
    console.log('📊 [Analytics Batch]', events.length, 'events');
  }
}

// Flush events перед выгрузкой страницы
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushEvents();
  });
}
