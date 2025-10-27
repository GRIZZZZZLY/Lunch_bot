/**
 * Скрипт для проверки голосов в конкретном голосовании
 * Использование: node check-poll-votes.js <pollId>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPollVotes(pollId) {
  try {
    console.log(`\n🔍 Проверка голосования ID=${pollId}...\n`);
    
    // Получаем голосование
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        group: true,
        votes: {
          include: {
            user: true,
            menuItem: true,
          },
        },
      },
    });
    
    if (!poll) {
      console.log('❌ Голосование не найдено');
      return;
    }
    
    // Информация о голосовании
    console.log('📋 Информация о голосовании:');
    console.log(`   ID: ${poll.id}`);
    console.log(`   Группа: ${poll.group.title} (ID: ${poll.groupId})`);
    console.log(`   Статус: ${poll.status}`);
    console.log(`   Создано: ${poll.startedAt}`);
    console.log(`   Завершено: ${poll.endedAt || 'ещё активно'}`);
    console.log(`   Длительность: ${poll.duration} минут`);
    
    // Голоса
    console.log(`\n👥 Голоса (всего: ${poll.votes.length}):\n`);
    
    if (poll.votes.length === 0) {
      console.log('   ⚠️  Нет голосов');
    } else {
      // Группируем по userId для проверки дубликатов
      const votesByUser = new Map();
      
      poll.votes.forEach((vote) => {
        const userName = `${vote.user.firstName} ${vote.user.lastName || ''}`.trim();
        const menuItemName = vote.menuItem?.name || 'N/A';
        
        if (!votesByUser.has(vote.userId)) {
          votesByUser.set(vote.userId, []);
        }
        
        votesByUser.get(vote.userId).push({
          id: vote.id,
          menuItem: menuItemName,
          createdAt: vote.createdAt,
          updatedAt: vote.updatedAt,
        });
      });
      
      // Показываем голоса по пользователям
      let index = 1;
      for (const [userId, votes] of votesByUser.entries()) {
        const vote = votes[0]; // Берём последний голос
        const user = poll.votes.find(v => v.userId === userId).user;
        const userName = `${user.firstName} ${user.lastName || ''}`.trim();
        
        console.log(`   ${index}. ${userName} (ID: ${userId})`);
        console.log(`      Блюдо: ${vote.menuItem}`);
        console.log(`      Создан: ${vote.createdAt}`);
        console.log(`      Обновлён: ${vote.updatedAt}`);
        
        if (votes.length > 1) {
          console.log(`      ⚠️  ВНИМАНИЕ: ${votes.length} записей для этого пользователя!`);
          votes.forEach((v, i) => {
            console.log(`         ${i + 1}. ID=${v.id}, ${v.menuItem}, ${v.createdAt}`);
          });
        }
        
        console.log('');
        index++;
      }
      
      // Проверка дубликатов
      console.log('📊 Статистика:');
      console.log(`   Всего записей голосов: ${poll.votes.length}`);
      console.log(`   Уникальных пользователей: ${votesByUser.size}`);
      
      if (poll.votes.length !== votesByUser.size) {
        console.log(`   ⚠️  ДУБЛИКАТЫ: ${poll.votes.length - votesByUser.size} лишних записей`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка при проверке голосования:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем ID из аргументов командной строки
const pollId = parseInt(process.argv[2]);

if (!pollId || isNaN(pollId)) {
  console.log('❌ Использование: node check-poll-votes.js <pollId>');
  console.log('   Пример: node check-poll-votes.js 137');
  process.exit(1);
}

checkPollVotes(pollId);
