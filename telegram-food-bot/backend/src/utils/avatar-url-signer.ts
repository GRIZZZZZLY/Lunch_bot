/**
 * Signed avatar URL — HMAC подпись для `/api/avatar/:fileId`.
 *
 * Проблема: <img src> в HTML не может нести `Authorization: Bearer`,
 * а endpoint защищён `telegramAuthMiddleware` после security hardening.
 * Старый формат `tg://avatar/<fileId>` → `/api/avatar/<fileId>` стабильно
 * получал 401.
 *
 * Решение: бэк выдаёт URL вида
 *   /api/avatar/<fileId>?exp=<unixSec>&sig=<base64url(HMAC_SHA256(secret, fileId+exp))>
 *
 * Middleware на avatar.routes проверяет sig+exp вместо Bearer. Подпись:
 *  - короткоживущая (TTL 24h по умолчанию),
 *  - неугадываема (HMAC-SHA256, ключ = JWT_SECRET).
 *
 * Чужой пользователь не может ни сгенерировать ссылку (нет secret), ни
 * подобрать (32-байтный fileId × HMAC). Утечка ссылки = доступ только
 * к этому avatar и только до exp.
 */

import crypto from 'crypto';

const SIG_PARAM = 'sig';
const EXP_PARAM = 'exp';
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24h

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required to sign avatar URLs');
  }
  return secret;
}

function hmac(payload: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64url');
}

/**
 * Подписать URL для отдачи в browser-img.
 * Возвращает path-only URL (без хоста) — фронт ставит относительно текущего origin.
 */
export function signAvatarUrl(fileId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  if (!fileId) throw new Error('fileId required');
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = hmac(`${fileId}:${exp}`);
  const safeFileId = encodeURIComponent(fileId);
  return `/api/avatar/${safeFileId}?${EXP_PARAM}=${exp}&${SIG_PARAM}=${sig}`;
}

/**
 * Проверка подписи. Сравнение времени-постоянное (crypto.timingSafeEqual).
 */
export function verifyAvatarSignature(
  fileId: string,
  exp: string | undefined,
  sig: string | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!fileId) return { ok: false, reason: 'missing fileId' };
  if (!exp) return { ok: false, reason: 'missing exp' };
  if (!sig) return { ok: false, reason: 'missing sig' };

  const expNum = Number.parseInt(exp, 10);
  if (!Number.isFinite(expNum)) return { ok: false, reason: 'invalid exp' };

  const nowSec = Math.floor(Date.now() / 1000);
  if (expNum < nowSec) return { ok: false, reason: 'expired' };

  const expected = hmac(`${fileId}:${expNum}`);

  // Базы Buffer одинаковой длины — иначе timingSafeEqual бросает.
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(sig);
  if (expectedBuf.length !== providedBuf.length) {
    return { ok: false, reason: 'bad signature' };
  }
  if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return { ok: false, reason: 'bad signature' };
  }
  return { ok: true };
}

export const AVATAR_SIG_PARAMS = { SIG_PARAM, EXP_PARAM } as const;
