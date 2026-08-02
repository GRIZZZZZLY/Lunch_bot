/* Модель экрана бюджета из сырых транзакций (долги/кредиты). Жизненный цикл
   PENDING → PAID → CONFIRMED раскладывается на две роли: должник платит и
   отменяет отметку, сборщик подтверждает и напоминает. Никаких выдуманных
   данных — только то, что вернул бэкенд. */
import type { Transaction } from '@/types/models';

export interface DebtLineVM {
  id: number;
  name: string; // кому должен (toUser)
  amount: number;
  status: 'PENDING' | 'PAID';
  /** За что и когда. subject пустой, если API не дал ни блюда, ни магазина. */
  reference: BudgetReference;
  /** Куда переводить. null, если получатель реквизиты не заполнил. */
  payTo: PayTo | null;
  /** Сколько уже ждёт подтверждения. Пусто, пока не отмечено. */
  waiting: string;
}

export interface BudgetReference {
  subject: string;
  when: string;
  /** Куда ведёт ссылка «за что». null, если API не дал ни забега, ни опроса. */
  href: string | null;
}

export interface PayTo {
  /** Готовая ссылка СБП: один тап открывает банк. Главнее телефона. */
  link?: string;
  /** Телефон для СБП — способ, если ссылки нет. */
  phone?: string;
  note?: string;
}

export interface CreditLineVM {
  id: number;
  name: string; // кто должен (fromUser)
  amount: number;
  status: 'PENDING' | 'PAID';
  reference: BudgetReference;
  /** Память о напоминаниях: «напоминали 2 раза, 14 июля». Пусто, если ни разу. */
  reminded: string;
}

/** Окно отмены подтверждения. Хозяин правила — сервер; здесь только показ. */
export const UNDO_CONFIRM_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface BudgetVM {
  myDebts: DebtLineVM[];
  myDebtTotal: number;
  settledRecently: boolean; // активных долгов нет, но был закрытый — показать успех
  owed: CreditLineVM[];
  owedReceived: number; // подтверждено, ₽
  owedExpected: number; // всего к получению, ₽
  owedCount: number;
  allCollected: boolean; // мне были должны, все рассчитались
  /** Подтверждённые за последние сутки — их ещё можно отменить. */
  undoable: CreditLineVM[];
  isEmpty: boolean;
}

function personName(u?: { firstName?: string; username?: string }): string {
  return u?.firstName || u?.username || 'Участник';
}

/** Реквизиты получателя. Пустые поля не превращаем в пустой объект. */
function payToOf(t: Transaction): PayTo | null {
  const phone = t.toUser?.paymentPhone?.trim() || undefined;
  /* В колонке paymentCard теперь лежит ссылка СБП, а не номер карты: поле в
     профиле заменено на «Ссылка на СБП», а имя колонки оставлено прежним,
     чтобы не тащить миграцию ради переименования. Номер карты в проде не был
     заполнен ни у кого, так что терять было нечего. */
  const link = t.toUser?.paymentCard?.trim() || undefined;
  const note = t.toUser?.paymentDetails?.trim() || undefined;
  if (!phone && !link && !note) return null;
  return { link, phone, note };
}

/** «2 дня», «14 часов», «5 минут» — без «назад»: подпись даёт контекст. */
function humanSince(from: string, now: Date): string {
  const ms = now.getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'меньше минуты';
  if (min < 60) return pluralRu(min, 'минуту', 'минуты', 'минут');
  const hours = Math.floor(min / 60);
  if (hours < 24) return pluralRu(hours, 'час', 'часа', 'часов');
  return pluralRu(Math.floor(hours / 24), 'день', 'дня', 'дней');
}

/* Своя плюрализация, а не общий pluralize: тот склеивает число со словом, а
   здесь число иногда нужно без него («напоминали 2 раза»). */
function pluralRu(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  return `${n} ${word}`;
}

/**
 * Память о напоминаниях. Сборщик, не видя её, напоминает повторно и выглядит
 * навязчивым; должник не понимает, забыли о нём или ещё не дошли.
 */
function remindedOf(t: Transaction): string {
  const count = t.reminderCount ?? 0;
  if (count < 1) return '';
  const when = t.lastReminderAt
    ? new Date(t.lastReminderAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : '';
  /* Короткая форма: «напоминали 2 раза, 19 июля» не влезала в ширину строки и
     обрезалась ровно по дате — а дата здесь и есть полезная часть. */
  const times = pluralRu(count, 'напоминание', 'напоминания', 'напоминаний');
  return when ? `${times} · ${when}` : times;
}

/**
 * За что долг. Две строки «Игорь · 420 ₽» и «Игорь · 180 ₽» не различить: обед
 * это или магазин, за какой день — экран не говорил. Источник — блюдо
 * (обеденная транзакция) или название магазина (закупка); дату берём из самой
 * транзакции, она есть всегда. Если API не дал ни того ни другого, остаётся
 * только дата, а не выдуманный текст.
 *
 * Двумя частями, а не склеенной строкой: длинное название иначе съедает дату
 * целиком, а именно дата различает два долга одному человеку.
 */
function referenceOf(t: Transaction): BudgetReference {
  /* Ссылка на источник: прочитать «Пятёрочка у офиса» можно было и раньше, а
     открыть закупку и увидеть, из чего сложились 180 ₽, — нет. Забег важнее
     опроса: в нём видна разбивка по позициям. */
  const runId = t.storeRun?.id ?? t.storeRunId ?? null;
  const href = runId != null ? `/store-run/${runId}` : t.pollId != null ? `/poll/${t.pollId}/results` : null;
  return {
    subject: t.menuItem?.name || t.storeRun?.storeName || '',
    when: t.createdAt
      ? new Date(t.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
      : '',
    href,
  };
}

export function buildBudget(
  debts: Transaction[],
  credits: Transaction[],
  now: Date = new Date(),
): BudgetVM {
  const myDebts = debts
    .filter((d) => d.status !== 'CONFIRMED')
    .map((d) => ({
      id: d.id,
      name: personName(d.toUser),
      amount: d.amount,
      status: d.status as 'PENDING' | 'PAID',
      reference: referenceOf(d),
      payTo: payToOf(d),
      // ждём подтверждения с момента отметки, а не с создания долга
      waiting: d.status === 'PAID' && d.paidAt ? humanSince(d.paidAt, now) : '',
    }))
    // сначала неоплаченные, внутри — по убыванию суммы
    .sort((a, b) => (a.status === b.status ? b.amount - a.amount : a.status === 'PENDING' ? -1 : 1));
  const myDebtTotal = myDebts.reduce((s, d) => s + d.amount, 0);
  const hadConfirmedDebt = debts.some((d) => d.status === 'CONFIRMED');

  const owed = credits
    .filter((c) => c.status !== 'CONFIRMED')
    .map((c) => ({
      id: c.id,
      name: personName(c.fromUser),
      amount: c.amount,
      status: c.status as 'PENDING' | 'PAID',
      reference: referenceOf(c),
      reminded: remindedOf(c),
    }))
    // сначала те, кто отметил оплату (их надо подтвердить)
    .sort((a, b) => (a.status === b.status ? b.amount - a.amount : a.status === 'PAID' ? -1 : 1));
  const owedExpected = credits.reduce((s, c) => s + c.amount, 0);
  const owedReceived = credits
    .filter((c) => c.status === 'CONFIRMED')
    .reduce((s, c) => s + c.amount, 0);
  const owedCount = credits.length;

  /* Подтверждённое уходит из активных, и отменить промах было негде. Держим
     сутки — ровно то окно, которое разрешает сервер. */
  const undoable = credits
    .filter((c) => {
      if (c.status !== 'CONFIRMED' || !c.confirmedAt) return false;
      const age = now.getTime() - new Date(c.confirmedAt).getTime();
      return age >= 0 && age <= UNDO_CONFIRM_WINDOW_MS;
    })
    .map((c) => ({
      id: c.id,
      name: personName(c.fromUser),
      amount: c.amount,
      status: 'PAID' as const,
      reference: referenceOf(c),
      reminded: '',
    }));

  return {
    myDebts,
    myDebtTotal,
    settledRecently: myDebts.length === 0 && hadConfirmedDebt,
    owed,
    owedReceived,
    owedExpected,
    owedCount,
    allCollected: owedCount > 0 && owed.length === 0,
    undoable,
    isEmpty:
      myDebts.length === 0 && owed.length === 0 && !hadConfirmedDebt && owedCount === 0,
  };
}
