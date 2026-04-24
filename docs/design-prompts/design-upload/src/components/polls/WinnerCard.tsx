import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Users } from 'lucide-react';
import { PastelCard, CardContent } from '../ui/pastel-card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface WinnerCardProps {
  dishName: string;
  dishImage?: string;
  voteCount: number;
  price: number;
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
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className={cn('w-full', className)}
    >
      <PastelCard variant="peach" className="overflow-hidden border-2 border-pastel-peach-400 shadow-xl">
        <CardContent className="p-6 pt-6">
          {/* Бейдж победителя */}
          <div className="flex justify-center mb-4">
            <Badge 
              variant="default" 
              className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1.5 text-sm font-semibold shadow-lg"
            >
              <Trophy className={`${ICON_SIZES.sm} mr-1.5`} />
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
                  🍽️
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
              <Users className={ICON_SIZES.sm} />
              <span className="font-medium">{voteCount} {voteCount === 1 ? 'голос' : voteCount < 5 ? 'голоса' : 'голосов'}</span>
            </div>
            
            <div className="w-1 h-1 rounded-full bg-gray-400" />
            
            <div className="font-semibold text-lg text-green-600 dark:text-green-400">
              {price} ₽
            </div>
          </div>
        </CardContent>
      </PastelCard>
    </motion.div>
  );
};

