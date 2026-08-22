/**
 * Правило домена: голоса не за блюдо («принесу своё», «пропускаю») имеют
 * `menuItemId === null` и в выборку блюд не попадают.
 *
 * Правило стояло в четырёх местах — poll.service.ts и трижды vote.service.ts.
 * Тест здесь для того, чтобы смена трактовки `null` меняла ОДНО поведение и
 * ломала ОДИН тест, а не расползалась по сервисам молча.
 */
import { menuItemIdsFromVoteGroups } from '../../../utils/vote-menu-items';

describe('menuItemIdsFromVoteGroups', () => {
  it('оставляет только голоса за блюда', () => {
    expect(
      menuItemIdsFromVoteGroups([
        { menuItemId: 7 },
        { menuItemId: null },
        { menuItemId: 8 },
        { menuItemId: null },
      ])
    ).toEqual([7, 8]);
  });

  it('сохраняет порядок — на нём держится сортировка по числу голосов', () => {
    expect(
      menuItemIdsFromVoteGroups([
        { menuItemId: 3 },
        { menuItemId: 1 },
        { menuItemId: 2 },
      ])
    ).toEqual([3, 1, 2]);
  });

  it('дубликаты не убирает: это задача вызывающего, а не правила', () => {
    expect(
      menuItemIdsFromVoteGroups([{ menuItemId: 5 }, { menuItemId: 5 }])
    ).toEqual([5, 5]);
  });

  it('id = 0 не считается отсутствующим', () => {
    expect(menuItemIdsFromVoteGroups([{ menuItemId: 0 }])).toEqual([0]);
  });

  it('только голоса не за блюда — пустой список, а не ошибка', () => {
    expect(
      menuItemIdsFromVoteGroups([{ menuItemId: null }, { menuItemId: null }])
    ).toEqual([]);
  });

  it('пустой вход — пустой выход', () => {
    expect(menuItemIdsFromVoteGroups([])).toEqual([]);
  });

  /* Принимает и строки groupBy, и сами Vote — у обоих есть menuItemId,
     а лишние поля функции безразличны. */
  it('работает и на полных строках голосов', () => {
    expect(
      menuItemIdsFromVoteGroups([
        { id: 1, pollId: 5, userId: 1, menuItemId: 7 } as never,
        { id: 2, pollId: 5, userId: 2, menuItemId: null } as never,
      ])
    ).toEqual([7]);
  });
});
