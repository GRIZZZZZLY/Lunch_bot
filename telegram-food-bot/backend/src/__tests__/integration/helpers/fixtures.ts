import { prisma } from '../../../database/client';
import { MenuItem, User, Group, Poll, Prisma } from '@prisma/client';

/**
 * Очищает тестовую базу данных
 * ВАЖНО: Удаляем в порядке зависимостей (от зависимых к независимым)
 */
export async function cleanDatabase() {
  // 1. Удаляем данные с внешними ключами (самые зависимые)
  await prisma.paymentReminder.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.xPHistory.deleteMany();
  await prisma.userStats.deleteMany();
  await prisma.adminReminder.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.menuSuggestion.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.userQuest.deleteMany();
  await prisma.userChallengeProgress.deleteMany();
  await prisma.userProgress.deleteMany();
  
  // 2. Удаляем результаты голосований и ответственных
  await prisma.responsibleSelection.deleteMany();
  await prisma.pollOrderCosts.deleteMany();
  await prisma.pollResult.deleteMany();
  
  // 3. Удаляем голоса
  await prisma.vote.deleteMany();
  
  // 4. Удаляем голосования и recurring polls
  await prisma.poll.deleteMany();
  await prisma.recurringPoll.deleteMany();
  
  // 5. Удаляем блюда (зависят от user через createdBy)
  await prisma.menuItem.deleteMany();
  
  // 6. Удаляем standalone tables (no user/group FK dependencies)
  await prisma.achievement.deleteMany();
  await prisma.quest.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.season.deleteMany();
  
  // 7. Удаляем пользователей и группы (независимые)
  await prisma.user.deleteMany();
  await prisma.group.deleteMany();
}

/**
 * Создаёт тестового пользователя
 */
export async function createTestUser(overrides?: Partial<User>): Promise<User> {
  return await prisma.user.create({
    data: {
      telegramId: BigInt(overrides?.telegramId || Math.floor(Math.random() * 1000000000)),
      firstName: overrides?.firstName || 'Test',
      lastName: overrides?.lastName || 'User',
      username: overrides?.username || `testuser${Date.now()}`,
      isAdmin: overrides?.isAdmin || false,
    },
  });
}

/**
 * Создаёт тестовую группу
 */
export async function createTestGroup(overrides?: Partial<Group>): Promise<Group> {
  return await prisma.group.create({
    data: {
      telegramId: BigInt(overrides?.telegramId || Math.floor(Math.random() * 1000000000)),
      title: overrides?.title || 'Test Group',
      type: overrides?.type || 'group',
      isActive: overrides?.isActive !== undefined ? overrides.isActive : true,
    },
  });
}

/**
 * Создаёт тестовое блюдо
 */
type TestMenuItemOverrides = Omit<Partial<MenuItem>, 'price'> & {
  createdBy?: number;
  price?: number | Prisma.Decimal | null;
};

export async function createTestMenuItem(overrides?: TestMenuItemOverrides): Promise<MenuItem> {
  // Если не передан createdBy, создаем временного пользователя
  let createdBy = overrides?.createdBy;
  if (!createdBy) {
    const tempUser = await createTestUser({ firstName: 'Menu Creator' });
    createdBy = tempUser.id;
  }

  return await prisma.menuItem.create({
    data: {
      name: overrides?.name || 'Test Dish',
      price: overrides?.price || 300,
      description: overrides?.description || 'Test description',
      imageUrl: overrides?.imageUrl || null,
      isActive: overrides?.isActive !== undefined ? overrides.isActive : true,
      createdBy,
    },
  });
}

/**
 * Создаёт тестовое голосование
 */
export async function createTestPoll(
  groupId: number,
  createdBy: number,
  overrides?: Partial<Poll>
): Promise<Poll> {
  return await prisma.poll.create({
    data: {
      groupId,
      createdBy,
      status: overrides?.status || 'ACTIVE',
      duration: overrides?.duration || 30,
      startedAt: overrides?.startedAt || new Date(),
      endedAt: overrides?.endedAt || null,
      selectedMenuItemIds: overrides?.selectedMenuItemIds || null,
    },
  });
}

/**
 * Создаёт полный тестовый сетап: группа + пользователь + блюда
 */
export async function createTestSetup() {
  const user = await createTestUser({ isAdmin: true });
  const group = await createTestGroup();
  const menuItems = await Promise.all([
    createTestMenuItem({ name: 'Пицца', price: 500, createdBy: user.id }),
    createTestMenuItem({ name: 'Бургер', price: 400, createdBy: user.id }),
    createTestMenuItem({ name: 'Салат', price: 300, createdBy: user.id }),
  ]);

  return { user, group, menuItems };
}
