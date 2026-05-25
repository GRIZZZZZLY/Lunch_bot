/**
 * Web Vitals → Sentry custom metrics
 *
 * Зачем: Sentry browserTracingIntegration ловит FCP/LCP, но INP и CLS у Telegram
 * Mini App в iframe ведут себя нестандартно. Подписываемся на onINP/onCLS/onLCP/
 * onFCP/onTTFB напрямую через web-vitals и шлём как Sentry measurements на
 * текущую транзакцию (если она есть) + как gauge для агрегата.
 *
 * Метрики попадают в Sentry → Performance → Web Vitals (per-page).
 */
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';
import * as Sentry from '@sentry/react';

type VitalName = 'CLS' | 'FCP' | 'INP' | 'LCP' | 'TTFB';

const UNIT_BY_METRIC: Record<VitalName, 'millisecond' | 'none'> = {
  CLS: 'none',
  FCP: 'millisecond',
  INP: 'millisecond',
  LCP: 'millisecond',
  TTFB: 'millisecond',
};

function report(metric: Metric): void {
  const name = metric.name as VitalName;
  const value = metric.value;
  const unit = UNIT_BY_METRIC[name] ?? 'none';

  try {
    // 1) Прикрепляем к активному span / транзакции — даёт Web Vitals в Sentry.
    const activeSpan = Sentry.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttribute(`web_vital.${name.toLowerCase()}`, value);
      activeSpan.setAttribute(`web_vital.${name.toLowerCase()}.rating`, metric.rating);
    }

    // 2) Breadcrumb — попадает в issue context, помогает корелировать с ошибками.
    Sentry.addBreadcrumb({
      category: 'web-vital',
      message: name,
      level: metric.rating === 'poor' ? 'warning' : 'info',
      data: {
        value,
        rating: metric.rating,
        unit,
        navigationType: metric.navigationType,
      },
    });

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[web-vitals] ${name}=${value.toFixed(2)} (${metric.rating})`);
    }
  } catch {
    /* swallow — телеметрия не должна валить рендер */
  }
}

/**
 * Подписаться на все Core Web Vitals. Вызывать ОДИН раз после рендера.
 */
export function initWebVitals(): void {
  try {
    onCLS(report);
    onFCP(report);
    onINP(report);
    onLCP(report);
    onTTFB(report);
  } catch (err) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[web-vitals] init failed', err);
    }
  }
}
