import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, Ban, Check, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { PastelCard } from '../ui/pastel-card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';
import { UserWithActivity } from '@/services/admin.service';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

interface UserManagementCardProps {
  users: UserWithActivity[];
  onToggleAdmin: (userId: number, isAdmin: boolean) => Promise<void>;
  onToggleActive: (userId: number, isActive: boolean) => Promise<void>;
  loading?: boolean;
}

export const UserManagementCard: React.FC<UserManagementCardProps> = ({
  users,
  onToggleAdmin,
  onToggleActive,
  loading = false,
}) => {
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const handleToggleAdmin = async (userId: number, currentStatus: boolean) => {
    setActionLoading(userId);
    try {
      await onToggleAdmin(userId, !currentStatus);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (userId: number, currentStatus: boolean) => {
    setActionLoading(userId);
    try {
      await onToggleActive(userId, !currentStatus);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <PastelCard variant="default" className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Users className={cn(ICON_SIZES.md)} />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">
            Управление пользователями
          </h3>
          <p className="text-sm text-muted-foreground">
            Всего: {users.length}
          </p>
        </div>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {users.map((user, index) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className={cn(
              'rounded-xl border p-3 transition-colors bg-card/70',
              !user.isActive && 'opacity-60',
              'border-border/70 hover:bg-muted/35'
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {user.firstName} {user.lastName}
                    </span>
                    {user.isAdmin && (
                      <Badge variant="info" className="text-xs">
                        <Shield className={cn(ICON_SIZES.xs, 'mr-1')} />
                        Админ
                    </Badge>
                  )}
                  {!user.isActive && (
                    <Badge variant="destructive" className="text-xs">
                      <Ban className={cn(ICON_SIZES.xs, 'mr-1')} />
                      Заблокирован
                    </Badge>
                  )}
                </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Голосов: {user.totalVotes}</span>
                    {user.pendingDebts > 0 && (
                      <span className="text-coral-500">
                        Долг: {user.pendingDebts.toFixed(2)}₽
                      </span>
                  )}
                  {user.lastActivity && (
                    <span className="flex items-center gap-1">
                      <Clock className={ICON_SIZES.xs} />
                      {dayjs(user.lastActivity).fromNow()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                  className="admin-action-btn"
                  aria-expanded={expandedUser === user.id}
                  aria-controls={`user-details-${user.id}`}
                >
                  {expandedUser === user.id ? (
                    <>
                      <ChevronUp className={ICON_SIZES.xs} />
                      Скрыть
                    </>
                  ) : (
                    <>
                      <ChevronDown className={ICON_SIZES.xs} />
                      Подробнее
                    </>
                  )}
                </button>
              </div>
            </div>

            {expandedUser === user.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                id={`user-details-${user.id}`}
                  className="mt-3 border-t border-border/70 pt-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant={user.isAdmin ? "danger" : "info"}
                    onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                    disabled={actionLoading === user.id || loading}
                    className="text-xs"
                  >
                    <Shield className={cn(ICON_SIZES.sm, "mr-1")} />
                    {user.isAdmin ? 'Снять админа' : 'Сделать админом'}
                  </Button>

                  <Button
                    size="sm"
                    variant={user.isActive ? "danger" : "success"}
                    onClick={() => handleToggleActive(user.id, user.isActive)}
                    disabled={actionLoading === user.id || loading}
                    className="text-xs"
                  >
                    {user.isActive ? (
                      <>
                        <Ban className={cn(ICON_SIZES.sm, "mr-1")} />
                        Заблокировать
                      </>
                    ) : (
                      <>
                        <Check className={cn(ICON_SIZES.sm, "mr-1")} />
                        Разблокировать
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>ID: {user.id}</div>
                  <div>Telegram ID: {user.telegramId}</div>
                  {user.username && <div>@{user.username}</div>}
                  <div>Зарегистрирован: {dayjs(user.createdAt).format('DD.MM.YYYY')}</div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </PastelCard>
  );
};
