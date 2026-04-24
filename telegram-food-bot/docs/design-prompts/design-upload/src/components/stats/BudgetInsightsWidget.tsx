import { motion } from 'framer-motion';
import { DollarSign, TrendingDown, PiggyBank } from 'lucide-react';
import { PastelCard, CardHeader, CardTitle, CardContent } from '../ui/pastel-card';

export function BudgetInsightsWidget() {
  const isDark = document.documentElement.classList.contains('dark');
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <PastelCard variant="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className={`w-5 h-5 ${isDark ? 'text-peach-400' : 'text-peach-600'}`} />
            <CardTitle className="text-lg">Бюджет и аналитика</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDark ? 'bg-green-500/20' : 'bg-green-100'
                }`}>
                  <TrendingDown className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                </div>
                <div>
                  <p className={`text-xs ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Средний чек
                  </p>
                  <p className="text-lg font-semibold">~350₽</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDark ? 'bg-peach-500/20' : 'bg-peach-100'
                }`}>
                  <PiggyBank className={`w-5 h-5 ${isDark ? 'text-peach-400' : 'text-peach-600'}`} />
                </div>
                <div>
                  <p className={`text-xs ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Экономия
                  </p>
                  <p className="text-lg font-semibold">0₽</p>
                </div>
              </div>
            </div>
            <div className={`text-center py-4 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              <p className="text-sm">
                Подробная аналитика появится после нескольких заказов
              </p>
            </div>
          </div>
        </CardContent>
      </PastelCard>
    </motion.div>
  );
}
