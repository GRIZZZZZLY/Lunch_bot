import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { PastelCard, CardContent } from '../ui/pastel-card';
import { cn } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';
import { AdminChecklist } from './AdminChecklist';

interface HomeEmptyStateCardProps {
  title: string;
  description: string;
  isAdmin: boolean;
  showAdminChecklist: boolean;
  showRemindAdmin: boolean;
  onCreatePoll: () => void;
  onRemindAdmin: () => void;
}

export const HomeEmptyStateCard: React.FC<HomeEmptyStateCardProps> = ({
  title,
  description,
  isAdmin,
  showAdminChecklist,
  showRemindAdmin,
  onCreatePoll,
  onRemindAdmin,
}) => (
  <PastelCard variant="default" className="overflow-hidden">
    <CardContent className="relative px-6 py-8 text-center space-y-6">
      <div className="space-y-2">
        <h2 className="text-foreground text-2xl font-semibold">
          {title}
        </h2>
        <p className="text-muted-foreground">
          {description}
        </p>
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-3">
          <Button
            variant="peach"
            size="lg"
            className="w-full"
            onClick={onCreatePoll}
          >
            <Sparkles className={`${ICON_SIZES.md} mr-2`} />
            Создать голосование
          </Button>
        </div>
      )}

      {isAdmin && showAdminChecklist && <AdminChecklist />}

      {showRemindAdmin && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRemindAdmin}
          className={cn(
            'w-full rounded-xl border border-lavender-500/20 bg-lavender-500/6 p-4',
            'hover:bg-lavender-500/10 shadow-sm hover:shadow-md',
            'transition-all duration-200 ease-out mt-4'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-lavender-500/12 p-2">
                <Bell className={cn(ICON_SIZES.md, 'text-lavender-600 dark:text-lavender-400')} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">
                  Напомнить админу
                </p>
                <p className="text-sm text-muted-foreground">
                  Попросить создать голосование
                </p>
              </div>
            </div>
            <div className="text-lavender-500">›</div>
          </div>
        </motion.button>
      )}
    </CardContent>
  </PastelCard>
);
