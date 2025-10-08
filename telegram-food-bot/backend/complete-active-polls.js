const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function completeActivePolls() {
  try {
    console.log('🔍 Searching for active polls...\n');
    
    const activePolls = await prisma.poll.findMany({
      where: { 
        status: 'ACTIVE'
      },
      include: {
        group: {
          select: {
            id: true,
            title: true
          }
        },
        _count: {
          select: {
            votes: true
          }
        }
      }
    });
    
    if (activePolls.length === 0) {
      console.log('✅ No active polls found');
      return;
    }
    
    console.log(`Found ${activePolls.length} active poll(s):\n`);
    
    for (const poll of activePolls) {
      console.log(`📊 Poll #${poll.id}:`);
      console.log(`   Group: ${poll.group.title} (ID: ${poll.group.id})`);
      console.log(`   Votes: ${poll._count.votes}`);
      console.log(`   Created: ${poll.createdAt}`);
      console.log('');
    }
    
    console.log('Do you want to complete all these polls? (y/n)');
    console.log('Or enter poll ID to complete specific one\n');
    
    // Для автоматического завершения всех
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('Your choice: ', async (answer) => {
      try {
        if (answer.toLowerCase() === 'y') {
          // Завершаем все
          for (const poll of activePolls) {
            await prisma.poll.update({
              where: { id: poll.id },
              data: {
                status: 'COMPLETED',
                endedAt: new Date()
              }
            });
            console.log(`✅ Completed poll #${poll.id} in ${poll.group.title}`);
          }
          console.log(`\n✅ All ${activePolls.length} poll(s) completed!`);
        } else if (!isNaN(parseInt(answer))) {
          // Завершаем конкретное голосование
          const pollId = parseInt(answer);
          const poll = activePolls.find(p => p.id === pollId);
          
          if (poll) {
            await prisma.poll.update({
              where: { id: pollId },
              data: {
                status: 'COMPLETED',
                endedAt: new Date()
              }
            });
            console.log(`\n✅ Completed poll #${pollId} in ${poll.group.title}`);
          } else {
            console.log(`\n❌ Poll #${pollId} not found in active polls`);
          }
        } else {
          console.log('\n❌ Cancelled');
        }
      } catch (err) {
        console.error('❌ Error:', err);
      } finally {
        await prisma.$disconnect();
        readline.close();
        process.exit(0);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Если запускается напрямую
if (require.main === module) {
  completeActivePolls();
}

module.exports = { completeActivePolls };
