/* Единый контроллер «назад»: Telegram BackButton + стек открытых оверлеев.
   Правила:
   - открытый оверлей (BottomSheet/Dialog) закрывается раньше навигации;
   - base-обработчик (навигация detail-экрана) ставит DetailLayout;
   - кнопка видима, когда есть оверлей или base-обработчик; иначе скрыта.
   Вне Telegram модуль работает как чистый стек (кнопкой управлять нечем). */
import { getWebApp } from './telegram';

type Handler = () => void;

export interface OverlayRegistration {
  /** Снять слой со стека (вызывать в cleanup компонента). */
  release: () => void;
  /** Верхний ли это слой (для Escape: реагирует только верхний). */
  isTop: () => boolean;
}

let overlays: Handler[] = [];
let baseHandler: Handler | null = null;
let clickBound = false;

function handleBack() {
  if (closeTopOverlay()) return;
  baseHandler?.();
}

function sync() {
  const wa = getWebApp();
  if (!wa) return;
  if (!clickBound) {
    wa.BackButton.onClick(handleBack);
    clickBound = true;
  }
  if (overlays.length > 0 || baseHandler !== null) wa.BackButton.show();
  else wa.BackButton.hide();
}

/** Регистрирует навигацию «назад» detail-экрана. Возвращает cleanup. */
export function setBaseBackHandler(fn: Handler): () => void {
  baseHandler = fn;
  sync();
  return () => {
    if (baseHandler === fn) {
      baseHandler = null;
      sync();
    }
  };
}

/** Регистрирует открытый оверлей; close должен закрыть его (unmount снимет слой). */
export function pushOverlay(close: Handler): OverlayRegistration {
  overlays.push(close);
  sync();
  return {
    release: () => {
      overlays = overlays.filter((c) => c !== close);
      sync();
    },
    isTop: () => overlays[overlays.length - 1] === close,
  };
}

/** Закрывает верхний оверлей. true — слой был и закрыт. */
export function closeTopOverlay(): boolean {
  const top = overlays[overlays.length - 1];
  if (!top) return false;
  top();
  return true;
}

/** Только для тестов. */
export function _resetBackButtonForTests() {
  overlays = [];
  baseHandler = null;
  clickBound = false;
}
