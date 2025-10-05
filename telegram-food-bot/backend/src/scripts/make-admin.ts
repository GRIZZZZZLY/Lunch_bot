import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function makeAdmin() {
  try {
    console.log('🔄 Making user 555502880 (Игорь) an admin...');
    
    const user = await prisma.user.update({
      where: { telegramId: 555502880 },
      data: { isAdmin: true },
    });
    
    console.log('✅ User is now admin:', user);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();
