import type { BrowserContext, Route } from '@playwright/test';
import type { MenuItem, MenuSuggestion, Poll, Transaction } from '../../../src/types/models';
import type { StoreItem, StoreRunWithRelations } from '../../../src/services/store-run.service';
import { activeStoreRunList, makeActivePoll, makeStoreRun, type E2EState } from '../scenarios/data';

const ok = <T>(data: T) => ({ success: true, data, timestamp: '2026-07-20T09:00:00.000Z' });
const fail = (error: string, code: string) => ({ success: false, error, code });

/** Роль в группе, как её видит сервер: глобальный isAdmin здесь не в счёт. */
function isGroupAdmin(state: E2EState): boolean {
  return state.groups.some((g) => g.isActive && (g.role === 'ADMIN' || g.role === 'CREATOR'));
}

async function bodyOf(route: Route): Promise<unknown> {
  const request = route.request();
  try {
    return request.postDataJSON() as unknown;
  } catch {
    // Не-JSON тела ниже сохраняются как строка для диагностики договора API.
  }
  const raw = request.postData();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function pathKey(method: string, path: string): string {
  return `${method} ${path}`;
}

function takeFailure(state: E2EState, method: string, path: string) {
  const exact = pathKey(method, path);
  const rule = state.failures[exact];
  if (!rule) return null;
  if (rule.remaining !== undefined) {
    if (rule.remaining <= 0) {
      delete state.failures[exact];
      return null;
    }
    rule.remaining -= 1;
  }
  return rule;
}

function nextId(items: Array<{ id: number }>, floor: number): number {
  return Math.max(floor, ...items.map((item) => item.id)) + 1;
}

function findPoll(state: E2EState, id: number): Poll | undefined {
  return state.polls.find((poll) => poll.id === id) ?? state.history.find((poll) => poll.id === id);
}

function updateStoreRun(state: E2EState, id: number, update: Partial<StoreRunWithRelations>) {
  const run = state.storeRuns.find((candidate) => candidate.id === id);
  if (run) Object.assign(run, update, { updatedAt: '2026-07-20T09:00:00.000Z' });
  return run;
}

function updateStoreItem(
  state: E2EState,
  runId: number,
  itemId: number,
  update: Partial<StoreItem>,
) {
  const run = state.storeRuns.find((candidate) => candidate.id === runId);
  const item = run?.items.find((candidate) => candidate.id === itemId);
  if (item) Object.assign(item, update, { updatedAt: '2026-07-20T09:00:00.000Z' });
  return item;
}

function queryRecord(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries());
}

async function fulfillUnexpected(route: Route, state: E2EState, method: string, path: string) {
  const key = pathKey(method, path);
  state.unexpectedRequests.push(key);
  await route.fulfill({
    status: 501,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, error: `Нет тестового ответа для ${key}`, code: 'E2E_UNEXPECTED' }),
  });
}

export async function installApiMock(context: BrowserContext, state: E2EState): Promise<void> {
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const body = await bodyOf(route);
    state.requests.push({ method, path, query: queryRecord(url), body });

    const delay = state.delays[pathKey(method, path)];
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));

    /* Персональный поток денег ведёт себя как поток опроса: отдаём кадр
       `connected` и закрываем — клиент переподключится с backoff, а опрос
       останется страховкой. Проверка Bearer здесь содержательная: токен для
       денежного потока не должен уезжать в URL. */
    const personalStream = path === '/sse/me/stream';
    const pollStream = path.match(/^\/polls\/(\d+)\/stream$/);
    if (method === 'GET' && (pollStream || personalStream)) {
      const authorization = request.headers().authorization;
      if (!authorization?.startsWith('Bearer e2e-')) {
        state.unexpectedRequests.push(
          `${method} ${path} без Bearer-токена`,
        );
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Требуется токен в заголовке Authorization',
            code: 'AUTH_REQUIRED',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: {
          'Cache-Control': 'no-cache',
        },
        body: 'event: connected\ndata: {}\n\n',
      });
      return;
    }

    const failure = takeFailure(state, method, path);
    if (failure) {
      if (failure.abort) {
        state.expectedNetworkFailures.push(`${method} /api${path}`);
        await route.abort('failed');
        return;
      }
      await route.fulfill({
        status: failure.status,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: failure.error, code: failure.code }),
      });
      return;
    }

    if (
      state.expireProtectedRequestOnce &&
      !state.protectedRequestExpired &&
      !path.startsWith('/auth/')
    ) {
      state.protectedRequestExpired = true;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Токен истёк', code: 'TOKEN_EXPIRED' }),
      });
      return;
    }

    if (method === 'POST' && path === '/auth/validate') {
      if (!state.validateAuth) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Не удалось проверить данные Telegram', code: 'INVALID_INIT_DATA' }),
        });
        return;
      }
      await route.fulfill({
        json: ok({ user: state.user, accessToken: 'e2e-access-token', refreshToken: 'e2e-refresh-token' }),
      });
      return;
    }
    if (method === 'POST' && path === '/auth/refresh') {
      if (!state.refreshAuth) {
        await route.fulfill({ status: 401, json: { success: false, error: 'Сессия истекла', code: 'TOKEN_EXPIRED' } });
        return;
      }
      /* Честная проверка типа токена — как настоящий refreshTokenMiddleware на
         сервере: access-токен на этом эндпоинте должен получать отказ. Раньше
         мок отвечал успехом на любой Bearer, и это маскировало Задачу 3 —
         клиент слал access вместо refresh, а smoke всё равно был зелёным. */
      /* Ротированный refresh-токен принимается тоже: ответ ниже выдаёт
         `e2e-refreshed-refresh-token`, и без него второе обновление в одном
         сценарии получало бы 401 от собственного же мока. */
      const authorization = request.headers().authorization;
      const acceptedRefreshTokens = [
        'Bearer e2e-refresh-token',
        'Bearer e2e-refreshed-refresh-token',
      ];
      if (!acceptedRefreshTokens.includes(authorization ?? '')) {
        await route.fulfill({
          status: 401,
          json: { success: false, error: 'Неверный тип токена', code: 'INVALID_TOKEN_TYPE' },
        });
        return;
      }
      await route.fulfill({
        json: ok({ user: state.user, accessToken: 'e2e-refreshed-token', refreshToken: 'e2e-refreshed-refresh-token' }),
      });
      return;
    }
    if (method === 'GET' && (path === '/auth/me' || path === '/user/me')) {
      await route.fulfill({ json: ok(state.user) });
      return;
    }
    if (method === 'GET' && path === '/user/groups') {
      await route.fulfill({ json: ok(state.groups) });
      return;
    }
    if (path === '/user/payment-info') {
      /* Берём ТОЛЬКО те поля, что знает сервер (user.controller.updatePaymentInfo).
         Раньше здесь стоял `...bodyRecord(body)` — мок соглашался с клиентом по
         построению и потому не мог поймать расхождение имён. Клиент слал
         sbpPhone/bankName/cardNumber, API читает paymentPhone/paymentCard/
         paymentDetails: PUT отвечал 200 и не записывал ничего. Тесты проходили
         четыре круга, а профиль в проде не сохранял ни разу. */
      if (method === 'PUT') {
        const b = bodyRecord(body) as Record<string, unknown>;
        const next = { ...state.paymentInfo };
        for (const key of ['paymentPhone', 'paymentCard', 'paymentDetails'] as const) {
          if (key in b) next[key] = b[key] as string | undefined;
        }
        state.paymentInfo = next;
      }
      await route.fulfill({ json: ok(state.paymentInfo) });
      return;
    }
    if (method === 'GET' && /^\/user\/\d+\/avatar$/.test(path)) {
      const userId = Number(path.split('/')[2]);
      await route.fulfill({ json: ok({ userId, initial: 'А' }) });
      return;
    }
    if (method === 'POST' && path === '/user/avatars/batch') {
      const ids = (bodyRecord(body).userIds as number[] | undefined) ?? [];
      await route.fulfill({ json: ok(ids.map((userId) => ({ userId, initial: 'А' }))) });
      return;
    }

    if (method === 'GET' && path === '/polls/active') {
      await route.fulfill({ json: ok(state.polls.filter((poll) => poll.status === 'ACTIVE')) });
      return;
    }
    if (method === 'GET' && path === '/polls/last-completed') {
      await route.fulfill({ json: ok(state.history.find((poll) => poll.status === 'COMPLETED') ?? null) });
      return;
    }
    if (method === 'GET' && path === '/polls') {
      const limit = Number(url.searchParams.get('limit') ?? 60);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const polls = state.history.slice(offset, offset + limit);
      await route.fulfill({
        json: ok({ polls, total: state.history.length, limit, offset, hasNext: offset + limit < state.history.length }),
      });
      return;
    }
    const activeForGroup = path.match(/^\/polls\/active\/(\d+)$/);
    if (method === 'GET' && activeForGroup) {
      const groupId = activeForGroup[1];
      await route.fulfill({ json: ok(state.polls.find((poll) => poll.groupId === groupId && poll.status === 'ACTIVE') ?? null) });
      return;
    }
    const pollResults = path.match(/^\/polls\/(\d+)\/results$/);
    if (method === 'GET' && pollResults) {
      await route.fulfill({ json: ok(state.pollResults[Number(pollResults[1])] ?? null) });
      return;
    }
    const myVotes = path.match(/^\/polls\/(\d+)\/my-votes$/);
    if (method === 'GET' && myVotes) {
      await route.fulfill({ json: ok({ menuItemIds: state.myVotes[Number(myVotes[1])] ?? [] }) });
      return;
    }
    const pollVote = path.match(/^\/polls\/(\d+)\/vote$/);
    if (pollVote && method === 'POST') {
      const pollId = Number(pollVote[1]);
      const menuItemId = Number(bodyRecord(body).menuItemId);
      state.myVotes[pollId] = [menuItemId];
      const poll = findPoll(state, pollId);
      if (poll) {
        poll.votes = (poll.votes ?? []).filter((entry) => entry.userId !== state.user.id);
        poll.votes.push({
          id: nextId(poll.votes, 1000),
          pollId,
          userId: state.user.id,
          menuItemId,
          createdAt: '2026-07-20T09:00:00.000Z',
          user: state.user,
        });
      }
      await route.fulfill({ json: ok({ pollId, userId: state.user.id, menuItemId }) });
      return;
    }
    if (pollVote && method === 'DELETE') {
      const pollId = Number(pollVote[1]);
      state.myVotes[pollId] = [];
      const poll = findPoll(state, pollId);
      if (poll) poll.votes = (poll.votes ?? []).filter((entry) => entry.userId !== state.user.id);
      await route.fulfill({ json: ok(null) });
      return;
    }
    const completePoll = path.match(/^\/polls\/(\d+)\/complete$/);
    if (method === 'PATCH' && completePoll) {
      const pollId = Number(completePoll[1]);
      const poll = state.polls.find((candidate) => candidate.id === pollId);
      if (poll) {
        poll.status = 'COMPLETED';
        poll.closedAt = '2026-07-20T09:30:00.000Z';
        state.polls = state.polls.filter((candidate) => candidate.id !== pollId);
        state.history.unshift(poll);
        state.pollResults[pollId] = {
          pollId,
          winnerId: poll.menuItems?.[0]?.menuItemId ?? 11,
          winnerName: poll.menuItems?.[0]?.menuItem.name ?? 'Борщ со сметаной',
          totalVotes: poll.votes?.length ?? 0,
          responsible: { userId: 202, name: 'Игорь', method: 'roulette' },
        };
      }
      await route.fulfill({ json: ok(state.pollResults[pollId] ?? null) });
      return;
    }
    const cancelPoll = path.match(/^\/polls\/(\d+)\/cancel$/);
    if (method === 'PATCH' && cancelPoll) {
      const pollId = Number(cancelPoll[1]);
      const poll = state.polls.find((candidate) => candidate.id === pollId);
      if (poll) {
        poll.status = 'CANCELLED';
        state.polls = state.polls.filter((candidate) => candidate.id !== pollId);
        state.history.unshift(poll);
      }
      await route.fulfill({ json: ok(poll ?? null) });
      return;
    }
    if (method === 'POST' && path === '/polls/create-from-webapp') {
      const input = bodyRecord(body);
      const poll = makeActivePoll();
      poll.id = 502;
      poll.groupId = String(input.groupId ?? 1);
      poll.duration = Number(input.duration ?? 30);
      poll.creatorId = state.user.id;
      state.polls = [poll];
      state.myVotes[poll.id] = [];
      await route.fulfill({ json: ok({ pollId: poll.id, messageId: 1502 }) });
      return;
    }
    const pollById = path.match(/^\/polls\/(\d+)$/);
    if (method === 'GET' && pollById) {
      await route.fulfill({ json: ok(findPoll(state, Number(pollById[1])) ?? null) });
      return;
    }

    if (method === 'GET' && (path === '/menu' || path === '/menu/active')) {
      const data = path.endsWith('/active') ? state.menu.filter((item) => item.isActive !== false) : state.menu;
      await route.fulfill({ json: ok(data) });
      return;
    }
    if (method === 'POST' && path === '/menu') {
      const input = bodyRecord(body);
      const item: MenuItem = {
        id: nextId(state.menu, 20),
        name: String(input.name ?? ''),
        price: Number(input.price ?? 0),
        description: input.description ? String(input.description) : undefined,
        category: input.category ? String(input.category) : undefined,
        isActive: input.isActive !== false,
      };
      state.menu.push(item);
      await route.fulfill({ status: 201, json: ok(item) });
      return;
    }
    const toggleMenu = path.match(/^\/menu\/(\d+)\/toggle$/);
    if (method === 'PATCH' && toggleMenu) {
      const item = state.menu.find((candidate) => candidate.id === Number(toggleMenu[1]));
      if (item) item.isActive = item.isActive === false;
      await route.fulfill({ json: ok(item ?? null) });
      return;
    }
    const menuById = path.match(/^\/menu\/(\d+)$/);
    if (menuById && method === 'GET') {
      await route.fulfill({ json: ok(state.menu.find((item) => item.id === Number(menuById[1])) ?? null) });
      return;
    }
    if (menuById && method === 'PUT') {
      const item = state.menu.find((candidate) => candidate.id === Number(menuById[1]));
      if (item) Object.assign(item, bodyRecord(body));
      await route.fulfill({ json: ok(item ?? null) });
      return;
    }
    if (menuById && method === 'DELETE') {
      state.menu = state.menu.filter((item) => item.id !== Number(menuById[1]));
      await route.fulfill({ json: ok(null) });
      return;
    }

    if (method === 'GET' && path === '/store-runs/active') {
      await route.fulfill({ json: ok(activeStoreRunList(state)) });
      return;
    }
    if (method === 'POST' && path === '/store-runs') {
      const input = bodyRecord(body);
      const run = makeStoreRun('COLLECTING', true);
      run.id = 602;
      run.groupId = Number(input.groupId ?? 1);
      run.storeName = String(input.storeName ?? 'Магазин');
      run.items = [];
      state.storeRuns.push(run);
      await route.fulfill({ status: 201, json: ok(run) });
      return;
    }
    const storeItemPrice = path.match(/^\/store-runs\/(\d+)\/items\/(\d+)\/price$/);
    if (method === 'POST' && storeItemPrice) {
      const input = bodyRecord(body);
      // BOUGHT без цены — легальное состояние API: Number(null) дал бы 0
      // и подменил «цена не указана» настоящим нулём.
      const bought = input.status !== 'NOT_FOUND';
      const item = updateStoreItem(state, Number(storeItemPrice[1]), Number(storeItemPrice[2]), {
        status: bought ? 'BOUGHT' : 'NOT_FOUND',
        price: bought && input.price != null ? Number(input.price) : null,
      });
      await route.fulfill({ json: ok(item ?? null) });
      return;
    }
    const storeItem = path.match(/^\/store-runs\/(\d+)\/items\/(\d+)$/);
    if (storeItem && method === 'PATCH') {
      const item = updateStoreItem(state, Number(storeItem[1]), Number(storeItem[2]), bodyRecord(body));
      await route.fulfill({ json: ok(item ?? null) });
      return;
    }
    if (storeItem && method === 'DELETE') {
      const run = state.storeRuns.find((candidate) => candidate.id === Number(storeItem[1]));
      if (run) run.items = run.items.filter((item) => item.id !== Number(storeItem[2]));
      await route.fulfill({ json: ok(null) });
      return;
    }
    const storeItems = path.match(/^\/store-runs\/(\d+)\/items$/);
    if (method === 'POST' && storeItems) {
      const run = state.storeRuns.find((candidate) => candidate.id === Number(storeItems[1]));
      const inputs = (bodyRecord(body).items as Array<Record<string, unknown>> | undefined) ?? [];
      const added: StoreItem[] = inputs.map((input, index) => ({
        id: nextId(run?.items ?? [], 710) + index,
        storeRunId: Number(storeItems[1]),
        userId: state.user.id,
        name: String(input.name ?? ''),
        quantity: Number(input.quantity ?? 1),
        notes: input.notes ? String(input.notes) : null,
        price: null,
        status: 'REQUESTED',
        createdAt: '2026-07-20T09:00:00.000Z',
        updatedAt: '2026-07-20T09:00:00.000Z',
        user: state.user,
      }));
      run?.items.push(...added);
      await route.fulfill({ status: 201, json: ok(added) });
      return;
    }
    const startShopping = path.match(/^\/store-runs\/(\d+)\/start-shopping$/);
    if (method === 'POST' && startShopping) {
      const run = updateStoreRun(state, Number(startShopping[1]), { status: 'SHOPPING', shoppingAt: '2026-07-20T09:00:00.000Z' });
      await route.fulfill({ json: ok(run ?? null) });
      return;
    }
    const settle = path.match(/^\/store-runs\/(\d+)\/settle$/);
    if (method === 'POST' && settle) {
      const run = updateStoreRun(state, Number(settle[1]), { status: 'SETTLED', settledAt: '2026-07-20T09:30:00.000Z' });
      await route.fulfill({ json: ok(run ?? null) });
      return;
    }
    const cancel = path.match(/^\/store-runs\/(\d+)\/cancel$/);
    if (method === 'POST' && cancel) {
      const run = updateStoreRun(state, Number(cancel[1]), { status: 'CANCELLED', cancelledAt: '2026-07-20T09:30:00.000Z' });
      await route.fulfill({ json: ok(run ?? null) });
      return;
    }
    const storeRun = path.match(/^\/store-runs\/(\d+)$/);
    if (method === 'GET' && storeRun) {
      await route.fulfill({ json: ok(state.storeRuns.find((run) => run.id === Number(storeRun[1])) ?? null) });
      return;
    }

    if (method === 'GET' && path === '/budget/debts') {
      await route.fulfill({ json: ok(state.debts) });
      return;
    }
    if (method === 'GET' && path === '/budget/credits') {
      await route.fulfill({ json: ok(state.credits) });
      return;
    }
    if (method === 'GET' && path === '/budget/stats') {
      await route.fulfill({
        json: ok({
          totalDebts: state.debts.reduce((sum, tx) => sum + tx.amount, 0),
          totalCredits: state.credits.reduce((sum, tx) => sum + tx.amount, 0),
          balance: 0,
          pendingTransactions: [...state.debts, ...state.credits].filter((tx) => tx.status !== 'CONFIRMED').length,
        }),
      });
      return;
    }
    const budgetMutation: Record<string, (tx: Transaction) => void> = {
      '/budget/mark-paid': (tx) => { tx.status = 'PAID'; },
      '/budget/confirm-payment': (tx) => { tx.status = 'CONFIRMED'; tx.confirmedAt = new Date().toISOString(); },
      // окно отмены проверяет сервер; мок повторяет только смену статуса
      '/budget/undo-confirmation': (tx) => { tx.status = 'PAID'; tx.confirmedAt = null; },
      '/budget/cancel-mark': (tx) => { tx.status = 'PENDING'; },
      '/budget/send-reminder': () => undefined,
    };
    if (method === 'POST' && budgetMutation[path]) {
      const transactionId = Number(bodyRecord(body).transactionId);
      const tx = [...state.debts, ...state.credits].find((candidate) => candidate.id === transactionId);
      if (tx) budgetMutation[path](tx);
      await route.fulfill({ json: ok(null) });
      return;
    }

    if (method === 'GET' && path === '/suggestions') {
      /* Сервер отдаёт чужие предложения только админу ГРУППЫ и только когда
         передан groupId. Мок раньше читал параметр onlyMine, которого клиент
         не шлёт, и игнорировал groupId, который шлёт, — из-за чего e2e видел
         очередь там, где живой сервер отдал бы пустой список. */
      const status = url.searchParams.get('status');
      const moderates = url.searchParams.get('groupId') ? isGroupAdmin(state) : false;
      const suggestions = state.suggestions.filter(
        (item) =>
          (!status || item.status === status) &&
          (moderates || item.suggestedBy === state.user.id),
      );
      await route.fulfill({ json: ok(suggestions) });
      return;
    }
    if (method === 'GET' && path === '/suggestions/pending-count') {
      if (!isGroupAdmin(state)) {
        await route.fulfill({
          status: 403,
          json: fail('Group admin access required', 'ACCESS_DENIED'),
        });
        return;
      }
      const count = state.suggestions.filter((item) => item.status === 'PENDING').length;
      await route.fulfill({ json: ok({ count }) });
      return;
    }
    if (method === 'POST' && path === '/suggestions') {
      const input = bodyRecord(body);
      const suggestion: MenuSuggestion = {
        id: nextId(state.suggestions, 910),
        name: String(input.name ?? ''),
        description: input.description ? String(input.description) : undefined,
        price: input.price ? Number(input.price) : undefined,
        status: 'PENDING',
        suggestedBy: state.user.id,
        createdAt: '2026-07-20T09:00:00.000Z',
        updatedAt: '2026-07-20T09:00:00.000Z',
        suggester: state.user,
      };
      state.suggestions.unshift(suggestion);
      await route.fulfill({ status: 201, json: ok(suggestion) });
      return;
    }
    const approveSuggestion = path.match(/^\/suggestions\/(\d+)\/approve$/);
    if (method === 'POST' && approveSuggestion) {
      const suggestion = state.suggestions.find((item) => item.id === Number(approveSuggestion[1]));
      if (suggestion) suggestion.status = 'APPROVED';
      await route.fulfill({ json: ok(suggestion ?? null) });
      return;
    }
    const rejectSuggestion = path.match(/^\/suggestions\/(\d+)\/reject$/);
    if (method === 'POST' && rejectSuggestion) {
      const suggestion = state.suggestions.find((item) => item.id === Number(rejectSuggestion[1]));
      if (suggestion) {
        suggestion.status = 'REJECTED';
        suggestion.rejectionReason = bodyRecord(body).reason ? String(bodyRecord(body).reason) : undefined;
      }
      await route.fulfill({ json: ok(suggestion ?? null) });
      return;
    }
    const suggestionById = path.match(/^\/suggestions\/(\d+)$/);
    if (method === 'DELETE' && suggestionById) {
      /* Право проверяет сервер, и оно двойное: автор отзывает своё, пока оно
         на рассмотрении, админ группы убирает уже разобранное. Мок отвечал 200
         всегда — поэтому e2e не мог поймать, что кнопка отзыва была наглухо
         закрыта админской мидлварой. */
      const target = state.suggestions.find((item) => item.id === Number(suggestionById[1]));
      if (!target) {
        await route.fulfill({ status: 404, json: fail('Suggestion not found', 'NOT_FOUND') });
        return;
      }
      const isAuthor = target.suggestedBy === state.user.id;
      const isPending = target.status === 'PENDING';
      if (!(isAuthor && isPending)) {
        if (!isGroupAdmin(state)) {
          await route.fulfill({
            status: 403,
            json: fail('Удалить может автор своего предложения или админ группы', 'NOT_ADMIN'),
          });
          return;
        }
        if (isPending) {
          await route.fulfill({
            status: 500,
            json: fail('Failed to delete suggestion', 'INTERNAL_ERROR'),
          });
          return;
        }
      }
      state.suggestions = state.suggestions.filter((item) => item.id !== target.id);
      await route.fulfill({ json: ok(null) });
      return;
    }

    if (method === 'POST' && path === '/feedback') {
      await route.fulfill({ status: 201, json: ok({ id: 1001, createdAt: '2026-07-20T09:00:00.000Z' }) });
      return;
    }
    if (method === 'GET' && path.startsWith('/recurring/')) {
      await route.fulfill({ json: ok(null) });
      return;
    }
    if (method === 'POST' && path === '/recurring') {
      await route.fulfill({ status: 201, json: ok({ id: 1101, ...bodyRecord(body), isEnabled: true }) });
      return;
    }

    if (method === 'GET' && path === '/admin/users') {
      await route.fulfill({ json: ok([
        { ...state.user, isActive: true, updatedAt: '2026-07-20T09:00:00.000Z', totalVotes: 6, totalDebts: 1, totalCredits: 0, pendingDebts: 1, lastActivity: CREATED_AT },
        { ...state.user, id: 202, firstName: 'Игорь', username: 'igor_e2e', isAdmin: true, isActive: true, updatedAt: '2026-07-20T09:00:00.000Z', totalVotes: 9, totalDebts: 0, totalCredits: 1, pendingDebts: 0, lastActivity: CREATED_AT },
      ]) });
      return;
    }
    if (method === 'GET' && path === '/admin/debtors') {
      await route.fulfill({ json: ok(state.debts.length ? [{ userId: 101, userName: 'Анна Тестова', telegramId: '700000101', totalDebt: 600, oldestDebt: CREATED_AT, debtCount: 2, debts: state.debts.map((tx) => ({ id: tx.id, amount: tx.amount, createdAt: tx.createdAt, pollId: tx.pollId, toUser: { id: 202, firstName: 'Игорь' } })) }] : []) });
      return;
    }
    if (method === 'GET' && path === '/admin/debt-stats') {
      await route.fulfill({ json: ok({ totalDebtors: state.debts.length ? 1 : 0, totalDebtAmount: state.debts.reduce((sum, tx) => sum + tx.amount, 0), avgDebtPerUser: 600, oldestDebtAge: 6 }) });
      return;
    }
    if (method === 'GET' && path === '/admin/cleanup/stats') {
      await route.fulfill({ json: ok({ oldPolls: { count30Days: 3, count60Days: 2, count90Days: 1 }, oldTransactions: { count30Days: 2, count60Days: 1, count90Days: 0 } }) });
      return;
    }
    /* Предпросмотр очистки: сколько уйдёт и сколько удержат непогашенные
       долги. Без этой ручки диалог удаления откатывался к тексту без чисел, а
       именно чисел ему и не хватало. */
    if (method === 'GET' && path === '/admin/cleanup/preview') {
      const kind = url.searchParams.get('kind');
      await route.fulfill({
        json: ok(
          kind === 'transactions'
            ? { deletable: 2, blockedByDebt: 0 }
            : { deletable: 3, blockedByDebt: 1 },
        ),
      });
      return;
    }
    if (method === 'GET' && path.startsWith('/admin/reminder-settings/')) {
      await route.fulfill({ json: ok({ id: 1, groupId: 1, isEnabled: true, intervalDays: 3, messageTemplate: 'Напоминание', minDebtAge: 2, maxReminders: 3, createdAt: CREATED_AT, updatedAt: CREATED_AT }) });
      return;
    }
    if (method === 'GET' && path.startsWith('/admin/notification-settings/')) {
      await route.fulfill({ json: ok({ id: 1, groupId: 1, notifyOnNewUser: true, notifyOnNewPoll: true, notifyOnPollEnd: true, notifyOnDebtPaid: true, createdAt: CREATED_AT, updatedAt: CREATED_AT }) });
      return;
    }
    if (path.startsWith('/admin/') && ['POST', 'PUT', 'DELETE'].includes(method)) {
      await route.fulfill({ json: ok({ sent: 1, total: 1, deleted: 1, ...bodyRecord(body) }) });
      return;
    }

    await fulfillUnexpected(route, state, method, path);
  });
}

const CREATED_AT = '2026-07-14T09:00:00.000Z';
