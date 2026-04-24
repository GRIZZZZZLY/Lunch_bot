import { useState } from 'react';
import { StatsTopBar } from './StatsTopBar';
import { OverviewView } from './OverviewView';
import { InsightsView } from './InsightsView';
import { LeaderboardView } from './LeaderboardView';
import { LoadingView, EmptyView } from './StatesView';
import type { StatsData, StatsPeriod, StatsTab } from './types';
import '@/styles/stats.css';

interface Props {
  data: StatsData;
  initialTab?: StatsTab;
  initialPeriod?: StatsPeriod;
  onEmptyAction?: () => void;
}

export function StatsScreen({
  data,
  initialTab = 'overview',
  initialPeriod = 'month',
  onEmptyAction,
}: Props) {
  const [tab, setTab] = useState<StatsTab>(initialTab);
  const [period, setPeriod] = useState<StatsPeriod>(initialPeriod);

  const renderBody = () => {
    if (data.isLoading) return <LoadingView />;
    if (data.isEmpty) return <EmptyView onAction={onEmptyAction} />;
    if (tab === 'overview' && data.overview) return <OverviewView data={data.overview} />;
    if (tab === 'insights' && data.insights) return <InsightsView data={data.insights} />;
    if (tab === 'leaderboard' && data.leaderboard) return <LeaderboardView data={data.leaderboard} />;
    return <EmptyView onAction={onEmptyAction} />;
  };

  return (
    <>
      <StatsTopBar
        period={period}
        onPeriodChange={setPeriod}
        tab={tab}
        onTabChange={setTab}
      />
      {renderBody()}
    </>
  );
}
