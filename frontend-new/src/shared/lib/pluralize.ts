/** Только форма слова, без числа: под крупной цифрой число не повторяют. */
export function pluralForm(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Русская плюрализация: pluralize(3, 'блюдо', 'блюда', 'блюд') → «3 блюда». */
export function pluralize(n: number, one: string, few: string, many: string): string {
  return `${n} ${pluralForm(n, one, few, many)}`;
}
