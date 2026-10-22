import crypto from 'crypto';

/* Помощники наборов аутентификации (`api/auth-*.test.ts`): вход идёт с
   ВКЛЮЧЁННОЙ проверкой подписи, поэтому initData подписывается здесь тем же
   алгоритмом, которым его подписывает Telegram. */

export type EnvPatch = Record<string, string | undefined>;

/** Применить переменные окружения; возвращает прежние значения для отката. */
export function applyEnv(vars: EnvPatch): EnvPatch {
  const saved: EnvPatch = {};
  for (const [key, value] of Object.entries(vars)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return saved;
}

/** Временно поменять окружение; восстанавливается и после исключения. */
export async function withEnv<T>(vars: EnvPatch, fn: () => T | Promise<T>): Promise<T> {
  const saved = applyEnv(vars);
  try {
    return await fn();
  } finally {
    applyEnv(saved);
  }
}

/** Токен бота, если окружение его не задало (CI задаёт свой). */
export const FALLBACK_BOT_TOKEN = '777000:auth-test';

/** initData, подписанный так же, как его подписывает Telegram (HMAC-SHA256). */
export function signInitData(
  fields: Record<string, string>,
  botToken = process.env.BOT_TOKEN as string
): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map(key => `${key}=${fields[key]}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

/** Поля initData свежего запуска Mini App. */
export function initDataFields(
  telegramId: number,
  firstName = 'Анна',
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: JSON.stringify({ id: telegramId, first_name: firstName, username: `u${telegramId}` }),
    ...extra,
  };
}
