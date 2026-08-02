/* Store Run — чистая доменная логика (Phase 3B). Без React и side-effects.
   Семантика зафиксирована в docs/frontend-redesign/store-run/ и
   store-run-state-machine.md. Ключевое: price — цена за всю строку, quantity
   информационное (в деньги не умножается); в деньги идут только BOUGHT с price!=null. */
import type {
  StoreItem,
  StoreItemStatus,
  StoreRun,
  StoreRunUser,
} from '@/services/store-run.service';

/** Пресеты минут сбора. Backend принимает 3..30 (controller.ts:12) — 60 убран (B1). */
export const COLLECT_PRESETS = [5, 15, 30] as const;

/* ------------------------------------------------------------------ price */

/** Цена из API (Prisma Decimal сериализуется строкой). `0` НЕ превращается в null. */
export function priceNum(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Верхняя граница цены позиции — та же, что у API (SetPriceSchema). */
export const PRICE_MAX = 100_000;

/**
 * Значение из поля ввода цены. null = «нет пригодной цены» (пусто, невалидно
 * ИЛИ вне диапазона — все три блокируют сабмит). Поддержаны десятичная запятая,
 * пробелы-разделители разрядов и `0`; отрицательные, NaN, Infinity и суммы
 * больше PRICE_MAX отклоняются. Результат округляется до копеек: без этого
 * двоичная дробь протаскивала в деньги значения вида 249.99899999999997.
 */
export function parsePriceInput(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else {
    // \s покрывает и обычный пробел, и NBSP из копипаста разрядов.
    const cleaned = value.replace(/\s/g, '').replace(',', '.');
    if (cleaned === '') return null;
    n = Number(cleaned);
  }
  if (!Number.isFinite(n) || n < 0 || n > PRICE_MAX) return null;
  return Math.round(n * 100) / 100;
}

/* Форматирование суммы переехало в shared: цену показывает не только закупка. */
export { formatPrice } from '@/shared/lib/money';

/* ------------------------------------------------------------------ roles */

export function isInitiator(
  run: Pick<StoreRun, 'initiatorId'> | null | undefined,
  userId: number | null | undefined,
): boolean {
  return !!run && userId != null && run.initiatorId === userId;
}

export function isOwner(
  item: Pick<StoreItem, 'userId'>,
  userId: number | null | undefined,
): boolean {
  return userId != null && item.userId === userId;
}

/**
 * Причина отмены по `shoppingAt`. Ручной cancel API разрешает только из
 * COLLECTING (service.ts:398) → наличие shoppingAt = автоотмена по таймауту.
 */
export function cancellationKind(run: Pick<StoreRun, 'shoppingAt'>): 'manual' | 'auto' {
  return run.shoppingAt ? 'auto' : 'manual';
}

/* ----------------------------------------------------------- items / money */

const isBillable = (item: Pick<StoreItem, 'status' | 'price'>): boolean =>
  item.status === 'BOUGHT' && priceNum(item.price) != null;

function sumBought(items: StoreItem[], predicate: (item: StoreItem) => boolean): number {
  return items.reduce((sum, item) => {
    if (!isBillable(item) || !predicate(item)) return sum;
    return sum + (priceNum(item.price) ?? 0);
  }, 0);
}

/** Итого закупки: Σ BOUGHT с price!=null (quantity не участвует). */
export function purchasedTotal(items: StoreItem[]): number {
  return sumBought(items, () => true);
}

/** Долг участника инициатору. Для самого инициатора всегда 0 (свои позиции не долг). */
export function personalDebtTotal(
  items: StoreItem[],
  userId: number,
  initiatorId: number,
): number {
  if (userId === initiatorId) return 0;
  return sumBought(items, (item) => item.userId === userId);
}

/** Собственные покупки инициатора (не долг). */
export function initiatorOwnTotal(items: StoreItem[], initiatorId: number): number {
  return sumBought(items, (item) => item.userId === initiatorId);
}

/** «Вам должны»: Σ BOUGHT не-инициаторских позиций. purchasedTotal = receivable + own. */
export function receivableTotal(items: StoreItem[], initiatorId: number): number {
  return sumBought(items, (item) => item.userId !== initiatorId);
}

export function hasRequested(items: StoreItem[]): boolean {
  return items.some((item) => item.status === 'REQUESTED');
}

/**
 * BOUGHT без цены — штатное промежуточное состояние: покупку отмечают одним
 * касанием, цену вносят позже. Такие позиции не попадают в деньги, поэтому
 * settle с ними запрещён и здесь, и в сервисе.
 */
export function boughtWithoutPrice(items: StoreItem[]): StoreItem[] {
  return items.filter((item) => item.status === 'BOUGHT' && priceNum(item.price) == null);
}

export interface Progress {
  total: number;
  processed: number;
  requested: number;
  bought: number;
  notFound: number;
}

export function computeProgress(items: StoreItem[]): Progress {
  const count = (status: StoreItemStatus) => items.filter((i) => i.status === status).length;
  const bought = count('BOUGHT');
  const notFound = count('NOT_FOUND');
  const requested = count('REQUESTED');
  return { total: items.length, processed: bought + notFound, requested, bought, notFound };
}

/* ----------------------------------------------------------- grouping */

export interface ParticipantGroup {
  userId: number;
  user?: StoreRunUser;
  isMine: boolean;
  items: StoreItem[];
}

/**
 * Группировка позиций по владельцу для COLLECTING; секция текущего пользователя
 * («Мои позиции») первой, остальные — в порядке первого появления.
 */
export function groupItemsByParticipant(
  items: StoreItem[],
  currentUserId: number | null | undefined,
): ParticipantGroup[] {
  const order: number[] = [];
  const byUser = new Map<number, ParticipantGroup>();
  for (const item of items) {
    let group = byUser.get(item.userId);
    if (!group) {
      group = {
        userId: item.userId,
        user: item.user,
        isMine: currentUserId != null && item.userId === currentUserId,
        items: [],
      };
      byUser.set(item.userId, group);
      order.push(item.userId);
    }
    group.items.push(item);
  }
  const groups = order.map((id) => byUser.get(id)!);
  return groups.sort((a, b) => Number(b.isMine) - Number(a.isMine));
}

export interface BreakdownEntry {
  userId: number;
  user?: StoreRunUser;
  isInitiator: boolean;
  /** Денежный итог группы: только BOUGHT с price!=null. */
  total: number;
  /** ВСЕ позиции участника (REQUESTED/BOUGHT/NOT_FOUND) — для показа ненайденных. */
  items: StoreItem[];
}

/**
 * Разбивка по участникам для SETTLED. В группу входят позиции всех статусов;
 * денежный total — только BOUGHT с price!=null. Порядок — первое появление.
 */
export function computeBreakdown(items: StoreItem[], initiatorId: number): BreakdownEntry[] {
  const order: number[] = [];
  const byUser = new Map<number, BreakdownEntry>();
  for (const item of items) {
    let entry = byUser.get(item.userId);
    if (!entry) {
      entry = {
        userId: item.userId,
        user: item.user,
        isInitiator: item.userId === initiatorId,
        total: 0,
        items: [],
      };
      byUser.set(item.userId, entry);
      order.push(item.userId);
    }
    entry.items.push(item);
    if (isBillable(item)) entry.total += priceNum(item.price) ?? 0;
  }
  return order.map((id) => byUser.get(id)!);
}
