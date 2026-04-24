import { motion } from 'framer-motion';
import { User, TrendingUp, Wallet } from 'lucide-react';
import { PastelCard, CardHeader, CardTitle, CardContent } from '../ui/pastel-card';

interface PersonalHeroCardProps {
  isDark: boolean;
}

export function PersonalHeroCard({ isDark }: PersonalHeroCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <PastelCard variant="default" className="relative overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              isDark ? 'bg-primary/12 text-primary' : 'bg-primary/10 text-primary'
            }`}>
              <User className='w-6 h-6' />
            </div>
            <div>
              <CardTitle className="text-lg">Моя статистика</CardTitle>
              <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Личная активность и привычки
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/35 p-3">
              <div className="mb-2 flex items-center gap-2">
                <TrendingUp className={`h-5 w-5 ${isDark ? 'text-mint-400' : 'text-mint-600'}`} />
                <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Участие
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold">Стабильный участник</p>
                <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Следите за голосованиями и не пропускаете обеды</p>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/35 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Wallet className={`h-5 w-5 ${isDark ? 'text-lavender-400' : 'text-lavender-600'}`} />
                <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Платежи
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold">Готово к расчетам</p>
                <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Проверяйте оплаты и держите платежные данные под рукой</p>
              </div>
            </div>
          </div>
        </CardContent>
      </PastelCard>
    </motion.div>
  );
}
