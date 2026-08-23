/**
 * Кто победил в голосовании — арифметика без БД.
 *
 * Эти 130 строк жили внутри `completePollMultiWinner` (311 строк), между
 * чтением голосования и транзакцией. Разделение не косметическое: подсчёт
 * победителей — единственная часть завершения, у которой есть правила
 * (`minVotes`, `maxWinners`, тай-брейк) и, значит, есть что проверять. Пока она
 * была вперемешку с транзакцией, проверить тай-брейк можно было только через
 * мок Prisma — читая аргументы `pollResult.create`.
 *
 * Функция чистая: на вход голоса, на выход данные результата. Ни `prisma`, ни
 * `logger`, ни времени «сейчас» — момент завершения передаётся параметром,
 * иначе тест зависел бы от часов.
 */
import { toNumber } from '../utils/decimal';
import { getTimestamp, toISOString } from '../utils/date';

/** Голос в том виде, в котором его отдаёт Prisma с включёнными связями. */
export interface WinnerVote {
  userId: number;
  voteType: string;
  menuItemId: number | null;
  createdAt: Date;
  menuItem: {
    name: string;
    price: unknown;
    imageUrl: string | null;
  } | null;
  user: {
    id: number;
    firstName: string;
    lastName: string | null;
    username: string | null;
  };
}

export interface WinnerVoter {
  userId: number;
  firstName: string;
  lastName?: string;
  username?: string;
}

export interface Winner {
  menuItemId: number;
  menuItemName: string;
  menuItemSnapshot: { price?: number; imageUrl?: string };
  voterIds: number[];
  voters: WinnerVoter[];
  voteCount: number;
  votedAt: string[];
}

export interface VoterGroup {
  voterIds: number[];
  voters: WinnerVoter[];
  count: number;
}

export interface TieBreak {
  method: string;
  appliedTo: number[];
  reason: string;
}

export interface MultiWinnerResultData {
  version: 1;
  mode: 'multi-winner';
  winners: Winner[];
  bringOwn: VoterGroup;
  skipped: VoterGroup;
  meta: {
    primaryWinnerId: number | null;
    tieBreak?: TieBreak;
    completedAt: string;
    completedBy: number;
    params: { minVotes: number; maxWinners: number | null };
  };
}

export interface WinnerOptions {
  minVotes: number;
  maxWinners: number | null;
  tieBreakMethod: 'earliest' | 'alphabetical';
  completedBy: number;
  /** Момент завершения. Параметр, а не `new Date()`: иначе тест зависит от часов. */
  completedAt: Date;
}

function toVoter(vote: WinnerVote): WinnerVoter {
  return {
    userId: vote.user.id,
    firstName: vote.user.firstName,
    lastName: vote.user.lastName ?? undefined,
    username: vote.user.username ?? undefined,
  };
}

function toGroup(votes: WinnerVote[]): VoterGroup {
  return {
    voterIds: votes.map(vote => vote.userId),
    voters: votes.map(toVoter),
    count: votes.length,
  };
}

/**
 * Разложить голоса по типу.
 *
 * Голос за блюдо, у которого блюда уже нет (удалено из меню), не попадает
 * никуда — победителем не может быть запись без названия.
 */
function groupVotesByType(votes: WinnerVote[]): {
  byMenuItem: Map<number, WinnerVote[]>;
  bringOwn: WinnerVote[];
  skipped: WinnerVote[];
} {
  const byMenuItem = new Map<number, WinnerVote[]>();
  const bringOwn: WinnerVote[] = [];
  const skipped: WinnerVote[] = [];

  for (const vote of votes) {
    if (vote.voteType === 'MENU_ITEM' && vote.menuItemId && vote.menuItem) {
      const forItem = byMenuItem.get(vote.menuItemId) ?? [];
      forItem.push(vote);
      byMenuItem.set(vote.menuItemId, forItem);
    } else if (vote.voteType === 'BRING_OWN') {
      bringOwn.push(vote);
    } else if (vote.voteType === 'SKIP') {
      skipped.push(vote);
    }
  }

  return { byMenuItem, bringOwn, skipped };
}

/** Победители, отсортированные по числу голосов, с фильтром и ограничением. */
function buildWinners(
  byMenuItem: Map<number, WinnerVote[]>,
  minVotes: number,
  maxWinners: number | null
): Winner[] {
  const winners = Array.from(byMenuItem.entries())
    .filter(([, votes]) => votes.length >= minVotes)
    .map(([menuItemId, votes]) => {
      const menuItem = votes[0].menuItem!;

      return {
        menuItemId,
        menuItemName: menuItem.name,
        menuItemSnapshot: {
          price: menuItem.price ? toNumber(menuItem.price as never) : undefined,
          imageUrl: menuItem.imageUrl ?? undefined,
        },
        voterIds: votes.map(vote => vote.userId),
        voters: votes.map(toVoter),
        voteCount: votes.length,
        votedAt: votes.map(vote => toISOString(vote.createdAt)),
      };
    })
    .sort((a, b) => b.voteCount - a.voteCount);

  return maxWinners && maxWinners > 0 ? winners.slice(0, maxWinners) : winners;
}

/**
 * Главный победитель: при равенстве голосов правило выбирается вызывающим.
 *
 * Без тай-брейка победителя определял порядок строк из БД, то есть случай.
 * Алфавитный вариант сравнивает через `localeCompare(…, 'ru')`: побайтовое
 * сравнение ставит «Ёжик» перед «Ежевикой».
 */
function resolvePrimaryWinner(
  winners: Winner[],
  method: 'earliest' | 'alphabetical'
): { primaryWinnerId: number | null; tieBreak?: TieBreak } {
  if (winners.length === 0) return { primaryWinnerId: null };

  const maxVotes = winners[0].voteCount;
  const top = winners.filter(winner => winner.voteCount === maxVotes);

  if (top.length === 1) {
    return { primaryWinnerId: top[0].menuItemId };
  }

  const primary =
    method === 'alphabetical'
      ? [...top].sort((a, b) =>
          a.menuItemName.localeCompare(b.menuItemName, 'ru')
        )[0]
      : top.reduce((prev, curr) =>
          getTimestamp(new Date(curr.votedAt[0])) <
          getTimestamp(new Date(prev.votedAt[0]))
            ? curr
            : prev
        );

  return {
    primaryWinnerId: primary.menuItemId,
    tieBreak: {
      method,
      appliedTo: top.map(winner => winner.menuItemId),
      reason: `${top.length} блюд с ${maxVotes} голосами`,
    },
  };
}

/**
 * Итоги голосования в форме, которая уходит в `poll_results.rouletteData`.
 *
 * Возвращает и `primaryWinnerId` отдельно: он же пишется в
 * `poll_results.winnerMenuItemId`, и дублировать его разбором JSON на стороне
 * вызывающего незачем.
 */
export function buildMultiWinnerResult(
  votes: WinnerVote[],
  options: WinnerOptions
): {
  resultData: MultiWinnerResultData;
  primaryWinnerId: number | null;
  tieBreak?: TieBreak;
} {
  const { byMenuItem, bringOwn, skipped } = groupVotesByType(votes);
  const winners = buildWinners(byMenuItem, options.minVotes, options.maxWinners);
  const { primaryWinnerId, tieBreak } = resolvePrimaryWinner(
    winners,
    options.tieBreakMethod
  );

  return {
    primaryWinnerId,
    tieBreak,
    resultData: {
      version: 1,
      mode: 'multi-winner',
      winners,
      bringOwn: toGroup(bringOwn),
      skipped: toGroup(skipped),
      meta: {
        primaryWinnerId,
        tieBreak,
        completedAt: toISOString(options.completedAt),
        completedBy: options.completedBy,
        params: {
          minVotes: options.minVotes,
          maxWinners: options.maxWinners,
        },
      },
    },
  };
}
