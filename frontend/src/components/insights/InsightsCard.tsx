/**
 * InsightsCard - Карточка с персональными инсайтами
 * Показывает интересные паттерны поведения пользователя
 */

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Award, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersonalInsight } from '@/services/insights.service';

interface InsightsCardProps {
  insights: PersonalInsight[];
  className?: string;
}

const colorClasses = {
  orange: 'from-orange-500 to-red-500',
  blue: 'from-blue-500 to-cyan-500',
  purple: 'from-purple-500 to-pink-500',
  green: 'from-green-500 to-emerald-500',
  yellow: 'from-yellow-500 to-orange-500',
};

const getIcon = (type: string) => {
  switch (type) {
    case 'favorite_dish':
      return TrendingUp;
    case 'voting_pattern':
      return Target;
    case 'taste_match':
      return Users;
    case 'achievement':
      return Award;
    default:
      return TrendingUp;
  }
};

export const InsightsCard: React.FC<InsightsCardProps> = ({
  insights,
  className,
}) => {
  if (insights.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl',
          'border-l-4 border-gray-300 dark:border-gray-600',
          className
        )}
      >
        <div className="text-center text-muted-foreground">
          <p className="text-sm">
            Как только пройдёт первое голосование, мы покажем ваши привычки и любимые блюда.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl',
        'border-l-4 border-purple-500',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
          <TrendingUp size={20} className="text-white" />
        </div>
        <h3 className="text-xl font-semibold text-foreground">
          Твои инсайты
        </h3>
      </div>

      <div className="space-y-3">
        {insights.map((insight, index) => {
          const Icon = getIcon(insight.type);
          
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'p-4 rounded-xl transition-all',
                'bg-gradient-to-r',
                colorClasses[insight.color as keyof typeof colorClasses] || colorClasses.orange,
                'text-white shadow-lg hover:scale-[1.02]'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl flex-shrink-0">
                  {insight.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-lg mb-1">
                    {insight.title}
                  </h4>
                  <p className="text-sm opacity-90">
                    {insight.description}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <Icon size={20} className="opacity-75" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: insights.length * 0.1 + 0.2 }}
        className="mt-4 pt-4 border-t border-border text-center"
      >
        <p className="text-xs text-muted-foreground">
          Продолжай голосовать, чтобы открыть больше инсайтов! 🎯
        </p>
      </motion.div>
    </motion.div>
  );
};

/**
 * Компактная версия для встраивания
 */
export const InsightsBadge: React.FC<{
  insight: PersonalInsight;
  onClick?: () => void;
}> = ({ insight, onClick }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full',
        'bg-gradient-to-r text-white font-medium text-sm',
        'shadow-lg cursor-pointer',
        colorClasses[insight.color as keyof typeof colorClasses]
      )}
    >
      <span>{insight.icon}</span>
      <span>{insight.title}</span>
    </motion.div>
  );
};
