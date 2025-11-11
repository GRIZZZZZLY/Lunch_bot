// Исправление неправильно сохранённого расписания
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSchedule() {
  try {
    console.log('🔧 Fixing schedule with broken JSON...\n');

    const schedules = await prisma.recurringPoll.findMany();

    for (const schedule of schedules) {
      console.log(`Checking schedule #${schedule.id}...`);
      console.log(`  Current daysOfWeek: ${schedule.daysOfWeek}`);
      
      // Проверяем нужно ли исправить
      let daysOfWeek = schedule.daysOfWeek;
      
      // Если это строка типа '["[","6","]"]' - исправляем
      if (daysOfWeek.includes('"["')) {
        console.log('  ❌ Broken JSON detected!');
        
        // Извлекаем число из строки
        const match = daysOfWeek.match(/\d+/);
        if (match) {
          const dayNumber = parseInt(match[0]);
          const fixed = JSON.stringify([dayNumber]);
          
          console.log(`  ✅ Fixing: ${daysOfWeek} → ${fixed}`);
          
          await prisma.recurringPoll.update({
            where: { id: schedule.id },
            data: { daysOfWeek: fixed },
          });
          
          console.log('  ✅ Fixed!');
        }
      } else {
        console.log('  ✅ Already correct');
      }
      
      // Также исправим selectedMenuItemIds если нужно
      if (schedule.selectedMenuItemIds && schedule.selectedMenuItemIds.includes('"["')) {
        console.log('  ⚠️  selectedMenuItemIds also broken, fixing...');
        await prisma.recurringPoll.update({
          where: { id: schedule.id },
          data: { selectedMenuItemIds: null }, // Сбросим на "все блюда"
        });
        console.log('  ✅ Reset to "all items"');
      }
      
      console.log('');
    }

    console.log('✅ All done!\n');
    
    // Проверяем результат
    const updated = await prisma.recurringPoll.findMany();
    for (const s of updated) {
      console.log(`Schedule #${s.id}: daysOfWeek = ${s.daysOfWeek}`);
      const parsed = JSON.parse(s.daysOfWeek);
      console.log(`  Parsed: ${JSON.stringify(parsed)} (type: ${typeof parsed[0]})`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSchedule();
