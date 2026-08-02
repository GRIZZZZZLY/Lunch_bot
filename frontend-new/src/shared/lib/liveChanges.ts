/* Что изменилось не по вашей воле.
 *
 * У экранов денег и закупки теперь живые каналы: коллега отмечает оплату,
 * подтверждает её или проставляет цену — и строка меняется у вас под глазами,
 * пока вы ничего не трогали. Поток делает invalidateQueries, строка молча
 * перерисовывается, и отличить «пришло обновление» от «так и было» нельзя.
 *
 * Здесь хранится, что именно недавно приехало по потоку. Собственные действия
 * сюда не попадают: у них есть свой отклик — нажатие, спиннер, оптимистичное
 * обновление, — и подсвечивать их значило бы повторяться.
 */
import { useSyncExternalStore } from 'react';

/** Сколько строка считается «только что изменившейся». */
export const LIVE_FLASH_MS = 1600;

const fresh = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
/* Меняем ссылку на снимок только когда состав действительно поменялся:
   useSyncExternalStore сравнивает по Object.is и иначе зациклится. */
let snapshot: ReadonlySet<string> = new Set();

function publish(): void {
  snapshot = new Set(fresh.keys());
  for (const listener of listeners) listener();
}

/** Пометить, что запись приехала по потоку. Повторный сигнал продлевает метку. */
export function markLiveChange(key: string): void {
  const existing = fresh.get(key);
  if (existing) clearTimeout(existing);
  fresh.set(
    key,
    setTimeout(() => {
      fresh.delete(key);
      publish();
    }, LIVE_FLASH_MS),
  );
  publish();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ReadonlySet<string> {
  return snapshot;
}

/**
 * Весь набор свежих меток. Для списков: хук нельзя звать внутри .map, поэтому
 * строки проверяют членство сами.
 */
export function useLiveChanges(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Приехало ли это по потоку прямо сейчас. */
export function useLiveChange(key: string | null | undefined): boolean {
  const set = useLiveChanges();
  return !!key && set.has(key);
}

/** Ключи. Строкой, чтобы деньги и закупка не пересеклись по числовому id. */
export const liveKey = {
  debt: (transactionId: number) => `debt:${transactionId}`,
  storeRun: (storeRunId: number) => `run:${storeRunId}`,
};

/** Только для тестов: сбросить метки между случаями. */
export function _resetLiveChanges(): void {
  for (const timer of fresh.values()) clearTimeout(timer);
  fresh.clear();
  publish();
}
