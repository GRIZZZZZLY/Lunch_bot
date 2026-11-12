/**
 * Что стоит на месте талона: скелет, ошибка, сам талон или приглашение создать
 * голосование.
 *
 * Выбор одного из четырёх состояний жил самовызывающейся функцией в теле
 * `HomePage` (задача 12). Здесь же считается view-model талона — варианты,
 * число голосов и время окончания: они нужны только этому месту.
 *
 * Служебные состояния голосования локальны для талона: закупки и бюджет живут в
 * собственных запросах и обычно уже в кеше — терять их из-за моргнувшей сети на
 * опросе значит прятать горящий долг.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { mapPollToOptions, totalVotes } from '@/lib/pollMappers';
import type { MenuItem, Poll } from '@/types/models';
import { ErrorState, Skeleton } from '@/shared/ui';
import { EmptyTicket } from './EmptyTicket';
import { LunchTicket } from './LunchTicket';
import { pollEndsAt } from '../lib/selectors';
import type { PollOptionVM } from '../lib/types';
import styles from '../HomePage.module.css';

interface MutationLike {
  isPending: boolean;
}

/* Длительность отрыва совпадает с keyframes tearTop/tearStub в
   HomePage.module.css: талон остаётся смонтированным ровно на время анимации. */
const TEAR_MS = 460;

function noop() {}

interface TicketSlotProps {
  /* Тип целиком, а не выборка полей: талон читает `title`, которого в `Poll`
     нет — API отдаёт его сверх схемы, и приведение живёт здесь, в одном месте. */
  activePoll: (Poll & { title?: string }) | null;
  allMenu: MenuItem[];
  myChoiceId: number | null;
  loading: boolean;
  showSkeleton: boolean;
  error: unknown;
  canCreate: boolean;
  hasGroup: boolean;
  scheduleHint: string | null;
  voteMutation: MutationLike & { mutate: (v: { pollId: number; menuItemId: number }) => void };
  withdrawMutation: MutationLike & { mutate: (pollId: number) => void };
  completePoll: MutationLike & { mutate: (pollId: number) => void };
  cancelPoll: MutationLike & { mutate: (v: { pollId: number }) => void };
  onExpire: () => void;
  onRetry: () => void;
  onCreate: () => void;
  /** Отрыв доиграл, и на месте талона сейчас встанет пустой. Состояние отрыва
      живёт здесь, и без этого сигнала FlipGroup Главной не увидел бы смену:
      место талона сжималось бы кадром, а «Сейчас» прыгало вверх. */
  onTearEnd?: () => void;
}

export function TicketSlot({
  activePoll,
  allMenu,
  myChoiceId,
  loading,
  showSkeleton,
  error,
  canCreate,
  hasGroup,
  scheduleHint,
  voteMutation,
  withdrawMutation,
  completePoll,
  cancelPoll,
  onExpire,
  onRetry,
  onCreate,
  onTearEnd,
}: TicketSlotProps) {
  const options: PollOptionVM[] = useMemo(
    () =>
      mapPollToOptions(activePoll, allMenu).map((o) => ({
        id: Number(o.id),
        name: o.name,
        votes: o.votes,
      })),
    [activePoll, allMenu],
  );
  const endsAt = activePoll ? pollEndsAt(activePoll) : null;

  /* ---- отрыв талона ----
     Талон гасится, когда голосование закрылось: он держится ещё TEAR_MS после
     того, как `activePoll` стал null, и уходит по перфорации. Отмена сюда не
     попадает — там ничего не решили, и рвать нечего: флаг ставит обработчик
     `onCancel` ниже. Reduced-motion проверяем в JS, а не только в CSS: при
     выключенной анимации талон не должен висеть лишние полсекунды.

     Слепок и сам флаг обновляются в рендере, а не в эффекте: эффект отработал
     бы кадром позже, талон к этому моменту уже сменился бы пустым состоянием, и
     отрыв играл бы на заново смонтированной карточке — с миганием. */
  const pollId = activePoll?.id ?? null;
  const live = useMemo(
    () =>
      activePoll && endsAt
        ? {
            title: activePoll.title || 'Что заказываем на обед?',
            options,
            votes: totalVotes(activePoll),
            endsAt,
            myChoiceId,
          }
        : null,
    [activePoll, endsAt, options, myChoiceId],
  );

  const [reduceMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  const [frozen, setFrozen] = useState(live);
  const [prevPollId, setPrevPollId] = useState<number | null>(pollId);
  const [cancelling, setCancelling] = useState(false);
  const [tearing, setTearing] = useState(false);
  /* Голосование сменилось при открытом экране: новый талон или пустой на месте
     ушедшего — событие, и оно проявляется (.anim-in). Талон, который был на
     месте при открытии экрана, не проявляется: это не событие. */
  const [arrived, setArrived] = useState(false);

  if (live && live !== frozen) setFrozen(live);
  if (pollId !== prevPollId) {
    setPrevPollId(pollId);
    setArrived(true);
    if (cancelling) {
      setCancelling(false);
    } else if (prevPollId != null && pollId == null && !reduceMotion) {
      setTearing(true);
    }
  }

  useEffect(() => {
    if (!tearing) return;
    const t = setTimeout(() => {
      setTearing(false);
      onTearEnd?.();
    }, TEAR_MS);
    return () => clearTimeout(t);
  }, [tearing, onTearEnd]);

  /* key по голосованию: каждая смена монтирует карточку заново, и .anim-in
     играет на каждой, а не на первой. */
  const settle = (card: ReactNode) => (
    <div key={pollId ?? 'empty'} className={arrived ? 'anim-in' : undefined}>
      {card}
    </div>
  );

  /* Раньше проверок загрузки и ошибки: рефетч после закрытия голосования не
     должен подменять уходящий талон скелетом. Обработчики пустые — карточка на
     это время не принимает касания (.tearing), а голосовать уже не в чем. */
  if (tearing && !activePoll && frozen) {
    return (
      <LunchTicket
        title={frozen.title}
        options={frozen.options}
        totalVotes={frozen.votes}
        endsAt={frozen.endsAt}
        myChoiceId={frozen.myChoiceId}
        voting={false}
        onVote={noop}
        onWithdraw={noop}
        isAdmin={canCreate}
        mutating={false}
        onCloseEarly={noop}
        onCancel={noop}
        tearing
      />
    );
  }

  /* Достижимо только через предохранитель барьера: обычная загрузка до
     раскрытия экрана не доходит. */
  if (loading) {
    if (!showSkeleton) return null;
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
    return <ErrorState kind="network" onRetry={onRetry} />;
  }

  if (activePoll && endsAt) {
    return settle(
      <LunchTicket
        title={activePoll.title || 'Что заказываем на обед?'}
        options={options}
        totalVotes={totalVotes(activePoll)}
        endsAt={endsAt}
        onExpire={onExpire}
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
        onCancel={() => {
          /* Отменённое голосование не рвут: талон просто исчезает. */
          setCancelling(true);
          cancelPoll.mutate({ pollId: activePoll.id });
        }}
      />,
    );
  }

  return settle(
    <EmptyTicket
      canCreate={canCreate}
      hasGroup={hasGroup}
      onCreate={onCreate}
      scheduleHint={scheduleHint}
    />,
  );
}
