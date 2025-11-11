const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'services', 'recurring-poll.service.ts');

console.log('📝 Reading file...');
let content = fs.readFileSync(filePath, 'utf8');

// Находим функцию и заменяем её полностью
const functionStart = 'static calculateNextRun(daysOfWeek: number[], timeOfDay: string): Date {';
const functionEnd = '  }\n\n  /**\n   * Получение истории запусков';

const startIndex = content.indexOf(functionStart);
if (startIndex === -1) {
  console.log('❌ Function not found!');
  process.exit(1);
}

const endIndex = content.indexOf(functionEnd, startIndex);
if (endIndex === -1) {
  console.log('❌ Function end not found!');
  process.exit(1);
}

console.log(`✅ Found function at position ${startIndex}-${endIndex}`);

// Новая реализация функции
const newFunction = `static calculateNextRun(daysOfWeek: number[], timeOfDay: string): Date {
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
      const dayOfWeek = nextDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      
      if (daysOfWeek.includes(dayOfWeek)) {
        return nextDate;
      }
      
      nextDate = addDays(nextDate, 1);
    }

    // Fallback: если не нашли (не должно случиться)
    return addDays(now, 1);
  }

  /**
   * Получение истории запусков`;

// Заменяем
const before = content.substring(0, startIndex);
const after = content.substring(endIndex);
const newContent = before + newFunction + after;

console.log('💾 Writing patched file...');
fs.writeFileSync(filePath, newContent, 'utf8');

console.log('✅ Successfully patched calculateNextRun!');
console.log('\n📋 Changes:');
console.log('  + Added check if today matches scheduled day');
console.log('  + Added check if scheduled time has not passed yet');
console.log('  + Returns today if conditions are met');
console.log('  + Otherwise starts from tomorrow as before');
