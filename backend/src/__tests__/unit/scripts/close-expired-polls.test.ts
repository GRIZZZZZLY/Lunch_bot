/**
 * Ручное закрытие просроченных голосований (`npm run close-expired-polls`).
 *
 * Скрипт запускают ровно тогда, когда планировщик простаивал, поэтому главное
 * здесь не «счётчики сходятся», а две вещи: одно испорченное голосование не
 * срывает обход остальных (иначе каждый следующий запуск падал бы на той же
 * строке и голосования висели бы вечно) и неудача не выдаётся за успех —
 * оператор видит, сколько не закрылось, и получает ненулевой код выхода.
 */
import { main } from '../../../scripts/close-expired-polls';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);
jest.mock('../../../services/poll-completion.service', () => ({
  PollCompletionService: { findExpiredActivePolls: jest.fn() },
}));
jest.mock('../../../services/poll-timer.service', () => ({
  closeExpiredPoll: jest.fn(),
}));

const { PollCompletionService } = jest.requireMock(
  '../../../services/poll-completion.service'
);
const { closeExpiredPoll } = jest.requireMock(
  '../../../services/poll-timer.service'
);

const NOW = new Date('2026-09-02T12:00:00.000Z');

/** Активное голосование, срок которого вышел час назад. */
const activePoll = (id: number) => ({
  id,
  groupId: 10,
  status: 'ACTIVE',
  duration: 30,
  startedAt: new Date(NOW.getTime() - 90 * 60_000),
  endedAt: null,
  group: { id: 10, title: 'Обеденная' },
});

/* Строка из `findExpiredActivePolls`. `chatId`/`messageId` пустые намеренно:
   это та самая ветка, где `closeExpiredPoll` зовёт `completePoll` напрямую и
   может бросить — из-за неё скрипт и умирал целиком. */
const expiredRow = (id: number) => ({
  id,
  groupId: 10,
  endsAt: new Date(NOW.getTime() - 60 * 60_000),
  chatId: null,
  messageId: null,
  votesCount: 2,
});

/* Консоль перехватывается один раз на файл: `jest.spyOn` на уже замоканном
   методе возвращает ТОТ ЖЕ мок, поэтому пересоздание спая в `beforeEach`
   копило бы вывод всех тестов в одну строку. */
const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
const errorLog = jest
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

/** Всё, что скрипт напечатал оператору, одной строкой. */
const output = (): string =>
  log.mock.calls.map(call => call.join(' ')).join('\n');

beforeEach(() => {
  resetPrismaMock();
  /* Именно `mockReset`, а не `clearAllMocks`: очередь `mockResolvedValueOnce`
     переживает `clear`, и недоеденный из прошлого теста ответ утёк бы в
     следующий — тест проверял бы чужую заготовку. */
  closeExpiredPoll.mockReset();
  PollCompletionService.findExpiredActivePolls.mockReset();
  log.mockClear();
  errorLog.mockClear();
  jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

/** Два просроченных голосования: и в отчёте «до», и в выборке на закрытие. */
function twoExpired(): void {
  prismaMock.poll.findMany.mockResolvedValue([
    activePoll(1),
    activePoll(2),
  ] as never);
  PollCompletionService.findExpiredActivePolls.mockResolvedValue([
    expiredRow(1),
    expiredRow(2),
  ]);
}

describe('close-expired-polls', () => {
  it('падение на одном голосовании не срывает обход остальных', async () => {
    twoExpired();
    closeExpiredPoll
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('completed');

    const code = await main();

    expect(closeExpiredPoll).toHaveBeenCalledTimes(2);
    expect(code).toBe(1);
  });

  it('оператор видит, какое именно голосование не закрылось', async () => {
    twoExpired();
    closeExpiredPoll
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('completed');

    await main();

    expect(errorLog).toHaveBeenCalledWith(
      '❌ Голосование 1 (группа 10) не закрылось:',
      expect.any(Error)
    );
    expect(output()).toContain('Не закрылось: 1');
  });

  /* Иначе сбой выглядел бы как безобидная гонка с планировщиком, и оператор
     решил бы, что всё в порядке. */
  it('неудача не выдаётся за параллельное закрытие', async () => {
    twoExpired();
    closeExpiredPoll
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('completed');

    await main();

    expect(output()).not.toContain('закрыл кто-то другой');
  });

  it('когда всё закрылось, отчёт двумя числами и код выхода 0', async () => {
    twoExpired();
    closeExpiredPoll
      .mockResolvedValueOnce('completed')
      .mockResolvedValueOnce('cancelled');

    const code = await main();

    expect(code).toBe(0);
    expect(output()).toContain('Завершено: 1, отменено (без голосов): 1');
    expect(output()).not.toContain('Не закрылось');
  });

  /* `skipped` — это не сбой: голосование закрыл планировщик или человек между
     отчётом и записью, и оптимистичная блокировка это поймала. */
  it('чужое параллельное закрытие остаётся не ошибкой', async () => {
    twoExpired();
    closeExpiredPoll.mockResolvedValue('skipped');

    const code = await main();

    expect(code).toBe(0);
    expect(output()).toContain('закрыл кто-то другой параллельно');
    expect(output()).not.toContain('Не закрылось');
  });

  it('без просроченных голосований закрывать нечего', async () => {
    prismaMock.poll.findMany.mockResolvedValue([] as never);

    const code = await main();

    expect(code).toBe(0);
    expect(output()).toContain('No expired polls found!');
    expect(PollCompletionService.findExpiredActivePolls).not.toHaveBeenCalled();
    expect(closeExpiredPoll).not.toHaveBeenCalled();
  });
});
