/**
 * Итоги опроса видит любой участник группы — значит, в них не должно быть
 * лишнего о людях.
 *
 * `GET /api/polls/:id/results` отдавал ответственного целиком: telegramId,
 * флаги и платёжные поля (в базе они зашифрованы, наружу уходил шифротекст).
 * Экрану нужно только имя.
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { generateTelegramInitData } from '../helpers/authHelper';

const app = createTestApp();

const RESPONSIBLE_TELEGRAM_ID = 700000301;
const MEMBER_TELEGRAM_ID = 700000302;

async function tokenFor(telegramId: number): Promise<string> {
  const response = await request(app)
    .post('/api/auth/validate')
    .send({ initData: generateTelegramInitData(telegramId) })
    .expect(200);
  return response.body.accessToken as string;
}

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('GET /api/polls/:id/results', () => {
  it('отдаёт ответственного без платёжных полей и telegramId', async () => {
    const responsible = await prisma.user.create({
      data: {
        telegramId: BigInt(RESPONSIBLE_TELEGRAM_ID),
        firstName: 'Анна',
        paymentPhone: 'ciphertext-phone',
        paymentCard: 'ciphertext-card',
        paymentDetails: 'ciphertext-details',
      },
    });
    const member = await prisma.user.create({
      data: { telegramId: BigInt(MEMBER_TELEGRAM_ID), firstName: 'Борис' },
    });
    const group = await prisma.group.create({
      data: { telegramId: BigInt(-100000000301), title: 'Команда итогов' },
    });
    await prisma.groupMember.createMany({
      data: [
        { groupId: group.id, userId: responsible.id, role: 'CREATOR', isActive: true },
        { groupId: group.id, userId: member.id, role: 'MEMBER', isActive: true },
      ],
    });
    const poll = await prisma.poll.create({
      data: { groupId: group.id, status: 'COMPLETED', createdBy: responsible.id, endedAt: new Date() },
    });
    await prisma.pollResult.create({
      data: { pollId: poll.id, totalVotes: 2, responsibleUserId: responsible.id },
    });

    const response = await request(app)
      .get(`/api/polls/${poll.id}/results`)
      .set('Authorization', `Bearer ${await tokenFor(MEMBER_TELEGRAM_ID)}`)
      .expect(200);

    const shown = response.body.data.result.responsibleUser;
    expect(shown).toMatchObject({ id: responsible.id, firstName: 'Анна' });
    for (const hidden of ['telegramId', 'paymentPhone', 'paymentCard', 'paymentDetails', 'isAdmin']) {
      expect(shown).not.toHaveProperty(hidden);
    }
  });
});
