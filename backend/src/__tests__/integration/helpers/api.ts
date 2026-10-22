import request from 'supertest';
import type express from 'express';
import type { GroupMember } from '@prisma/client';

import { prisma } from '../../../database/client';
import { generateTelegramInitData } from './authHelper';

/**
 * Токен настоящего входа: тот же путь, которым идёт приложение.
 * Набор должен выставить `SKIP_TELEGRAM_VALIDATION=true` до создания приложения.
 */
export async function tokenFor(
  app: express.Application,
  telegramId: number
): Promise<string> {
  const response = await request(app)
    .post('/api/auth/validate')
    .send({ initData: generateTelegramInitData(telegramId) })
    .expect(200);

  return response.body.accessToken as string;
}

/** Ключ идемпотентности: без него изменяющие маршруты с `required: true` отвечают 400. */
export function idemKey(label = 'op'): string {
  return `test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type MemberRole = 'CREATOR' | 'ADMIN' | 'MEMBER';

export async function addMember(
  groupId: number,
  userId: number,
  role: MemberRole = 'MEMBER',
  extra: Partial<Pick<GroupMember, 'isActive' | 'participatesInPolls' | 'leftAt'>> = {}
): Promise<GroupMember> {
  return prisma.groupMember.create({
    data: { groupId, userId, role, ...extra },
  });
}
