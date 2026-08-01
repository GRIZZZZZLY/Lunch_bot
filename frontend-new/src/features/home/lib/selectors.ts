/* Главная — чистая логика (Phase 4). Без React и side-effects. */
import type { UserGroup } from '@/services/user.service';
import type { Transaction } from '@/types/models';

/* ------------------------------------------------ склонения */

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

export const pluralVotes = (n: number) => plural(n, 'голос', 'голоса', 'голосов');
export const pluralItems = (n: number) => plural(n, 'позиция', 'позиции', 'позиций');

/* ------------------------------------------------ приветствие */

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

/** «ПЯТНИЦА, 18 ИЮЛЯ» для caption. */
export function dateCaption(date: Date): string {
  const s = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------ таймер опроса */

/** Абсолютный момент окончания голосования (сервер: createdAt + duration минут). */
export function pollEndsAt(createdAt: string, durationMinutes: number): string {
  return new Date(new Date(createdAt).getTime() + durationMinutes * 60_000).toISOString();
}

/* ------------------------------------------------ выбор группы для создания */

/**
 * Целевая группа нового голосования. Приоритет: выбранная в форме →
 * текущая активная → первая админская. Никогда не отправляем «молча
 * в первую попавшуюся», если явный выбор существует.
 */
export function resolveTargetGroup(
  formGroupId: string | null | undefined,
  currentGroupId: string | null,
  adminGroups: Pick<UserGroup, 'id'>[],
): string | null {
  const ids = adminGroups.map((g) => String(g.id));
  if (formGroupId && ids.includes(String(formGroupId))) return String(formGroupId);
  if (currentGroupId && ids.includes(String(currentGroupId))) return String(currentGroupId);
  return ids[0] ?? currentGroupId ?? null;
}

/* ------------------------------------------------ бюджет-строка */

export type BudgetRowKind = 'hidden' | 'debt' | 'awaiting' | 'collector';

export interface BudgetRowModel {
  kind: BudgetRowKind;
  /** Главная сумма строки. */
  amount: number;
  /** Транзакция для действия «Оплатил» (только kind='debt'). */
  payableTxId: number | null;
  /**
   * Сумма именно той транзакции, которую погасит «Оплатил». Отдельно от
   * `amount`: подписывать кнопку общей суммой долгов — значит обещать
   * погашение всех, а помечать одну.
   */
  payableAmount: number;
  /** Сколько активных долгов стоит за `amount` (kind='debt'). */
  payableCount: number;
  /** collector: сколько уже подтверждено. */
  confirmed: number;
}

/**
 * Свод шести legacy-сценариев бюджета в компактную строку Главной:
 * долг (есть PENDING) → ждёт подтверждения (есть PAID) → сборщик
 * (есть кредиты) → скрыто. Полный сценарный виджет — Phase 6.
 */
export function budgetRow(debts: Transaction[], credits: Transaction[]): BudgetRowModel {
  const activeDebts = debts.filter((d) => d.status !== 'CONFIRMED');
  const activeCredits = credits.filter((c) => c.status !== 'CONFIRMED');
  const pending = activeDebts
    .filter((d) => d.status === 'PENDING')
    .sort((a, b) => b.amount - a.amount)[0];
  if (pending) {
    return {
      kind: 'debt',
      amount: activeDebts.reduce((s, d) => s + d.amount, 0),
      payableTxId: pending.id,
      payableAmount: pending.amount,
      payableCount: activeDebts.length,
      confirmed: 0,
    };
  }
  const paid = activeDebts.filter((d) => d.status === 'PAID');
  if (paid.length > 0) {
    return {
      kind: 'awaiting',
      amount: paid.reduce((s, d) => s + d.amount, 0),
      payableTxId: null,
      payableAmount: 0,
      payableCount: 0,
      confirmed: 0,
    };
  }
  if (activeCredits.length > 0) {
    return {
      kind: 'collector',
      // Только активные: подтверждённые деньги уже получены и в «вам должны»
      // превращали закрытый расчёт в вечную задолженность.
      amount: activeCredits.reduce((s, c) => s + c.amount, 0),
      payableTxId: null,
      payableAmount: 0,
      payableCount: 0,
      confirmed: credits.filter((c) => c.status === 'CONFIRMED').reduce((s, c) => s + c.amount, 0),
    };
  }
  return { kind: 'hidden', amount: 0, payableTxId: null, payableAmount: 0, payableCount: 0, confirmed: 0 };
}
