// Пересчитать nextRunAt для всех расписаний
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Копируем функцию addDays (простая версия)
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Копируем исправленную функцию calculateNextRun
function calculateNextRun(daysOfWeek, timeOfDay) {
  const now = new Date();
  const [hours, minutes] = timeOfDay.split(':').map(Number);

  // Проверяем сегодняшний день
  const todayScheduled = new Date(now);
  todayScheduled.setHours(hours, minutes, 0, 0);
  
  const currentDay = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
  
  // Если сегодня подходящий день И время ещё не прошло
  if (daysOfWeek.includes(currentDay) && timeOfDay > currentTime) {
    return todayScheduled;
  }

  // Иначе начинаем с завтрашнего дня
  let nextDate = addDays(now, 1);
  nextDate.setHours(hours, minutes, 0, 0);

  // Ищем ближайший день из daysOfWeek
  for (let i = 0; i < 7; i++) {
    const dayOfWeek = nextDate.getDay();
    
    if (daysOfWeek.includes(dayOfWeek)) {
      return nextDate;
    }
    
    nextDate = addDays(nextDate, 1);
  }

  // Fallback
  return addDays(now, 1);
}

async function recalculateAll() {
  try {
    console.log('🔄 Recalculating nextRunAt for all schedules...\n');

    const schedules = await prisma.recurringPoll.findMany();

    for (const schedule of schedules) {
      const daysOfWeek = JSON.parse(schedule.daysOfWeek);
      const nextRun = calculateNextRun(daysOfWeek, schedule.timeOfDay);

      console.log(`Schedule #${schedule.id}:`);
      console.log(`  Old nextRunAt: ${schedule.nextRunAt}`);
      console.log(`  New nextRunAt: ${nextRun.toISOString()}`);

      await prisma.recurringPoll.update({
        where: { id: schedule.id },
        data: { nextRunAt: nextRun },
      });

      console.log('  ✅ Updated\n');
    }

    console.log('✅ All schedules recalculated!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

recalculateAll();
