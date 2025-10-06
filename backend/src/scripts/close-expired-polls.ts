/**
 * Скрипт для завершения истекших голосований
 * Использование: npm run close-expired-polls
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function closeExpiredPolls() {
  console.log('');
  console.log('========================================');
  console.log('  Close Expired Polls');
  console.log('========================================');
  console.log('');

  try {
    // Найдем истекшие голосования
    const expiredPolls = await prisma.poll.findMany({
      where: {
        status: 'ACTIVE',
        endedAt: {
          lt: new Date(), // endedAt < now
        },
      },
      include: {
        group: true,
      },
    });

    if (expiredPolls.length === 0) {
      console.log('✅ No expired polls found!');
      console.log('');
      return;
    }

    console.log(`⚠️  Found ${expiredPolls.length} expired poll(s):`);
    console.log('');

    for (const poll of expiredPolls) {
      const endedAt = new Date(poll.endedAt!);
      const now = new Date();
      const hoursSinceEnd = Math.floor((now.getTime() - endedAt.getTime()) / (1000 * 60 * 60));

      console.log(`  Poll ID: ${poll.id}`);
      console.log(`  Group: ${poll.group.title} (ID: ${poll.group_id})`);
      console.log(`  Ended at: ${endedAt.toISOString()}`);
      console.log(`  Hours ago: ${hoursSinceEnd}h`);
      console.log('');
    }

    // Завершаем голосования
    console.log('🔄 Closing expired polls...');
    console.log('');

    const result = await prisma.poll.updateMany({
      where: {
        status: 'ACTIVE',
        endedAt: {
          lt: new Date(),
        },
      },
      data: {
        status: 'COMPLETED',
      },
    });

    console.log(`✅ Closed ${result.count} expired poll(s)`);
    console.log('');
    console.log('========================================');
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем скрипт
closeExpiredPolls()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
