import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GradientButton } from '../../components/ui/gradient-button';

/**
 * TestPage - простая тестовая страница для проверки роутинга
 */
export const TestPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-8 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">✅ Роутинг работает!</h1>
        <p className="text-muted-foreground mb-6">
          Если вы видите эту страницу, значит приложение загружается корректно
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold mb-3">Навигация:</h2>
        
        <GradientButton 
          variant="peach" 
          className="w-full"
          onClick={() => navigate('/')}
        >
          🏠 Главная
        </GradientButton>

        <GradientButton 
          variant="mint" 
          className="w-full"
          onClick={() => navigate('/menu')}
        >
          🍽️ Меню
        </GradientButton>

        <GradientButton 
          variant="lavender" 
          className="w-full"
          onClick={() => navigate('/stats')}
        >
          📊 Статистика
        </GradientButton>

        <GradientButton 
          variant="coral" 
          className="w-full"
          onClick={() => navigate('/profile')}
        >
          👤 Профиль
        </GradientButton>
      </div>

      <div className="mt-8 p-4 bg-muted/30 rounded-lg">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Совет:</strong> Используйте Bottom Navigation внизу экрана для быстрой навигации
        </p>
      </div>
    </div>
  );
};
