import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, 
  TrendingUp,
  Clock,
  Vote,
  Sun,
  Moon,
  ArrowRight,
} from 'lucide-react';
import { GlassHeroCard } from '../components/glass';
import { DonationButton } from '../components/donation';
import { BottomSheet, useBottomSheet } from '../components/common/BottomSheet';
import { CreatePollForm, SimplePollCard } from '../components/polls';
import { useTelegram } from '../hooks/useTelegram';
import { useAuth } from '../hooks/useAuth';
import { useHaptic } from '../hooks/useHaptic';
import { useMenu, useAppStore } from '../store/useAppStore';
import { pollsService, PollWithDetails } from '../services/polls.service';

/**
 * HomePage - Главная страница с Hero section и Action buttons
 * Трансформация от Crypto Premium к Food Premium Experience
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { colorScheme } = useTelegram();
  const { user } = useAuth();
  const haptic = useHaptic();
  const { menuItems } = useMenu();
  const { theme, setTheme } = useAppStore((state) => ({
    theme: state.theme,
    setTheme: state.setTheme,
  }));
  
  const isDark = colorScheme === 'dark';
  const { isOpen: isPollSheetOpen, open: openPollSheet, close: closePollSheet } = useBottomSheet();
  
  // Подсчёт статистики для Hero card
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderItemsCount, setOrderItemsCount] = useState(0);
  const [activePolls, setActivePolls] = useState<PollWithDetails[]>([]);
  const [activePoll, setActivePoll] = useState<PollWithDetails | null>(null);
  const [pollRefreshKey, setPollRefreshKey] = useState(0);
  
  useEffect(() => {
    // TODO: Получить реальные данные заказа из store
    // Пока используем mock данные
    setOrderTotal(1450);
    setOrderItemsCount(3);
    
    // Загружаем активные голосования
    loadActivePolls();
  }, []);
  
  const loadActivePolls = async () => {
    try {
      const response = await pollsService.getActivePolls();
      console.log('🔍 Poll API Response:', response);
      
      if (response.success && response.data) {
        console.log('📊 Active polls data:', response.data);
        setActivePolls(response.data);
        
        // Set first active poll as main poll
        if (response.data.length > 0) {
          const firstPoll = response.data[0];
          console.log('✅ Setting active poll:', firstPoll);
          
          // Transform backend fields to frontend expected fields
          const transformedPoll = {
            ...firstPoll,
            title: 'Голосование на обед',
            endTime: firstPoll.endedAt || 
              (firstPoll.startedAt ? 
                new Date(new Date(firstPoll.startedAt).getTime() + (firstPoll.duration || 30) * 60 * 1000).toISOString() : 
                new Date(Date.now() + 30 * 60 * 1000).toISOString()),
            voteCount: firstPoll._count?.votes || 0,
          };
          
          setActivePoll(transformedPoll);
        } else {
          console.log('❌ No active polls found');
          setActivePoll(null);
        }
      } else {
        // Если ошибка авторизации - просто не показываем виджет
        console.warn('Cannot load polls:', response.error);
        setActivePoll(null);
        setActivePolls([]);
      }
    } catch (error) {
      console.error('Error loading active polls:', error);
      setActivePoll(null);
      setActivePolls([]);
    }
  };

  // Auto-refresh active poll every 10 seconds
  useEffect(() => {
    if (!activePoll) return;
    
    const refreshInterval = setInterval(() => {
      loadActivePolls();
    }, 10000); // 10 seconds

    return () => clearInterval(refreshInterval);
  }, [activePoll]);
  
  // Средний чек
  const averageCheck = orderItemsCount > 0 
    ? Math.round(orderTotal / orderItemsCount) 
    : 0;

  // Handle poll creation success
  const handlePollCreated = (pollId: number) => {
    closePollSheet();
    haptic.success();
    // Reload active polls to show the new poll
    loadActivePolls();
  };

  // Handle poll closed
  const handlePollClosed = () => {
    loadActivePolls(); // Refresh to remove closed poll
  };

  // Handle FAB click
  const handleCreatePollClick = () => {
    haptic.medium();
    openPollSheet();
  };
  
  // Быстрая статистика
  const quickStats = [
    {
      icon: <ShoppingCart size={20} />,
      label: 'Текущий заказ',
      value: `₽${orderTotal.toLocaleString('ru-RU')}`,
      subtitle: orderItemsCount > 0 
        ? `${orderItemsCount} ${orderItemsCount === 1 ? 'блюдо' : 'блюда'} · ₽${averageCheck} средний чек`
        : 'Заказ пуст',
      color: 'text-orange-600',
      gradient: true,
    },
    {
      icon: <TrendingUp size={20} />,
      label: 'Популярное',
      value: '🍕 Пицца',
      color: 'text-primary-food-700',
    },
    {
      icon: <Clock size={20} />,
      label: 'Сегодня',
      value: `${menuItems.filter(i => i.isActive).length} блюд`,
      color: 'text-green-600',
    },
  ];
  
  return (
    <>
      {/* Animated Gradient Background */}
      <div className="space-y-6 pb-24">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="pt-4"
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Привет, {user?.firstName || 'Гость'}! 👋
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Время выбрать что поесть
          </p>
        </motion.div>
        
        {/* Theme Toggle */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="flex items-center justify-center gap-4 py-4"
        >
          <Sun size={24} className={`transition-colors ${
            theme === 'light' ? 'text-orange-500' : 'text-gray-400 dark:text-gray-600'
          }`} />
          
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
              theme === 'dark' 
                ? 'bg-slate-600 dark:bg-slate-700' 
                : 'bg-gray-300'
            }`}
            aria-label="Переключить тему"
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md ${
                theme === 'dark' ? 'left-9' : 'left-1'
              }`}
            />
          </button>
          
          <Moon size={24} className={`transition-colors ${
            theme === 'dark' ? 'text-blue-400' : 'text-gray-400'
          }`} />
        </motion.div>
        
        {/* DEBUG INFO - Показываем всем для отладки */}
        <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-lg text-xs mb-4">
          <div>👤 User: {user?.firstName || 'Unknown'}</div>
          <div>🔑 Admin: {user?.isAdmin ? 'YES' : 'NO'}</div>
          <div>🗳️ Active Poll: {activePoll ? `ID ${activePoll.id}` : 'NONE'}</div>
          <div>📊 Total Polls: {activePolls.length}</div>
          <div>🔄 Refresh Key: {pollRefreshKey}</div>
          {activePoll && (
            <>
              <div>📅 Status: {activePoll.status || 'N/A'}</div>
              <div>⏱️ Duration: {activePoll.duration || 'N/A'} min</div>
              <div>🏷️ Title: {activePoll.title || 'N/A'}</div>
              <div>🏁 EndTime: {activePoll.endTime ? new Date(activePoll.endTime).toLocaleTimeString() : 'N/A'}</div>
              <div>📍 StartedAt: {activePoll.startedAt || 'N/A'}</div>
              <div>📍 EndedAt: {activePoll.endedAt || 'N/A'}</div>
            </>
          )}
        </div>
        
        {/* Dynamic Poll Widget - Launch or Active */}
        <AnimatePresence mode="wait">
          {!activePoll && user?.isAdmin && (
            <motion.div
              key="launch-poll"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCreatePollClick}
                className="cursor-pointer"
              >
                <GlassHeroCard
                  gradient={{ from: '#8B5CF6', to: '#7C3AED' }}
                  value="🗳️"
                  label="Запустить голосование"
                  sublabel="Создайте новое голосование для вашей группы"
                  textColor="#FFFFFF"
                  icon={<Vote size={24} />}
                  className="shadow-lg ring-2 ring-white/20"
                />
              </motion.div>
            </motion.div>
          )}
          
          {activePoll && (
            <motion.div
              key="active-poll"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              <SimplePollCard 
                poll={activePoll} 
                onPollClosed={handlePollClosed}
              />
            </motion.div>
          )}
        </AnimatePresence>
        

        
        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {quickStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.3 }}
              className={`
                rounded-xl p-4 shadow-sm border
                ${stat.gradient 
                  ? 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700/30 col-span-full' 
                  : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                }
              `}
            >
              <div className="flex items-center space-x-2 mb-2">
                <div className={stat.color}>
                  {stat.icon}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {stat.label}
                </span>
              </div>
              <p className="font-bold text-xl text-gray-900 dark:text-white mb-1">
                {stat.value}
              </p>
              {stat.subtitle && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {stat.subtitle}
                </p>
              )}
            </motion.div>
          ))}
        </motion.div>
        
        {/* Time-based Greeting Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="bg-gradient-to-r from-primary-food-50 to-primary-food-100 dark:from-peach-500/20 dark:to-peach-400/20 rounded-xl p-4 border border-primary-food-200 dark:border-peach-400/30"
        >
          <div className="flex items-start space-x-3">
            <div className="text-3xl">
              🍽️
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-primary-food-900 dark:text-primary-food-100 mb-1">
                Время обеда!
              </h3>
              <p className="text-sm text-primary-food-700 dark:text-primary-food-300">
                Выберите что-нибудь вкусное из нашего меню
              </p>
            </div>
          </div>
        </motion.div>
        
        {/* Donation Button */}
        <DonationButton />
      </div>

      {/* Create Poll Bottom Sheet */}
      <BottomSheet
        isOpen={isPollSheetOpen}
        onClose={closePollSheet}
        title="Запустить голосование"
        snapPoints={[85]}
        showHandle
        enableSwipeDown
        enableBackdrop={true}
      >
        <CreatePollForm 
          onSuccess={handlePollCreated}
          onCancel={closePollSheet}
        />
      </BottomSheet>
    </>
  );
};
