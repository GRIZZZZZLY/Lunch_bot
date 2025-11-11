// Patch для исправления calculateNextRun
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'services', 'recurring-poll.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `  static calculateNextRun(daysOfWeek: number[], timeOfDay: string): Date {
    const now = new Date();
    const [hours, minutes] = timeOfDay.split(':').map(Number);
    // Начинаем с завтрашнего дня (не запускаем сегодня если уже прошло время)
    let nextDate = addDays(now, 1);
    nextDate.setHours(hours, minutes, 0, 0);`;

const newCode = `  static calculateNextRun(daysOfWeek: number[], timeOfDay: string): Date {
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
    nextDate.setHours(hours, minutes, 0, 0);`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Successfully patched calculateNextRun!');
} else {
  console.log('❌ Old code not found - maybe already patched?');
  console.log('Searching for function...');
  if (content.includes('static calculateNextRun')) {
    console.log('✅ Function exists');
    // Show current implementation
    const match = content.match(/static calculateNextRun[\s\S]{0,500}/);
    if (match) {
      console.log('\nCurrent implementation:');
      console.log(match[0]);
    }
  }
}
