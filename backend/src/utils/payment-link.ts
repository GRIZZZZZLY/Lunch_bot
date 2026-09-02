import { EncryptionService } from './encryption';

/**
 * Поле `paymentCard` исторически хранило номер карты, а теперь — ссылку СБП
 * (сервер принимает только http/https, см. user.controller). Маскировать
 * ссылку нельзя: должник получает «**** **** **** 1234» и не может заплатить —
 * маска не просто бесполезна, она собрана из цифр, случайно попавших в адрес.
 * Legacy-значения из цифр по-прежнему маскируются как раньше.
 */
export function isPaymentLink(value: string): boolean {
  try {
    const { protocol } = new URL(value.trim());
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function paymentLinkButton(value: string): { text: string; url: string } {
  return { text: '💳 Перевести по ссылке', url: value.trim() };
}

/** Строка для текста сообщения (legacy-Markdown: ссылку в текст не кладём). */
export function paymentCardLine(value: string): string {
  return isPaymentLink(value)
    ? '🔗 Ссылка для перевода — кнопкой ниже'
    : `💳 Карта: ${EncryptionService.maskCardNumber(value)}`;
}
