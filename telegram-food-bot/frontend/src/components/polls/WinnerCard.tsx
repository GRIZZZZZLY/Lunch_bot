import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Users } from 'lucide-react';
import { GlassCard, GlassCardContent } from '../ui/glass-card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface WinnerCardProps {
  dishName: string;
  dishImage?: string;
  voteCount: number;
  price: number;
  category?: string;
  className?: string;
}

/**
 * Карточка победившего блюда
 */
export const WinnerCard: React.FC<WinnerCardProps> = ({
  dishName,
  dishImage,
  voteCount,
  price,
  category,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className={cn('w-full', className)}
    >
      <GlassCard className="overflow-hidden border-2 border-yellow-500/30 shadow-xl">
        <GlassCardContent className="p-6">
          {/* Бейдж победителя */}
          <div className="flex justify-center mb-4">
            <Badge 
              variant="default" 
              className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1.5 text-sm font-semibold shadow-lg"
            >
              <Trophy className="w-4 h-4 mr-1.5" />
              Победитель
            </Badge>
          </div>

          {/* Изображение блюда */}
          <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden mb-4 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
            {dishImage ? (
              <img
                src={dishImage}
                alt={dishName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl opacity-50">
                  {getCategoryEmoji(category)}
                </span>
              </div>
            )}
            
            {/* Градиент оверлей */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>

          {/* Название блюда */}
          <h3 className="text-2xl font-bold text-center mb-3 text-gray-900 dark:text-white">
            {dishName}
          </h3>

          {/* Статистика */}
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span className="font-medium">{voteCount} {voteCount === 1 ? 'голос' : voteCount < 5 ? 'голоса' : 'голосов'}</span>
            </div>
            
            <div className="w-1 h-1 rounded-full bg-gray-400" />
            
            <div className="font-semibold text-lg text-green-600 dark:text-green-400">
              {price} ₽
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
};

// Вспомогательная функция для эмодзи категорий
function getCategoryEmoji(category?: string): string {
  const emojiMap: Record<string, string> = {
    'pizza': '🍕',
    'salad': '🥗',
    'soup': '🍜',
    'pasta': '🍝',
    'burger': '🍔',
    'sushi': '🍱',
    'dessert': '🍰',
    'drink': '🥤',
  };
  
  return category ? emojiMap[category.toLowerCase()] || '🍽️' : '🍽️';
}
