// Проверка последнего созданного poll
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLastPoll() {
  try {
    const lastPoll = await prisma.poll.findFirst({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        groupId: true,
        status: true,
        selectedMenuItemIds: true,
        createdAt: true,
      }
    });

    console.log('📊 Last Poll:');
    console.log(JSON.stringify(lastPoll, null, 2));
    
    if (lastPoll?.selectedMenuItemIds) {
      console.log('\n✅ selectedMenuItemIds found:');
      const ids = JSON.parse(lastPoll.selectedMenuItemIds);
      console.log('IDs:', ids);
    } else {
      console.log('\n❌ selectedMenuItemIds is NULL or empty');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLastPoll();
