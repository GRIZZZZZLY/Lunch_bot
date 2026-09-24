import { formatRemaining, runStatusText, type TeamActivity } from '@/lib/teamActivity';
import { useCountdown } from '@/shared/lib/useCountdown';

/** «Голосуем · 12:41», живой. Истёк, а сервер ещё не закрыл, — «завершается». */
export function PollStatusText({ endsAt }: { endsAt: string }) {
  const cd = useCountdown(endsAt);
  return <>{cd.isExpired ? 'Голосуем · завершается…' : `Голосуем · ${formatRemaining(cd)}`}</>;
}

/** Строка статуса команды в шторке «Команды». */
export function ActivityLine({ activity }: { activity: TeamActivity }) {
  const { pollEndsAt, run } = activity;
  if (pollEndsAt && run) {
    return (
      <>
        <PollStatusText endsAt={pollEndsAt} />, {runStatusText(run.status, false)}
      </>
    );
  }
  if (pollEndsAt) return <PollStatusText endsAt={pollEndsAt} />;
  if (run) return <>{runStatusText(run.status)}</>;
  return <>Тихо</>;
}
