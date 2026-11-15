import { Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';

/** Имя, под которым удалённый человек остаётся в чужих долгах, голосах и заказах. */
export const DELETED_USER_NAME = 'Удалённый пользователь';

/**
 * Telegram ID удалённого аккаунта. Настоящие ID пользователей положительные и
 * меньше 2^52, ID чатов — отрицательные, но не ниже -2^52. Число ниже -2^62 не
 * совпадёт ни с кем, поэтому повторный вход создаёт новый профиль, а отправка
 * сообщения «по старой памяти» уходит в никуда, а не в чужой чат.
 */
export function deletedTelegramId(userId: number): bigint {
  return -(2n ** 62n) - BigInt(userId);
}

/** Долги, которые ещё не закрыты: ни подтверждены, ни прощены, ни отменены. */
const CLOSED_DEBT = ['CONFIRMED', 'FORGIVEN', 'CANCELLED'];
const ADMIN_ROLES = ['ADMIN', 'CREATOR'];

export type AccountDeletionResult = { deleted: true } | { deleted: false; blockers: string[] };

type Tx = Prisma.TransactionClient;

/**
 * Что не даёт удалить аккаунт прямо сейчас. Удаление не закрывает чужое за
 * человека: незакрытый долг пропал бы у второй стороны вместе с реквизитами,
 * идущий опрос или закупка остались бы без ведущего, а группа — без админа.
 * Человек закрывает это сам и повторяет удаление.
 */
async function findBlockers(tx: Tx, userId: number): Promise<string[]> {
  const blockers: string[] = [];

  const openDebts = await tx.transaction.count({
    where: {
      OR: [{ fromUserId: userId }, { toUserId: userId }],
      status: { notIn: CLOSED_DEBT },
    },
  });
  if (openDebts > 0) {
    blockers.push(
      `Незакрытых долгов: ${openDebts}. Оплатите свои долги и подтвердите или простите долги вам.`
    );
  }

  const activePolls = await tx.poll.findMany({
    where: { createdBy: userId, status: 'ACTIVE' },
    select: { group: { select: { title: true } } },
  });
  for (const p of activePolls) {
    blockers.push(`Идёт ваш опрос в группе «${p.group.title}». Завершите или отмените его.`);
  }

  const activeRuns = await tx.storeRun.findMany({
    where: { initiatorId: userId, status: { in: ['COLLECTING', 'SHOPPING'] } },
    select: { group: { select: { title: true } } },
  });
  for (const r of activeRuns) {
    blockers.push(`Идёт ваша закупка в группе «${r.group.title}». Завершите или отмените её.`);
  }

  const adminOf = await tx.groupMember.findMany({
    where: { userId, isActive: true, role: { in: ADMIN_ROLES }, group: { isActive: true } },
    select: { groupId: true, group: { select: { title: true } } },
  });
  for (const m of adminOf) {
    const others = await tx.groupMember.groupBy({
      by: ['role'],
      where: { groupId: m.groupId, isActive: true, userId: { not: userId } },
      _count: true,
    });
    const hasMembers = others.length > 0;
    const hasOtherAdmin = others.some((o) => ADMIN_ROLES.includes(o.role));
    if (hasMembers && !hasOtherAdmin) {
      blockers.push(
        `Вы единственный администратор группы «${m.group.title}». Назначьте другого администратора.`
      );
    }
  }

  return blockers;
}

/**
 * Удаление аккаунта по просьбе самого человека.
 *
 * Строка пользователя не удаляется, а обезличивается: на неё ссылаются чужие
 * долги, голоса и заказы, и удаление строки либо упёрлось бы во внешние ключи,
 * либо унесло бы чужую историю. Стираются все личные данные и всё, что
 * относится только к самому человеку.
 *
 * Проверка препятствий и обезличивание — в одной транзакции с блокировкой
 * строки: долг, созданный между проверкой и удалением, иначе остался бы
 * висеть на «Удалённом пользователе».
 */
export async function deleteAccount(userId: number): Promise<AccountDeletionResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ telegram_id: bigint; is_active: boolean }[]>`
      SELECT telegram_id, is_active FROM users WHERE id = ${userId} FOR UPDATE`;
    const row = locked[0];
    if (!row || !row.is_active) return { deleted: true } as const;

    const blockers = await findBlockers(tx, userId);
    if (blockers.length > 0) return { deleted: false, blockers };

    const oldChatId = row.telegram_id.toString();
    const now = new Date();

    await tx.user.update({
      where: { id: userId },
      data: {
        telegramId: deletedTelegramId(userId),
        username: null,
        firstName: DELETED_USER_NAME,
        lastName: null,
        photoUrl: null,
        avatarUrl: null,
        avatarUpdatedAt: null,
        paymentCard: null,
        paymentPhone: null,
        paymentDetails: null,
        isActive: false,
        isAdmin: false,
        participatesInPolls: false,
      },
    });

    // Выход из групп — как обычный уход: членство остаётся в истории неактивным.
    await tx.groupMember.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, leftAt: now },
    });

    // Только своё: прогресс, награды, заготовки заказов, напоминания админу.
    await tx.userProgress.deleteMany({ where: { userId } });
    await tx.userStats.deleteMany({ where: { userId } });
    await tx.userAchievement.deleteMany({ where: { userId } });
    await tx.userChallengeProgress.deleteMany({ where: { userId } });
    await tx.userQuest.deleteMany({ where: { userId } });
    await tx.xPHistory.deleteMany({ where: { userId } });
    await tx.userItemPreset.deleteMany({ where: { userId } });
    await tx.adminReminder.deleteMany({ where: { userId } });

    // Личка человека — его Telegram ID. Ссылки на неё в чужих строках тоже стираем.
    await tx.transaction.updateMany({
      where: { debtChatId: oldChatId },
      data: { debtChatId: null, debtMessageId: null },
    });
    await tx.outboxEvent.deleteMany({ where: { recipientChatId: oldChatId } });

    // Очередь уведомлений хранит имена сторон долга снимком.
    await tx.$executeRaw`
      UPDATE outbox_events e
         SET payload = jsonb_set(e.payload, '{debtorFirstName}', to_jsonb(${DELETED_USER_NAME}::text))
        FROM transactions t
       WHERE e.entity_type = 'TRANSACTION' AND e.entity_id = t.id
         AND t.from_user_id = ${userId} AND e.payload ? 'debtorFirstName'`;
    await tx.$executeRaw`
      UPDATE outbox_events e
         SET payload = jsonb_set(e.payload, '{payeeFirstName}', to_jsonb(${DELETED_USER_NAME}::text))
        FROM transactions t
       WHERE e.entity_type = 'TRANSACTION' AND e.entity_id = t.id
         AND t.to_user_id = ${userId} AND e.payload ? 'payeeFirstName'`;

    logger.info('Account deleted', { userId });
    return { deleted: true } as const;
  });
}
