import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RouletteRevealOverlay } from '@/components/rl/RouletteRevealOverlay';
import { usePollById, usePollResults } from '@/hooks/usePolls';
import { useMenuItems } from '@/hooks/useMenu';
import { useSSE } from '@/hooks/useSSE';
import { mapPollToOptions, totalVotes } from '@/lib/pollMappers';
import { CompletedPollWidget } from '@/components/rl/homeWidgets';
import { BackHeader } from '@/components/rl/parts';
import { Avatar, Button } from '@/components/rl/primitives';

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
  const ranking = useMemo(
    () => [...options].sort((a, b) => b.votes - a.votes).map((o) => ({ name: o.name, votes: o.votes })),
    [options],
  );
  // This backend nests the payload as { result: {...}, poll }; support flat shape too.
  const flat = results as
    | { winnerId?: number; winnerName?: string; totalVotes?: number; responsible?: { name?: string } }
    | null
    | undefined;
  const nested = (results as unknown as { result?: { winnerMenuItemId?: number; responsibleUserId?: number; totalVotes?: number } } | null | undefined)?.result;
  const winnerId = flat?.winnerId ?? nested?.winnerMenuItemId;
  const total = totalVotes(poll ?? null) || flat?.totalVotes || nested?.totalVotes || 0;
  const winnerOpt = options.find((o) => Number(o.id) === winnerId);
  const winnerName = flat?.winnerName || winnerOpt?.name || ranking[0]?.name || 'Без названия';
  const winnerVotes = winnerOpt?.votes ?? ranking[0]?.votes ?? 0;
  const responsibleName =
    flat?.responsible?.name ||
    (poll?.votes ?? []).find((v) => v.user?.id === nested?.responsibleUserId)?.user?.firstName;

  const [rouletteOpen, setRouletteOpen] = useState(false);
  const voterNames = useMemo(
    () => Array.from(new Set((poll?.votes ?? []).map((v) => v.user?.firstName).filter((n): n is string => !!n))),
    [poll],
  );

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
      {responsibleName && (
        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={responsibleName} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Ответственный</div>
            <div className="font-head" style={{ fontSize: 'var(--t-16)', fontWeight: 600 }}>
              {responsibleName}
            </div>
            <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-secondary)' }}>выбран рулеткой</div>
          </div>
          <Button variant="outline" size="sm" icon="roulette" onClick={() => setRouletteOpen(true)}>
            Крутить
          </Button>
        </div>
      )}
      <RouletteRevealOverlay
        open={rouletteOpen}
        names={voterNames}
        winnerName={responsibleName ?? ''}
        onClose={() => setRouletteOpen(false)}
      />
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
