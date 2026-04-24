import { motion } from 'framer-motion';
import { Award, Lock } from 'lucide-react';
import { PastelCard, CardHeader, CardTitle, CardContent } from '../ui/pastel-card';

interface Achievement {
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface AchievementBadgesGridProps {
  isDark: boolean;
  onAchievementClick?: (achievement: Achievement) => void;
}

export function AchievementBadgesGrid({
  isDark,
  onAchievementClick: _onAchievementClick,
}: AchievementBadgesGridProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <PastelCard variant="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className={`w-5 h-5 ${isDark ? 'text-peach-400' : 'text-peach-600'}`} />
            <CardTitle className="text-lg">Достижения</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Lock className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`} />
              <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Получайте достижения за активность
              </p>
            </div>
          </div>
        </CardContent>
      </PastelCard>
    </motion.div>
  );
}
