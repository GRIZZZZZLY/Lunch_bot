import { motion } from 'framer-motion';
import { Trophy, Users } from 'lucide-react';
import { PastelCard, CardHeader, CardTitle, CardContent } from '../ui/pastel-card';

interface LeaderboardUser {
  position: number;
}

interface LeaderboardProps {
  isDark: boolean;
  onUserClick?: (user: LeaderboardUser) => void;
}

export function Leaderboard({ isDark, onUserClick }: LeaderboardProps) {
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
            <Trophy className={`w-5 h-5 ${isDark ? 'text-peach-400' : 'text-peach-600'}`} />
            <CardTitle className="text-lg">Лидеры группы</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Users className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`} />
              <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Статистика появится после нескольких голосований
              </p>
            </div>
          </div>
        </CardContent>
      </PastelCard>
    </motion.div>
  );
}
