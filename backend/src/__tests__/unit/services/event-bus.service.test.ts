/**
 * Серверная сторона живых обновлений: шина, через которую сервисы сообщают
 * SSE-контроллеру, что что-то изменилось. До задачи 11 у неё не было ни одного
 * теста — при этом задача 05 прямо требовала «мутация → событие опубликовано»,
 * и зафиксировать это было нечем.
 *
 * Что здесь важно и ломается молча:
 *
 * 1. Отписка. SSE-соединение живёт до закрытия вкладки; если `off` не снимает
 *    слушателя, каждый переоткрытый экран добавляет ещё один, и через сотню
 *    подключений EventEmitter начинает предупреждать об утечке — а событие
 *    уходит в мёртвые ответы.
 * 2. Адресность. `debt_updated` и `store_run_updated` несут `audience` — список
 *    людей, которым событие адресовано. Ошибка здесь означает, что долг одного
 *    человека виден другому, поэтому поле проверяется как часть контракта.
 * 3. Синхронность. `emit` доставляет слушателям СИНХРОННО (EventEmitter), и
 *    сервисы на это опираются: событие публикуется после коммита транзакции.
 */
import {
  eventBus,
  type DebtUpdatedEvent,
  type PollUpdatedEvent,
} from '../../../services/event-bus.service';

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const NOW = '2026-08-23T12:00:00.000Z';

function pollEvent(over: Partial<PollUpdatedEvent> = {}): PollUpdatedEvent {
  return { pollId: 5, type: 'vote_added', userId: 1, timestamp: NOW, ...over };
}

/** Слушатели снимаются после каждого теста: шина — синглтон на весь процесс. */
const attached: Array<() => void> = [];

function listen<T>(
  eventName: Parameters<typeof eventBus.on>[0],
  listener: (data: T) => void
): jest.Mock {
  const spy = jest.fn(listener) as jest.Mock;
  eventBus.on(eventName, spy as never);
  attached.push(() => eventBus.off(eventName, spy as never));
  return spy;
}

afterEach(() => {
  while (attached.length) attached.pop()!();
  jest.clearAllMocks();
});

describe('доставка событий', () => {
  it('слушатель получает событие с тем же содержимым', () => {
    const listener = listen<PollUpdatedEvent>('poll_updated', () => undefined);

    eventBus.emit('poll_updated', pollEvent());

    expect(listener).toHaveBeenCalledWith(pollEvent());
  });

  /* Синхронность — часть контракта: сервис публикует событие ПОСЛЕ коммита и
     рассчитывает, что к следующей строке оно уже доставлено. */
  it('доставка синхронная, без ожидания микрозадач', () => {
    const listener = listen<PollUpdatedEvent>('poll_updated', () => undefined);

    eventBus.emit('poll_updated', pollEvent());

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('все слушатели одного события получают его', () => {
    const first = listen<PollUpdatedEvent>('poll_updated', () => undefined);
    const second = listen<PollUpdatedEvent>('poll_updated', () => undefined);

    eventBus.emit('poll_updated', pollEvent());

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('событие не уходит слушателям другого типа', () => {
    const debts = listen<DebtUpdatedEvent>('debt_updated', () => undefined);

    eventBus.emit('poll_updated', pollEvent());

    expect(debts).not.toHaveBeenCalled();
  });

  /* Событие без слушателей — норма: SSE-подключений может не быть вовсе, и
     мутация не имеет права падать из-за того, что никто не смотрит. */
  it('без слушателей emit не бросает', () => {
    expect(() => eventBus.emit('poll_updated', pollEvent())).not.toThrow();
  });
});

describe('отписка', () => {
  it('после off слушатель больше не вызывается', () => {
    const listener = jest.fn();
    eventBus.on('poll_updated', listener);
    eventBus.emit('poll_updated', pollEvent());

    eventBus.off('poll_updated', listener);
    eventBus.emit('poll_updated', pollEvent({ type: 'vote_removed' }));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  /**
   * Счётчик слушателей возвращается к исходному значению.
   *
   * Именно это ломается при утечке: SSE-контроллер подписывается на каждое
   * соединение, и не снятый слушатель живёт до перезапуска процесса. Проверяем
   * дельтой к исходному значению, а не абсолютным числом: шина — синглтон, и
   * в прогоне могли остаться подписки других наборов.
   */
  it('подписка и отписка не оставляют следа', () => {
    const before = eventBus.listenerCount('store_run_updated');
    const listener = jest.fn();

    eventBus.on('store_run_updated', listener);
    expect(eventBus.listenerCount('store_run_updated')).toBe(before + 1);

    eventBus.off('store_run_updated', listener);
    expect(eventBus.listenerCount('store_run_updated')).toBe(before);
  });

  it('off по незарегистрированному слушателю ничего не портит', () => {
    const before = eventBus.listenerCount('poll_updated');

    eventBus.off('poll_updated', jest.fn());

    expect(eventBus.listenerCount('poll_updated')).toBe(before);
  });
});

describe('адресность денежных событий', () => {
  /* `audience` — это ответ на вопрос «кому можно показать»: долг адресован
     двоим, и потеря поля означала бы рассылку чужого долга всем подписчикам. */
  it('долг несёт обоих участников', () => {
    const listener = listen<DebtUpdatedEvent>('debt_updated', () => undefined);

    eventBus.emit('debt_updated', {
      transactionId: 42,
      status: 'CONFIRMED',
      audience: [7, 9],
      timestamp: NOW,
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ audience: [7, 9], status: 'CONFIRMED' })
    );
  });

  it('закупка адресуется инициатору и заказавшим', () => {
    const listener = listen('store_run_updated', () => undefined);

    eventBus.emit('store_run_updated', {
      storeRunId: 3,
      status: 'SHOPPING',
      audience: [1, 2, 3],
      timestamp: NOW,
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ audience: [1, 2, 3] })
    );
  });
});

describe('синглтон', () => {
  /* Один экземпляр на процесс — иначе сервис публикует в одну шину, а
     SSE-контроллер слушает другую, и живые обновления «просто не работают». */
  it('импорт отдаёт тот же экземпляр', () => {
    const again = require('../../../services/event-bus.service').eventBus;

    expect(again).toBe(eventBus);
  });

  /* Предел слушателей поднят до 100 намеренно: столько может быть открытых
     SSE-соединений. Значение по умолчанию (10) начало бы печатать
     предупреждения об утечке на нормальной нагрузке. */
  it('предел слушателей рассчитан на сотню соединений', () => {
    const listeners = Array.from({ length: 40 }, () => jest.fn());
    const warn = jest.spyOn(process, 'emitWarning');

    for (const listener of listeners) eventBus.on('poll_updated', listener);
    for (const listener of listeners) eventBus.off('poll_updated', listener);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
