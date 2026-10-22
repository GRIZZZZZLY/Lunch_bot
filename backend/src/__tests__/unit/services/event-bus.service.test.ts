/**
 * Серверная сторона живых обновлений: шина, через которую сервисы сообщают
 * SSE-контроллеру, что что-то изменилось.
 *
 * Важна отписка: SSE-соединение живёт до закрытия вкладки; если `off` не
 * снимает слушателя, каждый переоткрытый экран добавляет ещё один, и событие
 * уходит в мёртвые ответы.
 */
import { eventBus, type PollUpdatedEvent } from '../../../services/event-bus.service';

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function pollEvent(over: Partial<PollUpdatedEvent> = {}): PollUpdatedEvent {
  return {
    pollId: 5,
    type: 'vote_added',
    userId: 1,
    timestamp: '2026-08-23T12:00:00.000Z',
    ...over,
  };
}

it('слушатель получает событие с тем же содержимым', () => {
  const listener = jest.fn();
  eventBus.on('poll_updated', listener);

  eventBus.emit('poll_updated', pollEvent());
  eventBus.off('poll_updated', listener);

  expect(listener).toHaveBeenCalledWith(pollEvent());
});

it('после off слушатель больше не вызывается', () => {
  const listener = jest.fn();
  eventBus.on('poll_updated', listener);
  eventBus.emit('poll_updated', pollEvent());

  eventBus.off('poll_updated', listener);
  eventBus.emit('poll_updated', pollEvent({ type: 'vote_removed' }));

  expect(listener).toHaveBeenCalledTimes(1);
});
