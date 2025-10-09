import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../store/useAppStore';

/**
 * Диагностическая HomePage - проверка что всё работает
 */
export const HomePageDiagnostic: React.FC = () => {
  console.log('🔍 [HomePageDiagnostic] Rendering');
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useAppStore((state) => state.theme);
  
  console.log('📊 [HomePageDiagnostic] State:', { user, theme });
  
  return (
    <div 
      className="min-h-screen p-6 space-y-6"
      style={{ 
        backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f5f5f5',
        color: theme === 'dark' ? '#ffffff' : '#000000'
      }}
    >
      {/* Debug Info */}
      <div 
        className="p-6 rounded-2xl"
        style={{ 
          backgroundColor: theme === 'dark' ? '#2a2a2a' : '#ffffff',
          border: '2px solid #3b82f6'
        }}
      >
        <h1 className="text-3xl font-bold mb-4" style={{ color: '#3b82f6' }}>
          🔍 Диагностика HomePage
        </h1>
        
        <div className="space-y-3 text-sm">
          <div>
            <strong>Theme:</strong> {theme || 'undefined'}
          </div>
          <div>
            <strong>User:</strong> {user ? `${user.firstName} (ID: ${user.id})` : 'Not loaded'}
          </div>
          <div>
            <strong>Timestamp:</strong> {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Test Gradient */}
      <div 
        className="p-6 rounded-2xl"
        style={{ 
          background: 'linear-gradient(135deg, #FF6B9D 0%, #FFA06B 100%)',
          color: '#ffffff'
        }}
      >
        <h2 className="text-2xl font-bold mb-2">✅ Gradient Background Test</h2>
        <p>Если видите этот текст на розово-оранжевом фоне, градиенты работают</p>
      </div>

      {/* Test Buttons */}
      <div className="space-y-3">
        <button
          onClick={() => navigate('/menu')}
          className="w-full p-4 rounded-xl font-semibold text-white"
          style={{ backgroundColor: '#22c55e' }}
        >
          🍽️ Перейти в Меню
        </button>
        
        <button
          onClick={() => navigate('/stats')}
          className="w-full p-4 rounded-xl font-semibold text-white"
          style={{ backgroundColor: '#8b5cf6' }}
        >
          📊 Перейти в Статистику
        </button>
        
        <button
          onClick={() => navigate('/profile')}
          className="w-full p-4 rounded-xl font-semibold text-white"
          style={{ backgroundColor: '#f59e0b' }}
        >
          👤 Перейти в Профиль
        </button>

        <button
          onClick={() => navigate('/debug-simple')}
          className="w-full p-4 rounded-xl font-semibold text-white"
          style={{ backgroundColor: '#64748b' }}
        >
          🛠️ Simple HomePage
        </button>
      </div>

      {/* Test Tailwind Classes */}
      <div className="bg-blue-500 text-white p-6 rounded-2xl">
        <h3 className="text-xl font-bold mb-2">🎨 Tailwind CSS Test</h3>
        <p>Если видите синий фон, Tailwind CSS работает</p>
        <div className="mt-3 flex gap-2">
          <div className="bg-red-500 w-12 h-12 rounded"></div>
          <div className="bg-green-500 w-12 h-12 rounded"></div>
          <div className="bg-yellow-500 w-12 h-12 rounded"></div>
        </div>
      </div>

      {/* Console Logs */}
      <div 
        className="p-6 rounded-2xl text-xs font-mono"
        style={{ 
          backgroundColor: theme === 'dark' ? '#0a0a0a' : '#e5e5e5',
          border: '1px solid #6b7280'
        }}
      >
        <h3 className="text-base font-bold mb-3">📋 Console Logs</h3>
        <p>Откройте DevTools (F12) → Console</p>
        <p className="mt-2 text-green-500">Должны видеть: 🔍 [HomePageDiagnostic] Rendering</p>
      </div>
    </div>
  );
};
