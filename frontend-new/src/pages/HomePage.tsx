import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, TrendingUp, UserPlus, Utensils } from 'lucide-react';
import { HeroCard } from '@/components/home/HeroCard';
import { InlineVotingCard } from '@/components/home/InlineVotingCard';
import { ActionsGrid, type ActionTile } from '@/components/home/ActionsGrid';
import { getDeepLinkPollId } from '@/lib/telegram';
import { usePollById } from '@/hooks/usePolls';
import { BudgetWidget } from '@/components/budget/BudgetWidget';
import { CalculatorModal } from '@/components/budget/CalculatorModal';
import { useBudgetWidget } from '@/hooks/useBudgetWidget';
import { WinnerCard } from '@/components/home/WinnerCard';
import { getGreeting } from '@/lib/greeting';
import { mapPollToOptions, totalVotes, pollCountdown } from '@/lib/pollMappers';
import { useActivePoll, useCreatePoll, useLastCompletedPoll, useMyVotes, usePollResults, useVote, useWithdrawVote } from '@/hooks/usePolls';
import { useCreateRecurringPoll } from '@/hooks/useRecurringPoll';
import { useAuth } from '@/hooks/useAuth';
import { useMyGroups } from '@/hooks/useUser';
import { useMenuItems } from '@/hooks/useMenu';
import { useSSE } from '@/hooks/useSSE';
import { useToast } from '@/hooks/useToast';
import { TopDishModal } from '@/components/modals/TopDishModal';
import { CreatePollSheet } from '@/components/admin/CreatePollSheet';
import type {
  CreatePollContext,
  CreatePollFormState,
  MenuItemOption,
} from '@/components/admin/types';
import '@/styles/home.css';

const DURATION_TO_MINUTES: Record<CreatePollFormState['duration'], number> = {
  '15m': 15,
  '30m': 30,
  '1h': 60,
  custom: 30,
};

const DAY_TO_NUM: Record<string, number> = {
  Вс: 0, Пн: 1, Вт: 2, Ср: 3, Чт: 4, Пт: 5, Сб: 6,
};

const TOP_DISH_KEY = 'top-dish-seen-poll';

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

  useSSE({ pollId: activePoll?.id ?? null, enabled: !!activePoll });

  const { data: lastCompletedPoll } = useLastCompletedPoll();
  const { data: lastPollResult } = usePollResults(lastCompletedPoll?.id ?? null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [topDishOpen, setTopDishOpen] = useState(false);

  useEffect(() => {
    if (!lastCompletedPoll || !lastPollResult) return;
    const seen = (() => {
      try {
        return localStorage.getItem(TOP_DISH_KEY);
      } catch {
        return null;
      }
    })();
    if (seen === String(lastCompletedPoll.id)) return;
    const closedAt = lastCompletedPoll.closedAt ?? lastCompletedPoll.createdAt;
    const ageMin = (Date.now() - new Date(closedAt).getTime()) / 60_000;
    if (ageMin < 60) {
      setTopDishOpen(true);
      try {
        localStorage.setItem(TOP_DISH_KEY, String(lastCompletedPoll.id));
      } catch {
        /* no-op */
      }
    }
  }, [lastCompletedPoll, lastPollResult]);

  const { data: allMenu = [] } = useMenuItems();
  const { data: myGroups = [] } = useMyGroups();
  const createPollMutation = useCreatePoll();
  const createRecurringMutation = useCreateRecurringPoll();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const budget = useBudgetWidget();
  const budgetBlock = (
    <>
      <BudgetWidget data={budget.data} callbacks={budget.callbacks} />
      <CalculatorModal
        open={budget.calcOpen}
        defaultTotal={budget.creditsTotal}
        participants={budget.creditsParticipants}
        onClose={budget.closeCalculator}
        onSubmit={budget.closeCalculator}
      />
    </>
  );

  const adminGroups = useMemo(() => {
    const activeGroups = myGroups.filter((g) => g.isActive);
    if (user?.isAdmin) return activeGroups;
    return activeGroups.filter((g) => {
      const role = (g.role ?? '').toUpperCase();
      return role === 'ADMIN' || role === 'CREATOR';
    });
  }, [myGroups, user?.isAdmin]);

  const createPollCtx = useMemo<CreatePollContext>(() => {
    const items: MenuItemOption[] = allMenu
      .filter((m) => m.isActive !== false)
      .map((m) => ({
        id: String(m.id),
        emoji: m.emoji ?? '🍽',
        name: m.name,
        restaurant: m.category ?? '—',
        price: m.price,
      }));
    return {
      items,
      maxItems: Math.min(8, Math.max(2, items.length)),
      minItems: 2,
      audiences: [
        { key: 'all', label: 'Вся группа', sub: 'все участники получат уведомление' },
      ],
      groups: adminGroups.map((g) => ({ id: String(g.id), title: g.title })),
    };
  }, [allMenu, adminGroups]);

  const handleCreatePoll = async (form: CreatePollFormState) => {
    setCreateError(null);
    const group =
      (form.groupId && adminGroups.find((g) => String(g.id) === form.groupId)) ||
      adminGroups[0];
    if (!group) {
      const msg = 'Нет группы, где вы админ. Добавьте бота в группу и сделайте его администратором.';
      setCreateError(msg);
      toast.error(msg);
      return;
    }
    const selectedMenuItems = form.selectedItems
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n));
    const duration = DURATION_TO_MINUTES[form.duration];
    try {
      if (form.recurring) {
        const daysOfWeek = form.recurringDays
          .map((d) => DAY_TO_NUM[d])
          .filter((n): n is number => typeof n === 'number');
        if (daysOfWeek.length === 0) {
          throw new Error('Выберите хотя бы один день недели');
        }
        await createRecurringMutation.mutateAsync({
          groupId: group.id,
          daysOfWeek,
          timeOfDay: form.recurringTime,
          duration,
          selectedMenuItemIds: selectedMenuItems.length ? selectedMenuItems : null,
        });
      } else {
        await createPollMutation.mutateAsync({
          groupId: group.id,
          duration,
          selectedMenuItems,
          title: form.title.trim() || undefined,
          isMultiSelect: true,
          maxSelections: 3,
        });
        toast.success('Опрос запущен', { title: '🚀 Голосование отправлено в группу' });
      }
      setCreateOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось создать опрос';
      setCreateError(msg);
      toast.error(msg);
    }
  };

  const topDish = useMemo(() => {
    if (!lastPollResult) return null;
    const match = allMenu.find((m) => m.id === lastPollResult.winnerId);
    return {
      name: lastPollResult.winnerName || match?.name || 'Блюдо',
      emoji: match?.emoji ?? '🍽',
      votes: lastPollResult.totalVotes ?? 0,
      totalVotes: lastPollResult.totalVotes ?? 0,
      price: match?.price,
    };
  }, [lastPollResult, allMenu]);

  const options = useMemo(() => mapPollToOptions(activePoll), [activePoll]);
  const myChoiceId = myVotesData?.menuItemIds?.[0] ?? null;
  const hasVoted = myChoiceId !== null;
  const participants = totalVotes(activePoll);
  const countdown = pollCountdown(activePoll);

  const actionItems: ActionTile[] = useMemo(
    () => [
      { key: 'menu', label: 'Меню', palette: 'peach', icon: Utensils, iconColor: '#3D2012', onClick: () => navigate('/menu') },
      { key: 'history', label: 'История', palette: 'lav', icon: Clock, iconColor: '#2E1F56', onClick: () => navigate('/poll/history') },
      { key: 'stats', label: 'Статистика', palette: 'sage', icon: TrendingUp, iconColor: '#0E3D26', onClick: () => navigate('/stats') },
      { key: 'invite', label: 'Пригласить', palette: 'sky', icon: UserPlus, iconColor: '#083855' },
    ],
    [navigate],
  );

  const greeting = useMemo(() => {
    return getGreeting({
      userName: user?.firstName ?? '',
      hasActivePoll: !!activePoll,
      hasVoted,
      isPollEnding: !!activePoll && parseInt(countdown.split(':')[0], 10) <= 2,
      hasCompletedPoll: false,
    });
  }, [user, activePoll, hasVoted, countdown]);

  if (authLoading || pollLoading) {
    return (
      <div className="home-body">
        <LoadingView />
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-body">
        <div style={{ padding: 16, color: 'var(--ink-2)' }}>
          Не удалось загрузить данные. Попробуйте позже.
        </div>
      </div>
    );
  }

  const hero = (
    <HeroCard
      palette={greeting.palette}
      eyebrow={greeting.eyebrow}
      title={greeting.title}
      subtitle={greeting.subtitle}
      avatars={[]}
      moreCount={0}
      chips={activePoll ? ['🗳 активно'] : undefined}
    />
  );

  if (!activePoll) {
    return (
      <div className="home-body">
        {hero}
        <InlineVotingCard kind="empty" onCreate={() => setCreateOpen(true)} />
        {createError && (
          <div style={{ padding: '8px 12px', color: 'var(--coral-500)', fontSize: 13 }}>
            {createError}
          </div>
        )}
        {budgetBlock}
        <ActionsGrid items={actionItems} />
        <TopDishModal open={topDishOpen} dish={topDish} onClose={() => setTopDishOpen(false)} />
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
      </div>
    );
  }

  if (hasVoted && myChoiceId !== null) {
    return (
      <div className="home-body">
        {hero}
        <InlineVotingCard
          kind="voted"
          pollNumber={activePoll.id}
          subtitle={`${participants} проголосовали`}
          participantsText="Результаты в реальном времени"
          countdown={countdown}
          options={options}
          myChoiceId={myChoiceId}
          totalVotes={participants}
          onChange={() => withdrawMutation.mutate(activePoll.id)}
          onWithdraw={() => withdrawMutation.mutate(activePoll.id)}
        />
        {budgetBlock}
        <TopDishModal open={topDishOpen} dish={topDish} onClose={() => setTopDishOpen(false)} />
      </div>
    );
  }

  return (
    <div className="home-body">
      {hero}
      <InlineVotingCard
        kind="active"
        pollNumber={activePoll.id}
        subtitle="идёт голосование"
        participantsText={`👥 ${participants} проголосовали`}
        countdown={countdown}
        urgent={parseInt(countdown.split(':')[0], 10) <= 1}
        options={options}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id as number)}
        onVote={() => {
          if (selectedId !== null) {
            voteMutation.mutate({ pollId: activePoll.id, menuItemId: selectedId });
          }
        }}
      />
      {budgetBlock}
      <ActionsGrid items={actionItems} />
      <TopDishModal open={topDishOpen} dish={topDish} onClose={() => setTopDishOpen(false)} />
    </div>
  );
}

function LoadingView() {
  return (
    <>
      <div
        className="home-hero morning anim-hero"
        style={{ opacity: 0.55 }}
        aria-busy="true"
      >
        <div className="deco" />
        <div className="eyebrow" style={{ background: 'rgba(255,255,255,0.35)', width: 80, height: 10, borderRadius: 4 }} />
        <div style={{ height: 20, marginTop: 8, background: 'rgba(255,255,255,0.45)', borderRadius: 6, width: '60%' }} />
        <div style={{ height: 13, marginTop: 6, background: 'rgba(255,255,255,0.35)', borderRadius: 4, width: '40%' }} />
      </div>
      <div className="vote-card">
        <div style={{ height: 40, background: 'var(--line-2)', borderRadius: 10 }} />
        <div style={{ height: 10, background: 'var(--line-2)', borderRadius: 4, width: '85%' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 56, background: 'var(--line-2)', borderRadius: 12, opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      </div>
    </>
  );
}

// exported WinnerCard demo use case kept for future closed-poll state
export { WinnerCard };
