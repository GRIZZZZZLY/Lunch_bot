import { useEffect, useState } from 'react';
import type { Metric } from 'web-vitals';

const getRatingColor = (rating: Metric['rating']): string => {
  switch (rating) {
    case 'good':
      return 'bg-green-500';
    case 'needs-improvement':
      return 'bg-yellow-500';
    case 'poor':
      return 'bg-red-500';
  }
};

/** Локальный экран метрик для разработки, включаемый Ctrl+Shift+P. */
export const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<Record<string, Metric>>({});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        setIsVisible(previous => !previous);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    if ('PerformanceObserver' in window) {
      void import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
        const updateMetric = (metric: Metric) => {
          setMetrics(previous => ({ ...previous, [metric.name]: metric }));
        };

        onCLS(updateMetric);
        onINP(updateMetric);
        onFCP(updateMetric);
        onLCP(updateMetric);
        onTTFB(updateMetric);
      });
    }

    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!isVisible || !import.meta.env.DEV) return null;

  return (
    <div className='fixed bottom-4 right-4 z-[9999] max-w-sm rounded-lg bg-black/90 p-4 text-white shadow-lg'>
      <div className='mb-2 flex items-center justify-between'>
        <h3 className='text-sm font-bold'>⚡ Производительность</h3>
        <button
          type='button'
          onClick={() => setIsVisible(false)}
          className='text-xs text-gray-400 hover:text-white'
        >
          ✕
        </button>
      </div>
      <div className='space-y-2 text-xs'>
        {Object.entries(metrics).map(([name, metric]) => (
          <div key={name} className='flex items-center justify-between'>
            <span className='font-mono'>{name}</span>
            <div className='flex items-center gap-2'>
              <span className='font-mono'>{metric.value.toFixed(0)} мс</span>
              <span
                className={`h-2 w-2 rounded-full ${getRatingColor(metric.rating)}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
