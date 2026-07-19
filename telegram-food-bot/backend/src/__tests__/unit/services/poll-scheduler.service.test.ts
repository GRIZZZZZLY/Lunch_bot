import { PollSchedulerService } from '../../../services/poll-scheduler.service';
import { RecurringPollService } from '../../../services/recurring-poll.service';

jest.mock('../../../services/recurring-poll.service', () => ({
  RecurringPollService: {
    executeScheduledPoll: jest.fn(),
    getActiveSchedules: jest.fn(),
    getNextRunInfo: jest.fn().mockReturnValue('Завтра в 12:30'),
    toggleEnabled: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

type SchedulerInternals = {
  checkAndExecuteSchedules: () => Promise<void>;
};

const runSchedulerTick = (): Promise<void> =>
  (PollSchedulerService as unknown as SchedulerInternals).checkAndExecuteSchedules();
const mockedRecurringPollService = RecurringPollService as jest.Mocked<
  typeof RecurringPollService
>;

const schedule = {
  createdAt: new Date('2026-07-01T09:00:00.000Z'),
  createdBy: 5,
  creator: {
    firstName: 'Admin',
    id: 5,
    lastName: null,
    telegramId: BigInt(500),
  },
  daysOfWeek: JSON.stringify([3]),
  duration: 30,
  group: {
    id: 9,
    telegramId: BigInt(-100900),
    title: 'Lunch Team',
  },
  groupId: 9,
  id: 4,
  isEnabled: true,
  lastRunAt: null,
  lastRunMessage: null,
  lastRunStatus: null,
  nextRunAt: new Date('2026-07-01T09:30:00.000Z'),
  selectedMenuItemIds: JSON.stringify([1, 2]),
  timeOfDay: '12:30',
  updatedAt: new Date('2026-07-01T09:00:00.000Z'),
};

describe('PollSchedulerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 1, 12, 30, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
    PollSchedulerService.stop();
  });

  it('executes a due schedule once and notifies the schedule creator', async () => {
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    PollSchedulerService.initialize({ api: { sendMessage } });
    mockedRecurringPollService.getActiveSchedules.mockResolvedValue([schedule]);
    mockedRecurringPollService.executeScheduledPoll.mockResolvedValue({
      message: 'Poll created successfully',
      pollId: 77,
      status: 'SUCCESS',
      success: true,
    });

    await runSchedulerTick();

    expect(mockedRecurringPollService.executeScheduledPoll).toHaveBeenCalledWith(4);
    expect(sendMessage).toHaveBeenCalledWith(
      500,
      expect.stringContaining('Автоматическое голосование создано'),
      { parse_mode: 'Markdown' }
    );
  });

  it('skips a due schedule that already ran today', async () => {
    PollSchedulerService.initialize(null);
    mockedRecurringPollService.getActiveSchedules.mockResolvedValue([
      {
        ...schedule,
        lastRunAt: new Date(2026, 6, 1, 8, 0, 0),
      },
    ]);

    await runSchedulerTick();

    expect(mockedRecurringPollService.executeScheduledPoll).not.toHaveBeenCalled();
  });

  it('disables recurring polls from callback actions', async () => {
    mockedRecurringPollService.toggleEnabled.mockResolvedValue({
      ...schedule,
      isEnabled: false,
    });

    await PollSchedulerService.handleDisableCallback(4);

    expect(mockedRecurringPollService.toggleEnabled).toHaveBeenCalledWith(
      4,
      false
    );
  });
});
