/**
 * Шторки главной: создание голосования и создание закупки.
 *
 * Состояние «открыта» и правило закрытия лежат вместе, потому что правило одно и
 * то же для обеих: шторка закрывается ТОЛЬКО на успехе. При отказе человек
 * должен видеть сообщение и свою форму — закрыть её значит потерять ввод и не
 * объяснить, что пошло не так.
 */
import { useCallback, useState } from 'react';

export interface HomeSheets {
  pollOpen: boolean;
  storeRunOpen: boolean;
  openPoll: () => void;
  closePoll: () => void;
  openStoreRun: () => void;
  closeStoreRun: () => void;
  /** Закрывает шторку голосования, если действие удалось. */
  afterPollAction: (action: () => Promise<boolean>) => Promise<void>;
  /** То же для закупки. */
  afterStoreRunAction: (action: () => Promise<boolean>) => Promise<void>;
}

export function useHomeSheets(): HomeSheets {
  const [pollOpen, setPollOpen] = useState(false);
  const [storeRunOpen, setStoreRunOpen] = useState(false);

  const afterPollAction = useCallback(async (action: () => Promise<boolean>) => {
    if (await action()) setPollOpen(false);
  }, []);

  const afterStoreRunAction = useCallback(async (action: () => Promise<boolean>) => {
    if (await action()) setStoreRunOpen(false);
  }, []);

  return {
    pollOpen,
    storeRunOpen,
    openPoll: useCallback(() => setPollOpen(true), []),
    closePoll: useCallback(() => setPollOpen(false), []),
    openStoreRun: useCallback(() => setStoreRunOpen(true), []),
    closeStoreRun: useCallback(() => setStoreRunOpen(false), []),
    afterPollAction,
    afterStoreRunAction,
  };
}
