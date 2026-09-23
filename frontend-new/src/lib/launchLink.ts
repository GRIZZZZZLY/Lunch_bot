/**
 * Ссылка, с которой открыли Mini App.
 *
 * Бот открывает приложение двумя способами, и оба нужно понимать:
 * - кнопкой `web_app` с параметрами в адресе: `?pollId=`, `?storeRunId=`,
 *   `?groupId=<id чата>&action=add|poll` (`backend/src/bot/commands/start.ts`);
 * - прямой ссылкой `t.me/<бот>/<app>?startapp=…`, которая приходит в
 *   `start_param`: `vote_<id>`, `storerun_<id>`, `menu_|add_|poll_<id чата>`.
 *
 * Раньше приложение понимало только опрос, и остальные кнопки из чата
 * открывали просто главную.
 *
 * Ссылка действует один раз за запуск: `start_param` не меняется до закрытия
 * Mini App, и без отметки «обработана» каждый возврат на экран применял бы её
 * заново.
 */
import { getStartParam } from '@/lib/telegram';

export type LaunchGroupAction = 'menu' | 'addDish' | 'createPoll';

export type LaunchLink =
  | { kind: 'poll'; id: number }
  | { kind: 'storeRun'; id: number }
  /** `chatId` — Telegram id чата группы, а не id группы в приложении. */
  | { kind: 'group'; chatId: string; action: LaunchGroupAction };

const GROUP_ACTIONS: Record<string, LaunchGroupAction> = {
  menu: 'menu',
  add: 'addDish',
  poll: 'createPoll',
};

function positiveId(raw: string | null | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}

function chatId(raw: string | null | undefined): string | null {
  return raw && /^-?\d+$/.test(raw) ? raw : null;
}

function fromSearch(search: string): LaunchLink | null {
  const params = new URLSearchParams(search);

  const pollId = positiveId(params.get('pollId'));
  if (pollId) return { kind: 'poll', id: pollId };

  const storeRunId = positiveId(params.get('storeRunId'));
  if (storeRunId) return { kind: 'storeRun', id: storeRunId };

  const group = chatId(params.get('groupId'));
  if (group) {
    return {
      kind: 'group',
      chatId: group,
      action: GROUP_ACTIONS[params.get('action') ?? ''] ?? 'menu',
    };
  }

  return null;
}

function fromStartParam(param: string | null): LaunchLink | null {
  if (!param) return null;

  const pollId = positiveId(param.startsWith('vote_') ? param.slice(5) : param);
  if (pollId) return { kind: 'poll', id: pollId };

  if (param.startsWith('storerun_')) {
    const id = positiveId(param.slice(9));
    return id ? { kind: 'storeRun', id } : null;
  }

  const underscore = param.indexOf('_');
  if (underscore < 0) return null;
  const action = GROUP_ACTIONS[param.slice(0, underscore)];
  const group = chatId(param.slice(underscore + 1));
  return action && group ? { kind: 'group', chatId: group, action } : null;
}

/** Чистый разбор: адрес важнее параметра запуска. */
export function parseLaunchLink(search: string, startParam: string | null): LaunchLink | null {
  return fromSearch(search) ?? fromStartParam(startParam);
}

let handled = false;

/** Ссылка запуска, если её ещё не обработали. */
export function getLaunchLink(): LaunchLink | null {
  if (handled) return null;
  const search = typeof window === 'undefined' ? '' : window.location.search;
  return parseLaunchLink(search, getStartParam());
}

export function markLaunchLinkHandled(): void {
  handled = true;
}

/** Опрос из ссылки запуска — его показывает главная. */
export function getLaunchPollId(): number | null {
  const link = getLaunchLink();
  return link?.kind === 'poll' ? link.id : null;
}
