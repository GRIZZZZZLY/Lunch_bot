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
import { useMemo } from 'react';

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
    return (
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
        onCancel={() => cancelPoll.mutate({ pollId: activePoll.id })}
      />
    );
  }

  return (
    <EmptyTicket
      canCreate={canCreate}
      hasGroup={hasGroup}
      onCreate={onCreate}
      scheduleHint={scheduleHint}
    />
  );
}
