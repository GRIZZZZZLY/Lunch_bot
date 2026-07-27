/* Главная (Phase 4, система C): талон голосования с живым таймером,
   секция «Сейчас» (победитель, закупки, бюджет-строка), шторки создания.
   Поведение сохранено: deep link, SSE, голос/отзыв, complete/cancel,
   разовые и recurring опросы (одиночный выбор — Q1), создание закупки.
   FAB удалён: «Запустить голосование» — CTA талона, «Новая закупка» —
   кнопка секции «Сейчас», «Предложить блюдо» — в Меню и Профиле. */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getDeepLinkPollId } from '@/lib/telegram';
import { mapPollToOptions, totalVotes } from '@/lib/pollMappers';
import { getAdminGroups, isGlobalAdmin } from '@/lib/permissions';
import { queryKeys } from '@/lib/queryClient';
import { isSameLocalDay } from '@/lib/date';
import { formatScheduleHint } from '@/lib/schedule';
import {
  useActivePoll,
  useCancelPoll,
  useCompletePoll,
  useCreatePoll,
  useLastCompletedPoll,
  useMyVotes,
  usePollById,
  usePollResults,
  useVote,
  useWithdrawVote,
} from '@/hooks/usePolls';
import { useCreateRecurringPoll, useRecurringSchedule } from '@/hooks/useRecurringPoll';
import { useAuth } from '@/hooks/useAuth';
import { useMyGroups } from '@/hooks/useUser';
import { useMenuItems } from '@/hooks/useMenu';
import { useDebts, useCredits, useMarkPaid } from '@/hooks/useBudget';
import { useSSE } from '@/hooks/useSSE';
import { useToast } from '@/hooks/useToast';
import { useEffect } from 'react';
import { CreatePollSheet } from '@/components/admin/CreatePollSheet';
import type { CreatePollContext, CreatePollFormState, MenuItemOption } from '@/components/admin/types';
import { CreateStoreRunSheet } from '@/features/store-run/components/CreateStoreRunSheet';
import { useActiveStoreRuns, useCreateStoreRun } from '@/hooks/useStoreRun';
import { useAppStore } from '@/store/useAppStore';
import { ErrorState, Skeleton } from '@/shared/ui';
import { Greeting } from './components/Greeting';
import { LunchTicket } from './components/LunchTicket';
import { EmptyTicket } from './components/EmptyTicket';
import { WinnerRow } from './components/WinnerRow';
import { NowSection } from './components/NowSection';
import { budgetRow, pollEndsAt, resolveTargetGroup } from './lib/selectors';
import type { PollOptionVM } from './lib/types';
import styles from './HomePage.module.css';

const DURATION_TO_MINUTES: Record<CreatePollFormState['duration'], number> = {
  '15m': 15,
  '30m': 30,
  '1h': 60,
  custom: 30,
};

const DAY_TO_NUM: Record<string, number> = { Вс: 0, Пн: 1, Вт: 2, Ср: 3, Чт: 4, Пт: 5, Сб: 6 };

export function HomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const currentGroupId = useAppStore((s) => s.currentGroupId);

  /* ---- активное голосование (deep link приоритетен) ---- */
  const deepLinkPollId = useMemo(() => getDeepLinkPollId(), []);
  const { data: deepLinkPoll, isLoading: deepLinkLoading } = usePollById(deepLinkPollId);
  const { data: fallbackActivePoll, isLoading: activeLoading, error } = useActivePoll();
  const activePoll = deepLinkPollId ? deepLinkPoll ?? null : fallbackActivePoll;
  const pollLoading = deepLinkPollId ? deepLinkLoading : activeLoading;

  useEffect(() => {
    if (deepLinkPollId && deepLinkPoll && deepLinkPoll.status !== 'ACTIVE') {
      navigate(`/poll/${deepLinkPollId}/results`, { replace: true });
    }
  }, [deepLinkPollId, deepLinkPoll, navigate]);

  const { data: myVotesData } = useMyVotes(activePoll?.id ?? null);
  const voteMutation = useVote();
  const withdrawMutation = useWithdrawVote();
  const completePoll = useCompletePoll();
  const cancelPoll = useCancelPoll();
  useSSE({ pollId: activePoll?.id ?? null, enabled: !!activePoll });

  const { data: lastCompletedPoll } = useLastCompletedPoll();
  // Итог показываем только за текущие сутки: вчерашний победитель на главной
  // уже неинформативен. Сам запрос оставляем — он нужен для повтора опроса.
  const winnerIsFresh = isSameLocalDay(
    lastCompletedPoll?.endedAt ?? lastCompletedPoll?.closedAt ?? lastCompletedPoll?.createdAt,
  );
  const { data: lastPollResult } = usePollResults(
    winnerIsFresh ? lastCompletedPoll?.id ?? null : null,
  );
  const { data: allMenu = [] } = useMenuItems();
  const { data: myGroups = [] } = useMyGroups();

  /* ---- бюджет и закупки ---- */
  const { data: debts = [] } = useDebts();
  const { data: credits = [] } = useCredits();
  const markPaid = useMarkPaid();
  const { data: activeRuns = [] } = useActiveStoreRuns();
  const createStoreRun = useCreateStoreRun();

  /* ---- локальный UI-state ---- */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [sheetGroupId, setSheetGroupId] = useState<string | null>(null);
  const createPollMutation = useCreatePoll();
  const createRecurringMutation = useCreateRecurringPoll();
  const { data: recurringSchedule } = useRecurringSchedule(
    currentGroupId ? Number(currentGroupId) : null,
  );
  const scheduleHint = formatScheduleHint(recurringSchedule);

  /* ---- view-model голосования ---- */
  const options: PollOptionVM[] = useMemo(
    () => mapPollToOptions(activePoll, allMenu).map((o) => ({ id: Number(o.id), name: o.name, votes: o.votes })),
    [activePoll, allMenu],
  );
  const myChoiceId = myVotesData?.menuItemIds?.[0] ?? null;
  const participants = totalVotes(activePoll);
  const endsAt = activePoll ? pollEndsAt(activePoll.createdAt, activePoll.duration) : null;
  const onPollExpire = useCallback(() => {
    // серверный статус — истина: по нулю таймера только рефетчим
    qc.invalidateQueries({ queryKey: queryKeys.polls.active });
  }, [qc]);

  /* ---- победитель ---- */
  const winnerVM = useMemo(() => {
    if (!lastCompletedPoll || !lastPollResult || !winnerIsFresh) return null;
    const opts = mapPollToOptions(lastCompletedPoll, allMenu);
    const top = [...opts].sort((a, b) => b.votes - a.votes)[0];
    const winnerVotes =
      opts.find((o) => o.id === lastPollResult.winnerId)?.votes ?? top?.votes ?? lastPollResult.totalVotes;
    return {
      winnerName: lastPollResult.winnerName || top?.name || 'Блюдо',
      winnerVotes,
      totalVotes: lastPollResult.totalVotes,
      responsibleName: lastPollResult.responsible?.name,
      pollId: lastCompletedPoll.id,
    };
  }, [lastCompletedPoll, lastPollResult, allMenu, winnerIsFresh]);

  /* ---- создание голосования ---- */
  const adminGroups = useMemo(() => getAdminGroups(user, myGroups), [myGroups, user]);
  const canCreate = adminGroups.length > 0 || (isGlobalAdmin(user) && !!currentGroupId);
  const effectiveSheetGroupId = sheetGroupId ?? currentGroupId;
  const { data: sheetMenu = [] } = useMenuItems({ activeOnly: true, groupId: effectiveSheetGroupId });

  const createPollCtx = useMemo<CreatePollContext>(() => {
    const items: MenuItemOption[] = sheetMenu
      .filter((m) => m.isActive !== false)
      .map((m) => ({
        id: String(m.id),
        emoji: m.emoji ?? '',
        name: m.name,
        restaurant: m.category ?? '—',
        price: m.price,
      }));
    return {
      items,
      maxItems: Math.min(8, Math.max(2, items.length)),
      minItems: 2,
      audiences: [{ key: 'all', label: 'Вся группа', sub: 'все участники получат уведомление' }],
      groups: adminGroups.map((g) => ({ id: String(g.id), title: g.title })),
    };
  }, [sheetMenu, adminGroups]);

  const handleCreatePoll = async (form: CreatePollFormState) => {
    const groupId = resolveTargetGroup(form.groupId, currentGroupId, adminGroups);
    if (!groupId) {
      toast.error('Нет активной группы. Добавьте бота в групповой чат.');
      return;
    }
    const selectedMenuItems = form.selectedItems.map((id) => Number(id)).filter((n) => Number.isFinite(n));
    const duration = DURATION_TO_MINUTES[form.duration];
    try {
      if (form.recurring) {
        const daysOfWeek = form.recurringDays
          .map((d) => DAY_TO_NUM[d])
          .filter((n): n is number => typeof n === 'number');
        if (daysOfWeek.length === 0) throw new Error('Выберите хотя бы один день недели');
        await createRecurringMutation.mutateAsync({
          groupId: Number(groupId),
          daysOfWeek,
          timeOfDay: form.recurringTime,
          duration,
          selectedMenuItemIds: selectedMenuItems.length ? selectedMenuItems : null,
        });
      } else {
        // Q1: одиночный выбор — multi-select UI не существует
        await createPollMutation.mutateAsync({
          groupId,
          duration,
          selectedMenuItems,
          title: form.title.trim() || undefined,
          isMultiSelect: false,
        });
        toast.success('Голосование отправлено в группу');
      }
      setCreateOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось создать опрос');
    }
  };

  const onCreatePollAction = () => {
    if (!canCreate) {
      toast.error('Создавать голосование может только администратор группы');
      return;
    }
    setCreateOpen(true);
  };

  const handleCreateOrder = async (input: { storeName: string; collectMinutes: number }) => {
    if (!currentGroupId) {
      toast.error('Нет активной группы для закупки');
      return;
    }
    try {
      const res = await createStoreRun.mutateAsync({ groupId: Number(currentGroupId), ...input });
      setCreateOrderOpen(false);
      const newId = res.data?.id;
      if (newId) navigate(`/store-run/${newId}`);
    } catch {
      /* toast показывает hook */
    }
  };

  const budget = useMemo(() => budgetRow(debts, credits), [debts, credits]);

  /* ---- служебные состояния ---- */
  if (authLoading || pollLoading) {
    return (
      <div className={`rl ${styles.screen}`}>
        <Greeting loading />
        <div className={styles.group} style={{ padding: 16 }}>
          <Skeleton variant="text" width="40%" height={10} />
          <div style={{ height: 12 }} />
          <Skeleton variant="block" height={110} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rl ${styles.screen}`}>
        <Greeting name={user?.firstName} />
        <ErrorState
          kind="network"
          onRetry={() => qc.invalidateQueries({ queryKey: queryKeys.polls.active })}
        />
      </div>
    );
  }

  const winner = winnerVM ? (
    <WinnerRow
      winnerName={winnerVM.winnerName}
      winnerVotes={winnerVM.winnerVotes}
      totalVotes={winnerVM.totalVotes}
      responsibleName={winnerVM.responsibleName}
      onOpen={() => navigate(`/poll/${winnerVM.pollId}/results`)}
    />
  ) : null;

  return (
    <div className={`rl ${styles.screen}`}>
      <Greeting name={user?.firstName} />

      {activePoll && endsAt ? (
        <LunchTicket
          title={(activePoll as { title?: string }).title || 'Что заказываем на обед?'}
          options={options}
          totalVotes={participants}
          endsAt={endsAt}
          onExpire={onPollExpire}
          selectedId={selectedId}
          myChoiceId={myChoiceId}
          hasVoted={myChoiceId !== null}
          voting={voteMutation.isPending || withdrawMutation.isPending}
          onSelect={setSelectedId}
          onVote={() => {
            if (selectedId != null && !voteMutation.isPending) {
              voteMutation.mutate({ pollId: activePoll.id, menuItemId: selectedId });
            }
          }}
          onWithdraw={() => {
            if (!withdrawMutation.isPending) withdrawMutation.mutate(activePoll.id);
          }}
          isAdmin={canCreate}
          mutating={completePoll.isPending || cancelPoll.isPending}
          onCloseEarly={() => completePoll.mutate(activePoll.id)}
          onCancel={() => cancelPoll.mutate({ pollId: activePoll.id })}
        />
      ) : (
        <EmptyTicket canCreate={canCreate} onCreate={onCreatePollAction} scheduleHint={scheduleHint} />
      )}

      <NowSection
        winner={winner}
        runs={activeRuns}
        budget={budget}
        paying={markPaid.isPending}
        onOpenRun={(id) => navigate(`/store-run/${id}`)}
        onMarkPaid={(txId) => {
          if (!markPaid.isPending) markPaid.mutate(txId);
        }}
        onOpenBudget={() => navigate('/budget')}
        onNewRun={() => setCreateOrderOpen(true)}
      />

      <CreatePollSheet
        open={createOpen}
        ctx={createPollCtx}
        initial={currentGroupId ? { groupId: currentGroupId } : undefined}
        submitting={createPollMutation.isPending || createRecurringMutation.isPending}
        onClose={() => {
          setCreateOpen(false);
          setSheetGroupId(null);
        }}
        onSubmit={handleCreatePoll}
        onGroupChange={setSheetGroupId}
      />
      <CreateStoreRunSheet
        open={createOrderOpen}
        busy={createStoreRun.isPending}
        onClose={() => setCreateOrderOpen(false)}
        onSubmit={handleCreateOrder}
      />
    </div>
  );
}
