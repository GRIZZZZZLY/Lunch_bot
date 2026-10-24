/**
 * Сообщения очереди уведомлений о долгах уходят в Markdown. `_` в имени —
 * обычное дело для Telegram; без экранирования Telegram отвечает
 * `can't parse entities`, и получатель не узнаёт об оплате вообще. Доставка,
 * правка старых сообщений и повторы проверяются на настоящей очереди в
 * integration/api/budget-lifecycle.redis.test.ts — там имена без разметки.
 */
import { renderOutboxMessage } from '../../../services/outbox.templates';

const NAME = 'Соус_острый';
const ESCAPED = 'Соус\\_острый';

it.each<[string, unknown]>([
  ['DEBT_MARKED_PAID', { transactionId: 10, debtorFirstName: NAME, amount: '250 ₽' }],
  ['STORE_RUN_MARKED_PAID', { storeRunId: 30, debtorId: 2, debtorFirstName: NAME, amount: '200.00₽' }],
  ['DEBT_MARK_CANCELLED', { debtorFirstName: NAME, amount: '250.00₽' }],
  ['DEBTS_ALL_CONFIRMED', { total: '460.00₽', lines: [{ name: NAME, amount: '210.00₽' }], forced: false }],
])('%s экранирует подставленное имя', (type, payload) => {
  expect(renderOutboxMessage(type, payload)!.text).toContain(ESCAPED);
});
