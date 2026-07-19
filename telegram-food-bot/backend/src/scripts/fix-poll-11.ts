/**
 * Скрипт для завершения Poll #11
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPoll11() {
  console.log('');
  console.log('========================================');
  console.log('  Fix Poll #11');
  console.log('========================================');
  console.log('');

  try {
    // Получаем Poll #11
    const poll = await prisma.poll.findUnique({
      where: { id: 11 },
      include: { group: true },
    });

    if (!poll) {
      console.log('❌ Poll #11 not found');
      return;
    }

    console.log('Current status:');
    console.log(`  ID: ${poll.id}`);
    console.log(`  Status: ${poll.status}`);
    console.log(`  Started: ${poll.startedAt?.toISOString()}`);
    console.log(`  EndedAt field: ${poll.endedAt?.toISOString() || 'NULL'}`);
    console.log(`  Duration: ${poll.duration} minutes`);
    console.log('');

    if (poll.status !== 'ACTIVE') {
      console.log(`✅ Poll is already ${poll.status}, nothing to do`);
      return;
    }

    // Вычисляем когда должно было закончиться
    const calculatedEndedAt = new Date(poll.startedAt.getTime() + poll.duration * 60 * 1000);
    console.log(`Calculated end time: ${calculatedEndedAt.toISOString()}`);
    console.log(`Current time: ${new Date().toISOString()}`);
    console.log('');

    // Обновляем статус на COMPLETED и устанавливаем endedAt
    console.log('🔄 Updating poll status to COMPLETED...');
    
    const updated = await prisma.poll.update({
      where: { id: 11 },
      data: {
        status: 'COMPLETED',
        endedAt: calculatedEndedAt,
      },
    });

    console.log('✅ Poll #11 updated successfully!');
    console.log(`  New status: ${updated.status}`);
    console.log(`  EndedAt: ${updated.endedAt?.toISOString()}`);
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
fixPoll11()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
