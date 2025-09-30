import { Context, SessionFlavor } from 'grammy';
import { User } from './database.types';

// Контекст бота с сессией
export interface SessionData {
  user?: User;
  step?: string;
  tempData?: any;
}

export type BotContext = Context & SessionFlavor<SessionData>;

// Данные пользователя Telegram
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

// Данные чата Telegram
export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  all_members_are_administrators?: boolean;
}

// Inline клавиатуры
export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: {
    url: string;
  };
}

// Callback данные
export interface CallbackData {
  action: string;
  data?: any;
}

// Типы команд бота
export type BotCommand = 
  | 'start'
  | 'help' 
  | 'menu'
  | 'startpoll'
  | 'history'
  | 'settings';

// Middleware типы
export interface BotMiddleware {
  name: string;
  handler: (ctx: BotContext, next: () => Promise<void>) => Promise<void>;
}

// Обработчики команд
export type CommandHandler = (ctx: BotContext) => Promise<void>;

// Обработчики callback queries
export type CallbackHandler = (ctx: BotContext) => Promise<void>;

// Конфигурация команд бота
export interface BotCommandConfig {
  command: string;
  description: string;
  adminOnly?: boolean;
  groupOnly?: boolean;
  privateOnly?: boolean;
}

// Статусы голосования для бота
export enum BotPollStatus {
  WAITING = 'waiting',
  ACTIVE = 'active', 
  ENDED = 'ended',
  CANCELLED = 'cancelled'
}

// Данные для голосования
export interface PollData {
  id: number;
  groupId: number;
  messageId?: number;
  status: BotPollStatus;
  items: Array<{
    id: number;
    name: string;
    votes: number;
  }>;
  totalVotes: number;
  startedAt: Date;
  endsAt: Date;
  createdBy: number;
}

// Результаты рулетки
export interface RouletteResult {
  winner: {
    id: number;
    name: string;
    votes: number;
  };
  responsible: {
    id: number;
    firstName: string;
    username?: string;
  };
  animation: string[];
}

// Ошибки бота
export class BotError extends Error {
  public readonly code: string;
  public readonly isPublic: boolean;

  constructor(message: string, code: string, isPublic: boolean = true) {
    super(message);
    this.name = 'BotError';
    this.code = code;
    this.isPublic = isPublic;
  }
}

// Коды ошибок
export enum BotErrorCodes {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  GROUP_NOT_FOUND = 'GROUP_NOT_FOUND', 
  POLL_NOT_FOUND = 'POLL_NOT_FOUND',
  MENU_EMPTY = 'MENU_EMPTY',
  POLL_ALREADY_ACTIVE = 'POLL_ALREADY_ACTIVE',
  POLL_NOT_ACTIVE = 'POLL_NOT_ACTIVE',
  USER_ALREADY_VOTED = 'USER_ALREADY_VOTED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  INVALID_CALLBACK_DATA = 'INVALID_CALLBACK_DATA',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DATABASE_ERROR = 'DATABASE_ERROR'
}
