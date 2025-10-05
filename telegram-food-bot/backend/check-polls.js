const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPolls() {
  try {
    const activePolls = await prisma.poll.findMany({
      where: { status: 'ACTIVE' },
      include: {
        group: true,
        creator: true
      }
    });
    
    console.log('Active polls:');
    activePolls.forEach(poll => {
      console.log(`  ID: ${poll.id}, Group: ${poll.group.title}, Status: ${poll.status}, Duration: ${poll.duration}min`);
      console.log(`  Started: ${poll.started_at}, Created by: ${poll.creator.username || poll.creator.first_name}`);
    });
    console.log(`\nTotal active polls: ${activePolls.length}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPolls();
