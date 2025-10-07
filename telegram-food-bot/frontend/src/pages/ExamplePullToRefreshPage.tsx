import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { EmptyState } from '../components/common/EmptyState';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../components/common/PullToRefreshIndicator';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '../components/ui/glass-card';
import { Skeleton } from '../components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

/**
 * ExamplePullToRefreshPage - Пример использования Pull-to-Refresh и Empty States
 * 
 * Демонстрирует:
 * - Pull-to-Refresh жест
 * - Empty States с CTA
 * - Skeleton loading
 * - Интеграция с реальными данными
 */
export const ExamplePullToRefreshPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Pull-to-Refresh hook
  const { isPulling, pullProgress, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      console.log('🔄 Refreshing data...');
      
      // Симуляция загрузки данных
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Загружаем новые данные (пример)
      setItems([
        { id: 1, title: 'Борщ', votes: 15 },
        { id: 2, title: 'Салат Цезарь', votes: 12 },
        { id: 3, title: 'Пельмени', votes: 10 },
      ]);
      
      console.log('✅ Data refreshed!');
    },
  });

  const loadData = async () => {
    setIsLoading(true);
    
    // Симуляция API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setItems([
      { id: 1, title: 'Борщ', votes: 15 },
      { id: 2, title: 'Салат Цезарь', votes: 12 },
    ]);
    
    setIsLoading(false);
  };

  // Initial load
  React.useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen pb-24">
      {/* Pull-to-Refresh Indicator */}
      <PullToRefreshIndicator 
        progress={pullProgress} 
        isRefreshing={isRefreshing} 
      />

      {/* Header */}
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-2">Пример Pull-to-Refresh</h1>
        <p className="text-sm text-muted-foreground">
          Потяните вниз для обновления данных
        </p>
      </div>

      {/* Content */}
      <div className="px-4 space-y-3">
        {isLoading ? (
          // Loading Skeletons
          <>
            <GlassCard>
              <GlassCardContent className="p-4">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-full" />
              </GlassCardContent>
            </GlassCard>
            <GlassCard>
              <GlassCardContent className="p-4">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-full" />
              </GlassCardContent>
            </GlassCard>
          </>
        ) : items.length === 0 ? (
          // Empty State
          <EmptyState 
            type="no-votes" 
            onAction={() => navigate('/vote')} 
          />
        ) : (
          // Items List
          items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <GlassCard hover>
                <GlassCardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {item.votes} голосов
                      </p>
                    </div>
                    <div className="text-2xl">🍽️</div>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          ))
        )}
      </div>

      {/* Instructions */}
      <div className="fixed bottom-20 left-0 right-0 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-primary/10 backdrop-blur-sm rounded-lg p-3 text-center text-sm"
        >
          <p className="text-muted-foreground">
            💡 Потяните экран вниз в самом верху для обновления
          </p>
        </motion.div>
      </div>
    </div>
  );
};
