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

/** Массив чисел из значения, которое могло прийти строкой JSON. */
export function parseNumberArray(value: number[] | string | null | undefined): number[] {
  const raw: unknown = typeof value === 'string' ? safeParse(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is number => Number.isInteger(n));
}

export function parseDaysOfWeek(days: number[] | string | null | undefined): number[] {
  const valid = parseNumberArray(days).filter((d) => d >= 0 && d <= 6);
  return [...new Set(valid)].sort((a, b) => a - b);
}

/** Порядок подписей в форме создания опроса: рабочая неделя, затем выходные. */
export const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
const LABEL_TO_NUM: Record<string, number> = { Пн: 1, Вт: 2, Ср: 3, Чт: 4, Пт: 5, Сб: 6, Вс: 0 };

/** Номера дней (0 — воскресенье) → подписи чипов формы. */
export function daysToLabels(days: number[]): string[] {
  return DAY_LABELS.filter((label) => days.includes(LABEL_TO_NUM[label]));
}

/** Подписи чипов формы → номера дней для бэкенда. */
export function labelsToDays(labels: string[]): number[] {
  const days = labels
    .map((label) => LABEL_TO_NUM[label])
    .filter((n): n is number => typeof n === 'number');
  return [...new Set(days)].sort((a, b) => a - b);
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
