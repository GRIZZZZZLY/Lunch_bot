/**
 * Классификация сбоя доставки в Telegram решает судьбу уведомления в очереди:
 * постоянная ошибка закрывает задание, временная возвращает его на повтор.
 * Объявить временную ошибку постоянной — потерять уведомление о деньгах.
 *
 * 403 и 502 проверены на настоящей очереди в
 * integration/api/budget-lifecycle.redis.test.ts; сетевые ошибки Node и
 * неизвестные — главный вид настоящего сбоя связи — только здесь.
 */
import { classifyDeliveryError } from '../../../utils/post-commit';

const telegramError = (errorCode: number) =>
  Object.assign(new Error('Telegram API error'), { error_code: errorCode });

it.each<[string, unknown, boolean]>([
  ['403 — адресат заблокировал бота', telegramError(403), true],
  ['400 — испорченный запрос', telegramError(400), true],
  ['429 — лимит Telegram', telegramError(429), false],
  ['502 — Telegram недоступен', telegramError(502), false],
  ['сетевая ошибка Node', Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }), false],
  ['неизвестная ошибка', new Error('boom'), false],
  ['не объект', undefined, false],
])('%s → постоянная: %s', (_name, error, permanent) => {
  expect(classifyDeliveryError(error).permanent).toBe(permanent);
});
