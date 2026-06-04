import { useMemo, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePollById, usePollResults } from '@/hooks/usePolls';
import { useMenuItems } from '@/hooks/useMenu';
import { useSSE } from '@/hooks/useSSE';
import { mapPollToOptions, totalVotes } from '@/lib/pollMappers';
import { CompletedPollWidget } from '@/components/rl/homeWidgets';
import { BackHeader } from '@/components/rl/parts';
import { Avatar } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';

export function PollResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pollId = id ? Number(id) : null;
  const valid = pollId !== null && Number.isFinite(pollId);

  const { data: poll, isLoading: pollLoading } = usePollById(valid ? pollId : null);
  const { data: results, isLoading: resultsLoading } = usePollResults(valid ? pollId : null);
  const { data: allMenu = [] } = useMenuItems();
  useSSE({ pollId: valid ? pollId : null, enabled: !!poll && poll.status === 'ACTIVE' });

  const options = useMemo(() => mapPollToOptions(poll ?? null, allMenu), [poll, allMenu]);
  const total = totalVotes(poll ?? null) || results?.totalVotes || 0;
  const ranking = useMemo(
    () => [...options].sort((a, b) => b.votes - a.votes).map((o) => ({ name: o.name, votes: o.votes })),
    [options],
  );
  const winnerName = results?.winnerName || ranking[0]?.name || 'Без названия';
  const winnerVotes = options.find((o) => Number(o.id) === results?.winnerId)?.votes ?? ranking[0]?.votes ?? 0;

  const body = (content: ReactNode) => (
    <div className="rl">
      <BackHeader title={poll ? `Опрос #${poll.id}` : 'Результаты'} onBack={() => navigate(-1)} />
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>{content}</div>
    </div>
  );

  if (!valid) return body(<InfoCard text="Некорректный идентификатор опроса." />);
  if (pollLoading || resultsLoading) return body(<InfoCard text="Загружаем результаты…" />);
  if (!poll) return body(<InfoCard text="Опрос не найден." />);

  return body(
    <>
      <CompletedPollWidget
        winnerName={winnerName}
        winnerVotes={winnerVotes}
        totalVotes={total}
        ranking={ranking}
        collapsed={false}
        onToggle={() => navigate(-1)}
      />
      {results?.responsible && (
        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={results.responsible.name} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Ответственный</div>
            <div className="font-head" style={{ fontSize: 'var(--t-16)', fontWeight: 600 }}>
              {results.responsible.name}
            </div>
            <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-secondary)' }}>
              {results.responsible.method === 'volunteer' ? 'вызвался сам' : 'выбран рулеткой'}
            </div>
          </div>
          <Icon name={results.responsible.method === 'volunteer' ? 'check' : 'roulette'} size={22} style={{ color: 'var(--accent)' }} />
        </div>
      )}
    </>,
  );
}

function InfoCard({ text }: { text: string }) {
  return (
    <div className="card" style={{ padding: 20, color: 'var(--text-secondary)', fontSize: 'var(--t-13)' }}>
      {text}
    </div>
  );
}
