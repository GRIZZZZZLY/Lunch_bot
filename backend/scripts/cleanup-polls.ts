/**
 * Скрипт для очистки отменённых голосований и кэша
 */
import { prisma } from '../src/database/client';
import { cacheService } from '../src/services/cache.service';
import { logger } from '../src/utils/logger';

async function cleanupPolls() {
  try {
    logger.info('🧹 Starting poll cleanup...');

    // 1. Найти все отменённые голосования за сегодня
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cancelledPolls = await prisma.poll.findMany({
      where: {
        status: 'CANCELLED',
        createdAt: {
          gte: today,
        },
      },
    });

    logger.info(`Found ${cancelledPolls.length} cancelled polls today`);

    // 2. Очистить весь кэш (если Redis включен)
    logger.info('🗑️ Clearing cache...');
    await cacheService.flush();
    logger.info('✅ Cache cleared (or skipped if Redis disabled)');

    // 3. Вывести информацию об активных голосованиях
    const activePolls = await prisma.poll.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        group: true,
      },
    });

    if (activePolls.length > 0) {
      logger.warn(`⚠️ Found ${activePolls.length} ACTIVE polls:`);
      activePolls.forEach(poll => {
        logger.info(`  - Poll #${poll.id} in group "${poll.group.title}" (status: ${poll.status})`);
      });
    } else {
      logger.info('✅ No active polls found');
    }

    logger.info('🎉 Cleanup completed successfully');
  } catch (error) {
    logger.error('Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск
cleanupPolls()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
