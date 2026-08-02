/* Переходы между страницами: направление входа новой страницы + возврат
   фокуса. Сами анимации — в styles/motion.css.

   Направление выводится из смены пути, а не передаётся из места навигации:
   так его получают все переходы сразу, включая Telegram BackButton и жест
   «назад» браузера, где никакого нашего кода в цепочке нет. */
import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { ROOT_TABS } from '@/app/navigation';

export type TransitionDirection = 'forward' | 'back' | 'fade';

/** Порядок root-табов задаёт, в какую сторону едет контент между вкладками. */
const TAB_ORDER = ROOT_TABS.map((t) => t.to);

function tabIndex(pathname: string): number {
  return TAB_ORDER.indexOf(pathname);
}

/**
 * Направление перехода из `from` в `to`.
 *
 * Между табами — по их порядку в навигации, чтобы движение совпадало с
 * положением нажатой кнопки. Таб → detail считается шагом вперёд, detail → таб
 * — назад: detail-экраны здесь всегда вложены в таб, отдельного входа в них
 * нет.
 */
export function resolveDirection(from: string, to: string): TransitionDirection {
  if (!to || from === to) return 'fade';

  const a = tabIndex(from);
  const b = tabIndex(to);

  if (a >= 0 && b >= 0) return b > a ? 'forward' : 'back';
  if (a >= 0) return 'forward';
  if (b >= 0) return 'back';
  // detail → detail: истории «вбок» тут нет, всегда шаг вглубь.
  return 'forward';
}

/* Последний ЗАКОММИЧЕННЫЙ путь. Модульный, а не в состоянии компонента:
   при переходе таб → detail один layout размонтируется, другой монтируется,
   и локальная память о предыдущем пути ушла бы вместе с первым — ровно там,
   где направление нужнее всего. */
let committedPath: string | null = null;

const DIRECTION_MARKERS = ['is-forward', 'is-back'] as const;

/**
 * Вешает класс направления на контейнер страницы.
 *
 * Класс ставится из эффекта, а не приходит пропсом из рендера, и причин две.
 *
 * Первая — чистота рендера: направление зависит от предыдущего пути, то есть
 * от внешней изменяемой памяти, а ленивые страницы приостанавливаются на
 * Suspense, и такой рендер может быть выброшен. Запись из него отравила бы
 * память, и повторный рендер получил бы `fade` вместо направления.
 *
 * Вторая — стабильность: смена animation-name перезапускает анимацию. Если бы
 * класс жил в разметке, любой следующий рендер (пришли данные, обновился SSE)
 * запускал бы вход страницы заново. Эффект же срабатывает один раз на путь.
 *
 * useLayoutEffect, не useEffect: он выполняется до отрисовки кадра, поэтому
 * анимация начинается сразу с нужным направлением, без промежуточного кадра
 * базового кроссфейда.
 */
export function usePageTransition(ref: RefObject<HTMLElement>, pathname: string): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    /* Тот же путь второй раз — это StrictMode, переигравший эффект: класс уже
       на узле, а память о предыдущем пути потеряна не была. Ставим только
       новый переход, но снимать класс идём ниже в любом случае, иначе в dev
       он остался бы висеть навсегда. */
    if (committedPath !== pathname) {
      const dir = committedPath === null ? 'fade' : resolveDirection(committedPath, pathname);
      committedPath = pathname;
      // Узел живёт под key={pathname}, то есть создаётся заново на каждый
      // переход: снимать прошлый класс не с чего.
      if (dir !== 'fade') el.classList.add(`is-${dir}`);
    }

    const marker = DIRECTION_MARKERS.find((m) => el.classList.contains(m));
    if (!marker) return;

    /* Класс снимаем, как только вход доигран: пока он висит, CSS глушит каскад
       внутри страницы (styles/motion.css), а он ещё нужен — данным, которые
       придут на место скелета. Слушаем только собственную анимацию узла:
       animationend всплывает и от детей. Таймер — страховка на случай, когда
       события не будет вовсе (анимация отменена, вкладка была скрыта). */
    const clear = () => el.classList.remove(marker);
    const onEnd = (e: AnimationEvent) => {
      if (e.target === el) clear();
    };
    el.addEventListener('animationend', onEnd);
    const timer = window.setTimeout(clear, 600);

    return () => {
      el.removeEventListener('animationend', onEnd);
      window.clearTimeout(timer);
    };
  }, [ref, pathname]);
}

/**
 * Возврат фокуса после смены маршрута.
 *
 * Кнопка, с которой ушли, исчезает вместе со старой страницей, и фокус
 * достаётся body: клавиатура и скринридер теряют место в документе. Поэтому
 * после каждой навигации отдаём фокус контейнеру страницы (нужен
 * tabIndex={-1}).
 *
 * `preventScroll` обязателен: без него браузер догоняет фокус скроллом и
 * гасит только что начатую анимацию входа.
 */
export function useRouteFocus(ref: RefObject<HTMLElement>, key: string): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const active = document.activeElement;
    // Фокус внутри страницы (открытая форма, шит) не отбираем.
    if (active && active !== document.body && el.contains(active)) return;
    el.focus({ preventScroll: true });
  }, [ref, key]);
}

/* Только для тестов: модульная память о пути живёт дольше рендера. */
export function __resetTransitionMemory(): void {
  committedPath = null;
}
