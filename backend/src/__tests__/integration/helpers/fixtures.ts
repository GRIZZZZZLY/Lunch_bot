import { prisma } from '../../../database/client';
import { MenuItem, User, Group, Poll, Prisma } from '@prisma/client';

/**
 * Очищает тестовую базу данных: все таблицы, кроме журнала миграций.
 *
 * Раньше здесь был список deleteMany в порядке внешних ключей. Каждая новая
 * таблица в него не попадала, пока тест не падал на внешнем ключе или на
 * данных, протёкших из прошлого теста (так было с магазинными забегами и
 * очередью уведомлений). Список таблиц берётся из самой базы.
 */
export async function cleanDatabase() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
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
  groupId?: number;
  price?: number | Prisma.Decimal | null;
};

export async function createTestMenuItem(overrides?: TestMenuItemOverrides): Promise<MenuItem> {
  // Если не передан createdBy, создаем временного пользователя
  let createdBy = overrides?.createdBy;
  if (!createdBy) {
    const tempUser = await createTestUser({ firstName: 'Menu Creator' });
    createdBy = tempUser.id;
  }

  // Если не передан groupId, создаём временную группу (groupId обязателен по схеме)
  let groupId = overrides?.groupId;
  if (!groupId) {
    const tempGroup = await createTestGroup({ title: 'Menu Default Group' });
    groupId = tempGroup.id;
  }

  return await prisma.menuItem.create({
    data: {
      name: overrides?.name || 'Test Dish',
      price: overrides?.price || 300,
      description: overrides?.description || 'Test description',
      imageUrl: overrides?.imageUrl || null,
      isActive: overrides?.isActive !== undefined ? overrides.isActive : true,
      createdBy,
      groupId,
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
    createTestMenuItem({ name: 'Пицца', price: 500, createdBy: user.id, groupId: group.id }),
    createTestMenuItem({ name: 'Бургер', price: 400, createdBy: user.id, groupId: group.id }),
    createTestMenuItem({ name: 'Салат', price: 300, createdBy: user.id, groupId: group.id }),
  ]);

  return { user, group, menuItems };
}
