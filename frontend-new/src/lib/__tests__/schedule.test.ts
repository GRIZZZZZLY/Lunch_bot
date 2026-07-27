import { describe, expect, it } from 'vitest';
import { formatScheduleHint, parseDaysOfWeek } from '../schedule';

describe('parseDaysOfWeek', () => {
  it('принимает массив и JSON-строку', () => {
    expect(parseDaysOfWeek([1, 2, 3])).toEqual([1, 2, 3]);
    expect(parseDaysOfWeek('[5,1,1]')).toEqual([1, 5]);
  });

  it('отбрасывает мусор', () => {
    expect(parseDaysOfWeek('не json')).toEqual([]);
    expect(parseDaysOfWeek(null)).toEqual([]);
    expect(parseDaysOfWeek([7, -1, 2.5, 3])).toEqual([3]);
  });
});

describe('formatScheduleHint', () => {
  it('называет будни, выходные и «каждый день» словами', () => {
    expect(formatScheduleHint({ isEnabled: true, daysOfWeek: [1, 2, 3, 4, 5], timeOfDay: '11:30' })).toBe(
      'Автозапуск в 11:30, по будням',
    );
    expect(formatScheduleHint({ isEnabled: true, daysOfWeek: [0, 6], timeOfDay: '12:00' })).toBe(
      'Автозапуск в 12:00, по выходным',
    );
    expect(
      formatScheduleHint({ isEnabled: true, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], timeOfDay: '09:05' }),
    ).toBe('Автозапуск в 09:05, каждый день');
  });

  it('произвольный набор дней перечисляет сокращениями', () => {
    expect(formatScheduleHint({ isEnabled: true, daysOfWeek: '[1,3,5]', timeOfDay: '11:30' })).toBe(
      'Автозапуск в 11:30, пн, ср, пт',
    );
  });

  it('молчит, если расписания нет, оно выключено или данные битые', () => {
    expect(formatScheduleHint(null)).toBeNull();
    expect(formatScheduleHint({ isEnabled: false, daysOfWeek: [1], timeOfDay: '11:30' })).toBeNull();
    expect(formatScheduleHint({ isEnabled: true, daysOfWeek: [], timeOfDay: '11:30' })).toBeNull();
    expect(formatScheduleHint({ isEnabled: true, daysOfWeek: [1], timeOfDay: 'позже' })).toBeNull();
  });

  it('расписание без поля isEnabled считаем включённым', () => {
    expect(formatScheduleHint({ daysOfWeek: [1], timeOfDay: '11:30' })).toBe('Автозапуск в 11:30, пн');
  });
});
