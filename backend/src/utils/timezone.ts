/**
 * Время «как на часах группы». Группа хранит имя пояса IANA (`groups.timezone`),
 * а моменты времени в базе лежат в timestamptz, то есть в UTC.
 * Только Intl: летнее время и смещения считает сама платформа.
 */

export const DEFAULT_TIME_ZONE = 'Europe/Moscow';

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Неизвестное или пустое имя пояса заменяем на пояс по умолчанию. */
export function safeTimeZone(zone: string | null | undefined): string {
  return zone && isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
}

export interface ZonedParts {
  /** YYYY-MM-DD по часам пояса */
  date: string;
  /** HH:MM по часам пояса */
  time: string;
  /** 0 = воскресенье … 6 = суббота */
  day: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function partsMap(instant: Date, zone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}

export function zonedParts(instant: Date, zone: string): ZonedParts {
  const p = partsMap(instant, zone);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    day: WEEKDAYS.indexOf(p.weekday),
  };
}

/** Смещение пояса от UTC в миллисекундах на указанный момент. */
function offsetMs(instant: Date, zone: string): number {
  const p = partsMap(instant, zone);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Момент, когда часы пояса показывают указанные дату и время. */
export function zonedLocalToUtc(
  date: string,
  time: string,
  zone: string
): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess - offsetMs(new Date(guess), zone);
  // Второй проход нужен, когда в этот день сдвигаются часы.
  t = guess - offsetMs(new Date(t), zone);
  return new Date(t);
}

/**
 * Ближайший запуск строго после `now` в один из дней недели в `HH:MM` по часам пояса.
 * Дни недели: 0 = воскресенье … 6 = суббота. Пустой список — завтра в это время.
 */
export function nextZonedRun(
  daysOfWeek: number[],
  timeOfDay: string,
  zone: string,
  now: Date = new Date()
): Date {
  const today = zonedParts(now, zone);
  const [y, mo, d] = today.date.split('-').map(Number);

  for (let i = 0; i <= 7; i++) {
    const weekday = (today.day + i) % 7;
    if (!daysOfWeek.includes(weekday)) continue;
    const dayUtc = new Date(Date.UTC(y, mo - 1, d + i));
    const date = dayUtc.toISOString().slice(0, 10);
    const candidate = zonedLocalToUtc(date, timeOfDay, zone);
    if (candidate.getTime() > now.getTime()) return candidate;
  }

  const tomorrow = new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10);
  return zonedLocalToUtc(tomorrow, timeOfDay, zone);
}
