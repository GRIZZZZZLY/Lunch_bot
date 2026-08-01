/**
 * Остаток словами для screen reader: «12:07» синтезатор читает как время суток,
 * а не как оставшиеся двенадцать минут. Подпись вокруг длительности каждый
 * таймер даёт свою — общее здесь только само проговаривание.
 */
export function spokenDuration(hours: number, minutes: number, seconds: number): string {
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ч`);
  if (minutes > 0) parts.push(`${minutes} мин`);
  parts.push(`${seconds} с`);
  return parts.join(' ');
}
