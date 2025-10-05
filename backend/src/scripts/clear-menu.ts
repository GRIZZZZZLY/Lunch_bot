/**
 * Скрипт для полной очистки меню и связанных данных
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearMenu() {
  try {
    console.log('🗑️  Начинаем очистку меню...');

    // 1. Удаляем все результаты голосований
    const deletedResults = await prisma.pollResult.deleteMany({});
    console.log(`✅ Удалено результатов голосований: ${deletedResults.count}`);

    // 2. Удаляем все голоса
    const deletedVotes = await prisma.vote.deleteMany({});
    console.log(`✅ Удалено голосов: ${deletedVotes.count}`);

    // 3. Удаляем все голосования
    const deletedPolls = await prisma.poll.deleteMany({});
    console.log(`✅ Удалено голосований: ${deletedPolls.count}`);

    // 4. Удаляем все блюда меню
    const deletedMenuItems = await prisma.menuItem.deleteMany({});
    console.log(`✅ Удалено блюд: ${deletedMenuItems.count}`);

    console.log('\n🎉 Меню полностью очищено!');
    console.log('Теперь можно добавлять блюда вручную.');

  } catch (error) {
    console.error('❌ Ошибка при очистке меню:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearMenu()
  .then(() => {
    console.log('\n✨ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
