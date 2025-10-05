/**
 * Проверка недавно добавленных блюд
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRecentItems() {
  try {
    // Получаем все блюда, отсортированные по времени создания
    const items = await prisma.menuItem.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        creator: {
          select: {
            username: true,
            firstName: true,
          },
        },
      },
    });

    console.log(`\n📊 Всего блюд в базе: ${await prisma.menuItem.count()}`);
    console.log(`\n📋 Последние ${items.length} блюд:\n`);

    items.forEach((item, index) => {
      const createdAt = new Date(item.createdAt);
      const timeAgo = Math.floor((Date.now() - createdAt.getTime()) / 1000);
      const timeStr = timeAgo < 60 
        ? `${timeAgo}с назад`
        : timeAgo < 3600
        ? `${Math.floor(timeAgo / 60)}м назад`
        : `${Math.floor(timeAgo / 3600)}ч назад`;

      console.log(
        `${index + 1}. [${item.id}] ${item.name} (${item.category || 'Без категории'})`
      );
      console.log(
        `   Создано: ${createdAt.toLocaleString('ru-RU')} (${timeStr})`
      );
      console.log(
        `   Автор: ${item.creator.firstName} (@${item.creator.username})`
      );
      console.log(
        `   Цена: ₽${item.price || 0} | Активно: ${item.isActive ? 'Да' : 'Нет'}`
      );
      console.log('');
    });

    // Группируем по минутам создания
    console.log('\n⏰ Группировка по времени создания:');
    const grouped = items.reduce((acc, item) => {
      const minute = new Date(item.createdAt).toLocaleString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      if (!acc[minute]) acc[minute] = [];
      acc[minute].push(item);
      return acc;
    }, {} as Record<string, typeof items>);

    Object.entries(grouped).forEach(([time, items]) => {
      console.log(`   ${time}: ${items.length} блюд${items.length > 1 ? ' ⚠️ ДУБЛИКАТЫ!' : ''}`);
      if (items.length > 1) {
        items.forEach(item => {
          console.log(`      - ${item.name}`);
        });
      }
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentItems();
