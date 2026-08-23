/**
 * Подсчёт победителей голосования — чистая функция, проверяемая без БД.
 *
 * Раньше это были 130 строк внутри `completePollMultiWinner` (311 строк
 * целиком), между чтением голосования и транзакцией. Чтобы проверить тай-брейк,
 * тесту приходилось поднимать мок Prisma, класть в него голоса с блюдами и
 * пользователями и читать результат из аргументов `pollResult.create` —
 * то есть проверять арифметику через слой БД.
 *
 * Здесь она проверяется как арифметика. Правила, которые закреплены:
 * `minVotes` отсекает, `maxWinners` ограничивает, при равенстве голосов
 * выигрывает либо тот, за кого проголосовали раньше, либо первый по алфавиту
 * (русская сортировка), а «принесу своё» и «пропускаю» победителями не бывают.
 */
import {
  buildMultiWinnerResult,
  type WinnerVote,
} from '../../../services/poll-winners';

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
    const { resultData } = build([
      vote({ menuItemId: 1, userId: 1, menuItem: { name: 'Плов', price: null, imageUrl: null } }),
      vote({ menuItemId: 2, userId: 2, menuItem: { name: 'Шурпа', price: null, imageUrl: null } }),
      vote({ menuItemId: 2, userId: 3, menuItem: { name: 'Шурпа', price: null, imageUrl: null } }),
    ]);

    expect(resultData.winners.map(w => [w.menuItemId, w.voteCount])).toEqual([
      [2, 2],
      [1, 1],
    ]);
  });

  it('в снимок победителя попадают цена и картинка на момент завершения', () => {
    const { resultData } = build([
      vote({
        menuItemId: 1,
        menuItem: { name: 'Плов', price: 450, imageUrl: '/plov.jpg' },
      }),
    ]);

    expect(resultData.winners[0].menuItemSnapshot).toEqual({
      price: 450,
      imageUrl: '/plov.jpg',
    });
  });

  it('minVotes отсекает блюда с одним случайным голосом', () => {
    const { resultData } = build(
      [
        vote({ menuItemId: 1, userId: 1 }),
        vote({ menuItemId: 2, userId: 2, menuItem: { name: 'Шурпа', price: null, imageUrl: null } }),
        vote({ menuItemId: 2, userId: 3, menuItem: { name: 'Шурпа', price: null, imageUrl: null } }),
      ],
      { minVotes: 2 }
    );

    expect(resultData.winners.map(w => w.menuItemId)).toEqual([2]);
  });

  it('maxWinners ограничивает список', () => {
    const { resultData } = build(
      [
        vote({ menuItemId: 1, userId: 1 }),
        vote({ menuItemId: 2, userId: 2, menuItem: { name: 'Шурпа', price: null, imageUrl: null } }),
        vote({ menuItemId: 3, userId: 3, menuItem: { name: 'Лагман', price: null, imageUrl: null } }),
      ],
      { maxWinners: 2 }
    );

    expect(resultData.winners).toHaveLength(2);
  });

  it('голосование без голосов за блюда завершается без победителя', () => {
    const { resultData, primaryWinnerId } = build([]);

    expect(resultData.winners).toEqual([]);
    expect(primaryWinnerId).toBeNull();
    expect(resultData.meta.tieBreak).toBeUndefined();
  });

  it('голоса за одно блюдо собираются в одного победителя со всеми голосовавшими', () => {
    const { resultData } = build([
      vote({ menuItemId: 1, userId: 1, user: { id: 1, firstName: 'Иван', lastName: 'И', username: 'ivan' } }),
      vote({ menuItemId: 1, userId: 2, user: { id: 2, firstName: 'Пётр', lastName: null, username: null } }),
    ]);

    expect(resultData.winners[0].voterIds).toEqual([1, 2]);
    expect(resultData.winners[0].voters).toEqual([
      { userId: 1, firstName: 'Иван', lastName: 'И', username: 'ivan' },
      { userId: 2, firstName: 'Пётр', lastName: undefined, username: undefined },
    ]);
  });
});

describe('тай-брейк', () => {
  const earlier = new Date('2026-08-23T11:00:00.000Z');
  const later = new Date('2026-08-23T11:30:00.000Z');

  it('единственный лидер побеждает без тай-брейка', () => {
    const { primaryWinnerId, resultData } = build([
      vote({ menuItemId: 1, userId: 1 }),
      vote({ menuItemId: 1, userId: 2 }),
      vote({ menuItemId: 2, userId: 3, menuItem: { name: 'Шурпа', price: null, imageUrl: null } }),
    ]);

    expect(primaryWinnerId).toBe(1);
    expect(resultData.meta.tieBreak).toBeUndefined();
  });

  it('при равенстве по умолчанию выигрывает тот, за кого проголосовали раньше', () => {
    const { primaryWinnerId, resultData } = build([
      vote({ menuItemId: 1, userId: 1, createdAt: later }),
      vote({
        menuItemId: 2,
        userId: 2,
        createdAt: earlier,
        menuItem: { name: 'Шурпа', price: null, imageUrl: null },
      }),
    ]);

    expect(primaryWinnerId).toBe(2);
    expect(resultData.meta.tieBreak).toMatchObject({
      method: 'earliest',
      appliedTo: expect.arrayContaining([1, 2]),
    });
  });

  it('алфавитный тай-брейк учитывает русскую сортировку', () => {
    const { primaryWinnerId } = build(
      [
        vote({ menuItemId: 1, userId: 1, menuItem: { name: 'Ёжик в тумане', price: null, imageUrl: null } }),
        vote({ menuItemId: 2, userId: 2, menuItem: { name: 'Ежевика', price: null, imageUrl: null } }),
      ],
      { tieBreakMethod: 'alphabetical' }
    );

    // 'Ежевика' < 'Ёжик' по русской раскладке; побайтовое сравнение дало бы наоборот.
    expect(primaryWinnerId).toBe(2);
  });

  it('в причине тай-брейка записано, сколько блюд и с каким числом голосов', () => {
    const { resultData } = build([
      vote({ menuItemId: 1, userId: 1 }),
      vote({ menuItemId: 2, userId: 2, menuItem: { name: 'Шурпа', price: null, imageUrl: null } }),
      vote({ menuItemId: 3, userId: 3, menuItem: { name: 'Лагман', price: null, imageUrl: null } }),
    ]);

    expect(resultData.meta.tieBreak?.reason).toBe('3 блюд с 1 голосами');
  });
});

describe('«принесу своё» и «пропускаю»', () => {
  it('считаются отдельно и победителями не становятся', () => {
    const { resultData } = build([
      vote({ menuItemId: 1, userId: 1 }),
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

  /* Голос за блюдо, у которого нет самого блюда (удалено из меню), раньше
     молча выпадал из подсчёта — и это правильно: победителем не может быть
     запись, у которой нет названия. Закрепляем, чтобы «починка» этого не
     превратила удалённое блюдо в победителя без имени. */
  it('голос без блюда не создаёт победителя', () => {
    const { resultData } = build([
      vote({ menuItemId: 5, menuItem: null }),
    ]);

    expect(resultData.winners).toEqual([]);
  });
});

describe('форма результата', () => {
  it('несёт версию, режим и параметры завершения', () => {
    const { resultData } = build([vote({})], { minVotes: 2, maxWinners: 5 });

    expect(resultData).toMatchObject({
      version: 1,
      mode: 'multi-winner',
      meta: {
        completedBy: 7,
        completedAt: NOW.toISOString(),
        params: { minVotes: 2, maxWinners: 5 },
      },
    });
  });
});
