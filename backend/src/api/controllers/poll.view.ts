/**
 * Форма голосования в ответе API.
 *
 * Это транспорт, а не бизнес-логика, поэтому здесь, а не в сервисе: расчётное
 * время окончания и фильтр голосов по составу голосования нужны КЛИЕНТУ,
 * который рисует экран, и не нужны ни планировщику, ни боту.
 *
 * Обе функции вызываются из двух handler'ов каждая — это и есть причина, по
 * которой они вынесены из контроллера, а не оставлены на месте.
 */
import { logger } from '../../utils/logger';
import { pollEndsAt } from '../../utils/date';

type PollLike = {
  startedAt: Date;
  endedAt: Date | null;
  duration: number;
  selectedMenuItemIds?: string | null;
};

/**
 * Итоги завершения с несколькими победителями.
 *
 * В БД поле хранится то строкой JSON, то уже объектом (Prisma отдаёт Json
 * по-разному в зависимости от того, как записали), поэтому разбор терпим к
 * обоим. Пустое значение — пустой объект, а не `null`: клиент читает
 * `resultData.winners`.
 */
export function parseRouletteData(raw: unknown): { winners?: unknown[] } {
  if (typeof raw === 'string') return JSON.parse(raw);

  return (raw as { winners?: unknown[] }) || {};
}

/** Время окончания: фактическое, а при активном голосовании — расчётное. */
export function withEndTime<T extends PollLike>(poll: T): T & { endTime: string } {
  return { ...poll, endTime: pollEndsAt(poll).toISOString() };
}

/**
 * Оставить голоса только за блюда, которые были в этом голосовании.
 *
 * Состав хранится строкой JSON, и битую строку здесь чинить нечем: отвечать на
 * неё 500-м бессмысленно — голосование читается, просто без фильтра. Поэтому
 * предупреждение в лог и ответ как есть.
 */
export function filterVotesToSelection<
  T extends PollLike & { votes: Array<{ menuItemId: number | null }> },
>(poll: T, pollId: number): T {
  if (!poll.selectedMenuItemIds) return poll;

  try {
    const selectedIds = JSON.parse(poll.selectedMenuItemIds);
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) return poll;

    const selected = new Set(selectedIds);
    const votes = poll.votes.filter(
      vote => vote.menuItemId && selected.has(vote.menuItemId)
    );

    logger.info(`Filtered poll ${pollId} votes`, {
      totalVotes: poll.votes.length,
      filteredVotes: votes.length,
      selectedMenuItemIds: selectedIds,
    });

    return { ...poll, votes };
  } catch (error) {
    logger.warn('Failed to parse selectedMenuItemIds', { pollId, error });
    return poll;
  }
}
