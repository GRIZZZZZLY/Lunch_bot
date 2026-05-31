import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  User,
  DollarSign,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '../modals';
import {
  useSuggestions,
  useSuggestionStats,
  useApproveSuggestion,
  useRejectSuggestion,
  useDeleteSuggestion,
} from '@/hooks/useSuggestions';
import { MenuSuggestion } from '@/services/suggestion.service';
import { useTelegram } from '@/hooks/useTelegram';
import { sanitizeURL } from '@/lib/sanitize';
import { cn } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

type TabType = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SuggestionsPanelProps {
  selectedTab?: TabType;
}

/**
 * Админ панель для обработки предложений блюд
 */
export function SuggestionsPanel({ selectedTab = 'PENDING' }: SuggestionsPanelProps) {
  const { hapticFeedback } = useTelegram();
  const [itemToDelete, setItemToDelete] = useState<{ id: number; name: string } | null>(null);
  const [itemToReject, setItemToReject] = useState<{ id: number; name: string } | null>(null);

  const { data: stats, isLoading: statsLoading } = useSuggestionStats();
  const { data: suggestions, isLoading: suggestionsLoading } = useSuggestions({
    status: selectedTab,
  });

  const { mutate: approveSuggestion, isPending: isApproving } = useApproveSuggestion();
  const { mutate: rejectSuggestion, isPending: isRejecting } = useRejectSuggestion();
  const { mutate: deleteSuggestion, isPending: isDeleting } = useDeleteSuggestion();

  const handleApprove = (id: number) => {
    hapticFeedback?.impactOccurred('medium');
    approveSuggestion(id);
  };

  const handleReject = (id: number, name: string) => {
    // Открываем диалог подтверждения
    setItemToReject({ id, name });
    hapticFeedback?.impactOccurred('light');
  };

  const confirmReject = () => {
    if (!itemToReject) return;

    const reason = prompt('Причина отклонения (опционально):');
    hapticFeedback?.impactOccurred('medium');
    rejectSuggestion({ id: itemToReject.id, reason: reason || undefined });
    setItemToReject(null);
  };

  const handleDelete = (id: number, name: string) => {
    // Открываем диалог подтверждения
    setItemToDelete({ id, name });
    hapticFeedback?.impactOccurred('light');
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;

    hapticFeedback?.impactOccurred('medium');
    deleteSuggestion(itemToDelete.id);
    setItemToDelete(null);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Stats */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassCard intensity="solid" hover className="overflow-hidden">
            <GlassCardContent className="p-4">
              <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Sparkles className={`${ICON_SIZES.md}`} />
                  </div>
                <div className="flex-1 min-w-0">
                  <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Всего</div>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          <GlassCard intensity="low" hover className="overflow-hidden">
            <GlassCardContent className="p-4">
              <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-butter-500/10 text-butter-600 dark:text-butter-400">
                    <Clock className={`${ICON_SIZES.md}`} />
                  </div>
                <div className="flex-1 min-w-0">
                  <div className="text-2xl font-bold text-foreground">{stats.pending}</div>
                  <div className="text-xs text-muted-foreground">Ожидают</div>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          <GlassCard intensity="low" hover className="overflow-hidden">
            <GlassCardContent className="p-4">
              <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-mint-500/10 text-mint-600 dark:text-mint-400">
                    <CheckCircle className={`${ICON_SIZES.md}`} />
                  </div>
                <div className="flex-1 min-w-0">
                  <div className="text-2xl font-bold text-foreground">{stats.approved}</div>
                  <div className="text-xs text-muted-foreground">Одобрено</div>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          <GlassCard intensity="medium" hover className="overflow-hidden">
            <GlassCardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-peach-500/10 dark:bg-peach-500/20">
                  <div className={`${ICON_SIZES.md} flex items-center justify-center text-sm font-bold text-peach-500`}>
                    {stats.approvalRate}%
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Одобрений</div>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      )}

      {/* Suggestions List */}
      <div className="space-y-4">
        {suggestionsLoading ? (
          <div className="py-8 text-center text-muted-foreground">Загрузка...</div>
        ) : suggestions && suggestions.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                index={index}
                onApprove={handleApprove}
                onReject={handleReject}
                onDelete={handleDelete}
                isApproving={isApproving}
                isRejecting={isRejecting}
                isDeleting={isDeleting}
              />
            ))}
          </AnimatePresence>
        ) : (
          <div className="py-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {selectedTab === 'PENDING' && 'Нет ожидающих предложений'}
              {selectedTab === 'APPROVED' && 'Нет одобренных предложений'}
              {selectedTab === 'REJECTED' && 'Нет отклонённых предложений'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Предложения появятся здесь автоматически
            </p>
          </div>
        )}
      </div>

      {/* Диалоги подтверждения */}
      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        title="Удалить предложение?"
        description={`Удалить «${itemToDelete?.name}»? Отменить будет нельзя.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!itemToReject}
        onClose={() => setItemToReject(null)}
        onConfirm={confirmReject}
        title="Отклонить предложение?"
        description={`Точно хочешь отклонить предложение "${itemToReject?.name}"? После подтверждения тебя попросят указать причину отклонения.`}
        confirmLabel="Отклонить"
        cancelLabel="Отмена"
        variant="warning"
      />
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: MenuSuggestion;
  index: number;
  onApprove: (id: number) => void;
  onReject: (id: number, name: string) => void;
  onDelete: (id: number, name: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
  isDeleting: boolean;
}

function SuggestionCard({
  suggestion,
  index,
  onApprove,
  onReject,
  onDelete,
  isApproving,
  isRejecting,
  isDeleting,
}: SuggestionCardProps) {
  const isPending = suggestion.status === 'PENDING';
  const isApproved = suggestion.status === 'APPROVED';
  const isRejected = suggestion.status === 'REJECTED';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <GlassCard intensity="medium" hover className="overflow-hidden">
        <GlassCardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-foreground mb-1">
                {suggestion.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className={ICON_SIZES.xs} />
                <span>
                  {suggestion.suggester?.firstName} {suggestion.suggester?.lastName}
                </span>
                <span>•</span>
                <span>{new Date(suggestion.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>

            {/* Status Badge */}
            <div className={cn(
              'px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5',
               isPending && 'bg-butter-500/10 text-butter-700 dark:text-butter-400',
               isApproved && 'bg-mint-500/10 text-mint-700 dark:text-mint-400',
               isRejected && 'bg-coral-500/10 text-coral-700 dark:text-coral-400'
             )}>
              {isPending && <Clock className={ICON_SIZES.xs} />}
              {isApproved && <CheckCircle className={ICON_SIZES.xs} />}
              {isRejected && <XCircle className={ICON_SIZES.xs} />}
              {isPending && 'Ожидает'}
              {isApproved && 'Одобрено'}
              {isRejected && 'Отклонено'}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2">
            {suggestion.description && (
              <p className="text-sm text-muted-foreground">{suggestion.description}</p>
            )}

            <div className="flex flex-wrap gap-3 text-sm">
              {suggestion.price && (
                <div className="flex items-center gap-1.5">
                  <DollarSign className={`${ICON_SIZES.sm} text-primary`} />
                  <span className="font-semibold">₽{suggestion.price}</span>
                </div>
              )}
              {(() => {
                const safeImageUrl = suggestion.imageUrl
                  ? sanitizeURL(suggestion.imageUrl)
                  : '';

                if (!safeImageUrl) {
                  return null;
                }

                return (
                <div className="flex items-center gap-1.5">
                  <ImageIcon className={`${ICON_SIZES.sm} text-lavender-500`} />
                  <a
                    href={safeImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lavender-600 hover:underline dark:text-lavender-400"
                  >
                    Фото
                  </a>
                </div>
                );
              })()}
            </div>
          </div>

          {/* Review Info */}
          {suggestion.reviewedAt && suggestion.reviewer && (
            <div className="pt-3 border-t border-border text-xs text-muted-foreground">
              <div>
                Обработано {suggestion.reviewer.firstName} {suggestion.reviewer.lastName}
                <span className="ml-2">
                  {new Date(suggestion.reviewedAt).toLocaleString('ru-RU')}
                </span>
              </div>
              {suggestion.rejectionReason && (
                <div className="mt-1 text-coral-600 dark:text-coral-400">
                  Причина: {suggestion.rejectionReason}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {isPending && (
            <div className="flex gap-2 pt-3 border-t border-border">
              <Button
                onClick={() => onApprove(suggestion.id)}
                disabled={isApproving || isRejecting}
                variant="success"
                className="flex-1"
                size="sm"
              >
                <CheckCircle className={`${ICON_SIZES.sm} mr-2`} />
                Одобрить
              </Button>
              <Button
                onClick={() => onReject(suggestion.id, suggestion.name)}
                disabled={isApproving || isRejecting}
                variant="destructive"
                className="flex-1"
                size="sm"
              >
                <XCircle className={`${ICON_SIZES.sm} mr-2`} />
                Отклонить
              </Button>
            </div>
          )}

          {isRejected && (
            <div className="flex gap-2 pt-3 border-t border-border">
              <Button
                onClick={() => onDelete(suggestion.id, suggestion.name)}
                disabled={isDeleting}
                variant="outline"
                className="flex-1"
                size="sm"
              >
                <Trash2 className={`${ICON_SIZES.sm} mr-2`} />
                Удалить
              </Button>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
}
