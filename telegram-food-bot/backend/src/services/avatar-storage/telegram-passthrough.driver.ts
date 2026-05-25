/**
 * Default driver — текущее поведение avatar.controller. Качает файл из
 * api.telegram.org через bot.api.getFile + https.get, отдаёт stream.
 */

import https from 'https';
import type { AvatarFetchResult, AvatarStorageDriver } from './index';
import { getBotInstance } from '../../bot/bot-instance';

export class TelegramPassthroughDriver implements AvatarStorageDriver {
  readonly name = 'telegram-passthrough';

  async fetch(fileId: string): Promise<AvatarFetchResult> {
    const bot = getBotInstance();
    if (!bot) {
      throw new Error('Bot instance not available');
    }

    const file = await bot.api.getFile(fileId);
    if (!file.file_path) {
      throw new Error('Telegram file_path not found');
    }

    const token = bot.token;
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    return new Promise((resolve, reject) => {
      const req = https.get(fileUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Telegram CDN returned ${response.statusCode ?? 'unknown'}`));
          return;
        }
        resolve({
          stream: response,
          contentType: response.headers['content-type'] ?? 'image/jpeg',
        });
      });
      req.on('error', reject);
    });
  }
}
