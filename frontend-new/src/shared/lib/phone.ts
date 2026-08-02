/* Реквизиты для переводов: показ, ввод и проверка.

   Раньше собственный номер в профиле выводился замаскированным («+7 *** 33»).
   Строка существует ровно для того, чтобы человек убедился, что деньги придут
   куда надо, — маска это и делала невозможным. Номер свой и экран свой, так
   что показываем целиком и разбиваем на группы, чтобы ошибку было видно
   глазом. Номер карты маской остаётся: он на этом экране и не показывается. */

export const PHONE_PREFIX = '+7 ';

export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Значащие цифры номера — без кода страны.
 *
 * Восьмёрку отбрасываем ТОЛЬКО когда из-за неё цифр становится больше десяти:
 * привычное «8 926…» так и остаётся «+7 926…», а петербургское «812» не
 * превращается в «12» — код города тоже начинается с восьмёрки, и слепое
 * отбрасывание ломало бы реальные номера.
 */
function localDigits(raw: string): string {
  let d = phoneDigits(raw);
  if (d[0] === '7' || d[0] === '8') d = d.slice(1);
  if (d.length > 10 && d[0] === '8') d = d.slice(1);
  return d.slice(0, 10);
}

/**
 * «+7 900 123-45-67». Российский формат разбирается по группам; всё
 * остальное возвращаем как ввели — коверкать чужой формат хуже, чем оставить.
 */
export function formatPhone(raw: string): string {
  const d = phoneDigits(raw);
  if (d.length === 11 && (d[0] === '7' || d[0] === '8')) {
    return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
  }
  if (d.length === 10) {
    return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
  }
  return raw.trim();
}

/**
 * Форматирование по мере набора. «+7 » подставляется само и держится:
 * человеку остаётся набрать десять цифр, а не вспоминать код страны.
 * Набранная первой восьмёрка поглощается префиксом — так номер и диктуют.
 * Очистить поле можно, выделив его целиком и стерев: тогда реквизит
 * считается незаполненным.
 */
export function formatPhoneInput(raw: string): string {
  if (!raw.trim()) return '';
  const d = localDigits(raw);
  if (!d) return PHONE_PREFIX;
  let out = `${PHONE_PREFIX}${d.slice(0, 3)}`;
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}

/** Остался один префикс — значит номер не задан, а не задан неверно. */
export function isPhoneEmpty(raw: string): boolean {
  return localDigits(raw).length === 0;
}

/** Что уходит на сервер: пустое поле — это отсутствие реквизита, а не «+7». */
export function normalizePhone(raw: string): string | undefined {
  return isPhoneEmpty(raw) ? undefined : formatPhone(raw);
}

/** Сообщение об ошибке или null. Пустое поле допустимо — реквизит необязателен. */
export function validatePhone(raw: string): string | null {
  if (isPhoneEmpty(raw)) return null;
  if (localDigits(raw).length < 10) return 'Похоже, в номере не хватает цифр';
  return null;
}

/** Сообщение об ошибке или null. Пустая строка допустима — карта необязательна. */
export function validateCard(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const d = phoneDigits(v);
  if (d.length !== v.replace(/[\s-]/g, '').length) return 'В номере карты только цифры';
  if (d.length < 16 || d.length > 19) return 'В номере карты 16–19 цифр';
  return null;
}
