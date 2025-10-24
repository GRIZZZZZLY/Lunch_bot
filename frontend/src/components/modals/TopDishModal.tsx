import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, TrendingUp, Users } from 'lucide-react';
import { GlassCard } from '../ui/glass-card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface TopDishModalProps {
  isOpen: boolean;
  onClose: () => void;
  topDish: {
    name: string;
    voteCount: number;
    percentage: number;
    imageUrl?: string;
    description?: string;
    price?: number;
  } | null;
}

export const TopDishModal: React.FC<TopDishModalProps> = ({ isOpen, onClose, topDish }) => {
  if (!topDish) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md"
            >
              <GlassCard intensity="high" className="relative overflow-hidden">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors z-10"
                >
                  <X size={20} className="text-foreground" />
                </button>

                {/* Trophy icon */}
                <div className="absolute top-0 right-0 opacity-10">
                  <Trophy size={200} className="text-butter-500" />
                </div>

                {/* Content */}
                <div className="relative p-6 space-y-6">
                  {/* Header */}
                  <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center size-16 rounded-full bg-gradient-to-br from-butter-500 to-butter-600 mb-3">
                      <Trophy size={32} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Топ блюдо недели
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Самое популярное блюдо по итогам голосований
                    </p>
                  </div>

                  {/* Dish info */}
                  <div className="space-y-4">
                    {topDish.imageUrl && (
                      <div className="relative h-48 rounded-xl overflow-hidden">
                        <img
                          src={topDish.imageUrl}
                          alt={topDish.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="space-y-3">
                      {/* Name */}
                      <h3 className="text-xl font-bold text-foreground">
                        {topDish.name}
                      </h3>

                      {/* Description */}
                      {topDish.description && (
                        <p className="text-sm text-muted-foreground">
                          {topDish.description}
                        </p>
                      )}

                      {/* Stats */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Users size={18} className="text-peach-500" />
                          <span className="text-sm font-medium text-foreground">
                            {topDish.voteCount} голосов
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp size={18} className="text-mint-500" />
                          <span className="text-sm font-medium text-foreground">
                            {topDish.percentage}% выборов
                          </span>
                        </div>
                      </div>

                      {/* Price */}
                      {topDish.price && (
                        <Badge variant="default" className="bg-gradient-to-r from-butter-500 to-butter-600 text-white">
                          {topDish.price} ₽
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      variant="default"
                      className="flex-1 bg-gradient-to-r from-butter-500 to-butter-600 hover:from-butter-600 hover:to-butter-700"
                      onClick={onClose}
                    >
                      Отлично!
                    </Button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
