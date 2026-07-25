import { User } from '@prisma/client';
import { PollSchedulerService } from '../../../services/poll-scheduler.service';
import { RecurringPollService } from '../../../services/recurring-poll.service';
import { UserService } from '../../../services/user.service';

jest.mock('../../../services/recurring-poll.service', () => ({
  RecurringPollService: {
    executeScheduledPoll: jest.fn(),
    getActiveSchedules: jest.fn(),
    getNextRunInfo: jest.fn().mockReturnValue('Завтра в 12:30'),
    getById: jest.fn(),
    checkAdminAccess: jest.fn(),
    toggleEnabled: jest.fn(),
  },
}));

jest.mock('../../../services/user.service', () => ({
  UserService: {
    getUserByTelegramId: jest.fn(),
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
  (
    PollSchedulerService as unknown as SchedulerInternals
  ).checkAndExecuteSchedules();
const mockedRecurringPollService = RecurringPollService as jest.Mocked<
  typeof RecurringPollService
>;
const mockedUserService = UserService as jest.Mocked<typeof UserService>;

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

const createUser = (id: number, telegramId: bigint): User => ({
  id,
  telegramId,
  username: null,
  firstName: 'Admin',
  lastName: null,
  photoUrl: null,
  avatarUrl: null,
  avatarUpdatedAt: null,
  isAdmin: false,
  isActive: true,
  participatesInPolls: true,
  paymentCard: null,
  paymentPhone: null,
  paymentDetails: null,
  createdAt: new Date('2026-07-01T09:00:00.000Z'),
  updatedAt: new Date('2026-07-01T09:00:00.000Z'),
});

describe('PollSchedulerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 1, 12, 30, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
    void PollSchedulerService.stop();
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

    expect(
      mockedRecurringPollService.executeScheduledPoll
    ).toHaveBeenCalledWith(4);
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

    expect(
      mockedRecurringPollService.executeScheduledPoll
    ).not.toHaveBeenCalled();
  });

  it('disables recurring polls from callback actions', async () => {
    mockedRecurringPollService.getById.mockResolvedValue(schedule);
    mockedUserService.getUserByTelegramId.mockResolvedValue(
      createUser(5, 500n)
    );
    mockedRecurringPollService.checkAdminAccess.mockResolvedValue(true);
    mockedRecurringPollService.toggleEnabled.mockResolvedValue({
      ...schedule,
      isEnabled: false,
    });

    const result = await PollSchedulerService.handleDisableCallback(4, 500);

    expect(result).toBe(true);
    expect(mockedRecurringPollService.toggleEnabled).toHaveBeenCalledWith(
      4,
      false
    );
  });

  it('does not disable a schedule for an administrator of another group', async () => {
    mockedRecurringPollService.getById.mockResolvedValue(schedule);
    mockedUserService.getUserByTelegramId.mockResolvedValue(
      createUser(8, 800n)
    );
    mockedRecurringPollService.checkAdminAccess.mockResolvedValue(false);

    const result = await PollSchedulerService.handleDisableCallback(4, 800);

    expect(result).toBe(false);
    expect(mockedRecurringPollService.toggleEnabled).not.toHaveBeenCalled();
  });
});
