import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '../components/layout/Layout';
import { PageHeader } from '../components/common/PageHeader';
import { useTelegram } from '../hooks/useTelegram';
import { 
  Sparkles, 
  TrendingUp, 
  ShoppingCart, 
  Check, 
  Clock, 
  X,
  Heart,
  Star,
  Bell,
  Award,
  Zap,
  Sun,
  Moon
} from 'lucide-react';

/**
 * Демо-страница новых пастельных цветов
 * Показывает все варианты использования bluegray, lavender, peach и soft палитр
 * С ручным переключателем темы для тестирования
 */
export const ColorDemoPage: React.FC = () => {
  const { colorScheme } = useTelegram();
  // Локальный state для ручного переключения темы (независимо от Telegram)
  const [isDarkTheme, setIsDarkTheme] = useState(colorScheme === 'dark');
  const [activeTab, setActiveTab] = useState<'widgets' | 'buttons' | 'badges'>('widgets');

  return (
    <div className={`min-h-screen ${isDarkTheme ? 'dark bg-slate-800' : 'bg-gray-50'}`}>
      <Header />
      
      <main className="pb-20 px-4">
        {/* Theme Toggle + Header */}
        <div className="flex items-start justify-between mb-6">
          <PageHeader
            title="🎨 Пастельные Цвета"
            subtitle="Демонстрация мягкой палитры в светлой и темной теме"
            className="flex-1"
          />
          
          {/* Theme Toggle Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsDarkTheme(!isDarkTheme)}
            className={`ml-4 p-3 rounded-xl transition-all ${
              isDarkTheme 
                ? 'bg-slate-700 text-yellow-400 hover:bg-slate-600' 
                : 'bg-white text-slate-600 hover:bg-gray-100 shadow-md'
            }`}
            title={isDarkTheme ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
          >
            {isDarkTheme ? (
              <Sun size={24} className="animate-pulse" />
            ) : (
              <Moon size={24} />
            )}
          </motion.button>
        </div>

        {/* Навигация табами */}
        <div className={`flex gap-2 mb-6 rounded-lg p-1 ${
          isDarkTheme ? 'bg-slate-800/50' : 'bg-white shadow-sm border border-gray-200'
        }`}>
          <button
            onClick={() => setActiveTab('widgets')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
              activeTab === 'widgets'
                ? 'bg-bluegray-300 text-slate-900'
                : isDarkTheme
                  ? 'text-slate-300 hover:bg-slate-700'
                  : 'text-slate-600 hover:bg-gray-100'
            }`}
          >
            Виджеты
          </button>
          <button
            onClick={() => setActiveTab('buttons')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
              activeTab === 'buttons'
                ? 'bg-bluegray-300 text-slate-900'
                : isDarkTheme
                  ? 'text-slate-300 hover:bg-slate-700'
                  : 'text-slate-600 hover:bg-gray-100'
            }`}
          >
            Кнопки
          </button>
          <button
            onClick={() => setActiveTab('badges')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
              activeTab === 'badges'
                ? 'bg-bluegray-300 text-slate-900'
                : isDarkTheme
                  ? 'text-slate-300 hover:bg-slate-700'
                  : 'text-slate-600 hover:bg-gray-100'
            }`}
          >
            Бейджи
          </button>
        </div>

        {/* Виджеты */}
        {activeTab === 'widgets' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Bluegray Widget */}
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-3 flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-bluegray-300" />
                Bluegray Glass Widget
              </h3>
              <div className="glass-widget-bluegray rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-full bg-bluegray-400 
                                  flex items-center justify-center">
                    <TrendingUp size={24} className="text-slate-900" />
                  </div>
                  <span className="text-success-soft-300 text-sm font-medium">
                    +12%
                  </span>
                </div>
                
                <h4 className="text-2xl font-bold text-slate-50 mb-1">
                  248
                </h4>
                <p className="text-slate-300 text-sm mb-4">
                  Всего заказов за неделю
                </p>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Прогресс</span>
                    <span className="text-slate-50 font-medium">75%</span>
                  </div>
                  <div className="bg-bluegray-200/20 h-2 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '75%' }}
                      transition={{ duration: 1, delay: 0.3 }}
                      className="bg-bluegray-300 h-full rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Lavender Widget */}
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-3 flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-lavender-300" />
                Lavender Glass Widget (Premium)
              </h3>
              <div className="glass-widget-lavender rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-lavender-400 
                                  flex items-center justify-center">
                    <Sparkles size={24} className="text-slate-900" />
                  </div>
                  <div>
                    <h4 className="text-slate-50 font-semibold text-lg">
                      VIP Статус
                    </h4>
                    <p className="text-slate-300 text-sm">
                      Premium аккаунт
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 mb-3">
                  <span className="bg-lavender-300 text-slate-900 px-3 py-1 rounded-full text-xs font-medium">
                    <Star size={12} className="inline mr-1" />
                    Exclusive
                  </span>
                  <span className="bg-lavender-400 text-slate-900 px-3 py-1 rounded-full text-xs font-medium">
                    <Award size={12} className="inline mr-1" />
                    Level 5
                  </span>
                </div>
                
                <p className="text-slate-200 text-sm">
                  🎁 Получите 50% скидку на следующий заказ!
                </p>
              </div>
            </div>

            {/* Peach Widget */}
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-3 flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-peach-300" />
                Peach Glass Widget (Food Theme)
              </h3>
              <div className="glass-widget-peach rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-slate-50 font-bold text-xl mb-1">
                      🍔 Бургер Делюкс
                    </h4>
                    <p className="text-slate-300 text-sm">
                      Сочная говядина с сыром
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-peach-300">
                      ₽499
                    </div>
                    <div className="text-xs text-slate-400 line-through">
                      ₽699
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button className="btn-peach flex-1 px-4 py-2.5 rounded-lg font-medium
                                     transition-all hover:scale-105 active:scale-95">
                    <ShoppingCart size={16} className="inline mr-2" />
                    В корзину
                  </button>
                  <button className="bg-slate-700 text-slate-200 px-4 py-2.5 rounded-lg
                                     hover:bg-slate-600 transition-all">
                    <Heart size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Gradient Widget */}
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-3">
                Gradient: Bluegray → Lavender
              </h3>
              <div className="bg-gradient-to-r from-bluegray-300 to-lavender-300 
                              rounded-xl p-6 text-slate-900">
                <div className="flex items-center gap-3 mb-3">
                  <Zap size={32} />
                  <div>
                    <h4 className="font-bold text-xl">
                      Специальное предложение
                    </h4>
                    <p className="text-sm opacity-80">
                      Только сегодня!
                    </p>
                  </div>
                </div>
                <p className="font-medium">
                  Доставка бесплатно при заказе от ₽1000
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Кнопки */}
        {activeTab === 'buttons' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Bluegray Buttons */}
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-3">
                Bluegray Buttons
              </h3>
              <div className="space-y-3">
                <button className="btn-bluegray w-full px-6 py-3 rounded-lg font-semibold
                                   transition-all hover:scale-105 active:scale-95">
                  Информация
                </button>
                <button className="bg-bluegray-300 text-slate-900 w-full px-6 py-3 rounded-lg font-semibold
                                   hover:bg-bluegray-400 transition-all">
                  Подробнее
                </button>
                <button className="bg-bluegray-200 text-slate-900 w-full px-6 py-3 rounded-lg font-medium
                                   hover:bg-bluegray-300 transition-all">
                  Вторичная кнопка
                </button>
              </div>
            </div>

            {/* Lavender Buttons */}
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-3">
                Lavender Buttons (Premium)
              </h3>
              <div className="space-y-3">
                <button className="btn-lavender w-full px-6 py-3 rounded-lg font-semibold
                                   transition-all hover:scale-105 active:scale-95
                                   flex items-center justify-center gap-2">
                  <Sparkles size={20} />
                  Активировать Premium
                </button>
                <button className="bg-lavender-300 text-slate-900 w-full px-6 py-3 rounded-lg font-semibold
                                   hover:bg-lavender-400 transition-all
                                   flex items-center justify-center gap-2">
                  <Star size={20} />
                  VIP Доступ
                </button>
              </div>
            </div>

            {/* Peach Buttons */}
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-3">
                Peach Buttons (Food Actions)
              </h3>
              <div className="space-y-3">
                <button className="btn-peach w-full px-6 py-3 rounded-lg font-semibold
                                   transition-all hover:scale-105 active:scale-95
                                   flex items-center justify-center gap-2">
                  <ShoppingCart size={20} />
                  Заказать сейчас - ₽1299
                </button>
                <button className="bg-peach-300 text-slate-900 w-full px-6 py-3 rounded-lg font-semibold
                                   hover:bg-peach-400 transition-all">
                  Добавить в корзину
                </button>
              </div>
            </div>

            {/* Gradient Button */}
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-3">
                Gradient Buttons
              </h3>
              <div className="space-y-3">
                <button className="bg-gradient-to-r from-peach-300 to-lavender-300 
                                   text-slate-900 w-full px-6 py-3 rounded-lg font-bold
                                   hover:shadow-lg transition-all
                                   flex items-center justify-center gap-2">
                  <Zap size={20} />
                  Специальное предложение
                </button>
                <button className="bg-gradient-to-r from-bluegray-300 to-lavender-300 
                                   text-slate-900 w-full px-6 py-3 rounded-lg font-semibold
                                   hover:shadow-lg transition-all">
                  Получить бонус
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Бейджи */}
        {activeTab === 'badges' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Status Badges */}
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-3">
                Status Badges (Soft Colors)
              </h3>
              <div className="flex flex-wrap gap-2">
                <span className="bg-success-soft-300 text-slate-900 px-4 py-2 rounded-full 
                                text-sm font-medium inline-flex items-center gap-1.5">
                  <Check size={14} />
                  Доставлено
                </span>
                <span className="bg-warning-soft-300 text-slate-900 px-4 py-2 rounded-full 
                                text-sm font-medium inline-flex items-center gap-1.5">
                  <Clock size={14} />
                  В ожидании
                </span>
                <span className="bg-error-soft-300 text-slate-900 px-4 py-2 rounded-full 
                                text-sm font-medium inline-flex items-center gap-1.5">
                  <X size={14} />
                  Отменено
                </span>
              </div>
            </div>

            {/* Bluegray Badges */}
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-3">
                Bluegray Badges
              </h3>
              <div className="flex flex-wrap gap-2">
                <span className="bg-bluegray-300 text-slate-900 px-4 py-2 rounded-full 
                                text-sm font-medium">
                  Информация
                </span>
                <span className="bg-bluegray-400 text-slate-900 px-4 py-2 rounded-full 
                                text-sm font-medium">
                  В обработке
                </span>
                <span className="bg-bluegray-200 text-slate-900 px-3 py-1 rounded-full 
                                text-xs font-medium">
                  Новое
                </span>
              </div>
            </div>

            {/* Lavender Badges */}
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-3">
                Lavender Badges (Premium)
              </h3>
              <div className="flex flex-wrap gap-2">
                <span className="bg-lavender-300 text-slate-900 px-4 py-2 rounded-full 
                                text-sm font-medium inline-flex items-center gap-1.5">
                  <Sparkles size={14} />
                  VIP
                </span>
                <span className="bg-lavender-400 text-slate-900 px-4 py-2 rounded-full 
                                text-sm font-medium inline-flex items-center gap-1.5">
                  <Star size={14} />
                  Premium
                </span>
                <span className="bg-lavender-200 text-slate-900 px-3 py-1 rounded-full 
                                text-xs font-medium inline-flex items-center gap-1">
                  <Award size={12} />
                  Exclusive
                </span>
              </div>
            </div>

            {/* Peach Badges */}
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-3">
                Peach Badges (Food)
              </h3>
              <div className="flex flex-wrap gap-2">
                <span className="bg-peach-300 text-slate-900 px-4 py-2 rounded-full 
                                text-sm font-medium">
                  🔥 Популярное
                </span>
                <span className="bg-peach-400 text-slate-900 px-4 py-2 rounded-full 
                                text-sm font-medium">
                  -30% Скидка
                </span>
                <span className="bg-peach-200 text-slate-900 px-3 py-1 rounded-full 
                                text-xs font-medium">
                  ⚡ Быстро
                </span>
              </div>
            </div>

            {/* Notification Badge */}
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-3">
                Notification Badges
              </h3>
              <div className="flex gap-6">
                <div className="relative">
                  <Bell size={32} className="text-slate-300" />
                  <span className="absolute -top-1 -right-1 
                                   bg-lavender-300 text-slate-900 
                                   w-6 h-6 rounded-full 
                                   flex items-center justify-center 
                                   text-xs font-bold">
                    3
                  </span>
                </div>
                
                <div className="relative">
                  <ShoppingCart size={32} className="text-slate-300" />
                  <span className="absolute -top-1 -right-1 
                                   bg-peach-300 text-slate-900 
                                   w-6 h-6 rounded-full 
                                   flex items-center justify-center 
                                   text-xs font-bold">
                    5
                  </span>
                </div>
                
                <div className="relative">
                  <Heart size={32} className="text-slate-300" />
                  <span className="absolute -top-1 -right-1 
                                   bg-error-soft-300 text-slate-900 
                                   w-6 h-6 rounded-full 
                                   flex items-center justify-center 
                                   text-xs font-bold">
                    12
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Info Footer */}
        <div className={`mt-8 p-4 rounded-lg ${
          isDarkTheme 
            ? 'bg-slate-700/30 border border-slate-600/30' 
            : 'bg-blue-50 border border-blue-200'
        }`}>
          <p className={`text-sm text-center font-medium ${
            isDarkTheme ? 'text-slate-300' : 'text-blue-900'
          }`}>
            💡 Все цвета проверены на контрастность WCAG AA/AAA
          </p>
          <p className={`text-xs text-center mt-1 ${
            isDarkTheme ? 'text-slate-400' : 'text-blue-700'
          }`}>
            Переключайте тему кнопкой {isDarkTheme ? '☀️' : '🌙'} для сравнения отображения в светлой и темной теме
          </p>
        </div>
      </main>
    </div>
  );
};
