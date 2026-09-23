/**
 * Адрес Mini App так, как его открывает Telegram: подписанный initData в
 * `#tgWebAppData`. Официальный `telegram-web-app.js` сам разбирает этот хеш,
 * поэтому Lighthouse меряет авторизованный экран без подмены кода приложения.
 *
 * Подпись — той же схемой, что проверяет сервер (HMAC с ключом от токена бота),
 * пользователь — Анна из `backend/src/scripts/e2e-seed.ts`. Подпись
 * устаревает, поэтому адрес собирается в момент запуска.
 */
const { createHmac } = require('node:crypto');

const ANNA = { id: 700000101, first_name: 'Анна', last_name: 'Тестова', username: 'anna_e2e' };

function signedInitData(botToken, user = ANNA) {
  const params = new URLSearchParams({
    query_id: 'lighthouse',
    user: JSON.stringify({ ...user, language_code: 'ru' }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  });
  const checkString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(checkString).digest('hex'));
  return params.toString();
}

function telegramUrl(baseUrl, path, botToken) {
  const hash = new URLSearchParams({
    tgWebAppData: signedInitData(botToken),
    tgWebAppVersion: '8.0',
    tgWebAppPlatform: 'android',
  });
  return `${baseUrl.replace(/\/$/, '')}${path}#${hash}`;
}

module.exports = { telegramUrl };
