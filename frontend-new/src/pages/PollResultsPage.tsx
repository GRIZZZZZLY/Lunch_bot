import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { WinnerCard } from '@/components/home/WinnerCard';
import { usePollById, usePollResults } from '@/hooks/usePolls';
import { useSSE } from '@/hooks/useSSE';
import { mapPollToOptions, totalVotes } from '@/lib/pollMappers';
import '@/styles/home.css';

export function PollResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pollId = id ? Number(id) : null;
  const isValidId = pollId !== null && Number.isFinite(pollId);

  const { data: poll, isLoading: pollLoading } = usePollById(isValidId ? pollId : null);
  const { data: results, isLoading: resultsLoading } = usePollResults(
    isValidId ? pollId : null,
  );

  useSSE({
    pollId: isValidId ? pollId : null,
    enabled: !!poll && poll.status === 'ACTIVE',
  });

  const options = useMemo(() => mapPollToOptions(poll ?? null), [poll]);
  const total = totalVotes(poll ?? null);

  if (!isValidId) {
    return (
      <div className="home-body">
        <div style={{ padding: 16, color: 'var(--ink-2)' }}>Некорректный идентификатор опроса.</div>
      </div>
    );
  }

  if (pollLoading || resultsLoading) {
    return (
      <div className="home-body">
        <div style={{ padding: 16, color: 'var(--ink-2)' }}>Загружаем результаты…</div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="home-body">
        <div className="top-hdr">
          <div className="back" onClick={() => navigate(-1)}>
            ‹
          </div>
          <div className="ttl">Результаты</div>
          <div className="act" />
        </div>
        <div style={{ padding: 16, color: 'var(--ink-2)' }}>Опрос не найден.</div>
      </div>
    );
  }

  const winnerFromResults = results?.winnerName;
  const winnerFromPoll = poll.menuItems
    ?.slice()
    .sort((a, b) => (b._count?.votes ?? 0) - (a._count?.votes ?? 0))[0];
  const winnerName = winnerFromResults ?? winnerFromPoll?.menuItem?.name ?? 'Без названия';
  const winnerVotes =
    results?.totalVotes !== undefined
      ? winnerFromPoll?._count?.votes ?? 0
      : winnerFromPoll?._count?.votes ?? 0;
  const supplier = winnerFromPoll?.menuItem?.category ?? '—';
  const deliveryMinutes = winnerFromPoll?.menuItem?.deliveryMinutes ?? 30;
  const eta = formatEta(poll.closedAt ?? poll.createdAt, deliveryMinutes);

  const duty = results?.responsible
    ? {
        initial: (results.responsible.name?.[0] ?? '?').toUpperCase(),
        name: results.responsible.name,
        role:
          results.responsible.method === 'volunteer'
            ? 'вызвался сам'
            : 'выбран рулеткой',
      }
    : undefined;

  return (
    <div className="home-body">
      <div className="top-hdr">
        <div className="back" onClick={() => navigate(-1)}>
          ‹
        </div>
        <div className="ttl">Опрос #{poll.id}</div>
        <div className="act" />
      </div>
      <WinnerCard
        winnerName={winnerName}
        votes={winnerVotes}
        totalVotes={total || results?.totalVotes || 0}
        supplier={supplier}
        deliveryMinutes={deliveryMinutes}
        eta={eta}
        options={options}
        duty={duty}
      />
    </div>
  );
}

function formatEta(iso: string, deliveryMinutes: number): string {
  const d = new Date(new Date(iso).getTime() + deliveryMinutes * 60_000);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
