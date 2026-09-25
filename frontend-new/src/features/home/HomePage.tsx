/* Главная (Phase 4, система C): талон голосования с живым таймером,
   секция «Сейчас» (победитель, закупки, бюджет-строка), шторки создания.
   Поведение сохранено: deep link, SSE, голос/отзыв, complete/cancel,
   разовые и recurring опросы (одиночный выбор — Q1), создание закупки.
   FAB удалён: «Запустить голосование» — CTA талона, «Новая закупка» —
   кнопка секции «Сейчас», «Предложить блюдо» — в Меню и Профиле. */
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LaunchAction } from '@/app/useLaunchLinkRoute';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { CreatePollSheet } from '@/components/admin/CreatePollSheet';
import type { CreatePollFormState } from '@/components/admin/types';
import { CreateStoreRunSheet } from '@/features/store-run/components/CreateStoreRunSheet';
import { ManageStoreSheet } from '@/features/store-run/components/ManageStoreSheet';
import { useAppStore } from '@/store/useAppStore';
import { useGreetingHeader } from './hooks/useGreetingHeader';
import { TicketSlot } from './components/TicketSlot';
import { FirstScreenSkeleton } from './components/FirstScreenSkeleton';
import { WinnerRow } from './components/WinnerRow';
import { NowSection } from './components/NowSection';
import { useHomeFirstScreen } from './hooks/useHomeFirstScreen';
import { useHomeSheets } from './hooks/useHomeSheets';
import { useHomePoll } from './hooks/useHomePoll';
import { useHomeBudget } from './hooks/useHomeBudget';
import { useHomeStoreRun } from './hooks/useHomeStoreRun';
import { useHomeCreatePoll } from './hooks/useHomeCreatePoll';
import { winnerRowVM } from './lib/selectors';
import styles from './HomePage.module.css';

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  useGreetingHeader(user?.firstName, authLoading);
  const toast = useToast();
  const currentGroupId = useAppStore((s) => s.currentGroupId);

  /* ---- сценарий голосования ----
     Deep link, свои голоса, живые обновления и четыре мутации живут в
     `hooks/useHomePoll` — они связаны одним значением `activePoll`, и держать
     их вперемешку с бюджетом значило бы, что правка одного сценария цепляет
     остальные (шесть багфиксов этого файла — про это). */
  const poll = useHomePoll();
  const {
    activePoll,
    pollLoading,
    error,
    myChoiceId,
    lastCompletedPoll,
    lastPollResult,
    winnerIsFresh,
    voteMutation,
    withdrawMutation,
    completePoll,
    cancelPoll,
    onPollExpire,
    retryActivePoll,
  } = poll;

  /* ---- создание голосования: разовое и по расписанию ---- */
  const create = useHomeCreatePoll();
  const { allMenu, canCreate, hasGroup, scheduleHint } = create;

  /* ---- деньги и закупки: два независимых от голосования сценария ---- */
  const { budget, queries: budgetQueries } = useHomeBudget();
  const {
    activeRuns,
    createStoreRun,
    createRun,
    stores,
    managedStore,
    setManagedStore,
    renameManagedStore,
    archiveManagedStore,
    storeBusy,
    queries: runQueries,
  } = useHomeStoreRun();

  /* ---- барьер первого экрана ----
     Состав ожидаемого — в `useHomeFirstScreen`, само правило и его история —
     в `useFirstScreenBarrier`. Экран открывается целиком или не открывается. */
  const { revealed, waitedForData, showSkeleton } = useHomeFirstScreen({
    authLoading,
    deepLinkPollId: poll.deepLinkPollId,
    ...poll.queries,
    winnerExpected: winnerIsFresh && !!lastCompletedPoll?.id,
    ...create.queries,
    ...budgetQueries,
    ...runQueries,
  });

  const sheets = useHomeSheets();

  const winnerVM = useMemo(
    () => winnerRowVM(lastCompletedPoll, lastPollResult, allMenu, winnerIsFresh),
    [lastCompletedPoll, lastPollResult, allMenu, winnerIsFresh],
  );

  const onCreatePollAction = () => {
    if (!canCreate) {
      toast.error('Создавать голосование может только администратор группы');
      return;
    }
    sheets.openPoll();
  };

  /* «Создать голосование» из чата группы: шторка открывается сама, когда
     экран открылся и права известны. Состояние навигации гасится сразу, иначе
     возврат на главную открывал бы шторку снова. Без массива зависимостей:
     обработчик пересоздаётся на каждом рендере, а после гашения эффект пуст. */
  const launchAction = (location.state as { launchAction?: LaunchAction } | null)?.launchAction;
  useEffect(() => {
    if (!revealed || launchAction !== 'createPoll') return;
    navigate(location.pathname, { replace: true, state: null });
    onCreatePollAction();
  });

  const winner = winnerVM ? (
    <WinnerRow
      winnerName={winnerVM.winnerName}
      winnerVotes={winnerVM.winnerVotes}
      totalVotes={winnerVM.totalVotes}
      responsibleName={winnerVM.responsibleName}
      onOpen={() => navigate(`/poll/${winnerVM.pollId}/results`)}
    />
  ) : null;

  if (!revealed) {
    return <FirstScreenSkeleton visible={showSkeleton} />;
  }

  return (
    <div className={`rl ${styles.screen}${waitedForData ? ' anim-cascade' : ''}`}>
      {/* Обёртка держит место под талон (styles.ticketSlot): без неё приход
          данных сдвигал всё ниже на треть экрана. */}
      <div className={styles.ticketSlot}>
        <TicketSlot
          activePoll={activePoll}
          allMenu={allMenu}
          myChoiceId={myChoiceId}
          loading={authLoading || pollLoading}
          showSkeleton={showSkeleton}
          error={error}
          canCreate={canCreate}
          hasGroup={hasGroup}
          scheduleHint={scheduleHint}
          voteMutation={voteMutation}
          withdrawMutation={withdrawMutation}
          completePoll={completePoll}
          cancelPoll={cancelPoll}
          onExpire={onPollExpire}
          onRetry={retryActivePoll}
          onCreate={onCreatePollAction}
        />
      </div>

      <NowSection
        winner={winner}
        runs={activeRuns}
        budget={budget}
        onOpenRun={(id) => navigate(`/store-run/${id}`)}
        onOpenBudget={() => navigate('/budget')}
        onNewRun={sheets.openStoreRun}
      />

      <CreatePollSheet
        open={sheets.pollOpen}
        ctx={create.createPollCtx}
        initial={currentGroupId ? { groupId: currentGroupId } : undefined}
        submitting={create.submitting}
        schedule={create.sheetSchedule}
        deletingSchedule={create.deletingSchedule}
        onDeleteSchedule={() => sheets.afterPollAction(create.deleteSchedule)}
        onClose={() => {
          sheets.closePoll();
          create.setSheetGroupId(null);
        }}
        onSubmit={(form: CreatePollFormState) =>
          sheets.afterPollAction(() => create.submit(form))
        }
        onGroupChange={create.setSheetGroupId}
      />
      <CreateStoreRunSheet
        open={sheets.storeRunOpen}
        busy={createStoreRun.isPending}
        stores={stores}
        onClose={sheets.closeStoreRun}
        onSubmit={(input) => sheets.afterStoreRunAction(() => createRun(input))}
        onManageStore={setManagedStore}
      />
      {managedStore && (
        <ManageStoreSheet
          store={managedStore}
          busy={storeBusy}
          onClose={() => setManagedStore(null)}
          onRename={renameManagedStore}
          onArchive={archiveManagedStore}
        />
      )}
    </div>
  );
}
