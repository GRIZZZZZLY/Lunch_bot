/**
 * Shared typed bot instance singleton.
 * Services import this instead of keeping their own `let botInstance: any = null`.
 */
import { Bot } from 'grammy';
import type { BotContext } from '../types/bot.types';
import { logger } from '../utils/logger';

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
 * Returns the bot instance and throws if it is not initialized.
 * Use this when the bot is required for the operation to succeed.
 */
export function getRequiredBotInstance(): Bot<BotContext> {
  if (!instance) {
    throw new Error('Bot instance is not initialized');
  }
  return instance;
}
