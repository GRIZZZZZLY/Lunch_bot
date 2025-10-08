const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAndSetAdmin() {
  try {
    const telegramId = BigInt(process.env.TEST_USER_ID || '555502880');
    
    console.log('🔍 Checking user with telegramId:', telegramId.toString());
    
    let user = await prisma.user.findUnique({
      where: { telegramId }
    });
    
    if (!user) {
      console.log('❌ User not found');
      console.log('Creating user...');
      
      user = await prisma.user.create({
        data: {
          telegramId,
          username: 'dev_user',
          firstName: 'Dev',
          lastName: 'User',
          isAdmin: true,
          isActive: true
        }
      });
      
      console.log('✅ User created with admin rights:', user.id);
    } else {
      console.log('✅ User found:', {
        id: user.id,
        firstName: user.firstName,
        isAdmin: user.isAdmin,
        isActive: user.isActive
      });
      
      if (!user.isAdmin) {
        console.log('⚠️  User is not admin, updating...');
        
        user = await prisma.user.update({
          where: { id: user.id },
          data: { isAdmin: true }
        });
        
        console.log('✅ User updated to admin');
      } else {
        console.log('✅ User already has admin rights');
      }
    }
    
    console.log('\nFinal user status:', {
      id: user.id,
      telegramId: user.telegramId.toString(),
      firstName: user.firstName,
      isAdmin: user.isAdmin,
      isActive: user.isActive
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndSetAdmin();
