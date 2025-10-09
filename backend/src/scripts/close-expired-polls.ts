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
    const now = new Date();
    
    // Найдем все активные голосования
    const activePolls = await prisma.poll.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        group: true,
      },
    });

    // Фильтруем истекшие голосования
    const expiredPolls = activePolls.filter((poll) => {
      const endsAt = poll.endedAt || new Date(poll.startedAt.getTime() + poll.duration * 60 * 1000);
      return endsAt < now;
    });

    if (expiredPolls.length === 0) {
      console.log('✅ No expired polls found!');
      console.log('');
      return;
    }

    console.log(`⚠️  Found ${expiredPolls.length} expired poll(s):`);
    console.log('');

    for (const poll of expiredPolls) {
      const endsAt = poll.endedAt || new Date(poll.startedAt.getTime() + poll.duration * 60 * 1000);
      const hoursSinceEnd = Math.floor((now.getTime() - endsAt.getTime()) / (1000 * 60 * 60));

      console.log(`  Poll ID: ${poll.id}`);
      console.log(`  Group: ${poll.group.title} (ID: ${poll.group_id})`);
      console.log(`  Ended at: ${endsAt.toISOString()}`);
      console.log(`  Hours ago: ${hoursSinceEnd}h`);
      console.log('');
      
      // Обновляем каждое голосование отдельно
      await prisma.poll.update({
        where: { id: poll.id },
        data: {
          status: 'COMPLETED',
          endedAt: endsAt,
        },
      });
    }

    console.log(`✅ Closed ${expiredPolls.length} expired poll(s)`);
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
