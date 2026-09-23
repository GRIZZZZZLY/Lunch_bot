import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TelegramWebApp } from '../telegram';
import { parseLaunchLink } from '../launchLink';

/**
 * Ссылки, с которыми бот открывает Mini App. Формы взяты из того, что бот
 * реально отправляет (`backend/src/bot/commands/start.ts`,
 * `bot/keyboards/*.ts`, `services/store-run-notification.service.ts`), а не
 * придуманы: раньше приложение понимало только `?pollId=` и `vote_<id>`, и
 * кнопки «Заказать», «Открыть меню группы», «Добавить блюдо» и «Создать
 * голосование» открывали просто главную.
 */
describe('parseLaunchLink', () => {
  it.each([
    ['?pollId=12', null, { kind: 'poll', id: 12 }],
    ['', 'vote_34', { kind: 'poll', id: 34 }],
    ['', '56', { kind: 'poll', id: 56 }],
    ['?storeRunId=7', null, { kind: 'storeRun', id: 7 }],
    ['', 'storerun_8', { kind: 'storeRun', id: 8 }],
    ['?groupId=-1001234', null, { kind: 'group', chatId: '-1001234', action: 'menu' }],
    ['?groupId=-1001234&action=add', null, { kind: 'group', chatId: '-1001234', action: 'addDish' }],
    ['?groupId=-1001234&action=poll', null, { kind: 'group', chatId: '-1001234', action: 'createPoll' }],
    ['', 'menu_-1005', { kind: 'group', chatId: '-1005', action: 'menu' }],
    ['', 'add_-1005', { kind: 'group', chatId: '-1005', action: 'addDish' }],
    ['', 'poll_-1005', { kind: 'group', chatId: '-1005', action: 'createPoll' }],
  ])('%s %s', (search, startParam, expected) => {
    expect(parseLaunchLink(search, startParam)).toEqual(expected);
  });

  it.each([
    ['?pollId=abc', null],
    ['?pollId=0', null],
    ['', 'storerun_x'],
    ['', 'menu_'],
    ['', 'menu_12a'],
    ['', 'something'],
    ['', null],
  ])('мусор не превращается в ссылку: %s %s', (search, startParam) => {
    expect(parseLaunchLink(search, startParam)).toBeNull();
  });

  it('адрес важнее параметра запуска', () => {
    expect(parseLaunchLink('?storeRunId=7', 'vote_34')).toEqual({ kind: 'storeRun', id: 7 });
  });

  it('неизвестное действие открывает меню группы', () => {
    expect(parseLaunchLink('?groupId=-1&action=zzz', null)).toEqual({
      kind: 'group',
      chatId: '-1',
      action: 'menu',
    });
  });
});

/**
 * Ссылка действует ОДИН раз за запуск. Параметр запуска Telegram не меняется
 * до закрытия Mini App, и раньше каждый возврат на «Главную» снова подставлял
 * опрос из ссылки, а завершённый — снова уводил на итоги.
 */
describe('обработанная ссылка', () => {
  beforeEach(() => {
    vi.resetModules();
    window.Telegram = {
      WebApp: { initDataUnsafe: { start_param: 'storerun_8' } } as unknown as TelegramWebApp,
    };
  });

  afterEach(() => {
    delete window.Telegram;
  });

  it('больше не возвращается', async () => {
    const { getLaunchLink, markLaunchLinkHandled } = await import('../launchLink');

    expect(getLaunchLink()).toEqual({ kind: 'storeRun', id: 8 });
    markLaunchLinkHandled();
    expect(getLaunchLink()).toBeNull();
  });

  it('id опроса отдаётся только для ссылки на опрос', async () => {
    const { getLaunchPollId } = await import('../launchLink');
    expect(getLaunchPollId()).toBeNull();

    window.Telegram = {
      WebApp: { initDataUnsafe: { start_param: 'vote_34' } } as unknown as TelegramWebApp,
    };
    expect(getLaunchPollId()).toBe(34);
  });
});
