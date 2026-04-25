import { useEffect, useMemo, useState } from 'react';
import type { PollWithDetails } from '../services/polls.service';

const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const STORAGE_KEY_PREFIX = 'completedPoll:dismissed:';

interface UseCompletedPollVisibilityResult {
  visible: boolean;
  dismiss: () => void;
}

const readDismissed = (storageKey: string | null): boolean => {
  if (!storageKey || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
};

const writeDismissed = (storageKey: string | null): void => {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, '1');
  } catch {
    // ignore
  }
};

/**
 * Управляет видимостью CompletedPollWidget в pill-режиме на Home.
 * Скрывает виджет, если:
 *  - Прошло > 15 минут с момента завершения голосования (по `endedAt`/`endTime`).
 *  - Пользователь нажал «×» (записывается в localStorage по `pollId`).
 *
 * Возвращает `{ visible, dismiss }`. Таймер пересоздаётся при mount,
 * чтобы корректно обрабатывать возврат на страницу спустя время.
 */
export function useCompletedPollVisibility(
  poll: PollWithDetails | null | undefined
): UseCompletedPollVisibilityResult {
  const pollId = poll?.id ?? null;

  const endedAtMs = useMemo(() => {
    const raw = poll?.endedAt ?? poll?.endTime ?? null;
    if (!raw) return null;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : null;
  }, [poll?.endedAt, poll?.endTime]);

  const storageKey = pollId !== null ? `${STORAGE_KEY_PREFIX}${pollId}` : null;

  const computeInitial = (): boolean => {
    if (pollId === null) return false;
    if (readDismissed(storageKey)) return false;
    if (endedAtMs !== null && Date.now() - endedAtMs > FIFTEEN_MIN_MS) return false;
    return true;
  };

  const [visible, setVisible] = useState<boolean>(computeInitial);

  // Пересчитываем при смене опроса или времени завершения
  useEffect(() => {
    setVisible(computeInitial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId, endedAtMs]);

  // Авто-скрытие через 15 минут после endedAt
  useEffect(() => {
    if (!visible || endedAtMs === null) return;
    const remain = endedAtMs + FIFTEEN_MIN_MS - Date.now();
    if (remain <= 0) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(false), remain);
    return () => window.clearTimeout(timer);
  }, [visible, endedAtMs]);

  const dismiss = () => {
    writeDismissed(storageKey);
    setVisible(false);
  };

  return { visible, dismiss };
}
