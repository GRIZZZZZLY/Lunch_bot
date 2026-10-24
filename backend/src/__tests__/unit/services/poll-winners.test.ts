/**
 * Подсчёт победителей голосования — чистая функция, проверяемая без БД.
 * Завершение через API (итог записан один раз, повтор отдаёт тот же итог)
 * проверяется в integration/api/polls-lifecycle.redis.test.ts.
 *
 * Правила, которые закреплены здесь: порядок по числу голосов, `minVotes`
 * отсекает, `maxWinners` ограничивает, при равенстве голосов выигрывает либо
 * тот, за кого проголосовали раньше, либо первый по алфавиту (русская
 * сортировка), а «принесу своё», «пропускаю» и голос за удалённое блюдо
 * победителями не бывают.
 */
import { buildMultiWinnerResult, type WinnerVote } from '../../../services/poll-winners';

const NOW = new Date('2026-08-23T12:00:00.000Z');

/** Голос за блюдо в той форме, в которой его отдаёт Prisma. */
function vote(over: Partial<WinnerVote> & { menuItemId?: number }): WinnerVote {
  return {
    userId: 1,
    voteType: 'MENU_ITEM',
    menuItemId: 10,
    createdAt: NOW,
    menuItem: { name: 'Плов', price: null, imageUrl: null },
    user: { id: 1, firstName: 'Иван', lastName: null, username: null },
    ...over,
  };
}

const dish = (name: string) => ({ name, price: null, imageUrl: null });

function build(
  votes: WinnerVote[],
  options: {
    minVotes?: number;
    maxWinners?: number | null;
    tieBreakMethod?: 'earliest' | 'alphabetical';
  } = {}
) {
  return buildMultiWinnerResult(votes, {
    minVotes: options.minVotes ?? 1,
    maxWinners: options.maxWinners ?? null,
    tieBreakMethod: options.tieBreakMethod ?? 'earliest',
    completedBy: 7,
    completedAt: NOW,
  });
}

describe('победители', () => {
  it('каждое блюдо с голосами становится победителем, порядок — по числу голосов', () => {
    const { resultData, primaryWinnerId } = build([
      vote({ menuItemId: 1, userId: 1 }),
      vote({ menuItemId: 2, userId: 2, menuItem: dish('Шурпа') }),
      vote({ menuItemId: 2, userId: 3, menuItem: dish('Шурпа') }),
    ]);

    expect(resultData.winners.map(w => [w.menuItemId, w.voteCount])).toEqual([
      [2, 2],
      [1, 1],
    ]);
    expect(primaryWinnerId).toBe(2);
  });

  it('minVotes отсекает блюда с одним случайным голосом', () => {
    const { resultData } = build(
      [
        vote({ menuItemId: 1, userId: 1 }),
        vote({ menuItemId: 2, userId: 2, menuItem: dish('Шурпа') }),
        vote({ menuItemId: 2, userId: 3, menuItem: dish('Шурпа') }),
      ],
      { minVotes: 2 }
    );

    expect(resultData.winners.map(w => w.menuItemId)).toEqual([2]);
  });

  it('maxWinners ограничивает список', () => {
    const { resultData } = build(
      [
        vote({ menuItemId: 1, userId: 1 }),
        vote({ menuItemId: 2, userId: 2, menuItem: dish('Шурпа') }),
        vote({ menuItemId: 3, userId: 3, menuItem: dish('Лагман') }),
      ],
      { maxWinners: 2 }
    );

    expect(resultData.winners).toHaveLength(2);
  });

  /* Голос за блюдо, у которого нет самого блюда (удалено из меню), выпадает из
     подсчёта: победителем не может быть запись без названия. */
  it('«принесу своё», «пропускаю» и голос за удалённое блюдо победителями не становятся', () => {
    const { resultData } = build([
      vote({ menuItemId: 1, userId: 1 }),
      vote({ menuItemId: 5, userId: 4, menuItem: null }),
      vote({
        voteType: 'BRING_OWN',
        menuItemId: null as never,
        userId: 2,
        menuItem: null,
        user: { id: 2, firstName: 'Пётр', lastName: null, username: null },
      }),
      vote({
        voteType: 'SKIP',
        menuItemId: null as never,
        userId: 3,
        menuItem: null,
        user: { id: 3, firstName: 'Анна', lastName: null, username: null },
      }),
    ]);

    expect(resultData.winners.map(w => w.menuItemId)).toEqual([1]);
    expect(resultData.bringOwn).toMatchObject({ count: 1, voterIds: [2] });
    expect(resultData.skipped).toMatchObject({ count: 1, voterIds: [3] });
  });
});

describe('тай-брейк', () => {
  it('при равенстве по умолчанию выигрывает тот, за кого проголосовали раньше', () => {
    const { primaryWinnerId } = build([
      vote({ menuItemId: 1, userId: 1, createdAt: new Date('2026-08-23T11:30:00.000Z') }),
      vote({
        menuItemId: 2,
        userId: 2,
        createdAt: new Date('2026-08-23T11:00:00.000Z'),
        menuItem: dish('Шурпа'),
      }),
    ]);

    expect(primaryWinnerId).toBe(2);
  });

  it('алфавитный тай-брейк учитывает русскую сортировку', () => {
    const { primaryWinnerId } = build(
      [
        vote({ menuItemId: 1, userId: 1, menuItem: dish('Ёжик в тумане') }),
        vote({ menuItemId: 2, userId: 2, menuItem: dish('Ежевика') }),
      ],
      { tieBreakMethod: 'alphabetical' }
    );

    // 'Ежевика' < 'Ёжик' по русской раскладке; побайтовое сравнение дало бы наоборот.
    expect(primaryWinnerId).toBe(2);
  });
});
