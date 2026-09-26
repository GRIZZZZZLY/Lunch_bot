/* Модель экрана бюджета из сырых транзакций (долги/кредиты). Жизненный цикл
   PENDING → PAID → CONFIRMED раскладывается на две роли: должник платит и
   отменяет отметку, сборщик подтверждает и напоминает. Никаких выдуманных
   данных — только то, что вернул бэкенд. */
import type { Transaction } from '@/types/models';

export interface DebtLineVM {
  id: number;
  /** Кому должен: ключ группы. id получателя, а без него — имя. */
  toKey: string;
  name: string; // кому должен (toUser)
  amount: number;
  status: 'PENDING' | 'PAID';
  /** За что и когда. subject пустой, если API не дал ни блюда, ни магазина. */
  reference: BudgetReference;
  /** Куда переводить. null, если получатель реквизиты не заполнил. */
  payTo: PayTo | null;
  /** Сколько уже ждёт подтверждения. Пусто, пока не отмечено. */
  waiting: string;
  /** Для порядка строк в карточке: по дате, как в выписке банка. */
  createdAt: string;
  details: DebtDetails;
}

export interface BudgetReference {
  subject: string;
  when: string;
}

/**
 * Из чего сложилась сумма — раскрывается прямо в строке. Раньше за этим шли по
 * ссылке-дате на страницу закупки или результатов: из Главной в «Расчёты», из
 * «Расчётов» дальше — два перехода ради одной суммы.
 */
export interface DebtDetails {
  /** «Закупка «Пятёрочка»», «Обед» или пусто, если API не дал ни того ни другого. */
  source: string;
  lines: { label: string; amount: number }[];
  /** Итог — только когда строк больше одной: у одной строки он её и повторяет. */
  total: number | null;
  /** Когда отметили и подтвердили оплату. */
  events: string[];
  /** Добавляет ли раскрытие что-то к строке. У одного блюда без долей и без
      истории разбивка повторяла бы её: «Обед / Борщ 390 ₽». */
  informative: boolean;
}

/** Пауза между ручными напоминаниями одному должнику. Хозяин правила —
    сервер (backend reminder.service, REMINDER_COOLDOWN_MS); здесь только
    показ: кнопка гаснет, а не ждёт отказа. */
export const REMINDER_COOLDOWN_MS = 6 * 60 * 60 * 1000;

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
  /** Пауза после напоминания прошла (или напоминаний не было). */
  canRemind: boolean;
  /** «снова в 17:30», пока идёт пауза; иначе пусто. */
  remindAgain: string;
  details: DebtDetails;
}

/** Окно отмены подтверждения. Хозяин правила — сервер; здесь только показ. */
export const UNDO_CONFIRM_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Долги одному получателю. Три долга Игорю были тремя строками: три похода
    в банк, три одинаковых номера, три «Отметить». */
export interface DebtGroupVM {
  key: string;
  name: string;
  /** Реквизиты одни на получателя — берём у первого долга. */
  payTo: PayTo | null;
  /** По дате, затем по id: отметка строки не переставляет. */
  debts: DebtLineVM[];
  toTransfer: number;
  awaiting: number;
  pendingIds: number[];
}

/** Закрытые за сутки: кому и сколько — для итоговой карточки должника. */
export interface SettledVM {
  count: number;
  total: number;
  names: string[];
}

export interface BudgetVM {
  myDebts: DebtLineVM[];
  /** myDebts по получателям: с переводом — первыми, по убыванию суммы. */
  debtGroups: DebtGroupVM[];
  /** Ещё не переведено (PENDING). */
  myDebtToTransfer: number;
  /** Переведено и отмечено, ждёт получателя (PAID). Отдельно от «к переводу»:
      сложенные вместе, они звали переводить уже переведённое. */
  myDebtAwaiting: number;
  settledRecently: boolean; // активных долгов нет, но был закрытый — показать успех
  settled: SettledVM;
  owed: CreditLineVM[];
  owedReceived: number; // подтверждено, ₽
  owedExpected: number; // всего к получению, ₽
  owedCount: number;
  allCollected: boolean; // мне были должны, все рассчитались
  /** Кто рассчитался, по убыванию суммы, без повторов. */
  collectedNames: string[];
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
function remindedOf(t: Transaction, now: Date): string {
  const count = t.reminderCount ?? 0;
  if (count < 1) return '';
  /* Сегодняшнее — со временем: рядом с погашенной кнопкой «Напомнили» дата
     «20 июля» не говорит, когда можно снова. */
  const last = t.lastReminderAt ? new Date(t.lastReminderAt) : null;
  const when = !last
    ? ''
    : last.toDateString() === now.toDateString()
      ? `сегодня в ${last.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
      : last.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
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
  return {
    subject: t.menuItem?.name || t.storeRun?.storeName || '',
    when: t.createdAt
      ? new Date(t.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
      : '',
  };
}

/** «20 июля в 12:40». Склеиваем сами: форма «в» у Intl зависит от версии ICU. */
function dayTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${day} в ${time}`;
}

/* Доли обеда, которые сервер раскладывает на каждого. Нулевые не показываем:
   «Сервисный сбор 0 ₽» — шум, а не сведение. */
const SHARES = [
  ['deliveryShare', 'Доставка'],
  ['serviceShare', 'Сервисный сбор'],
  ['tipShare', 'Чаевые'],
] as const;

function detailsOf(t: Transaction): DebtDetails {
  const events: string[] = [];
  if (t.paidAt) events.push(`Оплату отметили ${dayTime(t.paidAt)}`);
  if (t.confirmedAt) events.push(`Оплату подтвердили ${dayTime(t.confirmedAt)}`);

  if (t.storeRun || t.storeItem) {
    const name = t.storeItem?.name || 'Покупка';
    const qty = t.storeItem?.quantity ?? 1;
    return {
      source: t.storeRun ? `Закупка «${t.storeRun.storeName}»` : 'Закупка',
      lines: [{ label: qty > 1 ? `${name} × ${qty}` : name, amount: t.itemPrice ?? t.amount }],
      total: null,
      events,
      // В строке — магазин, а что куплено, видно только в раскрытии.
      informative: Boolean(t.storeItem?.name) || events.length > 0,
    };
  }

  /* Цена блюда без долей — это весь долг. Если цены нет (старые записи), блюдо
     получает всю сумму: делить её за сервер было бы выдумкой. */
  const shares = SHARES.flatMap(([key, label]) => {
    const value = t[key] ?? 0;
    return value > 0 ? [{ label, amount: value }] : [];
  });
  const dish = { label: t.menuItem?.name || 'Блюдо', amount: t.itemPrice ?? t.amount };
  const lines = t.itemPrice != null ? [dish, ...shares] : [dish];
  return {
    source: t.pollId != null || t.menuItem ? 'Обед' : '',
    lines,
    total: lines.length > 1 ? t.amount : null,
    events,
    // Блюдо уже названо в строке — раскрывать стоит только доли и историю.
    informative: lines.length > 1 || events.length > 0,
  };
}

/* Имена по убыванию суммы на человека: первым — тот, чьи деньги весомее. */
function namesBySum(txs: Transaction[], who: (t: Transaction) => { firstName?: string; username?: string } | undefined): string[] {
  const byName = new Map<string, number>();
  for (const t of txs) {
    const name = personName(who(t));
    byName.set(name, (byName.get(name) ?? 0) + t.amount);
  }
  return [...byName.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

function groupDebts(debts: DebtLineVM[]): DebtGroupVM[] {
  const byKey = new Map<string, DebtGroupVM>();
  for (const d of debts) {
    let g = byKey.get(d.toKey);
    if (!g) {
      g = { key: d.toKey, name: d.name, payTo: d.payTo, debts: [], toTransfer: 0, awaiting: 0, pendingIds: [] };
      byKey.set(d.toKey, g);
    }
    g.debts.push(d);
    if (d.status === 'PENDING') {
      g.toTransfer += d.amount;
      g.pendingIds.push(d.id);
    } else {
      g.awaiting += d.amount;
    }
    g.payTo ??= d.payTo;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const byDate = (a: DebtLineVM, b: DebtLineVM) =>
    a.createdAt === b.createdAt ? a.id - b.id : a.createdAt < b.createdAt ? -1 : 1;
  /* Порядок не зависит от статуса: по всей сумме долгов получателю. После
     «Отметить все» список пересортировывался, карточка уезжала вниз, а под
     палец вставала сплошная кнопка другого человека. Строки — по дате. */
  return [...byKey.values()]
    .map((g) => ({
      ...g,
      debts: [...g.debts].sort(byDate),
      pendingIds: [...g.debts].sort(byDate).filter((d) => d.status === 'PENDING').map((d) => d.id),
      toTransfer: round(g.toTransfer),
      awaiting: round(g.awaiting),
    }))
    .sort((a, b) => b.toTransfer + b.awaiting - (a.toTransfer + a.awaiting) || (a.key < b.key ? -1 : 1));
}

/* Когда пауза кончится. Без этого «Напомнили» гасла без срока, и было не
   понять, ждать час или до завтра. */
function remindAgainOf(t: Transaction, now: Date): string {
  if (canRemindOf(t, now) || !t.lastReminderAt) return '';
  const at = new Date(new Date(t.lastReminderAt).getTime() + REMINDER_COOLDOWN_MS);
  const time = at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (at.toDateString() === now.toDateString()) return `снова в ${time}`;
  if (at.toDateString() === tomorrow.toDateString()) return `снова завтра в ${time}`;
  return `снова ${at.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} в ${time}`;
}

function canRemindOf(t: Transaction, now: Date): boolean {
  if (!t.lastReminderAt) return true;
  return now.getTime() - new Date(t.lastReminderAt).getTime() >= REMINDER_COOLDOWN_MS;
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
      toKey: d.toUser?.id != null ? String(d.toUser.id) : d.toUserId != null ? String(d.toUserId) : personName(d.toUser),
      name: personName(d.toUser),
      amount: d.amount,
      status: d.status as 'PENDING' | 'PAID',
      reference: referenceOf(d),
      payTo: payToOf(d),
      // ждём подтверждения с момента отметки, а не с создания долга
      waiting: d.status === 'PAID' && d.paidAt ? humanSince(d.paidAt, now) : '',
      createdAt: d.createdAt,
      details: detailsOf(d),
    }))
    // сначала неоплаченные, внутри — по убыванию суммы
    .sort((a, b) => (a.status === b.status ? b.amount - a.amount : a.status === 'PENDING' ? -1 : 1));
  const sumOf = (status: 'PENDING' | 'PAID') =>
    myDebts.filter((d) => d.status === status).reduce((s, d) => s + d.amount, 0);
  const hadConfirmedDebt = debts.some((d) => d.status === 'CONFIRMED');
  const recentlyConfirmed = debts.filter((d) => {
    if (d.status !== 'CONFIRMED' || !d.confirmedAt) return false;
    const age = now.getTime() - new Date(d.confirmedAt).getTime();
    return age >= 0 && age <= UNDO_CONFIRM_WINDOW_MS;
  });

  const owed = credits
    .filter((c) => c.status !== 'CONFIRMED')
    .map((c) => ({
      id: c.id,
      name: personName(c.fromUser),
      amount: c.amount,
      status: c.status as 'PENDING' | 'PAID',
      reference: referenceOf(c),
      reminded: remindedOf(c, now),
      canRemind: canRemindOf(c, now),
      remindAgain: remindAgainOf(c, now),
      details: detailsOf(c),
    }))
    // сначала те, кто отметил оплату (их надо подтвердить)
    .sort((a, b) => (a.status === b.status ? b.amount - a.amount : a.status === 'PAID' ? -1 : 1));
  const owedExpected = credits.reduce((s, c) => s + c.amount, 0);
  const owedReceived = credits
    .filter((c) => c.status === 'CONFIRMED')
    .reduce((s, c) => s + c.amount, 0);
  const owedCount = credits.length;
  const collectedNames = namesBySum(credits.filter((c) => c.status === 'CONFIRMED'), (c) => c.fromUser);

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
      canRemind: false,
      remindAgain: '',
      details: detailsOf(c),
    }));

  return {
    myDebts,
    debtGroups: groupDebts(myDebts),
    myDebtToTransfer: sumOf('PENDING'),
    myDebtAwaiting: sumOf('PAID'),
    settledRecently: myDebts.length === 0 && hadConfirmedDebt,
    settled: {
      count: recentlyConfirmed.length,
      total: recentlyConfirmed.reduce((s, d) => s + d.amount, 0),
      names: namesBySum(recentlyConfirmed, (d) => d.toUser),
    },
    owed,
    owedReceived,
    owedExpected,
    owedCount,
    allCollected: owedCount > 0 && owed.length === 0,
    collectedNames,
    undoable,
    isEmpty:
      myDebts.length === 0 && owed.length === 0 && !hadConfirmedDebt && owedCount === 0,
  };
}
