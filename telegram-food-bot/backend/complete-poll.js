const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function completePoll() {
  try {
    const result = await prisma.poll.updateMany({
      where: { status: 'ACTIVE' },
      data: { 
        status: 'COMPLETED',
        endedAt: new Date()
      }
    });
    
    console.log(`✅ Завершено голосований: ${result.count}`);
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

completePoll();
