import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Users, Check, Home as HomeIcon } from 'lucide-react';
import { adminService, PollParticipantInfo } from '../../services/admin.service';
import { useUI } from '../../store/useAppStore';
import { ICON_SIZES } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

interface Props {
  pollId: number;
  onAutoClosed?: () => void;
}

/**
 * Admin-only секция на активном голосовании: список участников,
 * кнопки исключить/вернуть, прогресс по EXPECTED-знаменателю.
 */
export const PollParticipantsAdminSection: React.FC<Props> = ({ pollId, onAutoClosed }) => {
  const { addNotification } = useUI();
  const [open, setOpen] = useState(false);
  const [participants, setParticipants] = useState<PollParticipantInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getPollParticipants(pollId);
      if (res.success && res.data) setParticipants(res.data);
    } catch (e) {
      addNotification({ type: 'error', message: 'Не удалось загрузить участников' });
    } finally {
      setLoading(false);
    }
  }, [pollId, addNotification]);

  useEffect(() => {
    if (open && !participants) load();
  }, [open, participants, load]);

  const toggle = async (p: PollParticipantInfo) => {
    if (p.hasVoted) return; // нет смысла исключать тех, кто уже проголосовал
    const next = p.status === 'EXPECTED' ? 'EXCLUDED' : 'EXPECTED';
    setBusyUserId(p.userId);
    try {
      const res = await adminService.setPollParticipantStatus(pollId, p.userId, next);
      if (res.success) {
        addNotification({
          type: 'success',
          message: next === 'EXCLUDED' ? 'Участник исключён' : 'Участник возвращён',
        });
        await load();
        const autoClosed = (res.data as any)?.autoClosed;
        if (autoClosed && onAutoClosed) onAutoClosed();
      }
    } catch (e) {
      addNotification({ type: 'error', message: 'Ошибка изменения статуса' });
    } finally {
      setBusyUserId(null);
    }
  };

  const expected = participants?.filter(p => p.status === 'EXPECTED') ?? [];
  const excluded = participants?.filter(p => p.status === 'EXCLUDED') ?? [];
  const votedCount = expected.filter(p => p.hasVoted).length;

  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-background/50 p-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between text-sm font-medium text-foreground"
      >
        <span className="flex items-center gap-2">
          <Users className={ICON_SIZES.sm} />
          Участники голосования
          {participants && (
            <span className="text-xs text-muted-foreground">
              ({votedCount}/{expected.length} проголосовало
              {excluded.length > 0 ? `, ${excluded.length} искл.` : ''})
            </span>
          )}
        </span>
        {open ? <ChevronUp className={ICON_SIZES.sm} /> : <ChevronDown className={ICON_SIZES.sm} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading && <p className="text-xs text-muted-foreground">Загрузка...</p>}

          {!loading && expected.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Ожидаемые</p>
              <ul className="space-y-1">
                {expected.map(p => (
                  <li
                    key={p.userId}
                    className="flex items-center justify-between rounded-lg bg-card/60 px-2 py-1.5 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      {p.hasVoted && <Check className={cn(ICON_SIZES.xs, 'text-green-500')} />}
                      {p.user.firstName} {p.user.lastName}
                    </span>
                    {!p.hasVoted && (
                      <button
                        type="button"
                        onClick={() => toggle(p)}
                        disabled={busyUserId === p.userId}
                        className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                        title="Исключить из этого голосования"
                      >
                        Исключить
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && excluded.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Исключены</p>
              <ul className="space-y-1">
                {excluded.map(p => (
                  <li
                    key={p.userId}
                    className="flex items-center justify-between rounded-lg bg-card/40 px-2 py-1.5 text-sm opacity-70"
                  >
                    <span className="flex items-center gap-2">
                      <HomeIcon className={cn(ICON_SIZES.xs, 'text-muted-foreground')} />
                      {p.user.firstName} {p.user.lastName}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggle(p)}
                      disabled={busyUserId === p.userId}
                      className="rounded-md px-2 py-0.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
                      title="Вернуть в это голосование"
                    >
                      Вернуть
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && participants && participants.length === 0 && (
            <p className="text-xs text-muted-foreground">Нет участников</p>
          )}
        </div>
      )}
    </div>
  );
};
