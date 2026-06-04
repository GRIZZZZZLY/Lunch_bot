import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDeepLinkPollId } from '@/lib/telegram';
import { mapPollToOptions, totalVotes } from '@/lib/pollMappers';
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
import { useCreateRecurringPoll } from '@/hooks/useRecurringPoll';
import { useAuth } from '@/hooks/useAuth';
import { useMyGroups } from '@/hooks/useUser';
import { useMenuItems } from '@/hooks/useMenu';
import { useDebts, useCredits, useMarkPaid } from '@/hooks/useBudget';
import { useSSE } from '@/hooks/useSSE';
import { useToast } from '@/hooks/useToast';
import { CreatePollSheet } from '@/components/admin/CreatePollSheet';
import type {
  CreatePollContext,
  CreatePollFormState,
  MenuItemOption,
} from '@/components/admin/types';
import {
  ActivePollWidget,
  BudgetWidget,
  CompletedPollWidget,
  HomeActionsSection,
  HomeHeroCard,
  type BudgetScenario,
  type PollOptionVM,
} from '@/components/rl/homeWidgets';
import { Badge, Button } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';
import { Fab } from '@/components/rl/Fab';
import { SectionTitle } from '@/components/rl/parts';
import { CreateStoreRunSheet } from '@/components/rl/CreateStoreRunSheet';
import { useActiveStoreRuns, useCreateStoreRun } from '@/hooks/useStoreRun';
import { useAppStore } from '@/store/useAppStore';

const DURATION_TO_MINUTES: Record<CreatePollFormState['duration'], number> = {
  '15m': 15,
  '30m': 30,
  '1h': 60,
  custom: 30,
};

const DAY_TO_NUM: Record<string, number> = {
  Вс: 0, Пн: 1, Вт: 2, Ср: 3, Чт: 4, Пт: 5, Сб: 6,
};

function plainGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

/** Vertical stack with staggered rise-in, matching the mockup's ScreenBody. */
function Stack({ children }: { children: ReactNode[] }) {
  return (
    <div className="rl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 16px 16px' }}>
        {children.filter(Boolean).map((node, i) => (
          <div key={i} className="anim-rise" style={{ animationDelay: `${Math.min(i * 55, 330)}ms` }}>
            {node}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

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
  const { data: lastPollResult } = usePollResults(lastCompletedPoll?.id ?? null);

  const { data: allMenu = [] } = useMenuItems();
  const { data: myGroups = [] } = useMyGroups();
  const createPollMutation = useCreatePoll();
  const createRecurringMutation = useCreateRecurringPoll();
  const toast = useToast();

  // budget (real, via debts/credits)
  const { data: debts = [] } = useDebts();
  const { data: credits = [] } = useCredits();
  const markPaid = useMarkPaid();

  // store runs
  const { data: activeRuns = [] } = useActiveStoreRuns();
  const createStoreRun = useCreateStoreRun();
  const currentGroupId = useAppStore((s) => s.currentGroupId);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [completedCollapsed, setCompletedCollapsed] = useState(true);

  // ----- derived: active poll view-model -----
  const options: PollOptionVM[] = useMemo(
    () => mapPollToOptions(activePoll, allMenu).map((o) => ({ id: Number(o.id), name: o.name, votes: o.votes })),
    [activePoll, allMenu],
  );
  const myChoiceId = myVotesData?.menuItemIds?.[0] ?? null;
  const hasVoted = myChoiceId !== null;
  const participants = totalVotes(activePoll);
  const teamCount = activePoll?._count?.participants;

  const { remaining, totalSec } = useMemo(() => {
    if (!activePoll) return { remaining: 0, totalSec: 600 };
    const t = activePoll.duration * 60;
    const elapsed = Math.floor((Date.now() - new Date(activePoll.createdAt).getTime()) / 1000);
    return { remaining: Math.max(0, t - elapsed), totalSec: t };
  }, [activePoll]);

  const pollTitle = (activePoll as { title?: string } | null)?.title || 'Что заказываем на обед?';

  // ----- derived: budget scenario -----
  const youOwe = debts.filter((d) => d.status !== 'CONFIRMED').reduce((s, d) => s + d.amount, 0);
  const owedToYou = credits.filter((c) => c.status !== 'CONFIRMED').reduce((s, c) => s + c.amount, 0);
  const pendingDebt = useMemo(
    () => debts.filter((d) => d.status === 'PENDING').sort((a, b) => b.amount - a.amount)[0],
    [debts],
  );
  const markedDebt = useMemo(
    () => debts.filter((d) => d.status === 'PAID').sort((a, b) => b.amount - a.amount)[0],
    [debts],
  );
  const budgetScenario: BudgetScenario =
    debts.length === 0 && credits.length === 0
      ? 'hidden'
      : pendingDebt
        ? 'urgent'
        : markedDebt
          ? 'awaiting'
          : credits.length > 0
            ? 'collector'
            : 'overview';
  const urgentTx = pendingDebt ?? markedDebt;
  const urgentCreditorName = urgentTx?.creditor?.firstName || urgentTx?.creditor?.username || undefined;
  const creditors = credits.map((c) => ({
    name: c.debtor?.firstName || c.debtor?.username || 'Участник',
    amount: c.amount,
    status: c.status,
  }));
  const collectTotal = credits.reduce((s, c) => s + c.amount, 0);
  const collected = credits.filter((c) => c.status === 'CONFIRMED').reduce((s, c) => s + c.amount, 0);

  // ----- derived: completed poll view-model -----
  const completedVM = useMemo(() => {
    if (!lastCompletedPoll || !lastPollResult) return null;
    const opts = mapPollToOptions(lastCompletedPoll, allMenu);
    const ranking = [...opts]
      .sort((a, b) => b.votes - a.votes)
      .map((o) => ({ name: o.name, votes: o.votes }));
    const winnerVotes =
      opts.find((o) => o.id === lastPollResult.winnerId)?.votes ?? ranking[0]?.votes ?? lastPollResult.totalVotes;
    return {
      winnerName: lastPollResult.winnerName || ranking[0]?.name || 'Блюдо',
      winnerVotes,
      totalVotes: lastPollResult.totalVotes,
      ranking,
    };
  }, [lastCompletedPoll, lastPollResult, allMenu]);

  // ----- create poll flow (reused) -----
  const adminGroups = useMemo(() => {
    const activeGroups = myGroups.filter((g) => g.isActive);
    if (user?.isAdmin) return activeGroups;
    return activeGroups.filter((g) => {
      const role = (g.role ?? '').toUpperCase();
      return role === 'ADMIN' || role === 'CREATOR';
    });
  }, [myGroups, user?.isAdmin]);

  const canCreate = adminGroups.length > 0 || (!!user?.isAdmin && !!currentGroupId);

  const createPollCtx = useMemo<CreatePollContext>(() => {
    const items: MenuItemOption[] = allMenu
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
  }, [allMenu, adminGroups]);

  const handleCreatePoll = async (form: CreatePollFormState) => {
    setCreateError(null);
    const matched =
      (form.groupId && adminGroups.find((g) => String(g.id) === form.groupId)) || adminGroups[0];
    const groupId = matched ? String(matched.id) : currentGroupId;
    if (!groupId) {
      const msg = 'Нет активной группы. Добавьте бота в групповой чат.';
      setCreateError(msg);
      toast.error(msg);
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
        await createPollMutation.mutateAsync({
          groupId,
          duration,
          selectedMenuItems,
          title: form.title.trim() || undefined,
          isMultiSelect: true,
          maxSelections: 3,
        });
        toast.success('Голосование отправлено в группу');
      }
      setCreateOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось создать опрос';
      setCreateError(msg);
      toast.error(msg);
    }
  };

  const onCreatePollAction = () => {
    if (!canCreate) {
      toast.error('Создавать голосование может только администратор группы');
      return;
    }
    setCreateOpen(true);
  };

  const greet = plainGreeting(new Date().getHours());
  const name = user?.firstName;

  const hero = (
    <HomeHeroCard greet={greet} name={name} activeCount={activePoll ? 1 : 0} teamCount={teamCount} />
  );

  const budget = (
    <BudgetWidget
      scenario={budgetScenario}
      youOwe={youOwe}
      owedToYou={owedToYou}
      urgentCreditorName={urgentCreditorName}
      urgentAmount={urgentTx?.amount ?? 0}
      creditors={creditors}
      collected={collected}
      collectTotal={collectTotal}
      onPaySbp={() => pendingDebt && markPaid.mutate(pendingDebt.id)}
    />
  );

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
      /* toast shown by hook */
    }
  };

  const actions = (
    <HomeActionsSection
      onCreatePoll={onCreatePollAction}
      onCreateOrder={() => setCreateOrderOpen(true)}
      onSuggest={() => navigate('/suggestions/mine')}
    />
  );

  const STORE_TONE: Record<string, 'accent' | 'warning' | 'success' | 'danger'> = {
    COLLECTING: 'accent',
    SHOPPING: 'warning',
    SETTLED: 'success',
    CANCELLED: 'danger',
  };
  const STORE_LABEL: Record<string, string> = {
    COLLECTING: 'Сбор',
    SHOPPING: 'В магазине',
    SETTLED: 'Готово',
    CANCELLED: 'Отменено',
  };
  const storeRuns =
    activeRuns.length > 0 ? (
      <div>
        <SectionTitle icon="cart">Активные закупки</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activeRuns.map((r) => (
            <button
              key={r.id}
              className="card press"
              onClick={() => navigate(`/store-run/${r.id}`)}
              style={{ width: '100%', padding: 14, display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="cart" size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-head" style={{ fontSize: 'var(--t-15)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.storeName}
                </div>
                <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }} className="tnum">
                  {r.items.length} позиций · {r.initiator.firstName}
                </div>
              </div>
              <Badge tone={STORE_TONE[r.status] ?? 'neutral'} icon="cart">
                {STORE_LABEL[r.status] ?? r.status}
              </Badge>
            </button>
          ))}
        </div>
      </div>
    ) : null;

  const createOrderSheet = (
    <CreateStoreRunSheet open={createOrderOpen} busy={createStoreRun.isPending} onClose={() => setCreateOrderOpen(false)} onSubmit={handleCreateOrder} />
  );

  const completed =
    completedVM != null ? (
      <CompletedPollWidget
        winnerName={completedVM.winnerName}
        winnerVotes={completedVM.winnerVotes}
        totalVotes={completedVM.totalVotes}
        ranking={completedVM.ranking}
        collapsed={completedCollapsed}
        onToggle={() => setCompletedCollapsed((v) => !v)}
        onDetails={() => lastCompletedPoll && navigate(`/poll/${lastCompletedPoll.id}/results`)}
        isAdmin={canCreate}
        onCancel={() => lastCompletedPoll && cancelPoll.mutate({ pollId: lastCompletedPoll.id })}
      />
    ) : null;

  const createSheet = (
    <CreatePollSheet
      open={createOpen}
      ctx={createPollCtx}
      submitting={createPollMutation.isPending || createRecurringMutation.isPending}
      onClose={() => {
        setCreateOpen(false);
        setCreateError(null);
      }}
      onSubmit={handleCreatePoll}
    />
  );

  // ----- loading -----
  if (authLoading || pollLoading) {
    return (
      <Stack>
        {[<HomeHeroCard key="h" loading />, <ActivePollWidget key="p" {...EMPTY_POLL_PROPS} loading />]}
      </Stack>
    );
  }

  // ----- error -----
  if (error) {
    return (
      <Stack>
        {[
          <div key="e" className="card" style={{ padding: 20, color: 'var(--text-secondary)', fontSize: 'var(--t-13)' }}>
            Не удалось загрузить данные. Попробуйте позже.
          </div>,
        ]}
      </Stack>
    );
  }

  // ----- empty (no active poll) -----
  if (!activePoll) {
    return (
      <>
        <Stack>
          {[
            hero,
            <EmptyPollCard key="empty" canCreate={canCreate} onCreate={onCreatePollAction} />,
            createError ? (
              <div key="err" style={{ color: 'var(--danger)', fontSize: 'var(--t-13)', padding: '0 4px' }}>
                {createError}
              </div>
            ) : null,
            completed,
            budget,
            storeRuns,
            actions,
          ]}
        </Stack>
        <Fab onClick={onCreatePollAction} />
        {createSheet}
        {createOrderSheet}
      </>
    );
  }

  // ----- active poll -----
  return (
    <>
      <Stack>
        {[
          hero,
          <ActivePollWidget
            key="poll"
            title={pollTitle}
            options={options}
            totalVotes={participants}
            teamCount={teamCount}
            remaining={remaining}
            total={totalSec}
            selectedId={selectedId}
            myChoiceId={myChoiceId}
            hasVoted={hasVoted}
            onSelect={(id) => setSelectedId(id)}
            onVote={() => {
              if (selectedId != null) voteMutation.mutate({ pollId: activePoll.id, menuItemId: selectedId });
            }}
            onWithdraw={() => withdrawMutation.mutate(activePoll.id)}
            voting={voteMutation.isPending}
            isAdmin={canCreate}
            adminOpen={adminOpen}
            onToggleAdmin={() => setAdminOpen((v) => !v)}
            onCloseEarly={() => completePoll.mutate(activePoll.id)}
            onCancel={() => cancelPoll.mutate({ pollId: activePoll.id })}
          />,
          completed,
          budget,
          storeRuns,
          actions,
        ]}
      </Stack>
      <Fab onClick={onCreatePollAction} />
      {createSheet}
      {createOrderSheet}
    </>
  );
}

const EMPTY_POLL_PROPS = {
  title: '',
  options: [] as PollOptionVM[],
  totalVotes: 0,
  remaining: 0,
  total: 600,
  selectedId: null,
  myChoiceId: null,
  hasVoted: false,
  onSelect: () => undefined,
  onVote: () => undefined,
};

function EmptyPollCard({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <div className="card" style={{ padding: 24, textAlign: 'center' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          margin: '0 auto 14px',
          background: 'var(--accent-tint)',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="flame" size={26} />
      </div>
      <div className="font-head tight" style={{ fontSize: 'var(--t-18)', fontWeight: 700, marginBottom: 4 }}>
        Сейчас нет голосования
      </div>
      <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)', marginBottom: canCreate ? 16 : 0 }}>
        {canCreate ? 'Запустите опрос — команда выберет, что заказать' : 'Дождитесь, пока администратор запустит опрос'}
      </div>
      {canCreate && (
        <Button variant="primary" icon="plus" onClick={onCreate} style={{ width: '100%' }}>
          Запустить голосование
        </Button>
      )}
    </div>
  );
}
