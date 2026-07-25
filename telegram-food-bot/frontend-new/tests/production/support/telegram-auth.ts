import { createHmac } from 'node:crypto';

export interface ProductionIdentity {
  groupName: string;
  initData: string;
  userId: number;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Не задана обязательная переменная ${name}.`);
  return value;
}

export function productionIdentity(): ProductionIdentity {
  const botToken = required('E2E_PRODUCTION_BOT_TOKEN');
  const groupName = required('E2E_PRODUCTION_GROUP_NAME');
  const userId = Number(required('E2E_PRODUCTION_USER_ID'));
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('E2E_PRODUCTION_USER_ID должен быть положительным целым числом.');
  }

  const firstName = process.env.E2E_PRODUCTION_FIRST_NAME?.trim() || 'Проверка';
  const lastName = process.env.E2E_PRODUCTION_LAST_NAME?.trim() || 'Продакшена';
  const username = process.env.E2E_PRODUCTION_USERNAME?.trim() || 'production_smoke';
  const params = new URLSearchParams({
    query_id: 'production-read-only-smoke',
    user: JSON.stringify({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      username,
      language_code: 'ru',
    }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  });
  const checkString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(checkString).digest('hex'));

  return { groupName, initData: params.toString(), userId };
}
