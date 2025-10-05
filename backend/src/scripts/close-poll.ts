import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function closePoll() {
  try {
    console.log('🔄 Closing Poll ID 9...');
    
    const poll = await prisma.poll.update({
      where: { id: 10 },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });
    
    console.log('✅ Poll closed:', poll);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

closePoll();
