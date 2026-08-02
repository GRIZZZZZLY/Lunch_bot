/* Показывать ли скелет.

   Скелет — обещание «сейчас будет, подожди». На быстром ответе он превращается
   в ложь: мелькнул и исчез, а человек успел увидеть два состояния подряд там,
   где ждать не пришлось. Поэтому у него две границы.

   DELAY — сколько ждём молча. Ответ уложился в это окно, значит паузы не было,
   и рассказывать о ней нечего.

   MIN_VISIBLE — сколько скелет живёт, если всё-таки появился. Без этого он
   гаснет через кадр после появления, и получается то самое мигание, от
   которого мы уходили: показали, тут же убрали.

   Важно: в окне молчания страница не должна показывать пустое состояние
   («блюд нет»), иначе вместо скелета мелькнёт неправда пострашнее. Условия
   пустоты на страницах остаются привязанными к настоящему isLoading. */
import { useEffect, useRef, useState } from 'react';

const DELAY_MS = 180;
const MIN_VISIBLE_MS = 260;

export function useDelayedLoading(
  loading: boolean,
  delayMs: number = DELAY_MS,
  minVisibleMs: number = MIN_VISIBLE_MS,
): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    if (loading) {
      // Уже показан — второй таймер не нужен, иначе он сбросит отсчёт минимума.
      if (visible) return undefined;
      const timer = window.setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delayMs);
      return () => window.clearTimeout(timer);
    }

    // Загрузка кончилась внутри окна молчания: скелет не появился и не появится.
    if (!visible) return undefined;

    const left = minVisibleMs - (Date.now() - (shownAt.current ?? Date.now()));
    if (left <= 0) {
      shownAt.current = null;
      setVisible(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      shownAt.current = null;
      setVisible(false);
    }, left);
    return () => window.clearTimeout(timer);
  }, [loading, visible, delayMs, minVisibleMs]);

  return visible;
}
