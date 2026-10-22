/**
 * fatalExit: при uncaughtException и unhandledRejection процесс намеренно
 * падает (crash-fast), но не мгновенно — есть секунда на сброс лог-транспортов.
 *
 * Классы ошибок, которые реально отдаются клиенту, проверены через ответ в
 * unit/middleware/error-handler.test.ts.
 */
import { setupErrorHandlers } from '../../../utils/error';

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logger } = jest.requireMock('../../../utils/logger');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('setupErrorHandlers', () => {
  let onSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;
  const handlers = new Map<string, (arg: unknown) => void>();

  beforeEach(() => {
    handlers.clear();
    jest.useFakeTimers();
    onSpy = jest
      .spyOn(process, 'on')
      .mockImplementation(
        (event: string | symbol, handler: (...args: never[]) => void) => {
          handlers.set(String(event), handler as (arg: unknown) => void);
          return process;
        }
      );
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    onSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('необработанное исключение валит процесс, но не мгновенно', () => {
    setupErrorHandlers();

    handlers.get('uncaughtException')?.(new Error('boom'));

    // Секунда на сброс логов — до неё выхода нет.
    expect(exitSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('отказ промиса не с Error тоже валит процесс', () => {
    setupErrorHandlers();

    handlers.get('unhandledRejection')?.('строка вместо ошибки');

    jest.advanceTimersByTime(1000);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('сбой самого логгера не мешает падению', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    logger.error.mockImplementation(() => {
      throw new Error('logger broken');
    });
    setupErrorHandlers();

    handlers.get('uncaughtException')?.(new Error('boom'));

    jest.advanceTimersByTime(1000);
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    logger.error.mockReset();
  });
});
