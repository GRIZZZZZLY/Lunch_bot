/**
 * Тик планировщика автоголосований (PollSchedulerService): расписание
 * пришло — автоголосование создаётся или нет, а админу, заведшему
 * расписание, уходит отчёт.
 *
 * Запускается тот обработчик, который планировщик ставит в cron; подменены
 * только сам cron (обработчик забирается, а не ждёт минуту), часы (время
 * расписания сравнивается с текущим «ЧЧ:ММ») и Telegram.
 *
 * Однопроцессная блокировка проверяется в scheduler-poll.integration.test.ts.
 */
import cron from 'node-cron';
import type { Group, User } from '@prisma/client';

import { prisma } from '../../../database/client';
import { PollSchedulerService } from '../../../services/poll-scheduler.service';
import { addMember } from '../helpers/api';
import { cleanDatabase } from '../helpers/fixtures';
import {
  type FakeTelegram,
  buttonsOf,
  createFakeTelegram,
  sentTo,
  webAppUrls,
} from '../helpers/bot';

let tg: FakeTelegram;
let tick: () => Promise<void>;

const NOW = new Date('2026-10-21T08:30:00Z');
const originalWebAppUrl = process.env.WEBAPP_URL;

interface World {
  group: Group;
  admin: User;
  scheduleId: number;
}

/** Группа, админ-автор расписания и расписание «сейчас, каждый день». */
async function world(menuItems: number, timeOfDay = NOW.toTimeString().slice(0, 5)): Promise<World> {
  const admin = await prisma.user.create({
    data: { telegramId: BigInt(9501), firstName: 'Админ' },
  });
  const group = await prisma.group.create({
    data: { telegramId: BigInt(-100950), title: 'Автообеды' },
  });
  await addMember(group.id, admin.id, 'ADMIN');
  for (let i = 0; i < menuItems; i++) {
    await prisma.menuItem.create({
      data: { name: `Блюдо ${i}`, groupId: group.id, createdBy: admin.id },
    });
  }
  const schedule = await prisma.recurringPoll.create({
    data: {
      groupId: group.id,
      daysOfWeek: '[0,1,2,3,4,5,6]',
      timeOfDay,
      duration: 60,
      createdBy: admin.id,
      isEnabled: true,
      nextRunAt: new Date(NOW.getTime() - 60_000),
    },
  });
  return { group, admin, scheduleId: schedule.id };
}

beforeAll(async () => {
  tg = await createFakeTelegram();
  jest.spyOn(cron, 'schedule').mockImplementation(((_expr: string, fn: () => Promise<void>) => {
    tick = fn;
    return { stop: () => undefined } as never;
  }) as never);
});

beforeEach(async () => {
  // Подменяются только часы: таймеры, микрозадачи и ввод-вывод — настоящие.
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
  await cleanDatabase();
  tg.reset();
  process.env.WEBAPP_URL = 'https://lunch.example.app';
  await PollSchedulerService.start();
});

afterEach(async () => {
  await PollSchedulerService.stop();
  jest.useRealTimers();
});

afterAll(async () => {
  if (originalWebAppUrl === undefined) delete process.env.WEBAPP_URL;
  else process.env.WEBAPP_URL = originalWebAppUrl;
  jest.restoreAllMocks();
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('тик планировщика', () => {
  it('в назначенное время создаёт автоголосование в группе и сообщает админу', async () => {
    const w = await world(3);

    await tick();

    const polls = await prisma.poll.findMany({ where: { groupId: w.group.id } });
    expect(polls).toHaveLength(1);
    expect(polls[0]).toMatchObject({ status: 'ACTIVE', isAutomatic: true });
    expect(sentTo(tg, w.group.telegramId).length).toBeGreaterThan(0);
    expect(sentTo(tg, w.admin.telegramId)).toHaveLength(1);
  });

  it('уже сработавшее сегодня расписание второй раз не запускается', async () => {
    const w = await world(3);
    await prisma.recurringPoll.update({
      where: { id: w.scheduleId },
      data: { lastRunAt: new Date(NOW.getTime() - 60 * 60_000) },
    });

    await tick();

    expect(await prisma.poll.count({ where: { groupId: w.group.id } })).toBe(0);
  });

  it('в другое время расписание не срабатывает', async () => {
    const w = await world(3, '03:07');

    await tick();

    expect(await prisma.poll.count({ where: { groupId: w.group.id } })).toBe(0);
    expect(tg.sent('sendMessage')).toHaveLength(0);
  });

  it('меню пусто: голосования нет, админ получает отчёт с кнопкой отключить расписание', async () => {
    const w = await world(1);

    await tick();

    expect(await prisma.poll.count({ where: { groupId: w.group.id } })).toBe(0);
    const [report] = sentTo(tg, w.admin.telegramId);
    expect(buttonsOf(report).map(b => b.callback_data)).toContain(
      `recurring:disable:${w.scheduleId}`
    );
    expect(webAppUrls(report).every(url => url.startsWith('https://'))).toBe(true);
  });

  // BUG: без WEBAPP_URL отчёт «меню пусто» несёт web_app-кнопку с адресом
  // «/menu». Telegram требует https и отвергает сообщение целиком — админ не
  // узнаёт ни о сбое, ни о кнопке «отключить».
  it.failing('без WEBAPP_URL отчёт «меню пусто» не содержит web_app с негодным адресом', async () => {
    delete process.env.WEBAPP_URL;
    const w = await world(1);

    await tick();

    const [report] = sentTo(tg, w.admin.telegramId);
    expect(report).toBeDefined();
    for (const url of webAppUrls(report)) {
      expect(url.startsWith('https://')).toBe(true);
    }
  });
});
