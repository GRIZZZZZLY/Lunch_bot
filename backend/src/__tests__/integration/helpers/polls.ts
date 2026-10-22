/**
 * Строители данных и клиент для HTTP-тестов голосований.
 *
 * Общие для наборов `polls-*`, `votes`, `recurring-polls`: без них каждый файл
 * заново выписывал бы создание людей, команд, блюд и голосований со снимком
 * участников — а снимок как раз то место, где легко ошибиться (без строки
 * EXPECTED человек не может голосовать вовсе).
 */
import request from 'supertest';
import type express from 'express';
import type { Group, MenuItem, Poll, Prisma, User } from '@prisma/client';

import { prisma } from '../../../database/client';
import { idemKey, tokenFor } from './api';

export function person(
  telegramId: number,
  firstName: string,
  extra: Partial<Pick<User, 'isAdmin' | 'isActive'>> = {}
): Promise<User> {
  return prisma.user.create({
    data: { telegramId: BigInt(telegramId), firstName, ...extra },
  });
}

export function team(
  telegramId: number,
  title: string,
  settings?: Record<string, unknown>
): Promise<Group> {
  return prisma.group.create({
    data: {
      telegramId: BigInt(telegramId),
      title,
      settings: settings ? JSON.stringify(settings) : undefined,
    },
  });
}

export function dish(
  groupId: number,
  createdBy: number,
  name: string,
  extra: Partial<Pick<MenuItem, 'isActive' | 'deletedAt'>> = {}
): Promise<MenuItem> {
  return prisma.menuItem.create({
    data: { groupId, createdBy, name, price: 300, ...extra },
  });
}

export interface PollSetup
  extends Partial<
    Pick<
      Prisma.PollUncheckedCreateInput,
      | 'status'
      | 'duration'
      | 'startedAt'
      | 'endedAt'
      | 'isMultiSelect'
      | 'maxSelections'
      | 'selectedMenuItemIds'
    >
  > {
  /** Кого ждут: строки снимка EXPECTED. */
  expected?: number[];
  /** Кто отказался от обедов: строки снимка EXCLUDED. */
  excluded?: number[];
}

/**
 * Голосование вместе со снимком участников — в том виде, в каком его
 * оставляет `PollService.createPoll`.
 */
export async function pollIn(
  groupId: number,
  createdBy: number,
  { expected = [], excluded = [], ...data }: PollSetup = {}
): Promise<Poll> {
  const poll = await prisma.poll.create({
    data: { groupId, createdBy, status: 'ACTIVE', duration: 30, ...data },
  });
  const rows = [
    ...expected.map(userId => ({ pollId: poll.id, userId, status: 'EXPECTED' })),
    ...excluded.map(userId => ({ pollId: poll.id, userId, status: 'EXCLUDED' })),
  ];
  if (rows.length > 0) await prisma.pollParticipant.createMany({ data: rows });
  return poll;
}

/** Завершённое голосование с итогом и голосами `[userId, menuItemId]`. */
export async function completedPoll(
  groupId: number,
  createdBy: number,
  votes: Array<[number, number]>,
  endedAt: Date = new Date()
): Promise<Poll> {
  const poll = await prisma.poll.create({
    data: {
      groupId,
      createdBy,
      status: 'COMPLETED',
      startedAt: new Date(endedAt.getTime() - 30 * 60_000),
      endedAt,
      selectedMenuItemIds: JSON.stringify([...new Set(votes.map(([, item]) => item))]),
    },
  });
  if (votes.length > 0) {
    await prisma.vote.createMany({
      data: votes.map(([userId, menuItemId]) => ({ pollId: poll.id, userId, menuItemId })),
    });
  }
  await prisma.pollResult.create({
    data: {
      pollId: poll.id,
      winnerMenuItemId: votes[0]?.[1] ?? null,
      totalVotes: votes.length,
      responsibleUserId: createdBy,
    },
  });
  return poll;
}

/**
 * Вошедший пользователь: настоящий вход через `/api/auth/validate` и ключ
 * идемпотентности на каждый изменяющий запрос (маршруты голосований объявлены
 * `required: true`).
 */
export interface Client {
  get(url: string): request.Test;
  post(url: string, body?: object): request.Test;
  patch(url: string, body?: object): request.Test;
  delete(url: string): request.Test;
}

export async function signIn(
  app: express.Application,
  telegramId: number
): Promise<Client> {
  const auth = `Bearer ${await tokenFor(app, telegramId)}`;
  const write = (test: request.Test) =>
    test.set('Authorization', auth).set('Idempotency-Key', idemKey());

  return {
    get: url => request(app).get(url).set('Authorization', auth),
    post: (url, body = {}) => write(request(app).post(url)).send(body),
    patch: (url, body = {}) => write(request(app).patch(url)).send(body),
    delete: url => write(request(app).delete(url)),
  };
}

/**
 * Запуск голосования через бота ставит в памяти таймер автозавершения на всю
 * длительность голосования (`poll-timer.service`), а завершение по кворуму —
 * трёхминутный таймер выбора ответственного. Настоящий таймер держал бы
 * процесс jest открытым до своего срока. Здесь подменяются только
 * `setTimeout`/`clearTimeout`, и часы идут вместе с настоящими
 * (`advanceTimers`), так что тайм-ауты библиотек срабатывают как обычно; всё,
 * что не сработало за время запроса, выбрасывается.
 */
export async function withParkedTimers<T>(work: () => Promise<T>): Promise<T> {
  jest.useFakeTimers({
    advanceTimers: true,
    doNotFake: [
      'Date',
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
    ],
  });
  try {
    return await work();
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
}
