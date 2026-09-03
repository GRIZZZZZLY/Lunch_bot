/* Главная (Phase 4, система C): талон голосования с живым таймером,
   секция «Сейчас» (победитель, закупки, бюджет-строка), шторки создания.
   Поведение сохранено: deep link, SSE, голос/отзыв, complete/cancel,
   разовые и recurring опросы (одиночный выбор — Q1), создание закупки.
   FAB удалён: «Запустить голосование» — CTA талона, «Новая закупка» —
   кнопка секции «Сейчас», «Предложить блюдо» — в Меню и Профиле. */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { CreatePollSheet } from '@/components/admin/CreatePollSheet';
import type { CreatePollFormState } from '@/components/admin/types';
import { CreateStoreRunSheet } from '@/features/store-run/components/CreateStoreRunSheet';
import { ManageStoreSheet } from '@/features/store-run/components/ManageStoreSheet';
import { useAppStore } from '@/store/useAppStore';
import { Greeting } from './components/Greeting';
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
  const { user, isLoading: authLoading } = useAuth();
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
  const { budget, markPaid, queries: budgetQueries } = useHomeBudget();
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
    return <FirstScreenSkeleton name={user?.firstName} visible={showSkeleton} />;
  }

  return (
    <div className={`rl ${styles.screen}${waitedForData ? ' anim-cascade' : ''}`}>
      <Greeting name={user?.firstName} loading={authLoading} />

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
        paying={markPaid.isPending}
        onOpenRun={(id) => navigate(`/store-run/${id}`)}
        onMarkPaid={(txId) => {
          if (!markPaid.isPending) markPaid.mutate(txId);
        }}
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
