/* Ленивый экран, который после предзагрузки рисуется сразу.

   React.lazy приостанавливается на первом рендере всегда, даже если import()
   уже выполнен на простое: его ленивая обёртка узнаёт о модуле только из
   собственного вызова. React 19 вдобавок держит заглушку не меньше 300 мс.
   Замер (Playwright, 2026-11-13): переход на заранее загруженную вкладку
   «Меню» проигрывал вход страницы 0–280 мс над пустым контейнером, а меню
   вставало на ~320-й мс без движения.

   Здесь модуль, однажды загруженный, запоминается, и следующий монтаж рисует
   компонент напрямую — без Suspense и без паузы.

   Тип элемента на открытой странице не меняется: lazy получает тот же промис,
   что и preload, уже после записи ready, поэтому готовым он становится не
   раньше ready. Через Lazy экран никогда не рисуется — Lazy только ждёт. */
import { createElement, lazy, type ComponentType } from 'react';

/* never, а не any: компонент с любыми пропсами приводится к нему, а тип
   пропсов снаружи остаётся типом самого экрана (возвращаем T). */
type Screen = ComponentType<never>;

export type Preloadable<T extends Screen> = T & {
  /** Загрузить модуль заранее. Отказ не кэшируется: следующий вызов попробует снова. */
  preload: () => Promise<unknown>;
};

export function preloadable<T extends Screen>(load: () => Promise<{ default: T }>): Preloadable<T> {
  let ready: T | null = null;
  let pending: Promise<{ default: T }> | null = null;

  const preload = () =>
    (pending ??= load().then(
      (m) => {
        ready = m.default;
        return m;
      },
      (e: unknown) => {
        pending = null;
        throw e;
      },
    ));

  const Lazy = lazy(preload as unknown as () => Promise<{ default: ComponentType<object> }>);

  function PreloadedScreen(props: object) {
    return createElement((ready ?? Lazy) as unknown as ComponentType<object>, props);
  }

  return Object.assign(PreloadedScreen, { preload }) as unknown as Preloadable<T>;
}
