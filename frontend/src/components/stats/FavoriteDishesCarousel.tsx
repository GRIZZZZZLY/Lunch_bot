import { motion } from 'framer-motion';
import { Utensils, Star } from 'lucide-react';
import { PastelCard, CardHeader, CardTitle, CardContent } from '../ui/pastel-card';

interface FavoriteDishesCarouselProps {
  isDark: boolean;
}

export function FavoriteDishesCarousel({ isDark }: FavoriteDishesCarouselProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <PastelCard variant="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Utensils className={`w-5 h-5 ${isDark ? 'text-peach-400' : 'text-peach-600'}`} />
            <CardTitle className="text-lg">Любимые блюда</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Star className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`} />
              <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Голосуйте чаще, чтобы увидеть статистику
              </p>
            </div>
          </div>
        </CardContent>
      </PastelCard>
    </motion.div>
  );
}
