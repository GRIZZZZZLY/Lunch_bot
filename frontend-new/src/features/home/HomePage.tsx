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
import { daysToLabels, formatScheduleHint, labelsToDays, parseDaysOfWeek, parseNumberArray } from '@/lib/schedule';
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
import {
  useCreateRecurringPoll,
  useDeleteRecurringPoll,
  useRecurringSchedule,
  useUpdateRecurringPoll,
} from '@/hooks/useRecurringPoll';
import { useAuth } from '@/hooks/useAuth';
import { useMyGroups } from '@/hooks/useUser';
import { useMenuItems } from '@/hooks/useMenu';
import { useDebts, useCredits, useMarkPaid } from '@/hooks/useBudget';
import { useSSE } from '@/hooks/useSSE';
import { useToast } from '@/hooks/useToast';
import { useEffect } from 'react';
import { CreatePollSheet, type SheetSchedule } from '@/components/admin/CreatePollSheet';
import type { CreatePollContext, CreatePollFormState, MenuItemOption } from '@/components/admin/types';
import { CreateStoreRunSheet } from '@/features/store-run/components/CreateStoreRunSheet';
import { useActiveStoreRuns, useCreateStoreRun } from '@/hooks/useStoreRun';
import { useAppStore } from '@/store/useAppStore';
import { ErrorState, Skeleton } from '@/shared/ui';
import { useDelayedLoading } from '@/shared/lib/useDelayedLoading';
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

/** Минуты расписания → чип длительности; нестандартные значения остаются «кастомными». */
function durationKeyOf(minutes: number): CreatePollFormState['duration'] {
  if (minutes === 15) return '15m';
  if (minutes === 30) return '30m';
  if (minutes === 60) return '1h';
  return 'custom';
}

export function HomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const currentGroupId = useAppStore((s) => s.currentGroupId);

  /* ---- активное голосование (deep link приоритетен) ---- */
  const deepLinkPollId = useMemo(() => getDeepLinkPollId(), []);
  const deepLinkQuery = usePollById(deepLinkPollId);
  const { data: deepLinkPoll, isLoading: deepLinkLoading } = deepLinkQuery;
  const activeQuery = useActivePoll();
  const { data: fallbackActivePoll, isLoading: activeLoading, error } = activeQuery;
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

  const lastCompletedQuery = useLastCompletedPoll();
  const lastCompletedPoll = lastCompletedQuery.data;
  // Итог показываем только за текущие сутки: вчерашний победитель на главной
  // уже неинформативен. Сам запрос оставляем — он нужен для повтора опроса.
  const winnerIsFresh = isSameLocalDay(
    lastCompletedPoll?.endedAt ?? lastCompletedPoll?.closedAt ?? lastCompletedPoll?.createdAt,
  );
  const resultsQuery = usePollResults(winnerIsFresh ? lastCompletedPoll?.id ?? null : null);
  const lastPollResult = resultsQuery.data;
  /* Объект запроса нужен барьеру (он спрашивает, приехали ли данные), а список
     берём деструктуризацией с умолчанием: `?? []` в теле создаёт новый массив
     на каждый рендер и попадает в зависимости useMemo ниже. */
  const menuQuery = useMenuItems();
  const { data: allMenu = [] } = menuQuery;
  const groupsQuery = useMyGroups();
  const { data: myGroups = [] } = groupsQuery;

  /* ---- бюджет и закупки ---- */
  const debtsQuery = useDebts();
  const { data: debts = [] } = debtsQuery;
  const creditsQuery = useCredits();
  const { data: credits = [] } = creditsQuery;
  const markPaid = useMarkPaid();
  const runsQuery = useActiveStoreRuns();
  const { data: activeRuns = [] } = runsQuery;

  /* ---- барьер первого экрана ----

     Запись с телефона показала четыре отдельных проявления за 280ms: заголовок,
     приветствие с карточкой «Сейчас», талон рывком, и уже внутри «Сейчас» —
     строка победителя. Каждое было честным ответом своего запроса, но человек
     видит не запросы, а как экран собирается четырьмя толчками.

     «Приехало» — это isSuccess или isError, а не наличие data. Первая редакция
     смотрела на `data !== undefined` и открывала барьер сразу: useActivePoll
     нормализует ответ в `q.data?.[0] ?? null`, то есть отдаёт null вместо
     undefined ещё во время загрузки. Зонд это и показал — приветствие с
     «Сейчас» проступали за 130ms до талона.

     isLoading здесь тоже не годится: у цепочки «последний опрос → его
     результат» есть кадр, где ни один запрос не помечен загружающимся, и барьер
     открылся бы в него. Ошибка считается ответом — экран, ждущий упавший
     запрос, не откроется никогда. Отключённый запрос не «приехал», поэтому
     ожидаемость зависимых спрашиваем отдельно (winnerExpected, deepLinkPollId),
     а от вечного ожидания страхует потолок ниже. */
  const arrived = (q: { isSuccess: boolean; isError: boolean }) => q.isSuccess || q.isError;
  const pollArrived = deepLinkPollId ? arrived(deepLinkQuery) : arrived(activeQuery);
  const winnerExpected = winnerIsFresh && !!lastCompletedPoll?.id;
  const firstScreenReady =
    !authLoading &&
    pollArrived &&
    arrived(lastCompletedQuery) &&
    (!winnerExpected || arrived(resultsQuery)) &&
    arrived(menuQuery) &&
    arrived(groupsQuery) &&
    arrived(debtsQuery) &&
    arrived(creditsQuery) &&
    arrived(runsQuery);

  /* Предохранитель: барьер без потолка — это риск вечного скелета. Достаточно
     одного запроса, выключенного по причине, которой мы здесь не знаем (нет
     группы, чужой сценарий), чтобы экран не открылся никогда. */
  const [capReached, setCapReached] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setCapReached(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);
  const revealed = firstScreenReady || capReached;

  /* Окно молчания короче общего: 100ms вместо 180. Причина из записи: ответ
     приходит ~330ms после монтирования, и при 180ms скелет не успевал
     появиться — на месте контента была пустота, а потом он вставал рывком.
     Ожидание длиннее трёх кадров надо объяснять, а не прятать. Мелькнуть
     скелет не может — минимальное время жизни у него своё. */
  const showFirstScreenSkeleton = useDelayedLoading(!revealed, 100);
  const createStoreRun = useCreateStoreRun();

  /* ---- локальный UI-state ---- */
  const [createOpen, setCreateOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [sheetGroupId, setSheetGroupId] = useState<string | null>(null);
  const createPollMutation = useCreatePoll();
  const createRecurringMutation = useCreateRecurringPoll();
  const updateRecurringMutation = useUpdateRecurringPoll();
  const deleteRecurringMutation = useDeleteRecurringPoll();

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
  /* «Ждём админа» и «бота вообще нет в чате» — разные тупики: во втором
     ждать бессмысленно, и раньше пустой талон говорил новичку неправду. */
  const hasGroup = myGroups.length > 0 || !!currentGroupId;
  const effectiveSheetGroupId = sheetGroupId ?? currentGroupId;
  const { data: sheetMenu = [] } = useMenuItems({ activeOnly: true, groupId: effectiveSheetGroupId });
  // Расписание запрашиваем для группы, выбранной в шторке: иначе правили бы чужое.
  const { data: recurringSchedule } = useRecurringSchedule(
    effectiveSheetGroupId ? Number(effectiveSheetGroupId) : null,
  );
  const scheduleHint = formatScheduleHint(recurringSchedule);
  const sheetSchedule = useMemo<SheetSchedule | null>(() => {
    if (!recurringSchedule) return null;
    return {
      id: recurringSchedule.id,
      isEnabled: recurringSchedule.isEnabled,
      days: daysToLabels(parseDaysOfWeek(recurringSchedule.daysOfWeek)),
      time: recurringSchedule.timeOfDay,
      durationKey: durationKeyOf(recurringSchedule.duration),
      itemIds: parseNumberArray(recurringSchedule.selectedMenuItemIds).map(String),
    };
  }, [recurringSchedule]);

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
        const daysOfWeek = labelsToDays(form.recurringDays);
        if (daysOfWeek.length === 0) throw new Error('Выберите хотя бы один день недели');
        // «Кастомную» длительность чипы не хранят — при правке сохраняем исходную,
        // иначе расписание на 90 минут молча стало бы 30-минутным.
        const scheduleDuration =
          form.duration === 'custom' && recurringSchedule?.duration
            ? recurringSchedule.duration
            : duration;
        const payload = {
          groupId: Number(groupId),
          daysOfWeek,
          timeOfDay: form.recurringTime,
          duration: scheduleDuration,
          selectedMenuItemIds: selectedMenuItems.length ? selectedMenuItems : null,
        };
        if (recurringSchedule) {
          // Сохранение = «хочу, чтобы работало»: выключенное расписание включаем.
          await updateRecurringMutation.mutateAsync({
            id: recurringSchedule.id,
            input: { ...payload, isEnabled: true },
          });
        } else {
          await createRecurringMutation.mutateAsync(payload);
        }
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

  const handleDeleteSchedule = async () => {
    if (!recurringSchedule) return;
    try {
      await deleteRecurringMutation.mutateAsync({
        id: recurringSchedule.id,
        groupId: recurringSchedule.groupId,
      });
      setCreateOpen(false);
    } catch {
      // сообщение уже показал хук
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

  /* Служебные состояния голосования локальны для талона: закупки и бюджет
     живут в собственных запросах и обычно уже в кеше — терять их из-за
     моргнувшей сети на опросе значит прятать горящий долг. */
  const ticketSlot = (() => {
    /* Достижимо только через предохранитель барьера: обычная загрузка до
       раскрытия экрана не доходит. */
    if (authLoading || pollLoading) {
      if (!showFirstScreenSkeleton) return null;
      return (
        <div className={`${styles.group} ${styles.ticketPad}`}>
          <Skeleton variant="text" width="40%" height={10} />
          <div className={styles.skeletonGap} />
          {/* 154px даёт скелету ровно ту же высоту, что у пустого талона (208
              с паддингами): смена скелета на данные проходит без сдвига. */}
          <Skeleton variant="block" height={154} />
        </div>
      );
    }
    if (error) {
      return (
        <ErrorState
          kind="network"
          onRetry={() => qc.invalidateQueries({ queryKey: queryKeys.polls.active })}
        />
      );
    }
    if (activePoll && endsAt) {
      return (
        <LunchTicket
          title={(activePoll as { title?: string }).title || 'Что заказываем на обед?'}
          options={options}
          totalVotes={participants}
          endsAt={endsAt}
          onExpire={onPollExpire}
          myChoiceId={myChoiceId}
          voting={voteMutation.isPending || withdrawMutation.isPending}
          onVote={(menuItemId) => {
            if (!voteMutation.isPending) {
              voteMutation.mutate({ pollId: activePoll.id, menuItemId });
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
      );
    }
    return (
      <EmptyTicket
        canCreate={canCreate}
        hasGroup={hasGroup}
        onCreate={onCreatePollAction}
        scheduleHint={scheduleHint}
      />
    );
  })();

  const winner = winnerVM ? (
    <WinnerRow
      winnerName={winnerVM.winnerName}
      winnerVotes={winnerVM.winnerVotes}
      totalVotes={winnerVM.totalVotes}
      responsibleName={winnerVM.responsibleName}
      onOpen={() => navigate(`/poll/${winnerVM.pollId}/results`)}
    />
  ) : null;

  /* Один скелет вместо четырёх проявлений подряд. Высоты — реальные (208px под
     талон, 140 под «Сейчас»), поэтому раскрытие ничего не сдвигает: меняется
     только содержимое уже занятых мест. */
  if (!revealed) {
    return (
      <div className={`rl ${styles.screen}`}>
        <Greeting name={user?.firstName} loading />

        <div className={styles.ticketSlot}>
          {showFirstScreenSkeleton && (
            <div className={`${styles.group} ${styles.ticketPad}`}>
              <Skeleton variant="text" width="40%" height={10} />
              <div className={styles.skeletonGap} />
              <Skeleton variant="block" height={154} />
            </div>
          )}
        </div>

        <div className={styles.nowSlot}>
          {showFirstScreenSkeleton && (
            <div className={`${styles.group} ${styles.ticketPad}`}>
              <Skeleton variant="text" width="30%" height={10} />
              <div className={styles.skeletonGap} />
              <Skeleton variant="block" height={56} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rl ${styles.screen}`}>
      <Greeting name={user?.firstName} loading={authLoading} />

      {/* Обёртка держит место под талон (styles.ticketSlot): без неё приход
          данных сдвигал всё ниже на треть экрана. */}
      <div className={styles.ticketSlot}>{ticketSlot}</div>

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
        submitting={
          createPollMutation.isPending ||
          createRecurringMutation.isPending ||
          updateRecurringMutation.isPending
        }
        schedule={sheetSchedule}
        deletingSchedule={deleteRecurringMutation.isPending}
        onDeleteSchedule={handleDeleteSchedule}
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
