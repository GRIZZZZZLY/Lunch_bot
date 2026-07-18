/* Обратный отсчёт от серверного timestamp.
   Остаток каждый раз вычисляется от Date.now() (не хранится как уменьшаемый
   state) — после сна вкладки значение сразу корректное; visibilitychange
   форсирует пересчёт немедленно, не дожидаясь очередного тика.
   ВАЖНО: isExpired — только про отображение. Источник истины о статусе
   (например, COLLECTING→SHOPPING по крону) — сервер; достижение нуля здесь
   ничего не переключает. */
import { useEffect, useMemo, useState } from 'react';

export interface Countdown {
  remainingMs: number;
  totalSeconds: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

function compute(targetMs: number | null): Countdown {
  const remainingMs =
    targetMs == null || !Number.isFinite(targetMs) ? 0 : Math.max(0, targetMs - Date.now());
  const totalSeconds = Math.ceil(remainingMs / 1000);
  return {
    remainingMs,
    totalSeconds,
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isExpired: remainingMs <= 0,
  };
}

export function useCountdown(target: string | number | Date | null | undefined): Countdown {
  const targetMs = useMemo(() => {
    if (target == null) return null;
    const ms = new Date(target).getTime();
    return Number.isFinite(ms) ? ms : null;
  }, [target]);

  const [state, setState] = useState<Countdown>(() => compute(targetMs));

  useEffect(() => {
    const tick = () => setState(compute(targetMs));
    tick();
    if (targetMs == null) return;

    const id = setInterval(() => {
      tick();
      // после нуля тикать незачем — статус меняет сервер
      if (targetMs - Date.now() <= 0) clearInterval(id);
    }, 1000);
    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [targetMs]);

  return state;
}
