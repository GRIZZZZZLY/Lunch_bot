import { StatsScreen } from '@/components/stats/StatsScreen';
import { useStats } from '@/hooks/useStats';

export function StatsPage() {
  const { data } = useStats();
  return <StatsScreen data={data} initialTab="overview" />;
}
