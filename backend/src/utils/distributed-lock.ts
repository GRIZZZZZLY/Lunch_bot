import { randomUUID } from 'crypto';
import { cacheService } from '../services/cache.service';
import { logger } from './logger';

export async function withDistributedLock(
  key: string,
  ttlSeconds: number,
  work: () => Promise<void>
): Promise<boolean> {
  const owner = randomUUID();
  const acquired = await cacheService.setIfAbsent(key, owner, ttlSeconds);

  if (acquired === 'exists') {
    logger.info('Background job skipped: another instance owns the lock', {
      key,
    });
    return false;
  }

  if (acquired === 'unavailable') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Distributed lock storage unavailable for ${key}`);
    }
    logger.warn('Background job lock unavailable outside production', { key });
    await work();
    return true;
  }

  try {
    await work();
    return true;
  } finally {
    await cacheService.deleteIfValueMatches(key, owner);
  }
}
