/* Итоги голосования (Phase 6, система C). Данные-логика перенесена 1:1 из
   legacy PollResultsPage: SSE только для ACTIVE, разбор flat/nested формы
   результата, ranking из mapPollToOptions. Визуал — талон + бары + группа. */
import { useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { RouletteRevealOverlay } from '@/components/rl/RouletteRevealOverlay';
import { usePollById, usePollResults } from '@/hooks/usePolls';
import { useMenuItems } from '@/hooks/useMenu';
import { useSSE } from '@/hooks/useSSE';
import { mapPollToOptions, totalVotes } from '@/lib/pollMappers';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { Button, ErrorState, Status } from '@/shared/ui';
import { pluralize } from '@/shared/lib/pluralize';
import styles from './PollResultsPage.module.css';

export function PollResultsPage() {
  const { id } = useParams<{ id: string }>();
  const pollId = id ? Number(id) : null;
  const valid = pollId !== null && Number.isFinite(pollId);

  const pollQuery = usePollById(valid ? pollId : null);
  const resultsQuery = usePollResults(valid ? pollId : null);
  const { data: poll, isLoading: pollLoading } = pollQuery;
  const { data: results, isLoading: resultsLoading } = resultsQuery;
  const { data: allMenu = [] } = useMenuItems();
  useSSE({ pollId: valid ? pollId : null, enabled: !!poll && poll.status === 'ACTIVE' });

  const options = useMemo(() => mapPollToOptions(poll ?? null, allMenu), [poll, allMenu]);
  const ranking = useMemo(
    () => [...options].sort((a, b) => b.votes - a.votes),
    [options],
  );
  // Бэкенд может вернуть плоскую форму или { result: {...} } — поддерживаем обе.
  const flat = results as
    | { winnerId?: number; winnerName?: string; totalVotes?: number; responsible?: { name?: string } }
    | null
    | undefined;
  const nested = (results as unknown as { result?: { winnerMenuItemId?: number; responsibleUserId?: number; totalVotes?: number } } | null | undefined)?.result;
  const winnerId = flat?.winnerId ?? nested?.winnerMenuItemId;
  const total = totalVotes(poll ?? null) || flat?.totalVotes || nested?.totalVotes || 0;
  const winnerOpt = options.find((o) => Number(o.id) === winnerId);
  const leadingVotes = ranking[0]?.votes ?? 0;
  const tiedWinners = poll?.status !== 'ACTIVE' && leadingVotes > 0
    ? ranking.filter((option) => option.votes === leadingVotes)
    : [];
  const hasMultipleWinners = tiedWinners.length > 1;
  const winnerIds = new Set(
    hasMultipleWinners
      ? tiedWinners.map((option) => Number(option.id))
      : winnerId == null
        ? []
        : [winnerId],
  );
  const winnerName = hasMultipleWinners
    ? tiedWinners.map((option) => option.name).join(' и ')
    : flat?.winnerName || winnerOpt?.name || ranking[0]?.name || 'Без названия';
  const winnerVotes = hasMultipleWinners ? leadingVotes : winnerOpt?.votes ?? leadingVotes;
  const responsibleName =
    flat?.responsible?.name ||
    (poll?.votes ?? []).find((v) => v.user?.id === nested?.responsibleUserId)?.user?.firstName;

  const [rouletteOpen, setRouletteOpen] = useState(false);
  const voterNames = useMemo(
    () => Array.from(new Set((poll?.votes ?? []).map((v) => v.user?.firstName).filter((n): n is string => !!n))),
    [poll],
  );

  useScreenHeader(poll ? `Опрос #${poll.id}` : 'Результаты');

  const body = (content: ReactNode) => <div className={`rl ${styles.screen}`}>{content}</div>;

  if (!valid) return body(<div className={styles.state}>Некорректный идентификатор опроса.</div>);
  if (pollLoading || resultsLoading) return body(<div className={styles.state}>Загружаем результаты…</div>);
  if (pollQuery.isError || resultsQuery.isError) {
    const error = (pollQuery.error ?? resultsQuery.error) as { status?: number } | null;
    const kind = error?.status === 403 ? 'forbidden' : error?.status === 404 ? 'notFound' : 'network';
    return body(
      <ErrorState
        kind={kind}
        title={kind === 'forbidden' ? 'Нет доступа' : undefined}
        description={kind === 'forbidden' ? 'Результаты этого голосования недоступны.' : undefined}
        onRetry={kind === 'network' ? () => {
          void pollQuery.refetch();
          void resultsQuery.refetch();
        } : undefined}
      />,
    );
  }
  if (!poll) return body(<div className={styles.state}>Опрос не найден.</div>);

  const maxVotes = Math.max(1, ranking[0]?.votes ?? 0);

  return body(
    <>
      <div className={styles.ticket}>
        <div className={styles.ticketCap}>
          {poll.status === 'ACTIVE' ? 'Лидирует' : 'Команда выбрала'}
        </div>
        <h1 className={styles.ticketName}>{winnerName}</h1>
        <div className={`tnum ${styles.ticketMeta}`}>
          {`${pluralize(winnerVotes, 'голос', 'голоса', 'голосов')} из ${total}`}
        </div>
      </div>

      {ranking.length > 0 && (
        <section className={styles.group} aria-label="Распределение голосов">
          <div className={styles.groupHead}>Распределение</div>
          {ranking.map((o) => (
            <div key={o.id} className={styles.row}>
              <div className={styles.rowMain}>
                <div className={styles.rowName}>
                  {o.name}
                  {winnerIds.has(Number(o.id)) && <Status tone="success">победитель</Status>}
                </div>
                <div className={styles.bar}>
                  <span className={styles.barFill} style={{ width: `${(o.votes / maxVotes) * 100}%` }} />
                </div>
              </div>
              <span className={`tnum ${styles.rowVal}`}>{o.votes}</span>
            </div>
          ))}
        </section>
      )}

      {responsibleName && (
        <section className={styles.group} aria-label="Ответственный">
          <div className={styles.groupHead}>Ответственный</div>
          <div className={styles.row}>
            <div className={styles.avatar} aria-hidden>
              {responsibleName[0].toUpperCase()}
            </div>
            <div className={styles.rowMain}>
              <div className={styles.rowName}>{responsibleName}</div>
              <span className={styles.rowSub}>выбран рулеткой</span>
            </div>
            <Button variant="secondary" onClick={() => setRouletteOpen(true)}>
              Крутить
            </Button>
          </div>
        </section>
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
