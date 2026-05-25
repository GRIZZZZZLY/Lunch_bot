/**
 * Phase 3 (P2-4) — Feature flag abstraction.
 *
 * Зачем: до этого новая фича = новый деплой. Если плохо — откат через
 * полный rollback. С флагами:
 *   - раскат на % пользователей (gradual rollout)
 *   - kill switch без деплоя (instant disable при инциденте)
 *   - A/B тесты по userId
 *
 * Слой провайдеров:
 *   EnvProvider     — стартовый, читает FEATURE_FLAGS_JSON из env.
 *                     Подходит для on/off флагов без сегментации.
 *   PostHogProvider — TODO (P3): polling/streaming флагов с postHog API.
 *   UnleashProvider — TODO (P3): self-hosted альтернатива.
 *
 * API эргономика:
 *   isEnabled('new_voting_ui')                   // bool
 *   isEnabled('new_voting_ui', { userId: 123 }) // bool с сегментацией
 *   variant('checkout_layout')                   // 'A' | 'B' | 'control'
 *
 * Use site:
 *   if (await featureFlags.isEnabled('budget_v2', { userId: ctx.user.id })) {
 *     // new flow
 *   } else {
 *     // legacy flow
 *   }
 *
 * Flag value формат в FEATURE_FLAGS_JSON:
 *   {
 *     "budget_v2": { "enabled": true, "rollout": 25 },           // 25% юзеров
 *     "new_admin_ui": { "enabled": true, "allowUserIds": [7] }, // только 7
 *     "kill_switch_payments": { "enabled": false }              // instant off
 *   }
 */

import { logger } from './logger';

export interface FlagContext {
  /** Внутренний User.id (НЕ telegramId — он BigInt). */
  userId?: number;
  /** Дополнительные сегменты — для A/B по группе или роли. */
  segments?: Record<string, string | number | boolean>;
}

interface FlagConfig {
  enabled: boolean;
  /** Процент users для постепенного раската (0..100). */
  rollout?: number;
  /** Whitelist user ids — игнорирует rollout. */
  allowUserIds?: number[];
  /** Blacklist — exclude всегда. */
  denyUserIds?: number[];
  /** Для variant() — список вариантов, выбираемых детерминированно по userId. */
  variants?: string[];
}

export interface FeatureFlagProvider {
  isEnabled(flag: string, ctx?: FlagContext): boolean;
  variant(flag: string, ctx?: FlagContext): string | undefined;
  refresh(): Promise<void>;
}

/**
 * Детерминированный hash userId → bucket [0..99]. Один и тот же user всегда
 * попадает в один и тот же bucket, поэтому раскат на 25% всегда даёт тех же
 * 25% юзеров.
 */
function bucketOf(userId: number, flag: string): number {
  // FNV-1a — простой, без зависимостей, достаточно равномерный.
  let h = 0x811c9dc5;
  const s = `${flag}:${userId}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h) % 100;
}

class EnvProvider implements FeatureFlagProvider {
  private flags: Record<string, FlagConfig> = {};

  constructor() {
    this.refresh().catch((err) => {
      logger.warn('FeatureFlags: initial load failed', { err: (err as Error).message });
    });
  }

  async refresh(): Promise<void> {
    const raw = process.env.FEATURE_FLAGS_JSON;
    if (!raw) {
      this.flags = {};
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.flags = parsed as Record<string, FlagConfig>;
      }
    } catch (err) {
      logger.error('FeatureFlags: FEATURE_FLAGS_JSON parse failed', {
        err: (err as Error).message,
      });
    }
  }

  isEnabled(flag: string, ctx?: FlagContext): boolean {
    const cfg = this.flags[flag];
    if (!cfg) return false;
    if (!cfg.enabled) return false;

    const userId = ctx?.userId;

    if (userId !== undefined) {
      if (cfg.denyUserIds?.includes(userId)) return false;
      if (cfg.allowUserIds?.includes(userId)) return true;
    }

    const rollout = cfg.rollout;
    if (rollout === undefined || rollout >= 100) return true;
    if (rollout <= 0) return false;

    // Без userId детерминизма нет — берём как полностью enabled,
    // если rollout >= 50, иначе disabled. По умолчанию консервативно.
    if (userId === undefined) return rollout >= 100;

    return bucketOf(userId, flag) < rollout;
  }

  variant(flag: string, ctx?: FlagContext): string | undefined {
    const cfg = this.flags[flag];
    if (!cfg?.enabled) return undefined;
    const variants = cfg.variants;
    if (!variants || variants.length === 0) return undefined;
    const userId = ctx?.userId;
    if (userId === undefined) return variants[0];
    return variants[bucketOf(userId, flag) % variants.length];
  }
}

export const featureFlags: FeatureFlagProvider = new EnvProvider();

// Hot-reload флагов раз в 30 сек (для env-driven полезно при `pm2 reload --update-env`).
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    featureFlags.refresh().catch(() => undefined);
  }, 30_000).unref();
}
