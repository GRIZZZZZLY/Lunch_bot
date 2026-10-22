/**
 * Бизнес-границы входа голосований: завершение с несколькими победителями и
 * расписание автоголосований. Проверяем саму схему — маршрут подключает её
 * через `.middleware`, а подключение проверяют интеграционные тесты.
 */
import { completeMultiWinnerBody } from '../../../api/schemas/poll';
import { createScheduleBody } from '../../../api/schemas/recurring-poll';

describe('completeMultiWinnerBody', () => {
  it.each([
    ['пустое тело', {}],
    ['alphabetical и maxWinners', { tieBreakMethod: 'alphabetical', maxWinners: 5 }],
    ['maxWinners null — без ограничения', { maxWinners: null }],
    ['границы', { minVotes: 0, maxWinners: 50 }],
  ])('принимает: %s', (_label, body) => {
    expect(completeMultiWinnerBody.schema.safeParse(body).success).toBe(true);
  });

  it.each([
    ['minVotes не число', { minVotes: 'два' }],
    ['minVotes отрицательный', { minVotes: -1 }],
    ['minVotes больше 100', { minVotes: 101 }],
    ['maxWinners не число', { maxWinners: 'все' }],
    ['maxWinners меньше 1', { maxWinners: 0 }],
    ['maxWinners больше 50', { maxWinners: 51 }],
    ['неизвестный tieBreakMethod', { tieBreakMethod: 'random' }],
  ])('отклоняет: %s', (_label, body) => {
    expect(completeMultiWinnerBody.schema.safeParse(body).success).toBe(false);
  });
});

describe('createScheduleBody', () => {
  const body = {
    groupId: 100,
    daysOfWeek: [1, 3, 5],
    timeOfDay: '11:30',
    duration: 30,
  };

  it.each([
    ['без списка блюд', {}],
    ['со списком блюд', { selectedMenuItemIds: [1, 2] }],
    ['список блюд null', { selectedMenuItemIds: null }],
    ['крайние время и длительность', { timeOfDay: '23:59', duration: 1440 }],
  ])('принимает: %s', (_label, override) => {
    expect(createScheduleBody.schema.safeParse({ ...body, ...override }).success).toBe(true);
  });

  it.each([
    ['groupId строкой', { groupId: '100' }],
    ['groupId ноль', { groupId: 0 }],
    ['пустой список дней', { daysOfWeek: [] }],
    ['день вне недели', { daysOfWeek: [7] }],
    ['больше семи дней', { daysOfWeek: [0, 1, 2, 3, 4, 5, 6, 0] }],
    ['время без двоеточия', { timeOfDay: '1130' }],
    ['час 24', { timeOfDay: '24:00' }],
    ['минута 60', { timeOfDay: '11:60' }],
    ['нулевая длительность', { duration: 0 }],
    ['длительность больше суток', { duration: 1441 }],
  ])('отклоняет: %s', (_label, override) => {
    expect(createScheduleBody.schema.safeParse({ ...body, ...override }).success).toBe(false);
  });
});
