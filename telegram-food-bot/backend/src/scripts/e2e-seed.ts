import { disconnect, prisma } from '../database/client';

const E2E_USER_TELEGRAM_ID = 700000101n;
const E2E_GROUP_TELEGRAM_ID = -100000000001n;

function assertSafeDatabase(): void {
  const raw = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  let databaseName = '';
  try {
    databaseName = new URL(raw).pathname.replace(/^\//, '').toLowerCase();
  } catch {
    throw new Error('E2E seed requires a valid TEST_DATABASE_URL or DATABASE_URL');
  }
  if (!databaseName.includes('test') && !databaseName.includes('e2e')) {
    throw new Error(`Refusing E2E data mutation outside a test database (database: ${databaseName || '<empty>'})`);
  }
}

async function cleanup(): Promise<void> {
  const group = await prisma.group.findUnique({ where: { telegramId: E2E_GROUP_TELEGRAM_ID } });
  if (group) await prisma.group.delete({ where: { id: group.id } });

  const user = await prisma.user.findUnique({ where: { telegramId: E2E_USER_TELEGRAM_ID } });
  if (user) await prisma.user.delete({ where: { id: user.id } });
}

async function seed(): Promise<void> {
  await cleanup();
  const user = await prisma.user.create({
    data: {
      telegramId: E2E_USER_TELEGRAM_ID,
      username: 'anna_e2e',
      firstName: 'Анна',
      lastName: 'Тестова',
      isAdmin: false,
      isActive: true,
    },
  });
  const group = await prisma.group.create({
    data: {
      telegramId: E2E_GROUP_TELEGRAM_ID,
      title: 'Команда E2E',
      type: 'supergroup',
      isActive: true,
    },
  });
  await prisma.groupMember.create({
    data: { groupId: group.id, userId: user.id, role: 'CREATOR', isActive: true },
  });
  await prisma.menuItem.createMany({
    data: [
      { name: 'Борщ E2E', description: 'Проверка договора меню', price: 390, createdBy: user.id, groupId: group.id },
      { name: 'Паста E2E', description: 'Второе тестовое блюдо', price: 510, createdBy: user.id, groupId: group.id },
    ],
  });
}

async function main(): Promise<void> {
  assertSafeDatabase();
  const command = process.argv[2] ?? 'seed';
  if (command === 'seed') await seed();
  else if (command === 'cleanup') await cleanup();
  else throw new Error(`Unknown E2E seed command: ${command}`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnect();
  });
