/* Единый механизм safe-area и стабильной высоты viewport.
   CSS-переменные --safe-area-* и --viewport-stable-height объявлены в
   tokens.css с fallback на env(); здесь они переопределяются значениями
   Telegram (safeAreaInset устройства + contentSafeAreaInset шапки Mini App).
   Страницы НЕ считают safe-area сами — только var(--safe-area-*). */
import { getWebApp, type TelegramWebApp } from './telegram';

export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Суммарный отступ контента: инсеты устройства + инсеты интерфейса Telegram. */
export function computeSafeArea(wa: TelegramWebApp | null): SafeArea | null {
  if (!wa) return null;
  const device = wa.safeAreaInset;
  const content = wa.contentSafeAreaInset;
  if (!device && !content) return null;
  return {
    top: (device?.top ?? 0) + (content?.top ?? 0),
    bottom: (device?.bottom ?? 0) + (content?.bottom ?? 0),
    left: (device?.left ?? 0) + (content?.left ?? 0),
    right: (device?.right ?? 0) + (content?.right ?? 0),
  };
}

/** Подписывается на изменения viewport/safe-area. Возвращает cleanup. */
export function initViewportSync(wa: TelegramWebApp | null = getWebApp()): () => void {
  if (!wa) return () => undefined;

  const root = document.documentElement.style;
  const apply = () => {
    const safe = computeSafeArea(wa);
    if (safe) {
      root.setProperty('--safe-area-top', `${safe.top}px`);
      root.setProperty('--safe-area-bottom', `${safe.bottom}px`);
      root.setProperty('--safe-area-left', `${safe.left}px`);
      root.setProperty('--safe-area-right', `${safe.right}px`);
    }
    if (wa.viewportStableHeight) {
      root.setProperty('--viewport-stable-height', `${wa.viewportStableHeight}px`);
    }
  };

  apply();
  wa.onEvent('viewportChanged', apply);
  wa.onEvent('safeAreaChanged', apply);
  wa.onEvent('contentSafeAreaChanged', apply);
  return () => {
    wa.offEvent('viewportChanged', apply);
    wa.offEvent('safeAreaChanged', apply);
    wa.offEvent('contentSafeAreaChanged', apply);
  };
}
