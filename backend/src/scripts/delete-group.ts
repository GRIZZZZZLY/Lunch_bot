import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteGroup() {
  try {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.log('\n❌ Укажите ID или Telegram ID группы:');
      console.log('   npm run delete-group <id>');
      console.log('   npm run delete-group -1001234567890');
      console.log('\n📋 Доступные группы:');
      
      const groups = await prisma.group.findMany();
      if (groups.length === 0) {
        console.log('   Нет групп в базе данных');
      } else {
        groups.forEach(group => {
          console.log(`   ID: ${group.id} | Telegram ID: ${group.telegramId} | ${group.title}`);
        });
      }
      return;
    }
    
    const identifier = args[0];
    let group;
    
    // Проверяем это DB ID или Telegram ID
    if (identifier.startsWith('-')) {
      // Это Telegram ID
      group = await prisma.group.findUnique({
        where: { telegramId: BigInt(identifier) }
      });
    } else {
      // Это DB ID
      group = await prisma.group.findUnique({
        where: { id: parseInt(identifier) }
      });
    }
    
    if (!group) {
      console.log(`\n❌ Группа не найдена: ${identifier}`);
      return;
    }
    
    console.log(`\n🗑️ Удаление группы:`);
    console.log(`   ID: ${group.id}`);
    console.log(`   Telegram ID: ${group.telegramId}`);
    console.log(`   Название: ${group.title}`);
    
    // Проверяем есть ли связанные голосования
    const pollsCount = await prisma.poll.count({
      where: { groupId: group.id }
    });
    
    if (pollsCount > 0) {
      console.log(`\n⚠️ ВНИМАНИЕ: У этой группы есть ${pollsCount} голосований!`);
      console.log('   Они будут удалены вместе с группой (CASCADE).');
    }
    
    // Удаляем группу
    await prisma.group.delete({
      where: { id: group.id }
    });
    
    console.log('\n✅ Группа успешно удалена!');
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

void deleteGroup();
