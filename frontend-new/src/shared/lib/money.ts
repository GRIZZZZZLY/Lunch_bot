/**
 * Форматирование суммы: ru-RU + ₽. Копейки показываем только когда они есть —
 * «249,5 ₽» для денег выглядит обрубком, а «1 340,00 ₽» для обеда шумит.
 *
 * Живёт в shared, потому что цену показывают и закупка, и предложения блюд.
 */
export function formatPrice(n: number): string {
  const hasKopecks = Math.round(n * 100) % 100 !== 0;
  return `${n.toLocaleString('ru-RU', {
    minimumFractionDigits: hasKopecks ? 2 : 0,
    maximumFractionDigits: 2,
  })} ₽`;
}

/**
 * Цена может отсутствовать: `MenuItem.price` — `Decimal?`, блюдо создаётся и
 * без суммы. Тогда показываем прочерк, а не «0 ₽» (ноль означал бы «бесплатно»)
 * и не пустое место (выглядит как потерянная вёрстка).
 */
export const NO_PRICE = '—';

export function formatPriceOrDash(n: number | null | undefined): string {
  return n == null ? NO_PRICE : formatPrice(n);
}
