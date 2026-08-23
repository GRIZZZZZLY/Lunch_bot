/**
 * Shared typed bot instance singleton.
 * Services import this instead of keeping their own `let botInstance: any = null`.
 */
import { Bot } from 'grammy';
import type { BotContext } from '../types/bot.types';
import { logger } from '../utils/logger';
import { BaseError } from '../utils/error';

let instance: Bot<BotContext> | null = null;

/**
 * Store the bot instance. Called once from bot.ts during startup.
 */
export function setBotInstance(bot: Bot<BotContext>): void {
  instance = bot;
  logger.info('Shared bot instance registered');
}

/**
 * Returns the bot instance, or null if not yet initialized.
 * Use this when the bot being absent is acceptable (e.g. skip notification).
 */
export function getBotInstance(): Bot<BotContext> | null {
  return instance;
}

/**
 * Отсутствие бота — отдельный тип ошибки, а не текст сообщения.
 * HTTP-слой отвечает на него 503, и раньше он ловил это подстрокой: ветка
 * молча умерла, как только формулировка разошлась с брошенной ошибкой.
 *
 * Статус и код класс несёт сам (`BaseError`): контроллеру больше не нужно
 * переводить тип в ответ — это делает `error-handler`. Смысл прежний: сервис
 * недоступен сейчас, повтор осмыслен, поэтому 503, а не 500.
 */
export class BotNotInitializedError extends BaseError {
  constructor() {
    super('Bot instance is not initialized', 503, 'BOT_NOT_AVAILABLE');
  }
}

/**
 * Returns the bot instance and throws if it is not initialized.
 * Use this when the bot is required for the operation to succeed.
 */
export function getRequiredBotInstance(): Bot<BotContext> {
  if (!instance) {
    throw new BotNotInitializedError();
  }
  return instance;
}
