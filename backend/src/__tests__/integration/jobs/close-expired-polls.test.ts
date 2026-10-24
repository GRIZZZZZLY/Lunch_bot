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
import * as pollTimer from '../../../services/poll-timer.service';
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

  const exitCode = await runScript();

  expect(exitCode).toBe(0);
  expect(await status(expiredWithVotes)).toBe('COMPLETED');
  expect(await status(expiredEmpty)).toBe('CANCELLED');
  expect(await status(running)).toBe('ACTIVE');
});

/* Регрессия: голосование, на котором закрытие бросало (путь без сообщения в
   чате зовёт завершение напрямую), обрывало скрипт целиком, и каждый
   следующий запуск падал на той же строке — остальные висели вечно. Сбой
   подставлен на границе одного вызова; второе голосование закрывается
   по-настоящему. */
it('сбой на одном голосовании не срывает обход остальных; код выхода 1', async () => {
  const author = await prisma.user.create({ data: { telegramId: BigInt(9611), firstName: 'Автор2' } });
  const first = await pollInOwnGroup(author, 120, [author]);
  const second = await pollInOwnGroup(author, 120, [author]);
  const failOnce = jest
    .spyOn(pollTimer, 'closeExpiredPoll')
    .mockRejectedValueOnce(new Error('boom'));

  let exitCode: number;
  try {
    exitCode = await runScript();
  } finally {
    failOnce.mockRestore();
  }

  expect(exitCode).toBe(1);
  expect([await status(first), await status(second)].sort()).toEqual(['ACTIVE', 'COMPLETED']);
});

const status = async (id: number) => (await prisma.poll.findUniqueOrThrow({ where: { id } })).status;

/* Завершение с голосами запускает выбор ответственного, а у него свой
   трёхминутный таймер «никто не вызвался — рулетка». Сам этот таймер к
   скрипту не относится; настоящий оставил бы процесс jest висеть три минуты
   и сработал бы после закрытия базы. Подменяются только таймеры. */
async function runScript(): Promise<number> {
  jest.useFakeTimers({
    doNotFake: ['Date', 'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate'],
  });
  try {
    return await main();
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
}
