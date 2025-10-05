/**
 * Проверка состояния меню в базе
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMenu() {
  try {
    const menuItems = await prisma.menuItem.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        price: true,
        isActive: true,
      },
    });

    console.log(`\n📊 В базе данных: ${menuItems.length} блюд\n`);

    if (menuItems.length > 0) {
      console.log('Блюда:');
      menuItems.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} (${item.category}) - ₽${item.price} [${item.isActive ? 'Активно' : 'Неактивно'}]`);
      });
    } else {
      console.log('✅ База данных пустая - блюд нет!');
    }

    // Проверяем голосования
    const polls = await prisma.poll.count();
    const votes = await prisma.vote.count();
    const results = await prisma.pollResult.count();

    console.log(`\n📈 Статистика:`);
    console.log(`   Голосований: ${polls}`);
    console.log(`   Голосов: ${votes}`);
    console.log(`   Результатов: ${results}`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMenu();
