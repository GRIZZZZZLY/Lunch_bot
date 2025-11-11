// Проверка расписаний в БД
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchedules() {
  try {
    console.log('🔍 Checking recurring poll schedules...\n');

    const schedules = await prisma.recurringPoll.findMany({
      include: {
        group: true,
        creator: true,
      },
    });

    console.log(`Found ${schedules.length} schedule(s)\n`);

    for (const schedule of schedules) {
      console.log('─'.repeat(60));
      console.log(`Schedule ID: ${schedule.id}`);
      console.log(`Group: ${schedule.group.title} (ID: ${schedule.groupId})`);
      console.log(`Created by: ${schedule.creator.firstName}`);
      console.log(`Enabled: ${schedule.isEnabled ? '✅ Yes' : '❌ No'}`);
      console.log(`Days: ${schedule.daysOfWeek}`);
      console.log(`Time: ${schedule.timeOfDay}`);
      console.log(`Duration: ${schedule.duration} min`);
      console.log(`Last run: ${schedule.lastRunAt || 'Never'}`);
      console.log(`Next run: ${schedule.nextRunAt || 'Not calculated'}`);
      console.log(`Last status: ${schedule.lastRunStatus || 'N/A'}`);
      console.log('');
    }

    // Проверка текущего времени
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const currentDay = now.getDay();
    
    console.log('─'.repeat(60));
    console.log('⏰ Current server time:');
    console.log(`Moscow time: ${now.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`);
    console.log(`Current HH:MM: ${currentTime}`);
    console.log(`Current day: ${currentDay} (0=Sun, 1=Mon, ..., 6=Sat)`);
    console.log('');

    // Проверка какие расписания должны запуститься
    for (const schedule of schedules) {
      if (!schedule.isEnabled) continue;
      
      const daysOfWeek = JSON.parse(schedule.daysOfWeek);
      const matchesDay = daysOfWeek.includes(currentDay);
      const matchesTime = schedule.timeOfDay === currentTime;

      if (matchesDay && matchesTime) {
        console.log(`🔥 THIS SCHEDULE SHOULD RUN NOW: #${schedule.id}`);
      } else if (matchesDay) {
        console.log(`📅 Schedule #${schedule.id} matches day, but time is ${schedule.timeOfDay} (current: ${currentTime})`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchedules();
