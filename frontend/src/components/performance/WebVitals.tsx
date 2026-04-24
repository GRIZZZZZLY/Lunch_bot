import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react';

/**
 * Web Vitals мониторинг
 * 
 * Отслеживает ключевые метрики производительности:
 * - LCP (Largest Contentful Paint) - скорость загрузки
 * - FID (First Input Delay) - интерактивность
 * - CLS (Cumulative Layout Shift) - визуальная стабильность
 * - FCP (First Contentful Paint) - первый контент
 * - TTFB (Time to First Byte) - время ответа сервера
 */

interface Metric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

const reportWebVitals = (metric: Metric) => {
  // Логируем метрики в консоль (в production можно отправлять в analytics)
  console.group(`📊 Web Vitals: ${metric.name}`);
  console.log(`Value: ${metric.value.toFixed(2)}ms`);
  console.log(`Rating: ${metric.rating}`);
  console.log(`ID: ${metric.id}`);
  console.groupEnd();

  // P1.2.3: Отправляем Web Vitals в Sentry
  Sentry.setMeasurement(metric.name, metric.value, 'millisecond');
  
  Sentry.addBreadcrumb({
    category: 'web-vitals',
    message: `${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`,
    level: metric.rating === 'good' ? 'info' : metric.rating === 'needs-improvement' ? 'warning' : 'error',
    data: {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
    },
  });

  // В production отправляем в analytics
  if (process.env.NODE_ENV === 'production') {
    // Google Analytics example:
    // window.gtag?.('event', metric.name, {
    //   value: Math.round(metric.value),
    //   metric_id: metric.id,
    //   metric_value: metric.value,
    //   metric_delta: metric.delta,
    // });

    // Custom analytics example:
    // fetch('/api/analytics/web-vitals', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     metric: metric.name,
    //     value: metric.value,
    //     rating: metric.rating,
    //     timestamp: Date.now(),
    //   }),
    // });
  }
};

export const WebVitals: React.FC = () => {
  useEffect(() => {
    // Динамический импорт web-vitals библиотеки
    // Только если в браузере поддерживается PerformanceObserver
    if ('PerformanceObserver' in window) {
      import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
        onCLS(reportWebVitals);
        onINP(reportWebVitals);
        onFCP(reportWebVitals);
        onLCP(reportWebVitals);
        onTTFB(reportWebVitals);
      }).catch((error) => {
        console.error('Failed to load web-vitals:', error);
      });
    }
  }, []);

  // Компонент не рендерит ничего - только side effects
  return null;
};

/**
 * Performance Monitor - визуальный индикатор производительности (для dev mode)
 */
export const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<Record<string, Metric>>({});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Только в dev mode
    if (process.env.NODE_ENV !== 'development') return;

    // Показывать при нажатии Ctrl+Shift+P
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    // Собираем метрики
    if ('PerformanceObserver' in window) {
      import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
        const updateMetric = (metric: Metric) => {
          setMetrics(prev => ({
            ...prev,
            [metric.name]: metric,
          }));
        };

        onCLS(updateMetric);
        onINP(updateMetric);
        onFCP(updateMetric);
        onLCP(updateMetric);
        onTTFB(updateMetric);
      });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  if (!isVisible || process.env.NODE_ENV !== 'development') return null;

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good':
        return 'bg-green-500';
      case 'needs-improvement':
        return 'bg-yellow-500';
      case 'poor':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg shadow-lg z-[9999] max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold">⚡ Performance</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-xs text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2 text-xs">
        {Object.entries(metrics).map(([name, metric]) => (
          <div key={name} className="flex items-center justify-between">
            <span className="font-mono">{name}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono">{metric.value.toFixed(0)}ms</span>
              <span className={`w-2 h-2 rounded-full ${getRatingColor(metric.rating)}`} />
            </div>
          </div>
        ))}
        <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-700">
          Press Ctrl+Shift+P to toggle
        </div>
      </div>
    </div>
  );
};

