import cron from 'node-cron';
import { initStoreRunAutoCloseJob } from '../../../jobs/store-run-autoclose.job';
import { storeRunNotificationService } from '../../../services/store-run-notification.service';
import { StoreRunService } from '../../../services/store-run.service';
import { NotificationResult } from '../../../types/notification.types';

let scheduledTask: (() => Promise<void>) | null = null;

jest.mock('node-cron', () => ({
  __esModule: true,
  default: {
    schedule: jest.fn((_cronExpr, task) => {
      scheduledTask = task;
      return { stop: jest.fn() };
    }),
  },
}));

jest.mock('../../../services/store-run.service', () => ({
  StoreRunService: {
    autoCloseExpired: jest.fn(),
    expireStaleShoppingRuns: jest.fn(),
  },
}));

jest.mock('../../../services/store-run-notification.service', () => ({
  storeRunNotificationService: {
    deleteStoreRunMessages: jest.fn(),
    notifyInitiatorCollectionClosed: jest.fn(),
    notifyShoppingStarted: jest.fn(),
    notifyStoreRunExpired: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockedCron = cron as jest.Mocked<typeof cron>;
const mockedStoreRunService = StoreRunService as jest.Mocked<
  typeof StoreRunService
>;
const mockedNotificationService = storeRunNotificationService as jest.Mocked<
  typeof storeRunNotificationService
>;
const notificationResult: NotificationResult = {
  sentAt: new Date('2026-07-01T12:00:00.000Z'),
  success: true,
};

describe('store run auto-close job', () => {
  const originalCron = process.env.STORE_RUN_AUTOCLOSE_CRON;

  beforeEach(() => {
    scheduledTask = null;
    process.env.STORE_RUN_AUTOCLOSE_CRON = '*/5 * * * *';
    jest.clearAllMocks();
    mockedStoreRunService.autoCloseExpired.mockResolvedValue([]);
    mockedStoreRunService.expireStaleShoppingRuns.mockResolvedValue([]);
    mockedNotificationService.deleteStoreRunMessages.mockResolvedValue(undefined);
    mockedNotificationService.notifyInitiatorCollectionClosed.mockResolvedValue(
      notificationResult
    );
    mockedNotificationService.notifyShoppingStarted.mockResolvedValue([
      notificationResult,
    ]);
    mockedNotificationService.notifyStoreRunExpired.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.STORE_RUN_AUTOCLOSE_CRON = originalCron;
  });

  it('registers the cron job with the configured expression', () => {
    initStoreRunAutoCloseJob();

    expect(mockedCron.schedule).toHaveBeenCalledWith(
      '*/5 * * * *',
      expect.any(Function)
    );
  });

  it('auto-closes collecting runs and expires stale shopping runs', async () => {
    mockedStoreRunService.autoCloseExpired.mockResolvedValue([11, 12]);
    mockedStoreRunService.expireStaleShoppingRuns.mockResolvedValue([13]);

    initStoreRunAutoCloseJob();
    await scheduledTask?.();

    expect(mockedStoreRunService.autoCloseExpired).toHaveBeenCalled();
    expect(mockedNotificationService.notifyShoppingStarted).toHaveBeenCalledWith(
      11
    );
    expect(mockedNotificationService.notifyShoppingStarted).toHaveBeenCalledWith(
      12
    );
    expect(
      mockedNotificationService.notifyInitiatorCollectionClosed
    ).toHaveBeenCalledWith(11);
    expect(
      mockedNotificationService.notifyInitiatorCollectionClosed
    ).toHaveBeenCalledWith(12);
    expect(mockedStoreRunService.expireStaleShoppingRuns).toHaveBeenCalled();
    expect(mockedNotificationService.deleteStoreRunMessages).toHaveBeenCalledWith(
      13
    );
    expect(mockedNotificationService.notifyStoreRunExpired).toHaveBeenCalledWith(
      13
    );
  });
});
