import { motion } from 'framer-motion';
import { User, TrendingUp, Award } from 'lucide-react';
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
      <PastelCard
        variant="glass"
        className="relative overflow-hidden"
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isDark ? 'bg-peach-500/20' : 'bg-peach-100'
            }`}>
              <User className={`w-6 h-6 ${isDark ? 'text-peach-400' : 'text-peach-600'}`} />
            </div>
            <div>
              <CardTitle className="text-lg">Моя статистика</CardTitle>
              <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Личные достижения
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
              <div>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Участие
                </p>
                <p className="text-lg font-semibold">Активен</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Award className={`w-5 h-5 ${isDark ? 'text-peach-400' : 'text-peach-600'}`} />
              <div>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Уровень
                </p>
                <p className="text-lg font-semibold">Новичок</p>
              </div>
            </div>
          </div>
        </CardContent>
      </PastelCard>
    </motion.div>
  );
}
