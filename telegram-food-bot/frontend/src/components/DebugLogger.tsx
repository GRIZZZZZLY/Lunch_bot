import { useEffect, useState } from 'react';

interface LogEntry {
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

export const DebugLogger = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Перехватываем console.log, console.warn, console.error
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (level: 'info' | 'warn' | 'error', args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      const entry: LogEntry = {
        time: new Date().toLocaleTimeString(),
        level,
        message,
        data: args.length > 1 ? args.slice(1) : undefined
      };

      setLogs(prev => [...prev.slice(-50), entry]); // Храним последние 50
    };

    console.log = (...args: any[]) => {
      originalLog(...args);
      // Логируем все сообщения с префиксами [ComponentName] или emoji
      if (
        args[0]?.includes?.('[') || 
        args[0]?.includes?.('🔄') || 
        args[0]?.includes?.('✅') || 
        args[0]?.includes?.('⚠️') || 
        args[0]?.includes?.('❌') ||
        args[0]?.includes?.('🚀') ||
        args[0]?.includes?.('📱')
      ) {
        addLog('info', args);
      }
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      addLog('warn', args);
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      addLog('error', args);
    };

    // Автоматическое открытие отключено - только по тройному тапу

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, [logs]);

  // Тройной тап для показа/скрытия
  useEffect(() => {
    let tapCount = 0;
    let tapTimer: NodeJS.Timeout;

    const handleTap = () => {
      tapCount++;
      clearTimeout(tapTimer);
      
      if (tapCount === 3) {
        setIsVisible(prev => !prev);
        tapCount = 0;
      }
      
      tapTimer = setTimeout(() => {
        tapCount = 0;
      }, 500);
    };

    document.addEventListener('touchstart', handleTap);
    
    return () => {
      document.removeEventListener('touchstart', handleTap);
      clearTimeout(tapTimer);
    };
  }, []);

  if (!isVisible && logs.length === 0) return null;

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-900/90 text-red-100';
      case 'warn': return 'bg-yellow-900/90 text-yellow-100';
      default: return 'bg-blue-900/90 text-blue-100';
    }
  };

  const getLevelEmoji = (level: string) => {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      default: return 'ℹ️';
    }
  };

  return (
    <>
      {/* Floating Button - увеличен для мобильных */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed top-4 right-4 z-[9999] bg-gray-800 text-white p-4 rounded-full shadow-2xl border-2 border-white/20"
        style={{ touchAction: 'manipulation', minWidth: '56px', minHeight: '56px' }}
      >
        <span className="text-xl">{isVisible ? '✖️' : '🐛'}</span>
        {logs.filter(l => l.level === 'error').length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
            {logs.filter(l => l.level === 'error').length}
          </span>
        )}
        {logs.length > 0 && (
          <span className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
            {logs.length}
          </span>
        )}
      </button>

      {/* Logger Panel */}
      {isVisible && (
        <div
          className="fixed inset-0 z-[9998] bg-black/95 overflow-auto p-4"
          style={{ 
            fontFamily: 'monospace',
            fontSize: '11px',
            touchAction: 'pan-y'
          }}
        >
          <div className="mb-4 flex justify-between items-center sticky top-0 bg-black py-2">
            <h2 className="text-white font-bold text-sm">🐛 Debug Logs</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setLogs([])}
                className="bg-red-600 text-white px-3 py-1 rounded text-xs"
              >
                Clear
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="bg-gray-600 text-white px-3 py-1 rounded text-xs"
              >
                Close
              </button>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              No logs yet. Waiting for events...
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded ${getLevelColor(log.level)}`}
                >
                  <div className="flex items-start gap-2">
                    <span>{getLevelEmoji(log.level)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs opacity-70 mb-1">{log.time}</div>
                      <div className="whitespace-pre-wrap break-words">
                        {log.message}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 text-gray-500 text-xs text-center pb-4">
            Tip: Triple-tap anywhere to toggle this panel
          </div>
        </div>
      )}
    </>
  );
};
