import { Client } from 'pg';
import { prisma } from '../../database/client';
import { RecurringPollService } from '../../services/recurring-poll.service';
import { notificationService } from '../../services/notification.service';
import { PollSchedulerService } from '../../services/poll-scheduler.service';

// Держим в синхроне с SCHEDULER_ADVISORY_LOCK_KEY в poll-scheduler.service.ts
const SCHEDULER_LOCK_KEY = 918273645;

/**
 * Integration-тесты против реальной PostgreSQL test-БД (см. globalSetup.ts).
 * Покрывают регрессии инцидента 2026-07-20 (дубль автоголосований в мёртвой группе).
 */

async function cleanup(): Promise<void> {
  await prisma.pollParticipant.deleteMany({});
  await prisma.poll.deleteMany({});
  await prisma.recurringPoll.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.user.deleteMany({});
}

describe('RecurringPollService.getActiveSchedules — group.isActive gate (integration)', () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('excludes due schedules whose group is deactivated (bot removed)', async () => {
    const user = await prisma.user.create({
      data: { telegramId: 9001n, firstName: 'Creator' },
    });
    const past = new Date(Date.now() - 60_000);

    const activeGroup = await prisma.group.create({
      data: { telegramId: -9001n, title: 'Active', isActive: true },
    });
    const deadGroup = await prisma.group.create({
      data: { telegramId: -9002n, title: 'Dead', isActive: false },
    });

    await prisma.recurringPoll.create({
      data: {
        groupId: activeGroup.id,
        daysOfWeek: '[0,1,2,3,4,5,6]',
        timeOfDay: '11:30',
        createdBy: user.id,
        isEnabled: true,
        nextRunAt: past,
      },
    });
    await prisma.recurringPoll.create({
      data: {
        groupId: deadGroup.id,
        daysOfWeek: '[0,1,2,3,4,5,6]',
        timeOfDay: '11:30',
        createdBy: user.id,
        isEnabled: true,
        nextRunAt: past,
      },
    });

    const schedules = await RecurringPollService.getActiveSchedules();

    expect(schedules.map((s) => s.groupId)).toEqual([activeGroup.id]);
  });
});

describe('RecurringPollService.executeScheduledPoll — bot-removed pre-check (integration)', () => {
  beforeEach(cleanup);
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('does not create a poll and disables the schedule when the bot cannot post', async () => {
    const user = await prisma.user.create({
      data: { telegramId: 9101n, firstName: 'Creator' },
    });
    const group = await prisma.group.create({
      data: { telegramId: -9101n, title: 'Live group', isActive: true },
    });
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user.id, isActive: true },
    });
    // Достаточно блюд, чтобы БЕЗ фикса код дошёл до createPoll и создал голосование.
    await prisma.menuItem.createMany({
      data: [
        { name: 'Dish A', createdBy: user.id, groupId: group.id },
        { name: 'Dish B', createdBy: user.id, groupId: group.id },
      ],
    });
    const recurring = await prisma.recurringPoll.create({
      data: {
        groupId: group.id,
        daysOfWeek: '[0,1,2,3,4,5,6]',
        timeOfDay: '11:30',
        duration: 90,
        createdBy: user.id,
        isEnabled: true,
      },
    });

    // Бот выгнан из группы → писать не может.
    jest.spyOn(notificationService, 'botCanPostToGroup').mockResolvedValue(false);

    const result = await RecurringPollService.executeScheduledPoll(recurring.id);

    expect(result.status).toBe('FAILED_BOT_REMOVED');
    expect(await prisma.poll.count({ where: { groupId: group.id } })).toBe(0);
    const after = await prisma.recurringPoll.findUnique({ where: { id: recurring.id } });
    expect(after?.isEnabled).toBe(false);
  });
});

/* «Два одновременных создания — одно активное голосование» проверяется через
   HTTP в api/polls-lifecycle.redis.test.ts. */

describe('PollSchedulerService — single-instance advisory lock (integration)', () => {
  let holder: Client | null = null;

  afterEach(async () => {
    await PollSchedulerService.stop();
    if (holder) {
      try {
        await holder.query('SELECT pg_advisory_unlock_all()');
      } catch {
        /* ignore */
      }
      await holder.end();
      holder = null;
    }
  });

  it('does not schedule the cron when another instance holds the lock', async () => {
    holder = new Client({ connectionString: process.env.DATABASE_URL });
    await holder.connect();
    const held = await holder.query('SELECT pg_try_advisory_lock($1) AS locked', [
      SCHEDULER_LOCK_KEY,
    ]);
    expect(held.rows[0].locked).toBe(true); // sanity: посторонний держатель захватил лок

    await PollSchedulerService.start();

    expect((PollSchedulerService as unknown as { cronJob: unknown }).cronJob).toBeNull();
  });

  it('schedules the cron when the lock is free', async () => {
    await PollSchedulerService.start();

    expect(
      (PollSchedulerService as unknown as { cronJob: unknown }).cronJob
    ).not.toBeNull();
  });

  // Остановленный процесс обязан отдать лок: иначе после штатного рестарта
  // (новый процесс поднимается, старый ещё не закрыл соединение) автоголосования
  // не запускает никто.
  it('releases the lock on stop() so the next instance can take over', async () => {
    await PollSchedulerService.start();
    await PollSchedulerService.stop();

    holder = new Client({ connectionString: process.env.DATABASE_URL });
    await holder.connect();
    const taken = await holder.query('SELECT pg_try_advisory_lock($1) AS locked', [
      SCHEDULER_LOCK_KEY,
    ]);

    expect(taken.rows[0].locked).toBe(true);
  });
});
