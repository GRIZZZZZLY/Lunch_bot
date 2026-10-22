/**
 * Поддельный Telegram для интеграционных тестов бота и фоновых задач.
 *
 * Бот собирается НАСТОЯЩИЙ — `createBot()` со всеми middleware, командами,
 * маршрутизацией callback-кнопок и обработчиками событий группы. Подменяется
 * только граница с Telegram: каждый исходящий вызов Bot API перехватывает
 * трансформер, записывает его и отвечает так, как ответил бы Telegram
 * (`{ ok: true, result }` или `{ ok: false, error_code, description }`).
 * Входящие события подаются через `bot.handleUpdate` — тот же путь, что у
 * webhook и long polling.
 *
 * Сервисы шлют сообщения через общий экземпляр (`getBotInstance()`), который
 * регистрирует сам `createBot`, поэтому отправки из фоновых задач попадают в
 * тот же журнал вызовов.
 */
import { Api, type Bot, type Transformer } from 'grammy';
import type { Update, UserFromGetMe } from 'grammy/types';

import { createBot } from '../../../bot/bot';
import type { BotContext } from '../../../types/bot.types';

/* Часть кода грузит модули лениво и с расширением `.js`
   (`await import('../services/budget.service.js')`): после сборки tsc файл
   именно так и называется, а в jest лежит исходник `.ts`, и такой импорт
   падает с MODULE_NOT_FOUND. Это не подмена: под `.js`-именем отдаётся тот же
   самый настоящий модуль. */
for (const name of [
  'database/client',
  'services/budget.service',
  'services/store-run-budget.service',
  'services/reminder.service',
  'services/responsible.service',
  'services/multi-category-responsible.service',
  'services/poll-scheduler.service',
  'services/poll-flow.service',
  'services/gamification.service',
]) {
  jest.mock(`../../../${name}.js`, () => jest.requireActual(`../../../${name}`), {
    virtual: true,
  });
}

export const BOT_INFO = {
  id: 777000,
  is_bot: true,
  first_name: 'Test Lunch Bot',
  username: 'test_lunch_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
} as unknown as UserFromGetMe;

export interface ApiCall {
  method: string;
  // Полезная нагрузка Bot API — произвольный JSON.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}

/** Отказ Telegram в том виде, в каком его возвращает Bot API. */
export class TelegramRefusal {
  constructor(
    readonly errorCode: number,
    readonly description: string,
    readonly parameters?: Record<string, unknown>
  ) {}
}

export const BLOCKED_BY_USER = () =>
  new TelegramRefusal(403, 'Forbidden: bot was blocked by the user');
export const TOO_MANY_REQUESTS = () =>
  new TelegramRefusal(429, 'Too Many Requests: retry after 5', {
    retry_after: 5,
  });
export const BAD_GATEWAY = () => new TelegramRefusal(502, 'Bad Gateway');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Responder = (payload: Record<string, any>) => unknown;

export interface FakeTelegram {
  bot: Bot<BotContext>;
  /** Все исходящие вызовы Bot API по порядку. */
  calls: ApiCall[];
  /** Вызовы одного метода. */
  sent(method: string): ApiCall[];
  /** Ответ на метод: значение — `result`, `TelegramRefusal` — отказ. */
  respond(method: string, responder: Responder): void;
  /** Очистить журнал и вернуть ответы по умолчанию. */
  reset(): void;
  /** Подать входящее обновление так, как его подал бы Telegram. */
  receive(update: Omit<Update, 'update_id'>): Promise<void>;
}

let nextMessageId = 1000;
let nextUpdateId = 1;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defaultResult(method: string, payload: Record<string, any>): unknown {
  switch (method) {
    case 'getMe':
      return BOT_INFO;
    case 'sendMessage':
      return {
        message_id: nextMessageId++,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(payload.chat_id), type: 'private' },
        text: payload.text,
      };
    case 'editMessageText':
      return {
        message_id: payload.message_id ?? nextMessageId++,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(payload.chat_id ?? 0), type: 'private' },
        text: payload.text,
      };
    case 'getChatAdministrators':
      return [];
    case 'getChatMember':
      return {
        status: 'member',
        user: { id: Number(payload.user_id), is_bot: false, first_name: 'X' },
      };
    case 'getChatMemberCount':
      return 2;
    default:
      return true;
  }
}

/**
 * Поднять бота с поддельным Telegram. Вызывать один раз на файл (`beforeAll`).
 */
export async function createFakeTelegram(): Promise<FakeTelegram> {
  const calls: ApiCall[] = [];
  const responders = new Map<string, Responder>();

  /* `createBot` сам дёргает `getMe` до того, как сюда можно поставить
     трансформер. Ответ даёт подделка той же границы — класса Api из grammY. */
  jest.spyOn(Api.prototype, 'getMe').mockResolvedValue(BOT_INFO);

  /* `createBot` вешает на процесс обработчики, которые через секунду гасят его
     при любой необработанной ошибке. Для боевого процесса это верно, а в
     jest такой обработчик убил бы весь прогон, поэтому снимаем ровно те
     обработчики, что добавил `createBot`. */
  const before = {
    uncaughtException: process.listeners('uncaughtException'),
    unhandledRejection: process.listeners('unhandledRejection'),
  };
  const bot = createBot();
  for (const listener of process.listeners('uncaughtException')) {
    if (!before.uncaughtException.includes(listener)) {
      process.removeListener('uncaughtException', listener);
    }
  }
  for (const listener of process.listeners('unhandledRejection')) {
    if (!before.unhandledRejection.includes(listener)) {
      process.removeListener('unhandledRejection', listener);
    }
  }

  bot.botInfo = BOT_INFO;

  /* Трансформер, поставленный последним, оборачивает все предыдущие
     (троттлинг, автоповтор) и до них не доходит: сеть не трогается вовсе. */
  const transformer: Transformer = async (_prev, method, payload) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (payload ?? {}) as Record<string, any>;
    calls.push({ method, payload: body });
    const responder = responders.get(method);
    const result = responder ? await responder(body) : defaultResult(method, body);
    if (result instanceof TelegramRefusal) {
      return {
        ok: false,
        error_code: result.errorCode,
        description: result.description,
        ...(result.parameters ? { parameters: result.parameters } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ok: true, result } as any;
  };
  bot.api.config.use(transformer);

  // Хвост инициализации (`getMe().then(...)`) успевает отработать до первого теста.
  await new Promise(resolve => setImmediate(resolve));
  calls.length = 0;

  return {
    bot,
    calls,
    sent: method => calls.filter(call => call.method === method),
    respond: (method, responder) => {
      responders.set(method, responder);
    },
    reset: () => {
      calls.length = 0;
      responders.clear();
    },
    receive: async update => {
      await bot.handleUpdate({ update_id: nextUpdateId++, ...update });
    },
  };
}

// ---------------------------------------------------------------------------
// Входящие обновления
// ---------------------------------------------------------------------------

export interface TgUser {
  id: number;
  first_name: string;
  username?: string;
  is_bot?: boolean;
}

export interface TgChat {
  id: number;
  type: 'private' | 'group' | 'supergroup';
  title?: string;
}

const date = () => Math.floor(Date.now() / 1000);

function tgUser(user: TgUser) {
  return { is_bot: false, ...user };
}

export function privateChat(user: TgUser): TgChat {
  return { id: user.id, type: 'private' };
}

export function groupChat(id: number, title = 'Обеденная группа'): TgChat {
  return { id, type: 'supergroup', title };
}

/** Текстовое сообщение; команда — это сообщение с сущностью bot_command. */
export function message(from: TgUser, chat: TgChat, text: string) {
  const isCommand = text.startsWith('/');
  const commandLength = isCommand ? text.split(' ')[0].length : 0;
  return {
    message: {
      message_id: nextMessageId++,
      date: date(),
      chat,
      from: tgUser(from),
      text,
      ...(isCommand
        ? { entities: [{ type: 'bot_command', offset: 0, length: commandLength }] }
        : {}),
    },
  } as unknown as Omit<Update, 'update_id'>;
}

/** Нажатие inline-кнопки под сообщением бота. */
export function callback(
  from: TgUser,
  chat: TgChat,
  data: string,
  messageText = 'сообщение бота'
) {
  return {
    callback_query: {
      id: String(nextUpdateId * 10 + 7),
      from: tgUser(from),
      chat_instance: 'ci',
      data,
      message: {
        message_id: nextMessageId++,
        date: date(),
        chat,
        from: { ...BOT_INFO },
        text: messageText,
      },
    },
  } as unknown as Omit<Update, 'update_id'>;
}

type MemberStatus =
  | 'creator'
  | 'administrator'
  | 'member'
  | 'restricted'
  | 'left'
  | 'kicked';

function chatMemberState(user: TgUser, status: MemberStatus) {
  return { user: tgUser(user), status };
}

/** Изменение статуса самого бота в чате (добавили, выгнали, повысили). */
export function myChatMember(
  chat: TgChat,
  actor: TgUser,
  oldStatus: MemberStatus,
  newStatus: MemberStatus
) {
  const botUser = { id: BOT_INFO.id, first_name: BOT_INFO.first_name, is_bot: true };
  return {
    my_chat_member: {
      chat,
      from: tgUser(actor),
      date: date(),
      old_chat_member: chatMemberState(botUser, oldStatus),
      new_chat_member: chatMemberState(botUser, newStatus),
    },
  } as unknown as Omit<Update, 'update_id'>;
}

/** Изменение статуса участника группы. */
export function chatMember(
  chat: TgChat,
  member: TgUser,
  oldStatus: MemberStatus,
  newStatus: MemberStatus,
  actor: TgUser = member
) {
  return {
    chat_member: {
      chat,
      from: tgUser(actor),
      date: date(),
      old_chat_member: chatMemberState(member, oldStatus),
      new_chat_member: chatMemberState(member, newStatus),
    },
  } as unknown as Omit<Update, 'update_id'>;
}

/** Служебное сообщение «в группу добавили участников». */
export function newChatMembers(chat: TgChat, actor: TgUser, members: TgUser[]) {
  return {
    message: {
      message_id: nextMessageId++,
      date: date(),
      chat,
      from: tgUser(actor),
      new_chat_members: members.map(tgUser),
    },
  } as unknown as Omit<Update, 'update_id'>;
}

export function preCheckoutQuery(
  from: TgUser,
  invoicePayload: string,
  totalAmount: number,
  currency = 'XTR'
) {
  return {
    pre_checkout_query: {
      id: `pcq-${nextUpdateId}`,
      from: tgUser(from),
      currency,
      total_amount: totalAmount,
      invoice_payload: invoicePayload,
    },
  } as unknown as Omit<Update, 'update_id'>;
}

export function successfulPayment(
  from: TgUser,
  invoicePayload: string,
  totalAmount: number,
  chargeId: string,
  currency = 'XTR'
) {
  return {
    message: {
      message_id: nextMessageId++,
      date: date(),
      chat: privateChat(from),
      from: tgUser(from),
      successful_payment: {
        currency,
        total_amount: totalAmount,
        invoice_payload: invoicePayload,
        telegram_payment_charge_id: chargeId,
        provider_payment_charge_id: '',
      },
    },
  } as unknown as Omit<Update, 'update_id'>;
}

// ---------------------------------------------------------------------------
// Разбор того, что ушло пользователю
// ---------------------------------------------------------------------------

interface InlineButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: { url: string };
}

/** Все кнопки inline-клавиатуры вызова (без раскладки по рядам). */
export function buttonsOf(call: ApiCall | undefined): InlineButton[] {
  const keyboard = call?.payload.reply_markup?.inline_keyboard as
    | InlineButton[][]
    | undefined;
  return keyboard ? keyboard.flat() : [];
}

/** Адреса web_app-кнопок вызова. */
export function webAppUrls(call: ApiCall | undefined): string[] {
  return buttonsOf(call)
    .map(button => button.web_app?.url)
    .filter((url): url is string => typeof url === 'string');
}

/** Отправки в конкретный чат. */
export function sentTo(fake: FakeTelegram, chatId: number | bigint): ApiCall[] {
  return fake
    .sent('sendMessage')
    .filter(call => String(call.payload.chat_id) === String(chatId));
}
