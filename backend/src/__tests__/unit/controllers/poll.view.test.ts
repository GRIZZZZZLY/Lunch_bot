/**
 * Форма голосования в ответе API: расчётное время окончания, фильтр голосов по
 * составу голосования и разбор итогов с несколькими победителями.
 */
import {
  filterVotesToSelection,
  parseRouletteData,
  withEndTime,
} from '../../../api/controllers/poll.view';

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const STARTED_AT = new Date('2026-08-02T12:00:00.000Z');

function poll(
  overrides: Partial<{
    endedAt: Date | null;
    selectedMenuItemIds: string | null;
    votes: Array<{ id: number; menuItemId: number | null }>;
  }> = {}
) {
  return {
    id: 10,
    startedAt: STARTED_AT,
    duration: 30,
    endedAt: null,
    selectedMenuItemIds: null,
    votes: [],
    ...overrides,
  };
}

describe('withEndTime', () => {
  it.each([
    ['активное: начало + длительность', null, '2026-08-02T12:30:00.000Z'],
    [
      'закрытое досрочно: фактическое время',
      new Date('2026-08-02T12:05:00.000Z'),
      '2026-08-02T12:05:00.000Z',
    ],
  ])('%s', (_label, endedAt, endTime) => {
    expect(withEndTime(poll({ endedAt }))).toMatchObject({ id: 10, endTime });
  });
});

describe('filterVotesToSelection', () => {
  const votes = [
    { id: 1, menuItemId: 1 },
    { id: 2, menuItemId: 3 },
    { id: 3, menuItemId: null },
  ];

  it('оставляет только голоса за блюда из состава голосования', () => {
    const result = filterVotesToSelection(
      poll({ selectedMenuItemIds: '[1,2]', votes }),
      10
    );

    expect(result.votes.map(v => v.id)).toEqual([1]);
  });

  it.each([
    ['состав не задан', null],
    ['пустой состав', '[]'],
    ['битый JSON', 'не json'],
  ])('%s — голоса не фильтруются', (_label, selectedMenuItemIds) => {
    const result = filterVotesToSelection(poll({ selectedMenuItemIds, votes }), 10);

    expect(result.votes).toEqual(votes);
  });
});

describe('parseRouletteData', () => {
  it.each([
    ['строка JSON', JSON.stringify({ winners: [{ menuItemId: 1 }] }), { winners: [{ menuItemId: 1 }] }],
    ['уже объект', { winners: [] }, { winners: [] }],
    ['null', null, {}],
    ['undefined', undefined, {}],
  ])('%s', (_label, raw, expected) => {
    expect(parseRouletteData(raw)).toEqual(expected);
  });
});
