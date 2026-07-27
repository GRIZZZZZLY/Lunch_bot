/** Работа с локальными сутками пользователя. */

/** Тот же календарный день по местному времени, что и `reference` (по умолчанию — сегодня). */
export function isSameLocalDay(value: string | number | Date | null | undefined, reference: Date = new Date()): boolean {
  if (value == null) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}
