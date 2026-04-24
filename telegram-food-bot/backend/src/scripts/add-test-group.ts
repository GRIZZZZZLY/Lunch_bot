import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Добавление тестовой группы вручную
 * Используется когда база данных была очищена
 */
async function addTestGroup() {
  try {
    console.log('\n🔍 Добавление тестовой группы...\n');
    
    // Проверяем существующие группы
    const existingGroups = await prisma.group.findMany();
    console.log(`Текущее количество групп: ${existingGroups.length}`);
    
    if (existingGroups.length > 0) {
      console.log('\n📋 Существующие группы:');
      existingGroups.forEach(group => {
        console.log(`  - ${group.title} (ID: ${group.telegramId})`);
      });
      console.log('\n⚠️ Группы уже есть в базе. Хотите добавить ещё одну? [y/N]');
      console.log('💡 Или укажите реальный Telegram Chat ID вашей группы:');
      console.log('   Формат: npm run add-test-group -- --chatId=-1001234567890 --title="Моя группа"');
      return;
    }
    
    // Получаем аргументы из командной строки
    const args = process.argv.slice(2);
    let chatId = '-1001234567890'; // Тестовый ID
    let title = 'Тестовая группа';
    
    // Парсим аргументы
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--chatId=')) {
        chatId = args[i].split('=')[1];
      } else if (args[i].startsWith('--title=')) {
        title = args[i].split('=')[1].replace(/['"]/g, '');
      }
    }
    
    console.log('\n📝 Создаем группу:');
    console.log(`   Название: ${title}`);
    console.log(`   Chat ID: ${chatId}`);
    
    // Создаем группу
    const group = await prisma.group.create({
      data: {
        telegramId: BigInt(chatId),
        title,
        type: 'group',
        isActive: true,
      }
    });
    
    console.log('\n✅ Группа успешно создана!');
    console.log(`   ID в БД: ${group.id}`);
    console.log(`   Telegram ID: ${group.telegramId}`);
    console.log(`   Название: ${group.title}`);
    
    console.log('\n💡 Примечание:');
    console.log('   Это тестовая группа. Для работы с реальной группой:');
    console.log('   1. Добавьте бота в группу Telegram');
    console.log('   2. Бот автоматически зарегистрирует группу при первом событии');
    console.log('   3. Или узнайте Chat ID группы и запустите:');
    console.log(`      npm run add-test-group -- --chatId=-100XXXXXXXXX --title="Название группы"`);
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestGroup();
