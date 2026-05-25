/**
 * S3StorageDriver — scaffold.
 *
 * НЕ ВКЛЮЧЁН по умолчанию. Активация: AVATAR_STORAGE_DRIVER=s3 + установка SDK.
 *
 * Полная реализация требует:
 *   npm install --save @aws-sdk/client-s3
 *
 * Алгоритм:
 *   1. headObject(bucket, fileId).
 *      - 200 → существует, отдать 302 redirectUrl (или подписанный GET).
 *      - 404 → cache-miss path:
 *          a) скачать из Telegram (TelegramPassthroughDriver).
 *          b) putObject в bucket с TTL-tag.
 *          c) вернуть 302 redirectUrl.
 *   2. Фоновая lambda/cron чистит объекты старше N дней (lifecycle policy).
 *
 * Сейчас driver throws при попытке использовать — это сигнал, что нужен
 * полноценный install + код, а не silently fall through.
 */

import type { AvatarFetchResult, AvatarStorageDriver } from './index';
import { logger } from '../../utils/logger';

const REQUIRED_ENV = [
  'AVATAR_S3_ENDPOINT',
  'AVATAR_S3_BUCKET',
  'AVATAR_S3_ACCESS_KEY_ID',
  'AVATAR_S3_SECRET_ACCESS_KEY',
] as const;

export class S3StorageDriver implements AvatarStorageDriver {
  readonly name = 's3-storage';

  constructor() {
    const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(`S3StorageDriver: missing env vars: ${missing.join(', ')}`);
    }
    logger.info('S3StorageDriver constructed (scaffold — fetch will throw until impl is added)', {
      endpoint: process.env.AVATAR_S3_ENDPOINT,
      bucket: process.env.AVATAR_S3_BUCKET,
    });
  }

  async fetch(_fileId: string): Promise<AvatarFetchResult> {
    throw new Error(
      'S3StorageDriver.fetch() not implemented. Install @aws-sdk/client-s3 and finish the scaffold (see file header).',
    );
  }
}
