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

export function Leaderboard({
  isDark,
  onUserClick: _onUserClick,
}: LeaderboardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <PastelCard variant="default">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className={`w-5 h-5 ${isDark ? 'text-primary' : 'text-primary'}`} />
            <CardTitle className="text-lg">Лидеры группы</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((place) => (
              <div key={place} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/35 px-3 py-3">
                <div className={
                  place === 1
                    ? 'flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary'
                    : place === 2
                      ? 'flex h-8 w-8 items-center justify-center rounded-full bg-lavender-500/12 text-sm font-semibold text-lavender-500'
                      : 'flex h-8 w-8 items-center justify-center rounded-full bg-butter-500/12 text-sm font-semibold text-butter-600 dark:text-butter-400'
                }>{place}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Место пока свободно</p>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Появится после накопления статистики</p>
                </div>
                <Users className={`h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
              </div>
            ))}
            <div className={`pt-1 text-center text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Лидерборд станет полезнее после нескольких завершённых голосований.
            </div>
          </div>
        </CardContent>
      </PastelCard>
    </motion.div>
  );
}
