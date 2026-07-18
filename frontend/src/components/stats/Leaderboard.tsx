import { useEffect, useState } from 'react';
import { m } from 'framer-motion';
import { Trophy, Users } from 'lucide-react';
import {
  gamificationService,
  LeaderboardEntry,
} from '../../services/gamification.service';
import {
  PastelCard,
  CardHeader,
  CardTitle,
  CardContent,
} from '../ui/pastel-card';

interface LeaderboardUser {
  position: number;
}

interface LeaderboardProps {
  groupId?: number;
  isDark: boolean;
  onUserClick?: (user: LeaderboardUser) => void;
}

function formatUserName(entry: LeaderboardEntry): string {
  const firstName = entry.user?.firstName?.trim();
  const lastName = entry.user?.lastName?.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  return (
    fullName ||
    entry.user?.username ||
    `Участник ${entry.user?.id ?? ''}`.trim()
  );
}

function placeClassName(place: number): string {
  if (place === 1) {
    return 'flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary';
  }

  if (place === 2) {
    return 'flex h-8 w-8 items-center justify-center rounded-full bg-lavender-500/12 text-sm font-semibold text-lavender-500';
  }

  return 'flex h-8 w-8 items-center justify-center rounded-full bg-butter-500/12 text-sm font-semibold text-butter-600 dark:text-butter-400';
}

export function Leaderboard({
  groupId,
  isDark,
  onUserClick,
}: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      try {
        setLoading(true);
        setFailed(false);

        const response = await gamificationService.getLeaderboard({
          category: 'TOTAL',
          groupId,
          limit: 10,
        });

        if (!cancelled) {
          setEntries(response.success && response.data ? response.data : []);
          setFailed(!response.success);
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
          setFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const textMuted = isDark ? 'text-zinc-400' : 'text-zinc-600';

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <PastelCard variant="default">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Лидеры группы</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 py-2">
            {loading && (
              <div className={`text-center py-6 text-sm ${textMuted}`}>
                Загружаем рейтинг...
              </div>
            )}

            {!loading && failed && (
              <div className={`text-center py-6 text-sm ${textMuted}`}>
                Не удалось загрузить рейтинг
              </div>
            )}

            {!loading && !failed && entries.length === 0 && (
              <div className={`text-center py-6 text-sm ${textMuted}`}>
                Лидерборд появится после первых действий участников.
              </div>
            )}

            {!loading &&
              !failed &&
              entries.map((entry) => {
                const content = (
                  <>
                    <div className={placeClassName(entry.position)}>
                      {entry.position}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {formatUserName(entry)}
                      </p>
                      <p className={`text-xs ${textMuted}`}>
                        {entry.totalXP} XP · уровень {entry.level} · {entry.rank}
                      </p>
                    </div>
                    <Users
                      className={`h-4 w-4 ${
                        isDark ? 'text-zinc-500' : 'text-zinc-400'
                      }`}
                    />
                  </>
                );
                const className =
                  'flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/35 px-3 py-3 text-left';
                const key = `${entry.user?.id ?? entry.userId}-${entry.position}`;

                if (onUserClick) {
                  return (
                    <button
                      key={key}
                      type="button"
                      className={className}
                      onClick={() => onUserClick({ position: entry.position })}
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <div key={key} className={className}>
                    {content}
                  </div>
                );
              })}
          </div>
        </CardContent>
      </PastelCard>
    </m.div>
  );
}
