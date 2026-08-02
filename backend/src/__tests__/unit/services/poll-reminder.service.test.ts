/**
 * Напоминания о голосовании.
 *
 * Важный факт об этом сервисе: рассылка напоминаний ОТКЛЮЧЕНА — вместо трёх
 * сообщений группа получает одно, обновляемое каждую минуту. `scheduleReminders`
 * поэтому не ставит ни одного таймера, а только регистрирует голосование, и
 * тесты это закрепляют: если таймеры вернут, участники начнут снова получать
 * по три сообщения на каждое голосование.
 *
 * Сами отправители (`sendReminderNotification`, `sendFinalCallNotification`,
 * `sendPersonalReminders`) из продакшена сейчас недостижимы. Они проверяются
 * через явное приведение типа: это описание контракта на случай, когда
 * напоминания включат обратно, и защита от того, чтобы включение сразу
 * привело к спаму или падению на заблокировавших бота.
 */
import { PollReminderService } from '../../../services/poll-reminder.service';
import { PollService } from '../../../services/poll.service';
import { UserService } from '../../../services/user.service';
import { asServiceMock } from '../../helpers/mocks';

jest.mock('../../../services/poll.service', () => ({
  PollService: { getPollById: jest.fn() },
}));

jest.mock('../../../services/user.service', () => ({
  UserService: { getUsersByGroupId: jest.fn() },
}));

jest.mock('../../../services/vote.service', () => ({
  VoteService: { getVotesByPollId: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const polls = asServiceMock(PollService);
const users = asServiceMock(UserService);
const { logger } = jest.requireMock('../../../utils/logger');

/** Доступ к приватным отправителям — из продакшена они сейчас не вызываются. */
const senders = PollReminderService as unknown as {
  sendReminderNotification(
    pollId: number,
    chatId: bigint,
    minutesRemaining: number
  ): Promise<void>;
  sendFinalCallNotification(pollId: number, chatId: bigint): Promise<void>;
  sendPersonalReminders(
    pollId: number,
    minutesRemaining: number
  ): Promise<void>;
};

const api = { sendMessage: jest.fn() };

function activePoll(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: 'ACTIVE',
    group: { id: 100 },
    votes: [{ userId: 1 }, { userId: 1 }, { userId: 2 }],
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  api.sendMessage.mockResolvedValue({ message_id: 1 });
  PollReminderService.initialize({ api });
  polls.getPollById.mockResolvedValue(activePoll());
  users.getUsersByGroupId.mockResolvedValue([]);
  for (const pollId of PollReminderService.getActiveReminders()) {
    PollReminderService.cancelReminders(pollId);
  }
});

describe('планирование', () => {
  it('инициализация запоминает бота', () => {
    expect(logger.info).toHaveBeenCalledWith('PollReminderService initialized');
  });

  it('голосование регистрируется, но ни одного таймера не ставится', () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    PollReminderService.scheduleReminders(1, 15, 100n);

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(PollReminderService.getActiveReminders()).toEqual([1]);
    setTimeoutSpy.mockRestore();
  });

  it('в логе прямо сказано, что напоминания отключены', () => {
    PollReminderService.scheduleReminders(2, 15, 100n);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Reminder notifications DISABLED for poll 2')
    );
  });

  it('несколько голосований учитываются независимо', () => {
    PollReminderService.scheduleReminders(1, 15, 100n);
    PollReminderService.scheduleReminders(2, 15, 200n);

    expect(PollReminderService.getActiveReminders()).toEqual([1, 2]);
  });

  it('повторное планирование не создаёт вторую запись', () => {
    PollReminderService.scheduleReminders(1, 15, 100n);
    PollReminderService.scheduleReminders(1, 20, 100n);

    expect(PollReminderService.getActiveReminders()).toEqual([1]);
  });
});

describe('отмена', () => {
  it('отмена убирает голосование из активных', () => {
    PollReminderService.scheduleReminders(1, 15, 100n);

    PollReminderService.cancelReminders(1);

    expect(PollReminderService.getActiveReminders()).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith('Cancelled reminders for poll 1');
  });

  it('отмена незарегистрированного голосования ничего не делает', () => {
    PollReminderService.cancelReminders(999);

    expect(logger.info).not.toHaveBeenCalledWith(
      'Cancelled reminders for poll 999'
    );
  });

  it('остановка бота снимает все напоминания', () => {
    PollReminderService.scheduleReminders(1, 15, 100n);
    PollReminderService.scheduleReminders(2, 15, 200n);

    PollReminderService.cancelAllReminders();

    expect(PollReminderService.getActiveReminders()).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith('Cancelled all reminders');
  });

  it('поставленные таймеры снимаются, а не остаются висеть', () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    const timers = { tenMinutes: setTimeout(() => {}, 1000) };
    (
      PollReminderService as unknown as {
        reminders: Map<number, { pollId: number; timers: unknown }>;
      }
    ).reminders.set(3, { pollId: 3, timers });

    PollReminderService.cancelReminders(3);

    expect(clearSpy).toHaveBeenCalledWith(timers.tenMinutes);
    clearSpy.mockRestore();
  });
});

describe('групповое напоминание (сейчас не вызывается из продакшена)', () => {
  it('сообщение называет остаток времени и число проголосовавших', async () => {
    await senders.sendReminderNotification(1, 100n, 10);

    const [chatId, text] = api.sendMessage.mock.calls[0];
    expect(chatId).toBe(100);
    expect(text).toContain('Осталось 10 минут');
    // Два голоса одного человека считаются за одного участника.
    expect(text).toContain('Уже проголосовало: 2');
  });

  it('завершённое голосование напоминания не получает', async () => {
    polls.getPollById.mockResolvedValue(activePoll({ status: 'COMPLETED' }));

    await senders.sendReminderNotification(1, 100n, 10);

    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Poll 1 is not active, skipping reminder'
    );
  });

  it('удалённое голосование напоминания не получает', async () => {
    polls.getPollById.mockResolvedValue(null);

    await senders.sendReminderNotification(1, 100n, 10);

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('голосование без голосов показывает ноль, а не пусто', async () => {
    polls.getPollById.mockResolvedValue(activePoll({ votes: undefined }));

    await senders.sendReminderNotification(1, 100n, 5);

    expect(api.sendMessage.mock.calls[0][1]).toContain('Уже проголосовало: 0');
  });

  it('сбой отправки не выбрасывается наружу', async () => {
    api.sendMessage.mockRejectedValue(new Error('chat not found'));

    await expect(
      senders.sendReminderNotification(1, 100n, 10)
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Error sending reminder notification for poll 1:',
      expect.any(Error)
    );
  });
});

describe('последний шанс (сейчас не вызывается из продакшена)', () => {
  it('сообщение говорит про 30 секунд и число проголосовавших', async () => {
    await senders.sendFinalCallNotification(1, 100n);

    const text = api.sendMessage.mock.calls[0][1] as string;
    expect(text).toContain('Последний шанс');
    expect(text).toContain('Проголосовало: 2');
  });

  it('неактивное голосование сообщения не получает', async () => {
    polls.getPollById.mockResolvedValue(activePoll({ status: 'CANCELLED' }));

    await senders.sendFinalCallNotification(1, 100n);

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('удалённое голосование сообщения не получает', async () => {
    polls.getPollById.mockResolvedValue(null);

    await senders.sendFinalCallNotification(1, 100n);

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('сбой отправки не выбрасывается наружу', async () => {
    api.sendMessage.mockRejectedValue(new Error('chat not found'));

    await expect(
      senders.sendFinalCallNotification(1, 100n)
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Error sending final call notification for poll 1:',
      expect.any(Error)
    );
  });
});

describe('личные напоминания (сейчас не вызываются из продакшена)', () => {
  function members(count: number, startId = 1) {
    return Array.from({ length: count }, (_, index) => ({
      id: startId + index,
      telegramId: BigInt(1000 + startId + index),
      firstName: `U${startId + index}`,
    }));
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** Личные напоминания шлются с паузой 100 мс — прокручиваем её. */
  async function send(pollId = 1, minutes = 10): Promise<void> {
    const promise = senders.sendPersonalReminders(pollId, minutes);
    await jest.advanceTimersByTimeAsync(60_000);
    await promise;
  }

  it('пишут только тем, кто ещё не голосовал', async () => {
    polls.getPollById.mockResolvedValue(
      activePoll({ votes: [{ userId: 1 }] })
    );
    users.getUsersByGroupId.mockResolvedValue(members(3));

    await send();

    const recipients = api.sendMessage.mock.calls.map(call => call[0]);
    expect(recipients).toEqual([1002, 1003]);
  });

  it('в сообщении есть имя и кнопка перехода к голосованию', async () => {
    users.getUsersByGroupId.mockResolvedValue(members(1, 5));

    await send(7, 3);

    const [, text, options] = api.sendMessage.mock.calls[0];
    expect(text).toContain('Привет, U5');
    expect(text).toContain('Осталось 3 минут');
    expect(JSON.stringify(options)).toContain('openpoll:7');
  });

  it('рассылка ограничена 50 адресатами за раз', async () => {
    users.getUsersByGroupId.mockResolvedValue(members(60));
    polls.getPollById.mockResolvedValue(activePoll({ votes: [] }));

    await send();

    expect(api.sendMessage).toHaveBeenCalledTimes(50);
    expect(logger.info).toHaveBeenCalledWith(
      'Sent personal reminders to 50 users for poll 1'
    );
  });

  it('заблокировавший бота не попадает в предупреждения', async () => {
    users.getUsersByGroupId.mockResolvedValue(members(1, 9));
    api.sendMessage.mockRejectedValue(
      Object.assign(new Error('403'), {
        description: 'Forbidden: bot was blocked by the user',
      })
    );

    await send();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('прочие отказы Telegram логируются, но рассылку не прерывают', async () => {
    users.getUsersByGroupId.mockResolvedValue(members(2, 20));
    polls.getPollById.mockResolvedValue(activePoll({ votes: [] }));
    api.sendMessage
      .mockRejectedValueOnce(
        Object.assign(new Error('400'), { description: 'chat not found' })
      )
      .mockResolvedValue({ message_id: 1 });

    await send();

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to send personal reminder to user 20:',
      'chat not found'
    );
    expect(api.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('голосование без группы рассылку не запускает', async () => {
    polls.getPollById.mockResolvedValue(activePoll({ group: null }));

    await send();

    expect(users.getUsersByGroupId).not.toHaveBeenCalled();
  });

  it('удалённое голосование рассылку не запускает', async () => {
    polls.getPollById.mockResolvedValue(null);

    await send();

    expect(users.getUsersByGroupId).not.toHaveBeenCalled();
  });

  it('сбой получения состава группы не выбрасывается наружу', async () => {
    users.getUsersByGroupId.mockRejectedValue(new Error('db down'));

    await expect(send()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Error sending personal reminders for poll 1:',
      expect.any(Error)
    );
  });
});
