/**
 * Расписание автоголосования — разбор и человеческая подпись.
 *
 * Дни недели бэкенд хранит как JSON-массив чисел 0..6, где 0 — воскресенье
 * (как в `Date.prototype.getDay`), и может отдать их либо массивом, либо
 * строкой — зависит от того, прошла ли запись через сериализацию.
 */

const DAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

export interface ScheduleLike {
  isEnabled?: boolean;
  daysOfWeek: number[] | string | null;
  timeOfDay: string;
}

export function parseDaysOfWeek(days: number[] | string | null | undefined): number[] {
  const raw: unknown = typeof days === 'string' ? safeParse(days) : days;
  if (!Array.isArray(raw)) return [];
  const valid = raw.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6);
  return [...new Set(valid)].sort((a, b) => a - b);
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sameDays(days: number[], expected: number[]): boolean {
  return days.length === expected.length && days.every((d, i) => d === expected[i]);
}

function formatDays(days: number[]): string {
  if (days.length === 7) return 'каждый день';
  if (sameDays(days, WEEKDAYS)) return 'по будням';
  if (sameDays(days, WEEKEND)) return 'по выходным';
  return days.map((d) => DAY_SHORT[d]).join(', ');
}

/**
 * Подпись вида «Автозапуск в 11:30, по будням».
 * `null`, если расписания нет, оно выключено или дни не заданы.
 */
export function formatScheduleHint(schedule: ScheduleLike | null | undefined): string | null {
  if (!schedule || schedule.isEnabled === false) return null;
  if (!/^\d{1,2}:\d{2}$/.test(schedule.timeOfDay ?? '')) return null;

  const days = parseDaysOfWeek(schedule.daysOfWeek);
  if (days.length === 0) return null;

  return `Автозапуск в ${schedule.timeOfDay}, ${formatDays(days)}`;
}
