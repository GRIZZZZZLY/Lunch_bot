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
      <PastelCard variant="default">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Utensils className={`w-5 h-5 ${isDark ? 'text-primary' : 'text-primary'}`} />
            <CardTitle className="text-lg">Любимые блюда</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 py-2">
            {[1,2,3].map((slot) => (
              <div key={slot} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/35 px-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Star className='h-4 w-4' />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Любимое блюдо #{slot}</p>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Появится после накопления голосов</p>
                </div>
              </div>
            ))}
            <div className={`pt-1 text-center text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Голосуй чаще, чтобы увидеть персональные предпочтения.
            </div>
          </div>
        </CardContent>
      </PastelCard>
    </motion.div>
  );
}
