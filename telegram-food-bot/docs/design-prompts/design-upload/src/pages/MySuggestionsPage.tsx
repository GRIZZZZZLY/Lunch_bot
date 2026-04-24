import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  CheckCircle,
  XCircle,
  Lightbulb,
  ArrowLeft,
  Filter,
  Search,
  Plus,
} from 'lucide-react';
import { PastelCard, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/pastel-card';
import { GlassCard } from '../components/ui/glass-card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Input } from '../components/ui/input';
// import { MediumWaveGradient } from '../components/background'; // REMOVED: убрали оранжевый градиент
import { useSuggestions } from '../hooks/useSuggestions';
import { MenuSuggestion } from '../services/suggestion.service';
import { useTelegram } from '../hooks/useTelegram';
import { cn } from '../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

type FilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const filterTabs: { value: FilterStatus; label: string; icon: any; color: string }[] = [
  { value: 'ALL', label: 'Все', icon: Lightbulb, color: 'text-lavender-500' },
  { value: 'PENDING', label: 'Ожидают', icon: Clock, color: 'text-butter-500' },
  { value: 'APPROVED', label: 'Одобрено', icon: CheckCircle, color: 'text-mint-500' },
  { value: 'REJECTED', label: 'Отклонено', icon: XCircle, color: 'text-coral-500' },
];

/**
 * MySuggestionsPage - История предложений пользователя
 *
 * Решает проблему "обрыва пользовательского пути" - показывает:
 * - Статус каждого предложения
 * - Комментарии админа при отклонении
 * - Дату рассмотрения
 * - Возможность отфильтровать по статусу
 */
export const MySuggestionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { hapticFeedback, colorScheme } = useTelegram();
  const isDark = colorScheme === 'dark';

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Загружаем предложения пользователя
  const { data: suggestionsRaw = [], isLoading } = useSuggestions(
    filterStatus === 'ALL' ? {} : { status: filterStatus }
  );
  // Защита от нестандартного ответа API (не массив)
  const suggestions = Array.isArray(suggestionsRaw) ? suggestionsRaw : [];

  // Фильтрация по поисковому запросу
  const filteredSuggestions = suggestions.filter((suggestion) =>
    suggestion.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Подсчёт по статусам
  const counts = {
    ALL: suggestions.length,
    PENDING: suggestions.filter(s => s.status === 'PENDING').length,
    APPROVED: suggestions.filter(s => s.status === 'APPROVED').length,
    REJECTED: suggestions.filter(s => s.status === 'REJECTED').length,
  };

  const handleTabChange = (tab: FilterStatus) => {
    hapticFeedback?.selectionChanged();
    setFilterStatus(tab);
  };

  const handleBack = () => {
    hapticFeedback?.impactOccurred('light');
    navigate('/menu');
  };

  const handleCreateNew = () => {
    hapticFeedback?.impactOccurred('medium');
    navigate('/menu'); // Перенаправляем на MenuPage где есть кнопка предложения
  };

  return (
    <>
      {/* Background removed - using neutral bg-background from Layout */}

      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 h-14 px-4">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className={ICON_SIZES.md} />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Lightbulb className={`${ICON_SIZES.md} text-primary`} />
            <h1 className="text-lg font-semibold">Мои предложения</h1>
          </div>
          <Button
            onClick={handleCreateNew}
            size="sm"
            variant="peach"
          >
            <Plus className={`${ICON_SIZES.sm} mr-1`} />
            Создать
          </Button>
        </div>
      </div>

      <div className="space-y-4 pb-24 px-4 pt-4">
        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative">
            <Search className={`${ICON_SIZES.sm} absolute left-3 top-1/2 -translate-y-1/2  text-muted-foreground`} />
            <Input
              type="text"
              placeholder="Поиск по названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/50"
            />
          </div>
        </motion.div>

        {/* Filter Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
        >
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = filterStatus === tab.value;

            return (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-primary/12 text-primary border border-primary/20 shadow-none'
                    : 'bg-card text-muted-foreground border border-border/60 hover:bg-muted/45'
                )}
              >
                <Icon className={cn(ICON_SIZES.sm, isActive ? 'text-white' : tab.color)} />
                <span className="font-medium">{tab.label}</span>
                {counts[tab.value] > 0 && (
                  <Badge
                    variant={isActive ? 'secondary' : 'outline'}
                    className={cn(
                      'ml-1',
                      isActive && 'bg-white/20 text-white border-none'
                    )}
                  >
                    {counts[tab.value]}
                  </Badge>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* Suggestions List */}
        <div className="space-y-3">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : filteredSuggestions.length > 0 ? (
              filteredSuggestions.map((suggestion, index) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  index={index}
                  isDark={isDark}
                />
              ))
            ) : (
              <EmptyState
                filterStatus={filterStatus}
                hasSearchQuery={!!searchQuery}
                onCreateNew={handleCreateNew}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

interface SuggestionCardProps {
  suggestion: MenuSuggestion;
  index: number;
  isDark: boolean;
}

function SuggestionCard({ suggestion, index, isDark }: SuggestionCardProps) {
  const isPending = suggestion.status === 'PENDING';
  const isApproved = suggestion.status === 'APPROVED';
  const isRejected = suggestion.status === 'REJECTED';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <GlassCard intensity="medium" hover className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-foreground mb-1 truncate">
                {suggestion.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                Отправлено {new Date(suggestion.createdAt).toLocaleDateString('ru-RU')}
              </p>
            </div>

            {/* Status Badge */}
            <div className={cn(
              'px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 whitespace-nowrap',
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

          {/* Description */}
          {suggestion.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {suggestion.description}
            </p>
          )}

          {/* Details */}
          {suggestion.price && (
            <div className="text-sm">
              <span className="text-peach-500 font-semibold">₽{suggestion.price}</span>
            </div>
          )}

          {/* Review Info */}
          {(isApproved || isRejected) && suggestion.reviewer && suggestion.reviewedAt && (
            <div className={cn(
              'pt-3 border-t text-xs',
              isApproved && 'border-green-500/20 text-green-600 dark:text-green-400',
              isRejected && 'border-red-500/20 text-red-600 dark:text-red-400'
            )}>
              {isApproved && (
                <div className="flex items-start gap-2">
                  <CheckCircle className={`${ICON_SIZES.sm} mt-0.5 flex-shrink-0`} />
                  <div>
                    <p className="font-medium mb-0.5">Блюдо добавлено в меню!</p>
                    <p className="text-muted-foreground">
                      {suggestion.reviewer.firstName} {suggestion.reviewer.lastName} •{' '}
                      {new Date(suggestion.reviewedAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                </div>
              )}

              {isRejected && (
                <div className="flex items-start gap-2">
                  <XCircle className={`${ICON_SIZES.sm} mt-0.5 flex-shrink-0`} />
                  <div>
                    <p className="font-medium mb-0.5">Отклонено администратором</p>
                    {suggestion.rejectionReason && (
                      <p className="text-foreground/70 mb-1">Причина: {suggestion.rejectionReason}</p>
                    )}
                    <p className="text-muted-foreground">
                      {suggestion.reviewer.firstName} {suggestion.reviewer.lastName} •{' '}
                      {new Date(suggestion.reviewedAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </GlassCard>
    </motion.div>
  );
}

interface EmptyStateProps {
  filterStatus: FilterStatus;
  hasSearchQuery: boolean;
  onCreateNew: () => void;
}

function EmptyState({ filterStatus, hasSearchQuery, onCreateNew }: EmptyStateProps) {
  if (hasSearchQuery) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <Search size={64} className="mx-auto mb-4 text-muted-foreground/30" />
        <h3 className="text-lg font-semibold mb-2">Ничего не найдено</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Попробуйте изменить поисковый запрос
        </p>
      </motion.div>
    );
  }

  const emptyMessages: Record<FilterStatus, { icon: string; title: string; description: string; cta: string }> = {
    ALL: {
      icon: '💡',
      title: 'У вас пока нет предложений',
      description: 'Предложите новое блюдо для добавления в меню',
      cta: 'Предложить блюдо'
    },
    PENDING: {
      icon: '⏳',
      title: 'Нет ожидающих предложений',
      description: 'Все ваши предложения уже рассмотрены',
      cta: 'Создать новое'
    },
    APPROVED: {
      icon: '✨',
      title: 'Нет одобренных предложений',
      description: 'Ваши одобренные предложения появятся здесь',
      cta: 'Предложить блюдо'
    },
    REJECTED: {
      icon: '📝',
      title: 'Нет отклонённых предложений',
      description: 'Отличная работа! Продолжайте предлагать',
      cta: 'Создать предложение'
    },
  };

  const message = emptyMessages[filterStatus];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-12"
    >
      <div className="text-6xl mb-4">{message.icon}</div>
      <h3 className="text-lg font-semibold mb-2">{message.title}</h3>
      <p className="text-sm text-muted-foreground mb-6">
        {message.description}
      </p>
      <Button
        onClick={onCreateNew}
        className="bg-gradient-to-r from-peach-500 to-coral-500"
      >
        <Plus className={`${ICON_SIZES.sm} mr-2`} />
        {message.cta}
      </Button>
    </motion.div>
  );
}

export default MySuggestionsPage;
