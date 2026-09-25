/* Штамп — авторский жест продукта: принятое печатается. Элемент приходит
   крупнее и бледнее (scale 1.35, opacity 0.55) и оседает в единицу за 300 мс
   на --ease-out, без отскока: отскок читался бы как «отпечаток отпружинил».

   Один жест на два события одного смысла: принятый голос на Главной и
   закрытый долг в «Расчётах». Играет только на событие, не на монтирование —
   это решает вызывающий.

   WAAPI, а не CSS-класс: повторное событие должно переигрывать анимацию, а в
   CSS это значит снять класс и дёрнуть reflow. Media query WAAPI не читает,
   поэтому reduced-motion проверяется здесь. Без Element.animate (jsdom,
   старый WebView) штампа просто нет. */
export function stamp(el: Element | null | undefined): void {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  (el as HTMLElement).animate(
    [
      { transform: 'scale(1.35)', opacity: 0.55 },
      { transform: 'scale(1)', opacity: 1 },
    ],
    { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  );
}
