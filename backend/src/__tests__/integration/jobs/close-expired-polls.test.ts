/**
 * Ручной скрипт `npm run close-expired-polls` — его запускают, когда
 * планировщик простаивал. Правило закрытия у скрипта и планировщика одно
 * (`closeExpiredPoll`): с голосами — завершить, пустое — отменить, ещё идущее —
 * не трогать. Пока у скрипта была своя копия правила, он ставил COMPLETED
 * пустым голосованиям, и одно и то же событие выглядело в истории по-разному.
 */
import type { User } from '@prisma/client';

import { prisma } from '../../../database/client';
import { main } from '../../../scripts/close-expired-polls';
import { cleanDatabase } from '../helpers/fixtures';
import { createFakeTelegram } from '../helpers/bot';

const MINUTE = 60 * 1000;

let seq = 0;
async function pollInOwnGroup(author: User, startedMinutesAgo: number, voters: User[]) {
  seq += 1;
  const group = await prisma.group.create({
    data: { telegramId: BigInt(-100960 - seq), title: `g${seq}` },
  });
  const dish = await prisma.menuItem.create({
    data: { name: `Блюдо ${seq}`, price: 250, groupId: group.id, createdBy: author.id },
  });
  const poll = await prisma.poll.create({
    data: {
      groupId: group.id,
      createdBy: author.id,
      status: 'ACTIVE',
      duration: 30,
      startedAt: new Date(Date.now() - startedMinutesAgo * MINUTE),
    },
  });
  for (const voter of voters) {
    await prisma.vote.create({ data: { pollId: poll.id, userId: voter.id, menuItemId: dish.id } });
  }
  return poll.id;
}

beforeAll(async () => {
  await createFakeTelegram();
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

it('с голосами — завершает, пустое — отменяет, идущее — не трогает; код выхода 0', async () => {
  const author = await prisma.user.create({ data: { telegramId: BigInt(9601), firstName: 'Автор' } });
  const voter = await prisma.user.create({ data: { telegramId: BigInt(9602), firstName: 'Голос' } });
  const expiredWithVotes = await pollInOwnGroup(author, 120, [author, voter]);
  const expiredEmpty = await pollInOwnGroup(author, 120, []);
  const running = await pollInOwnGroup(author, 5, [voter]);

  /* Завершение с голосами запускает выбор ответственного, а у него свой
     трёхминутный таймер «никто не вызвался — рулетка». Сам этот таймер к
     скрипту не относится; настоящий оставил бы процесс jest висеть три минуты
     и сработал бы после закрытия базы. Подменяются только таймеры. */
  jest.useFakeTimers({
    doNotFake: ['Date', 'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate'],
  });
  let exitCode: number;
  try {
    exitCode = await main();
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }

  expect(exitCode).toBe(0);
  const status = async (id: number) =>
    (await prisma.poll.findUniqueOrThrow({ where: { id } })).status;
  expect(await status(expiredWithVotes)).toBe('COMPLETED');
  expect(await status(expiredEmpty)).toBe('CANCELLED');
  expect(await status(running)).toBe('ACTIVE');
});
