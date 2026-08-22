/**
 * Русская плюрализация для серверных сообщений.
 *
 * Имя и сигнатуры намеренно совпадают с frontend-new/src/shared/lib/pluralize.ts:
 * человек, читающий обе половины продукта, видит одну функцию, а не две похожие.
 *
 * До этого модуля в backend было ЧЕТЫРЕ реализации одной логики под четырьмя
 * именами: `getPluralForm` в bot/keyboards/poll.keyboard.ts, вторая копия
 * `getPluralForm` в services/notification.service.ts, `pluralize` в
 * jobs/debt-reminder.job.ts (возвращавший при этом ФОРМУ, а не «число + форма»
 * — то есть тёзка с другим смыслом) и деградировавший `getVotesWord` в
 * services/poll.service.extensions.ts, умевший только слово «голос».
 * Эквивалентность всех четырёх подтверждена таблицей в
 * __tests__/unit/utils/pluralize.test.ts.
 */

/** Только форма слова, без числа: под крупной цифрой число не повторяют. */
export function pluralForm(
  n: number,
  one: string,
  few: string,
  many: string
): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Русская плюрализация: pluralize(3, 'блюдо', 'блюда', 'блюд') → «3 блюда». */
export function pluralize(
  n: number,
  one: string,
  few: string,
  many: string
): string {
  return `${n} ${pluralForm(n, one, few, many)}`;
}
