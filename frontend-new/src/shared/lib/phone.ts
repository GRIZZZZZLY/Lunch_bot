/* Реквизиты для переводов: показ и проверка.

   Раньше собственный номер в профиле выводился замаскированным («+7 *** 33»).
   Строка существует ровно для того, чтобы человек убедился, что деньги придут
   куда надо, — маска это и делала невозможным. Номер свой и экран свой, так
   что показываем целиком и разбиваем на группы, чтобы ошибку было видно
   глазом. Номер карты маской остаётся: он на этом экране и не показывается. */

export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
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

/** Сообщение об ошибке или null. Пустая строка допустима — реквизит необязателен. */
export function validatePhone(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const d = phoneDigits(v);
  if (d.length < 10) return 'Похоже, в номере не хватает цифр';
  if (d.length > 15) return 'В номере слишком много цифр';
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
