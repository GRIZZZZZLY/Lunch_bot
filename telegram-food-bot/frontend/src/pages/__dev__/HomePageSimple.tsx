import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../store/useAppStore';
import { motion } from 'framer-motion';

/**
 * Упрощенная HomePage - проверяем постепенно что работает
 */
export const HomePageSimple: React.FC = () => {
  console.log('🏠 [HomePageSimple] Rendering');
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useAppStore((state) => state.theme);
  const isDark = theme === 'dark';
  
  return (
    <div className="space-y-6 min-h-screen">
      {/* Gradient Background - FIXED */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
            : 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
        }}
      />

      {/* Header Card - VISIBLE */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl shadow-xl"
        style={{
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
        }}
      >
        <h1 
          className="text-3xl font-bold mb-2"
          style={{ color: isDark ? '#ffffff' : '#000000' }}
        >
          🏠 Привет, {user?.firstName || 'Гость'}!
        </h1>
        <p 
          className="text-lg"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
        >
          Добро пожаловать в Food Bot
        </p>
      </motion.div>

      {/* Quick Actions Grid - VISIBLE */}
      <div className="grid grid-cols-2 gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/menu')}
          className="p-6 rounded-xl shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#ffffff',
          }}
        >
          <div className="text-4xl mb-2">🍽️</div>
          <div className="font-semibold text-lg">Меню</div>
          <div className="text-sm opacity-80">Все блюда</div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/stats')}
          className="p-6 rounded-xl shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: '#ffffff',
          }}
        >
          <div className="text-4xl mb-2">📊</div>
          <div className="font-semibold text-lg">Статистика</div>
          <div className="text-sm opacity-80">Анализ</div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/profile')}
          className="p-6 rounded-xl shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: '#ffffff',
          }}
        >
          <div className="text-4xl mb-2">👤</div>
          <div className="font-semibold text-lg">Профиль</div>
          <div className="text-sm opacity-80">Настройки</div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            console.log('🗳️ Vote button clicked');
            alert('Голосование скоро!');
          }}
          className="p-6 rounded-xl shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            color: '#ffffff',
          }}
        >
          <div className="text-4xl mb-2">🗳️</div>
          <div className="font-semibold text-lg">Голосование</div>
          <div className="text-sm opacity-80">Активно</div>
        </motion.button>
      </div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="p-6 rounded-2xl"
        style={{
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
        }}
      >
        <h3 
          className="text-xl font-bold mb-3"
          style={{ color: isDark ? '#ffffff' : '#000000' }}
        >
          ℹ️ Состояние приложения
        </h3>
        <div 
          className="space-y-2 text-sm"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
        >
          <div>✅ Тема: <strong>{theme}</strong></div>
          <div>✅ Пользователь: <strong>{user?.firstName || 'Не загружен'}</strong></div>
          <div>✅ Навигация работает</div>
          <div>✅ Анимации включены</div>
        </div>
      </motion.div>

      {/* Debug Links */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => navigate('/debug-diagnostic')}
          className="px-4 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: isDark ? 'rgba(100, 100, 100, 0.5)' : 'rgba(200, 200, 200, 0.5)',
            color: isDark ? '#ffffff' : '#000000',
          }}
        >
          🔍 Диагностика
        </button>
        <button
          onClick={() => navigate('/home-full')}
          className="px-4 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: isDark ? 'rgba(100, 100, 100, 0.5)' : 'rgba(200, 200, 200, 0.5)',
            color: isDark ? '#ffffff' : '#000000',
          }}
        >
          🏠 Полная HomePage
        </button>
      </div>
    </div>
  );
};
