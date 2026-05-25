/**
 * Phase 3 (P2-5) — Avatar storage abstraction.
 *
 * Сейчас [avatar.controller.ts] делает live-proxy к api.telegram.org:
 *  - каждый запрос аватара = round-trip к Telegram CDN (latency, flakiness).
 *  - Cache-Control в браузере есть, но shared cache между пользователями
 *    отсутствует — другой пользователь грузит тот же аватар повторно.
 *
 * Цель абстракции — переключаться между:
 *   - TelegramPassthroughDriver  — текущее поведение (default).
 *   - S3StorageDriver            — копия + TTL refresh, отдаём из bucket.
 *
 * Контракт намеренно простой: получить URL аватара или Stream/Buffer.
 * Контроллер сам решает — pipe ли в response или 302 редирект.
 *
 * Активация S3 в env:
 *   AVATAR_STORAGE_DRIVER=s3
 *   AVATAR_S3_ENDPOINT=https://...
 *   AVATAR_S3_BUCKET=foodbot-avatars
 *   AVATAR_S3_ACCESS_KEY_ID=...
 *   AVATAR_S3_SECRET_ACCESS_KEY=...
 *   AVATAR_S3_PUBLIC_URL_BASE=https://cdn.example.com  // optional, если CDN перед bucket
 */

import { logger } from '../../utils/logger';
import { TelegramPassthroughDriver } from './telegram-passthrough.driver';
import { S3StorageDriver } from './s3-storage.driver';

export interface AvatarFetchResult {
  /** Если есть готовый public URL (S3/CDN) — отдаём 302 редирект. */
  redirectUrl?: string;
  /** Иначе stream/buffer с content-type. */
  stream?: NodeJS.ReadableStream;
  contentType?: string;
}

export interface AvatarStorageDriver {
  /** Имя драйвера для логов/метрик. */
  readonly name: string;
  /** Получить аватар по Telegram fileId. */
  fetch(fileId: string): Promise<AvatarFetchResult>;
}

function pickDriver(): AvatarStorageDriver {
  const choice = (process.env.AVATAR_STORAGE_DRIVER ?? 'telegram').toLowerCase();
  if (choice === 's3') {
    try {
      return new S3StorageDriver();
    } catch (err) {
      logger.error('AvatarStorage: S3 driver init failed, falling back to telegram', {
        err: (err as Error).message,
      });
    }
  }
  return new TelegramPassthroughDriver();
}

export const avatarStorage: AvatarStorageDriver = pickDriver();
