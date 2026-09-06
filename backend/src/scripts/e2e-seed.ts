/**
 * Данные для интеграционных и сквозных проверок.
 *
 * Форма данных — договор между этим сценарием и тестами
 * (`frontend-new/tests/e2e/specs/*`, `src/__tests__/integration/*`). Тесты
 * знают идентификаторы и названия наизусть, поэтому менять их нельзя, не
 * поправив тесты; новое добавлять можно.
 *
 * Три команды, и это главное в наборе: одной команды недостаточно, чтобы
 * поймать смешение данных между командами — а `PRODUCT.md` называет такое
 * смешение критической ошибкой.
 *
 *   Команда А — Анна администратор (CREATOR), своё меню, своё голосование;
 *   Команда Б — Анна обычный участник, своё меню, свой магазинный забег;
 *   Команда В — Анны в ней НЕТ. Запрос к ней должен получать отказ, а не
 *               пустой список: пустой ответ не отличить от «здесь ничего нет».
 *
 * Борис — вторая сторона денежных сценариев: получатель долгов и участник
 * всех трёх команд. Долги заведены в А и Б, поэтому командный экран бюджета
 * обязан показывать разные суммы, а не сумму по всем командам.
 *
 * Долг в Б привязан к магазинному забегу, а не к голосованию: у долга две
 * возможные связи с командой (`poll.groupId` и `storeRun.groupId`), и вторая
 * долго не проверялась вообще.
 */
import { disconnect, prisma } from '../database/client';

/** Анна: администратор А, участник Б, вне В. Её `initData` подписывают тесты. */
const ANNA_TELEGRAM_ID = 700000101n;
/** Борис: получатель долгов, участник всех команд. */
const BORIS_TELEGRAM_ID = 700000102n;

const TEAM_A_TELEGRAM_ID = -100000000001n;
const TEAM_B_TELEGRAM_ID = -100000000002n;
const TEAM_C_TELEGRAM_ID = -100000000003n;

const USER_TELEGRAM_IDS = [ANNA_TELEGRAM_ID, BORIS_TELEGRAM_ID];
const GROUP_TELEGRAM_IDS = [
  TEAM_A_TELEGRAM_ID,
  TEAM_B_TELEGRAM_ID,
  TEAM_C_TELEGRAM_ID,
];

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

/**
 * Удаление в порядке зависимостей.
 *
 * Каскадом обойтись нельзя: `Poll.group` и `StoreRun.group` объявлены без
 * `onDelete: Cascade`, поэтому удаление группы с голосованием падало бы на
 * внешнем ключе. Транзакции — первыми: они ссылаются и на голосование, и на
 * забег.
 */
async function cleanup(): Promise<void> {
  const groups = await prisma.group.findMany({
    where: { telegramId: { in: GROUP_TELEGRAM_IDS } },
    select: { id: true },
  });
  const groupIds = groups.map(group => group.id);

  if (groupIds.length > 0) {
    const polls = await prisma.poll.findMany({
      where: { groupId: { in: groupIds } },
      select: { id: true },
    });
    const storeRuns = await prisma.storeRun.findMany({
      where: { groupId: { in: groupIds } },
      select: { id: true },
    });
    const pollIds = polls.map(poll => poll.id);
    const storeRunIds = storeRuns.map(run => run.id);

    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { pollId: { in: pollIds } },
          { storeRunId: { in: storeRunIds } },
        ],
      },
      select: { id: true },
    });

    /* Задания на уведомление ссылаются на транзакцию только по значению
       (entityId), внешнего ключа нет — удаляем их явно, иначе очередь
       унесла бы в следующий прогон уведомления об уже удалённых долгах. */
    if (transactions.length > 0) {
      await prisma.outboxEvent.deleteMany({
        where: {
          entityType: 'TRANSACTION',
          entityId: { in: transactions.map(tx => tx.id) },
        },
      });
    }

    await prisma.transaction.deleteMany({
      where: { id: { in: transactions.map(tx => tx.id) } },
    });
    await prisma.storeRun.deleteMany({ where: { id: { in: storeRunIds } } });
    await prisma.poll.deleteMany({ where: { id: { in: pollIds } } });
    await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
  }

  await prisma.user.deleteMany({
    where: { telegramId: { in: USER_TELEGRAM_IDS } },
  });
}

async function seed(): Promise<void> {
  await cleanup();

  const anna = await prisma.user.create({
    data: {
      telegramId: ANNA_TELEGRAM_ID,
      username: 'anna_e2e',
      firstName: 'Анна',
      lastName: 'Тестова',
      isAdmin: false,
      isActive: true,
    },
  });
  const boris = await prisma.user.create({
    data: {
      telegramId: BORIS_TELEGRAM_ID,
      username: 'boris_e2e',
      firstName: 'Борис',
      lastName: 'Сборов',
      isAdmin: false,
      isActive: true,
    },
  });

  /* Названия команды А и её блюд закреплены в
     `frontend-new/tests/e2e/specs/integration.spec.ts` — не менять. */
  const teamA = await prisma.group.create({
    data: {
      telegramId: TEAM_A_TELEGRAM_ID,
      title: 'Команда E2E',
      type: 'supergroup',
      isActive: true,
    },
  });
  const teamB = await prisma.group.create({
    data: {
      telegramId: TEAM_B_TELEGRAM_ID,
      title: 'Команда Б E2E',
      type: 'supergroup',
      isActive: true,
    },
  });
  const teamC = await prisma.group.create({
    data: {
      telegramId: TEAM_C_TELEGRAM_ID,
      title: 'Команда В E2E',
      type: 'supergroup',
      isActive: true,
    },
  });

  await prisma.groupMember.createMany({
    data: [
      // Анна: администратор А, обычный участник Б, в В её нет.
      { groupId: teamA.id, userId: anna.id, role: 'CREATOR', isActive: true },
      { groupId: teamB.id, userId: anna.id, role: 'MEMBER', isActive: true },
      // Борис есть везде: он получатель долгов и «местный» для команды В.
      { groupId: teamA.id, userId: boris.id, role: 'MEMBER', isActive: true },
      { groupId: teamB.id, userId: boris.id, role: 'CREATOR', isActive: true },
      { groupId: teamC.id, userId: boris.id, role: 'CREATOR', isActive: true },
    ],
  });

  await prisma.menuItem.createMany({
    data: [
      { name: 'Борщ E2E', description: 'Проверка договора меню', price: 390, createdBy: anna.id, groupId: teamA.id },
      { name: 'Паста E2E', description: 'Второе тестовое блюдо', price: 510, createdBy: anna.id, groupId: teamA.id },
      /* Своё блюдо у каждой команды: если экран покажет чужое, это видно по
         названию, а не по совпадающим суммам. */
      { name: 'Плов Б E2E', description: 'Блюдо команды Б', price: 450, createdBy: boris.id, groupId: teamB.id },
      { name: 'Суп В E2E', description: 'Блюдо недоступной команды', price: 300, createdBy: boris.id, groupId: teamC.id },
    ],
  });

  /* Завершённые голосования в А и Б: «последнее завершённое» обязано
     различаться по команде. */
  const pollA = await prisma.poll.create({
    data: {
      groupId: teamA.id,
      status: 'COMPLETED',
      createdBy: anna.id,
      endedAt: new Date(),
    },
  });
  await prisma.poll.create({
    data: {
      groupId: teamB.id,
      status: 'COMPLETED',
      createdBy: boris.id,
      endedAt: new Date(),
    },
  });

  const storeRunB = await prisma.storeRun.create({
    data: {
      groupId: teamB.id,
      initiatorId: boris.id,
      storeName: 'Лента Б E2E',
      status: 'SETTLED',
      collectUntil: new Date(Date.now() + 60 * 60_000),
    },
  });

  await prisma.transaction.createMany({
    data: [
      // Долг команды А, связь через голосование.
      {
        pollId: pollA.id,
        fromUserId: anna.id,
        toUserId: boris.id,
        amount: 390,
        status: 'PENDING',
      },
      // Долг команды Б, связь через магазинный забег.
      {
        storeRunId: storeRunB.id,
        fromUserId: anna.id,
        toUserId: boris.id,
        amount: 450,
        status: 'PENDING',
      },
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
