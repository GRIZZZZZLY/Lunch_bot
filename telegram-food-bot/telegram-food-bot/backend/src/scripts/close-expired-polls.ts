/**
 * Скрипт для завершения истекших голосований
 * Использование: npm run close-expired-polls
 */

import { PrismaClient } from '@prisma/client';
import { CacheInvalidator } from '../services/cache.service';

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
    
    // Найдем ВСЕ активные голосования
    const activePolls = await prisma.poll.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        group: true,
      },
    });

    if (activePolls.length === 0) {
      console.log('✅ No active polls found!');
      console.log('');
      return;
    }

    console.log(`📊 Found ${activePolls.length} active poll(s), checking expiration...`);
    console.log('');

    // Фильтруем истекшие голосования (используя ту же логику что и в getActivePolls)
    const expiredPolls = activePolls.filter(poll => {
      const endsAt = poll.endedAt || new Date(poll.startedAt.getTime() + poll.duration * 60 * 1000);
      const isExpired = endsAt <= now;
      
      if (isExpired) {
        const hoursSinceEnd = Math.floor((now.getTime() - endsAt.getTime()) / (1000 * 60 * 60));
        console.log(`  ⏰ Poll ID: ${poll.id}`);
        console.log(`     Group: ${poll.group.title} (ID: ${poll.groupId})`);
        console.log(`     Started: ${poll.startedAt.toISOString()}`);
        console.log(`     Duration: ${poll.duration} min`);
        console.log(`     Should end: ${endsAt.toISOString()}`);
        console.log(`     Hours ago: ${hoursSinceEnd}h`);
        console.log('');
      }
      
      return isExpired;
    });

    if (expiredPolls.length === 0) {
      console.log('✅ No expired polls found!');
      console.log('');
      return;
    }

    console.log(`⚠️  Found ${expiredPolls.length} expired poll(s) to close`);
    console.log('');

    // Завершаем истекшие голосования по одному
    console.log('🔄 Closing expired polls...');
    console.log('');

    let closedCount = 0;
    for (const poll of expiredPolls) {
      const result = await prisma.poll.update({
        where: { id: poll.id },
        data: {
          status: 'COMPLETED',
          endedAt: poll.endedAt || new Date(poll.startedAt.getTime() + poll.duration * 60 * 1000),
        },
      });
      
      // Очищаем кэш для этого голосования
      CacheInvalidator.invalidatePoll(poll.id, poll.groupId);
      
      console.log(`  ✅ Closed poll ${result.id}`);
      console.log(`  🧹 Cache cleared for poll ${result.id}`);
      closedCount++;
    }

    console.log('');
    console.log(`✅ Successfully closed ${closedCount} expired poll(s)`);
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
