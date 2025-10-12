const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRepeatLogic() {
  console.log('🔍 Проверяем логику "Повторить вчерашнее"...\n');

  // 1. Найти последнее завершённое голосование
  console.log('1️⃣ Ищем последнее завершённое голосование...');
  const lastPoll = await prisma.poll.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { endedAt: 'desc' },
    include: { group: true }
  });

  if (!lastPoll) {
    console.log('❌ Нет завершённых голосований');
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Найдено: Poll #${lastPoll.id}`);
  console.log(`   Group: ${lastPoll.group.title}`);
  console.log(`   Status: ${lastPoll.status}`);
  console.log(`   Ended at: ${lastPoll.endedAt}`);
  console.log(`   Selected items: ${lastPoll.selectedMenuItemIds}`);
  console.log(`   Duration: ${lastPoll.duration} min`);

  // 2. Создать копию
  console.log('\n2️⃣ Создаём копию голосования...');
  try {
    const newPoll = await prisma.poll.create({
      data: {
        groupId: lastPoll.groupId,
        status: 'ACTIVE',
        duration: lastPoll.duration,
        createdBy: lastPoll.createdBy,
        selectedMenuItemIds: lastPoll.selectedMenuItemIds,
      }
    });

    console.log(`✅ Новое голосование создано: Poll #${newPoll.id}`);
    console.log(`   Group ID: ${newPoll.groupId}`);
    console.log(`   Status: ${newPoll.status}`);
    console.log(`   Duration: ${newPoll.duration} min`);
    console.log(`   Selected items: ${newPoll.selectedMenuItemIds}`);
    console.log(`   Created by: ${newPoll.createdBy}`);

    console.log('\n⚠️ ВНИМАНИЕ: Это тестовое голосование!');
    console.log('   Оно создано в БД, но НЕ отправлено в Telegram группу.');
    console.log(`   Для удаления: UPDATE Poll SET status='CANCELLED' WHERE id=${newPoll.id};`);

  } catch (error) {
    console.error('❌ Ошибка создания:', error.message);
  }

  await prisma.$disconnect();
}

testRepeatLogic().catch(console.error);
