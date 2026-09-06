/**
 * Текст сообщений очереди уведомлений.
 *
 * Отдельный файл, потому что шаблоны — данные: их можно проверить, не поднимая
 * ни сервис, ни бота. Ровно по этой причине в `notification.templates.ts`
 * шаблоны когда-то вынесли из сервиса — испорченная кодировка дожила до
 * продакшена именно потому, что ни один тест не смотрел на сам текст.
 */
import { renderOutboxMessage } from '../../../services/outbox.templates';

describe('DEBT_MARKED_PAID', () => {
  const payload = {
    transactionId: 10,
    debtorFirstName: 'Игорь',
    amount: '250 ₽',
  };

  it('сообщает получателю об оплате и сумме', () => {
    const message = renderOutboxMessage('DEBT_MARKED_PAID', payload);

    expect(message!.text).toContain('Получена оплата');
    expect(message!.text).toContain('Игорь');
    expect(message!.text).toContain('250 ₽');
    expect(message!.parseMode).toBe('Markdown');
  });

  it('несёт кнопку подтверждения с id долга', () => {
    const message = renderOutboxMessage('DEBT_MARKED_PAID', payload);

    expect(message!.replyMarkup).toEqual({
      inline_keyboard: [
        [{ text: 'Подтвердить ✅', callback_data: 'budget:confirm:10' }],
      ],
    });
  });

  /* `_` в имени — обычное дело для Telegram. Без экранирования Markdown
     ломается, и получатель не узнаёт об оплате вообще. */
  it('имя должника экранируется', () => {
    const message = renderOutboxMessage('DEBT_MARKED_PAID', {
      ...payload,
      debtorFirstName: 'Соус_острый',
    });

    expect(message!.text).toContain('Соус\\_острый');
  });

  it('без id долга кнопки нет, но сообщение остаётся', () => {
    const message = renderOutboxMessage('DEBT_MARKED_PAID', {
      debtorFirstName: 'Игорь',
      amount: '250 ₽',
    });

    expect(message!.text).toContain('Получена оплата');
    expect(message!.replyMarkup).toBeUndefined();
  });
});

/**
 * Задание могло быть поставлено ДРУГОЙ версией кода: очередь переживает
 * выпуск и откат приложения. Падать на таком задании нельзя.
 */
describe('устойчивость к чужим данным', () => {
  it('неизвестный тип сообщения не собирается', () => {
    expect(renderOutboxMessage('SOMETHING_FROM_THE_FUTURE', {})).toBeNull();
  });

  it.each([
    ['null', null],
    ['строка', 'payload'],
    ['массив', [1, 2]],
    ['число', 42],
  ])('payload вида «%s» не ломает сборку', (_label, badPayload) => {
    const message = renderOutboxMessage('DEBT_MARKED_PAID', badPayload);

    expect(message!.text).toContain('Получена оплата');
    expect(message!.replyMarkup).toBeUndefined();
  });

  it('поля неверного типа считаются отсутствующими', () => {
    const message = renderOutboxMessage('DEBT_MARKED_PAID', {
      transactionId: 'десять',
      debtorFirstName: 42,
      amount: null,
    });

    expect(message!.text).toContain('Получена оплата');
    expect(message!.replyMarkup).toBeUndefined();
  });
});
