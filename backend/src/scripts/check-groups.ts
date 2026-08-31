import { prisma } from '../database/client';

async function checkGroups() {
  try {
    const totalGroups = await prisma.group.count();
    
    console.log('\n📋 Telegram Groups Status:');
    console.log(`Total groups: ${totalGroups}`);
    
    if (totalGroups > 0) {
      console.log('\n📝 All groups:');
      const groups = await prisma.group.findMany({
        orderBy: { title: 'asc' }
      });
      
      groups.forEach(group => {
        console.log(`  ${group.isActive ? '✅' : '❌'} ${group.title}`);
        console.log(`     ID: ${group.telegramId}`);
        console.log(`     Type: ${group.type}`);
        console.log('');
      });
    } else {
      console.log('\n⚠️ No groups found in database!');
      console.log('\n💡 To add groups:');
      console.log('1. Add the bot to a Telegram group');
      console.log('2. The bot will automatically register the group');
      console.log('3. Or run: npm run sync-groups');
    }
    
  } catch (error) {
    console.error('Error checking groups:', error);
  } finally {
    await prisma.$disconnect();
  }
}

void checkGroups();
