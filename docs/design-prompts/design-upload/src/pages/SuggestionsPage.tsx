import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, RefreshCw, Clock } from 'lucide-react';
import { SuggestionsPanel } from '../components/menu/SuggestionsPanel';
import { useTelegram } from '../hooks/useTelegram';
import { useSuggestionStats } from '../hooks/useSuggestions';
import { ICON_SIZES } from '../lib/design-tokens';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

type TabType = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Страница обработки предложений блюд (только для админов)
 */
export const SuggestionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { hapticFeedback } = useTelegram();
  const [selectedTab, setSelectedTab] = useState<TabType>('PENDING');
  const { data: stats, isLoading: statsLoading, refetch } = useSuggestionStats();

  const handleBack = () => {
    hapticFeedback?.impactOccurred('light');
    navigate('/profile');
  };

  const handleRefresh = () => {
    hapticFeedback?.impactOccurred('light');
    refetch();
  };

  const handleTabChange = (tab: TabType) => {
    hapticFeedback?.selectionChanged();
    setSelectedTab(tab);
  };

  return (
    <>
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        {/* Top bar: Back button + Title + Actions */}
        <div className="flex items-center justify-between gap-3 h-14 px-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={handleBack}
              className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Назад"
            >
              <ArrowLeft className={ICON_SIZES.md} />
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Sparkles className={`${ICON_SIZES.md} text-primary flex-shrink-0`} />
              <h1 className="text-lg font-semibold truncate">Предложения</h1>
            </div>
          </div>

          {/* Actions: Pending count + Refresh */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!statsLoading && stats && stats.pending > 0 && (
              <Badge
                variant="outline"
                className="bg-butter-500/10 text-butter-700 dark:text-butter-400 border-butter-500/20"
              >
                <Clock className={`${ICON_SIZES.xs} mr-1`} />
                {stats.pending}
              </Badge>
            )}
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Обновить"
            >
              <RefreshCw className={ICON_SIZES.md} />
            </button>
          </div>
        </div>

        {/* Tabs row */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {[
            { value: 'PENDING' as TabType, label: 'Ожидают', count: stats?.pending || 0, color: 'amber' },
            { value: 'APPROVED' as TabType, label: 'Одобрено', count: stats?.approved || 0, color: 'green' },
            { value: 'REJECTED' as TabType, label: 'Отклонено', count: stats?.rejected || 0, color: 'red' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm font-medium',
                selectedTab === tab.value
                  ? 'bg-primary/12 text-primary border border-primary/20 shadow-none'
                  : 'bg-card text-muted-foreground border border-border/60 hover:bg-muted/45'
                )}
              >
              <span>{tab.label}</span>
              {!statsLoading && tab.count > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    'px-1.5 py-0 text-xs',
                    selectedTab === tab.value
                      ? 'bg-white/20 text-white border-none'
                      : 'bg-background/50'
                  )}
                >
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <SuggestionsPanel selectedTab={selectedTab} />
      </div>
    </>
  );
};

export default SuggestionsPage;
