import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HistoryScreen } from '@/components/profile/HistoryScreen';
import { usePollHistory } from '@/hooks/useUser';
import { buildHistoryDays } from '@/lib/profileMappers';

export function PollHistoryPage() {
  const navigate = useNavigate();
  const { data: polls = [], isLoading } = usePollHistory({ limit: 60 });

  const data = useMemo(
    () => ({
      days: buildHistoryDays(polls),
      isLoadingMore: isLoading && polls.length === 0,
    }),
    [polls, isLoading],
  );

  return (
    <HistoryScreen
      data={data}
      onBack={() => navigate(-1)}
      onOpenEntry={(id) => navigate(`/poll/${id}/results`)}
    />
  );
}
