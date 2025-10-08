import React from 'react';

/**
 * Минималистичная HomePage для диагностики
 * Если эта страница видна - проблема в оригинальной HomePage
 */
export const DebugHomePage: React.FC = () => {
  console.log('🟢 [DebugHomePage] Rendering!');
  
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-md w-full"
        style={{
          border: '4px solid #fff',
        }}
      >
        <h1 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
          🎉 SUCCESS!
        </h1>
        <p className="text-center text-lg text-gray-700 dark:text-gray-300 mb-6">
          Эта страница отображается правильно!
        </p>
        
        <div className="space-y-4">
          <div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg">
            <p className="text-sm font-mono text-green-800 dark:text-green-200">
              ✅ Layout работает
            </p>
          </div>
          
          <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <p className="text-sm font-mono text-blue-800 dark:text-blue-200">
              ✅ Стили загружаются
            </p>
          </div>
          
          <div className="p-4 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <p className="text-sm font-mono text-purple-800 dark:text-purple-200">
              ✅ Компонент рендерится
            </p>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 rounded-lg">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Если вы видите это:</strong><br/>
              Проблема в оригинальной HomePage, а не в Layout/Navigation
            </p>
          </div>
        </div>
        
        <button
          onClick={() => console.log('🔘 Button clicked!')}
          className="mt-6 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all"
        >
          Тест кнопки
        </button>
      </div>
    </div>
  );
};
