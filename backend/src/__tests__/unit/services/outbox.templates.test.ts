/**
 * Сборка сообщений очереди уведомлений. Шаблоны — данные, их можно проверить,
 * не поднимая ни сервис, ни бота. Проверяется то, от чего зависит доставка и
 * действие человека: экранирование имён (иначе Markdown ломается и сообщение
 * не уходит), callback_data кнопок, правка старого сообщения вместо нового и
 * устойчивость к заданиям, поставленным другой версией кода.
 */
import { renderOutboxMessage } from '../../../services/outbox.templates';

describe('DEBT_MARKED_PAID', () => {
  const payload = {
    transactionId: 10,
    debtorFirstName: 'Игорь',
    amount: '250 ₽',
  };

  it('называет должника и сумму', () => {
    const message = renderOutboxMessage('DEBT_MARKED_PAID', payload);

    expect(message!.text).toContain('Игорь');
    expect(message!.text).toContain('250 ₽');
    expect(message!.parseMode).toBe('Markdown');
  });

  it('несёт кнопку подтверждения с id долга', () => {
    const message = renderOutboxMessage('DEBT_MARKED_PAID', payload);

    expect(message!.replyMarkup!.inline_keyboard[0][0]).toMatchObject({
      callback_data: 'budget:confirm:10',
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

    expect(message!.text).toContain('Игорь');
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

    expect(message!.text).toEqual(expect.any(String));
    expect(message!.replyMarkup).toBeUndefined();
  });

  it('поля неверного типа считаются отсутствующими', () => {
    const message = renderOutboxMessage('DEBT_MARKED_PAID', {
      transactionId: 'десять',
      debtorFirstName: 42,
      amount: null,
    });

    expect(message!.text).toEqual(expect.any(String));
    expect(message!.replyMarkup).toBeUndefined();
  });
});

describe('STORE_RUN_MARKED_PAID', () => {
  const payload = {
    storeRunId: 30,
    debtorId: 2,
    debtorFirstName: 'Соус_острый',
    amount: '200.00₽',
  };

  it('несёт кнопку подтверждения заказа этого должника', () => {
    const message = renderOutboxMessage('STORE_RUN_MARKED_PAID', payload);

    expect(message!.replyMarkup!.inline_keyboard[0][0]).toMatchObject({
      callback_data: 'budget:srun_confirm:30:2',
    });
  });

  it('имя должника экранируется', () => {
    expect(renderOutboxMessage('STORE_RUN_MARKED_PAID', payload)!.text).toContain(
      'Соус\\_острый'
    );
  });
});

describe('DEBT_MARK_CANCELLED', () => {
  it('называет сумму и экранирует имя', () => {
    const message = renderOutboxMessage('DEBT_MARK_CANCELLED', {
      debtorFirstName: 'Соус_острый',
      amount: '250.00₽',
    });

    expect(message!.text).toContain('Соус\\_острый');
    expect(message!.text).toContain('250.00₽');
    expect(message!.parseMode).toBe('Markdown');
  });
});

describe('DEBT_CONFIRMED', () => {
  it('без сохранённого сообщения — просто новое сообщение', () => {
    const message = renderOutboxMessage('DEBT_CONFIRMED', {
      payeeFirstName: 'Аня',
      amount: '250.00₽',
    });

    expect(message!.text).toContain('250.00₽');
    expect(message!.edit).toBeUndefined();
  });

  it('с сохранённым сообщением — правка вместо нового', () => {
    const message = renderOutboxMessage('DEBT_CONFIRMED', {
      payeeFirstName: 'Аня',
      amount: '250.00₽',
      editChatId: '555',
      editMessageId: 33,
    });

    expect(message!.edit).toEqual({ chatId: '555', messageId: 33, alsoSend: false });
  });
});

describe('DEBT_CONFIRMATION_UNDONE', () => {
  /* Должнику уже сказали «оплата подтверждена»: старое сообщение
     переписывается, но и новое обязательно, иначе событие легко пропустить. */
  it('правит старое сообщение И шлёт новое', () => {
    const message = renderOutboxMessage('DEBT_CONFIRMATION_UNDONE', {
      payeeFirstName: 'Аня',
      amount: '250.00₽',
      editChatId: '555',
      editMessageId: 33,
    });

    expect(message!.edit).toEqual({ chatId: '555', messageId: 33, alsoSend: true });
  });
});

describe('DEBTS_ALL_CONFIRMED', () => {
  it('итог и каждая строка попадают в сводку, имена экранируются', () => {
    const message = renderOutboxMessage('DEBTS_ALL_CONFIRMED', {
      total: '460.00₽',
      lines: [
        { name: 'Игорь', amount: '250.00₽' },
        { name: 'Соус_острый', amount: '210.00₽' },
      ],
      forced: false,
    });

    expect(message!.text).toContain('460.00₽');
    expect(message!.text).toContain('Игорь');
    expect(message!.text).toContain('250.00₽');
    expect(message!.text).toContain('Соус\\_острый');
    expect(message!.text).toContain('210.00₽');
  });

  it('битые строки списка не ломают сборку', () => {
    const message = renderOutboxMessage('DEBTS_ALL_CONFIRMED', {
      total: '0.00₽',
      lines: [null, 'строка', { name: 42 }],
    });

    expect(message!.text).toContain('0.00₽');
  });
});
