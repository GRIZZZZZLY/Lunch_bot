import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { GlassCard, GlassCardContent } from '../../components/ui/glass-card';
import { GradientButton } from '../../components/ui/gradient-button';

/**
 * Упрощенная HomePage для тестирования
 */
export const SimpleHomePage: React.FC = () => {
  console.log('🏠 [SimpleHomePage] Rendering');
  
  const navigate = useNavigate();
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen p-4 space-y-4">
      {/* Простой заголовок */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold mb-2">
          🏠 Главная страница
        </h1>
        <p className="text-white/90">
          Привет, {user?.firstName || 'Гость'}!
        </p>
      </div>

      {/* Карточки навигации */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/vote')}
          className="bg-blue-500 text-white p-6 rounded-xl shadow-lg active:scale-95 transition-transform"
        >
          <div className="text-3xl mb-2">🗳️</div>
          <div className="font-semibold">Голосование</div>
        </button>

        <button
          onClick={() => navigate('/menu')}
          className="bg-green-500 text-white p-6 rounded-xl shadow-lg active:scale-95 transition-transform"
        >
          <div className="text-3xl mb-2">🍽️</div>
          <div className="font-semibold">Меню</div>
        </button>

        <button
          onClick={() => navigate('/stats')}
          className="bg-purple-500 text-white p-6 rounded-xl shadow-lg active:scale-95 transition-transform"
        >
          <div className="text-3xl mb-2">📊</div>
          <div className="font-semibold">Статистика</div>
        </button>

        <button
          onClick={() => navigate('/profile')}
          className="bg-pink-500 text-white p-6 rounded-xl shadow-lg active:scale-95 transition-transform"
        >
          <div className="text-3xl mb-2">👤</div>
          <div className="font-semibold">Профиль</div>
        </button>
      </div>

      {/* Информация */}
      <GlassCard>
        <GlassCardContent className="p-6">
          <h2 className="text-lg font-bold mb-3">📝 Упрощенная версия</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Это упрощенная версия HomePage для диагностики проблем с отображением.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Layout работает</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Навигация отображается</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>GlassCard рендерится</span>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Тестовая кнопка */}
      <GradientButton
        variant="peach"
        size="lg"
        className="w-full"
        onClick={() => {
          console.log('🔘 Test button clicked');
          alert('Кнопка работает! ✅');
        }}
      >
        🚀 Тест кнопки
      </GradientButton>

      {/* Переключатель на полную версию */}
      <button
        onClick={() => navigate('/')}
        className="w-full bg-gray-800 text-white p-4 rounded-xl"
      >
        Открыть полную версию HomePage →
      </button>
    </div>
  );
};
