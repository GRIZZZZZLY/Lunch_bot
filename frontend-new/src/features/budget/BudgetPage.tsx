/* Расчёты (Phase 6b, система C). Полный сценарный цикл на сырых
   транзакциях: должник отмечает оплату и отменяет отметку, сборщик
   подтверждает оплату и напоминает. Две роли могут сосуществовать. */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import {
  useCancelMark,
  useConfirmPayment,
  useCredits,
  useDebts,
  useMarkAllPaid,
  useMarkPaid,
  useRemindAll,
  useSendReminder,
  useUndoConfirmation,
} from '@/hooks/useBudget';
import { useMoneyStream } from '@/hooks/useMoneyStream';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { ConfirmDialog, EmptyState, ErrorState, Skeleton, Status } from '@/shared/ui';
import { FlipGroup } from '@/shared/ui/FlipGroup';
import { Button } from '@/components/rl/primitives';
import { pluralize } from '@/shared/lib/pluralize';
import { useDelayedLoading } from '@/shared/lib/useDelayedLoading';
import { isSafePaymentLink } from '@/shared/lib/phone';
import { openExternalLink } from '@/lib/telegram';
import { liveKey, useLiveChanges } from '@/shared/lib/liveChanges';
import { formatPrice } from '@/features/store-run/lib/selectors';
import { Icon } from '@/components/rl/Icon';
import { PaymentMissingNotice } from '@/components/profile/PaymentMissingNotice';
import { stamp } from '@/shared/lib/stamp';
import {
  buildBudget,
  type BudgetReference,
  type CreditLineVM,
  type DebtGroupVM,
  type DebtDetails,
  type PayTo as PayToVM,
} from './lib/buildBudget';
import styles from './BudgetPage.module.css';

type BusyKind = 'mark' | 'cancel' | 'confirm' | 'remind';

/* Строка, изменившаяся по потоку, помечается на полторы секунды. Своё действие
   сюда не попадает: у него есть нажатие, спиннер и оптимистичное обновление. */
function liveClass(base: string, isLive: boolean): string {
  return isLive ? `${base} live-flash live-money is-live` : `${base} live-flash live-money`;
}

function rowClass(base: string, live: ReadonlySet<string>, key: string): string {
  return liveClass(base, live.has(key));
}

/* Сумма в тексте: неразрывный пробел держит «₽» при числе. В имена кнопок
   идёт formatPrice как есть. */
function priceText(n: number): string {
  return formatPrice(n).replace(' ₽', '\u00a0₽');
}


/**
 * Куда переводить и что делать дальше — одной полосой под суммой. Раньше
 * «Отметить» стояла в колонке справа сверху и читалась раньше «Перевести»,
 * а порядок клавиши Tab расходился с тем, что видит глаз.
 *
 * Ссылка СБП главнее телефона: по ней плательщик попадает прямо в банк, а
 * номер надо скопировать и вставить. Телефон остаётся видимым текстом — на
 * случай, если ссылка не откроется, — поэтому недоступный clipboard ничего не
 * ломает. Нет ссылки — ведёт сам номер: иначе в строке не было бы ни одной
 * сплошной кнопки.
 */
function PayTo({
  value,
  name,
  amount,
  started,
  lead,
  onStart,
  mark,
  prompt,
}: {
  value: PayToVM;
  name: string;
  amount: number;
  /** Перевод уже начат: ведёт отметка, а не перевод. */
  started: boolean;
  /** Карточка в фокусе секции: сплошная кнопка на экране одна. */
  lead: boolean;
  onStart: () => void;
  /** Кнопка отметки — в той же полосе, сразу после перевода. */
  mark: ReactNode;
  /** «Перевели?» — сразу под полосой, рядом с кнопкой, о которой спрашивает. */
  prompt: ReactNode;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  const link = safeLinkOf(value);
  const phone = value.phone ?? null;

  /* Скопированный номер — тоже начало перевода: дальше человек уходит в банк.
     Отмечаем сразу, не дожидаясь clipboard, — он бывает недоступен. */
  const copy = () => {
    if (!phone) return;
    onStart();
    navigator.clipboard
      ?.writeText(phone)
      .then(() => setCopied(phone))
      .catch(() => undefined);
  };
  const transferVariant = lead && !started ? 'primary' : 'outline';

  if (!phone && !link) {
    return (
      <>
        {/* Заметка получателя подписана: без имени «Только наличными»
            читалось как правило приложения. */}
        {value.note && (
          <span className={styles.payToNote}>
            <span className={styles.payToNoteBy}>{name}:</span> <span>{value.note}</span>
          </span>
        )}
        <span className={styles.actionBar}>{mark}</span>
      </>
    );
  }

  return (
    <>
      <span className={styles.actionBar}>
        {/* Сумма — в имени кнопки для диктора, а на виду она уже стоит над
            кнопкой крупно; в самой кнопке она лишь повторялась. */}
        {link && (
          <Button
            variant={transferVariant}
            iconRight="arrowRight"
            aria-label={`Перевести ${formatPrice(amount)}: ${name}`}
            /* openExternalLink, а не <a target="_blank">: внутри Mini App обычная
               вкладка открывается так, что вернуться в приложение нельзя. */
            onClick={() => {
              onStart();
              openExternalLink(link);
            }}
          >
            Перевести
          </Button>
        )}
        {!link && phone && (
          <Button
            variant={transferVariant}
            iconRight={copied ? 'check' : 'copy'}
            aria-label={`Скопировать СБП: ${phone}`}
            onClick={copy}
          >
            <span className="tnum">СБП {phone}</span>
          </Button>
        )}
        {mark}
      </span>
      {prompt}
      {link && phone && (
        <button
          type="button"
          className={styles.payToItem}
          aria-label={`Скопировать СБП: ${phone}`}
          onClick={copy}
        >
          <span className={styles.payToLabel}>СБП</span>
          <span className="tnum">{phone}</span>
          <Icon name={copied ? 'check' : 'copy'} size={14} />
        </button>
      )}
      {/* Успех копирования нужно объявить: иконка меняется молча. */}
      <span className="sr-only" role="status">
        {copied ? 'Скопировано' : ''}
      </span>
    </>
  );
}

function safeLinkOf(value: PayToVM | null | undefined): string | undefined {
  return value && isSafePaymentLink(value.link) ? value.link : undefined;
}

/* Есть ли куда переводить с этого экрана. Нет — ведёт сама отметка: человек
   платит наличными или по реквизитам, которые знает сам. */
function hasPayPath(value: PayToVM | null | undefined): boolean {
  return Boolean(safeLinkOf(value) || value?.phone);
}

/* За что и когда. Переносится, а не режется многоточием: «Борщ со смета…»
   не давал сверить долг с банком, а обрезка ещё и оставляла двойной зазор
   перед точкой. Точка держится за названием неразрывным пробелом, поэтому
   строка никогда не начинается с «·»; дата не рвётся. */
function Reference({ value }: { value: BudgetReference }) {
  if (!value.subject && !value.when) return null;

  /* Текст, а не ссылка. Ссылка-дата вела на страницу закупки или результатов:
     из Главной в «Расчёты», оттуда ещё дальше — ради одной суммы. Разбивка
     теперь раскрывается в самой строке («Подробнее»). */
  return (
    <span className={styles.rowRef}>
      {value.subject && <span className={styles.rowRefSubject}>{value.subject}</span>}
      {value.subject && value.when ? '\u00a0· ' : null}
      {value.when && <span className={styles.nowrap}>{value.when}</span>}
    </span>
  );
}

/* Строчная кнопка в колонке текста — для редких действий строки («Отменить
   отметку», «Отменить»). В колонке кнопок они занимали до 167 px и выдавливали
   название долга. Вид и касание — как у «Подробнее». */
function RowLink({
  label,
  busy,
  locked = false,
  onClick,
  children,
}: {
  label: string;
  /** Своё действие идёт: кнопка занята, но фокус с неё не слетает. */
  busy: boolean;
  /** Действие закрыто чужим («Отметить все» ещё отправляет этот долг). */
  locked?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.more}
      aria-label={label}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      disabled={locked}
      onClick={() => {
        if (!busy) onClick();
      }}
    >
      {children}
    </button>
  );
}

/* Какой перевод начат — до закрытия приложения. Telegram может перезагрузить
   окно, пока человек в банке, и тогда ведущей снова становилась «Перевести»:
   так платят дважды. sessionStorage живёт ровно столько, сколько окно Mini
   App, и недоступен бывает (приватный режим) — тогда метка живёт до ухода. */
const STARTED_KEY = 'rl.budget.transferStarted';

function readStarted(): ReadonlySet<number> {
  try {
    const raw = window.sessionStorage.getItem(STARTED_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : []);
  } catch {
    return new Set();
  }
}

function writeStarted(ids: ReadonlySet<number>): void {
  try {
    window.sessionStorage.setItem(STARTED_KEY, JSON.stringify([...ids]));
  } catch {
    /* хранилище недоступно — метка проживёт до ухода с экрана */
  }
}

/* « — Борщ, 14 июля» для диалога подтверждения; пусто, если сказать нечего. */
function referenceText(ref: BudgetReference): string {
  const parts = [ref.subject, ref.when].filter(Boolean);
  return parts.length ? ` — ${parts.join(', ')}` : '';
}

/* Карточка, как до «Отметить все»: отправляемые долги ещё «к переводу». */
function holdMarking(g: DebtGroupVM, markingIds: readonly number[]): DebtGroupVM {
  const held = g.debts.filter((d) => d.status === 'PAID' && markingIds.includes(d.id));
  if (held.length === 0) return g;
  const heldSum = held.reduce((sum, d) => sum + d.amount, 0);
  const debts = g.debts.map((d) => (held.includes(d) ? { ...d, status: 'PENDING' as const, waiting: '' } : d));
  return {
    ...g,
    debts,
    toTransfer: Math.round((g.toTransfer + heldSum) * 100) / 100,
    awaiting: Math.round((g.awaiting - heldSum) * 100) / 100,
    pendingIds: debts.filter((d) => d.status === 'PENDING').map((d) => d.id),
  };
}

/* «Ян», «Ян и Оля», «Ян, Оля и Мария», «Ян, Оля и ещё 3». */
function namesLine(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} и ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} и ${names[2]}`;
  return `${names[0]}, ${names[1]} и ещё ${names.length - 2}`;
}

/* Печать закрытого цикла — тот же Штамп, что у голоса, но крупным оттиском:
   24-пиксельный чип был слишком мелок для момента, которым кончается весь
   путь от обеда до денег. Слово несёт заголовок карточки, печать — рисунок. */
function Seal({ sealRef }: { sealRef: Ref<HTMLSpanElement> }) {
  return (
    <span ref={sealRef} className={styles.seal} aria-hidden>
      <span className={styles.sealMark}>
        <Icon name="check" size={22} stroke={2.4} />
      </span>
    </span>
  );
}

/* Подпись «2 напоминания · сегодня в 11:30» переносится только между частями.
   Обрезка многоточием съедала время — а оно и говорит, когда напомнить снова. */
function Parts({ text }: { text: string }) {
  const parts = text.split(' · ');
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && ' '}
      <span className={styles.nowrap}>{i < parts.length - 1 ? `${part} ·` : part}</span>
    </Fragment>
  ));
}

/* Кнопка раскрытия строки. Отдельная, а не вся строка: в строке уже живёт
   действие («Отметить», «Напомнить»), а вложенные контролы запрещены. */
function MoreToggle({
  open,
  controls,
  label,
  onToggle,
}: {
  open: boolean;
  controls: string;
  /** Чья строка: шесть кнопок подряд назывались просто «Подробнее». */
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.more}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={`${open ? 'Свернуть' : 'Подробнее'}: ${label}`}
      onClick={onToggle}
    >
      {open ? 'Свернуть' : 'Подробнее'}
      <Icon name="chevronDown" size={14} stroke={2} className={styles.moreChevron} />
    </button>
  );
}

/* Из чего сложилась сумма. Итог — только у разбивки из нескольких строк. */
function Details({ id, value }: { id: string; value: DebtDetails }) {
  return (
    <div id={id} className={`${styles.details} anim-in`}>
      {value.source && <p className={styles.detailsSource}>{value.source}</p>}
      {/* Пара dt/dd в своём div (так dl разрешает): линия над «Итого» идёт
          на всю ширину, а не двумя отрезками по колонкам сетки. */}
      <dl className={styles.detailsList}>
        {value.lines.map((line, i) => (
          <div key={i} className={styles.detailsLine}>
            <dt>{line.label}</dt>
            <dd className="tnum">{formatPrice(line.amount)}</dd>
          </div>
        ))}
        {value.total != null && (
          <div className={`${styles.detailsLine} ${styles.detailsTotal}`}>
            <dt>Итого</dt>
            <dd className="tnum">{formatPrice(value.total)}</dd>
          </div>
        )}
      </dl>
      {value.events.map((event) => (
        <p key={event} className={styles.detailsEvent}>
          {event}
        </p>
      ))}
    </div>
  );
}

/* Штамп на закрытии долга — тот же жест, что принятый голос на Главной
   (shared/lib/stamp). Печатает детей при монтировании, если `play`: строка
   «Закрыт» монтируется заново, когда подтверждённая оплата переезжает в
   «Подтверждено сегодня». */
function Stamped({ play, children }: { play: boolean; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (play) stamp(ref.current);
  }, [play]);
  return (
    <span ref={ref} className={styles.stamped}>
      {children}
    </span>
  );
}

/* Штамп на итоговой строке — только если она появилась при открытом экране.
   Открыть «Расчёты» с уже закрытыми долгами — не событие: печатать нечего. */
function useStampOnArrival(shown: boolean, ready: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  const before = useRef<boolean | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (before.current === false && shown) stamp(ref.current);
    before.current = shown;
  }, [shown, ready]);
  return ref;
}

/* После денежного действия его кнопка часто исчезает (долг стал «ждёт»,
   строка переехала), и фокус падал в начало страницы. Ставим его на карточку
   или соседнюю строку — если человек за это время не ушёл фокусом сам. */
function focusRow(target: string, from?: string) {
  /* Сразу, пока кнопка действия ещё в DOM: через кадр она успевала исчезнуть,
     и фокус проваливался в начало страницы. Кадр ждём, только если цели ещё
     нет (строка переезжает в другую секцию). */
  const attempt = () => {
    const row = document.querySelector<HTMLElement>(`[data-flip="${target}"]`);
    if (!row) return false;
    const active = document.activeElement;
    const origin = from ? document.querySelector(`[data-flip="${from}"]`) : null;
    const free = !active || active === document.body || row.contains(active) || !!origin?.contains(active);
    if (free) row.focus({ preventScroll: true });
    return true;
  };
  if (!attempt()) window.requestAnimationFrame(attempt);
}

/* «уже меньше минуты» звучало странно — «только что». */
function waitingText(since: string): string {
  return since === 'меньше минуты' ? 'только что' : `уже ${since}`;
}

/* Штамп играет 300 мс; подтверждённая строка переезжает, когда оттиск осел. */
const STAMP_MS = 320;

function canStamp(): boolean {
  return (
    typeof HTMLElement !== 'undefined' &&
    typeof HTMLElement.prototype.animate === 'function' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/* Закрытие разбивки. Появление играет CSS (.anim-in), а уход CSS не поймать:
   React снимает узел сразу. Поэтому панель сначала гаснет, потом уходит.
   Без WAAPI или при reduced-motion — сразу. */
function closePanel(id: string, done: () => void) {
  const panel = document.getElementById(id);
  if (
    !panel ||
    typeof panel.animate !== 'function' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    done();
    return;
  }
  panel.animate(
    [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(var(--shift-in))' },
    ],
    { duration: 150, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
  ).onfinish = done;
}

export function BudgetPage() {
  useScreenHeader('Расчёты');
  /* Живой поток вместо двух опросов по 15 с. Опрос остаётся страховкой: пока
     поток не подтвердил соединение, запросы идут как раньше. */
  const streamStatus = useMoneyStream();
  /* Что приехало по потоку прямо сейчас: строку, изменившуюся не по вашей
     воле, иначе от неизменившейся не отличить. */
  const liveChanges = useLiveChanges();
  const live = streamStatus === 'connected';
  const debtsQuery = useDebts(undefined, live);
  const creditsQuery = useCredits(undefined, live);
  const markPaid = useMarkPaid();
  const markAllPaid = useMarkAllPaid();
  const cancelMark = useCancelMark();
  const confirmPayment = useConfirmPayment();
  const sendReminder = useSendReminder();
  const remindAll = useRemindAll();
  const undoConfirmation = useUndoConfirmation();

  /* Подстановка пустого массива внутри useMemo, а не рядом с ним: `?? []`
     снаружи создаёт новый массив на каждый рендер и мемоизация теряется. */
  const vm = useMemo(
    () => buildBudget(debtsQuery.data ?? [], creditsQuery.data ?? []),
    [debtsQuery.data, creditsQuery.data],
  );

  /* Занятость — явная пара «кто и чем занят», а не цепочка `??` по variables:
     TanStack сохраняет variables ПОСЛЕ завершения мутации, поэтому цепочка
     залипала на первой сработавшей, и следующая мутация на другой строке
     теряла и спиннер, и блокировку — второе касание уходило на сервер. */
  const busy: { id: number | undefined; kind: BusyKind } | null = markPaid.isPending
    ? { id: markPaid.variables, kind: 'mark' }
    : cancelMark.isPending
      ? { id: cancelMark.variables, kind: 'cancel' }
      : confirmPayment.isPending
        ? { id: confirmPayment.variables, kind: 'confirm' }
        : sendReminder.isPending
          ? { id: sendReminder.variables, kind: 'remind' }
          : null;
  const isBusy = (id: number, kind: BusyKind) => busy?.kind === kind && busy.id === id;

  /* Раскрытые строки: ключ секции и id, как у data-flip. У каждой строки своё
     раскрытие — открыть одну, не закрывая другую, нужно при сверке двух сумм. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string, panelId: string) => {
    const set = (open: boolean) =>
      setExpanded((prev) => {
        const next = new Set(prev);
        if (open) next.add(key);
        else next.delete(key);
        return next;
      });
    if (expanded.has(key)) closePanel(panelId, () => set(false));
    else set(true);
  };
  /* Долги, по которым человек уже нажал «Перевести» или скопировал номер: у
     них ведёт отметка. Порядок вставки важен — фокус у последнего начатого. */
  const [started, setStarted] = useState<ReadonlySet<number>>(readStarted);
  useEffect(() => writeStarted(started), [started]);
  /* Один перевод на всю карточку получателя — начатыми считаются все её
     непереведённые долги. */
  const startTransfer = (ids: readonly number[]) =>
    setStarted((prev) => {
      if (ids.every((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      for (const id of ids) {
        next.delete(id);
        next.add(id);
      }
      return next;
    });
  /* Подтверждённая оплата печатается Штампом прямо в своей строке, до
     переезда: при четырёх и больше должниках строка уезжала за край экрана и
     печаталась там, где её никто не видел. */
  /* Долги, отметить которые не удалось: строка подписана, ведёт отметка —
     иначе вела бы «Перевести» и звала заплатить второй раз. */
  const [failedIds, setFailedIds] = useState<ReadonlySet<number>>(() => new Set());
  const markFailed = (ids: readonly number[]) => {
    startTransfer(ids);
    setFailedIds((prev) => new Set([...prev, ...ids]));
  };
  const clearFailed = (ids: readonly number[]) =>
    setFailedIds((prev) => (ids.some((id) => prev.has(id)) ? new Set([...prev].filter((id) => !ids.includes(id))) : prev));
  const [closing, setClosing] = useState<{ row: CreditLineVM; index: number } | null>(null);
  const closingTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(closingTimer.current), []);
  /* Подтверждённые в этом визите — их строка «Закрыт» печатается Штампом. */
  const [closedNow, setClosedNow] = useState<ReadonlySet<number>>(() => new Set());
  /* Подтверждение необратимо: CONFIRMED нельзя отменить ни в интерфейсе, ни в
     API. Промах в списке из восьми человек закрывал чужой долг навсегда, а
     защита стояла на обратимом действии должника. */
  const [confirming, setConfirming] = useState<CreditLineVM | null>(null);
  const [remindingAll, setRemindingAll] = useState(false);
  const [undoing, setUndoing] = useState<CreditLineVM | null>(null);
  const pendingDebtors = vm.owed.filter((c) => c.status === 'PENDING');
  /* Массовое напоминание — только тем, кому можно напомнить сейчас: сервер
     отклонит повтор в пределах паузы, и счётчик на кнопке соврал бы. */
  const remindable = pendingDebtors.filter((c) => c.canRemind);
  const remindEveryone = () => remindAll.mutate(remindable.map((c) => c.id));
  const loading = debtsQuery.isLoading || creditsQuery.isLoading;
  const showSkeleton = useDelayedLoading(loading);
  const ready = !loading && debtsQuery.data !== undefined && creditsQuery.data !== undefined;
  const settledRef = useStampOnArrival(vm.settledRecently && vm.myDebts.length === 0, ready);
  const collectedRef = useStampOnArrival(vm.allCollected && vm.owed.length === 0 && !closing, ready);

  /* Скелет повторяет карточку — аватар, имя, «за что», сумма и полоса из двух
     кнопок, — чтобы приход данных не перестраивал экран. */
  if (loading) {
    return (
      <div className={`rl ${styles.screen}`}>
        {showSkeleton && (
          <div className={styles.group}>
            <div className={styles.groupHead}>
              <Skeleton variant="text" width="30%" />
            </div>
            {[0, 1].map((i) => (
              <div key={i} className={`${styles.row} ${styles.rowWide}`}>
                <Skeleton variant="circle" width={40} className={styles.avatarSkeleton} />
                <div className={styles.rowMain}>
                  <Skeleton variant="text" width="35%" />
                  <Skeleton variant="text" width="55%" className={styles.skeletonGap} />
                  <Skeleton variant="text" width="25%" height={20} className={styles.skeletonGap} />
                  <span className={styles.actionBar}>
                    <Skeleton variant="block" width={128} height={44} />
                    <Skeleton variant="block" width={112} height={44} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* Отказ чтения нельзя показывать как «долгов нет»: раньше error никто не
     читал, данные подставлялись пустым массивом, и человек с долгом на 600 ₽
     видел «Нет активных расчётов». Проверяем ДО пустого состояния и только
     когда данных нет вовсе — упавший фоновой рефетч не должен прятать
     уже показанные суммы. */
  const debtsFailed = debtsQuery.isError && debtsQuery.data === undefined;
  const creditsFailed = creditsQuery.isError && creditsQuery.data === undefined;
  if (debtsFailed || creditsFailed) {
    return (
      <div className={`rl ${styles.screen}`}>
        <div className={styles.stateWrap}>
          <ErrorState
            kind="network"
            title="Не удалось загрузить расчёты"
            description="Суммы не показаны — это сбой связи, а не отсутствие долгов."
            onRetry={() => {
              if (debtsFailed) debtsQuery.refetch();
              if (creditsFailed) creditsQuery.refetch();
            }}
          />
        </div>
      </div>
    );
  }

  if (vm.isEmpty) {
    return (
      <div className={`rl ${styles.screen}`}>
        <div className={styles.stateWrap}>
          <EmptyState
            icon="wallet"
            title="Нет активных расчётов"
            description="Долги и оплаты появятся здесь после завершения голосования или закупки."
          />
        </div>
      </div>
    );
  }

  /* Сплошная кнопка на экране — одна на секцию («правило одного штампа»).
     У должника ведёт карточка последнего начатого перевода, а без начатых —
     верхняя карточка с переводом. У сборщика — первая отмеченная оплата. */
  const groupStarted = (g: DebtGroupVM) => g.pendingIds.some((id) => started.has(id));
  /* «Отметить все» идёт запросами по одному, а оптимистика уже перевела долги
     в «ждёт». Пока запросы идут, секция выглядит как до нажатия: иначе
     пропадали «Перевести» и номер, кнопка прыгала, а сплошная уходила к
     другому человеку — под палец, который ещё на этой карточке. */
  const markingIds = markAllPaid.isPending ? (markAllPaid.variables ?? []).map((v) => v.id) : [];
  /* Одиночная отметка — так же: строка «к переводу», пока запрос в пути, чтобы
     кнопка оставалась на месте со спиннером и фокусом. */
  const heldIds =
    markPaid.isPending && markPaid.variables != null ? [...markingIds, markPaid.variables] : markingIds;
  const debtGroups = heldIds.length === 0 ? vm.debtGroups : vm.debtGroups.map((g) => holdMarking(g, heldIds));
  const toTransferShown = debtGroups.reduce((sum, g) => sum + g.toTransfer, 0);
  const awaitingShown = debtGroups.reduce((sum, g) => sum + g.awaiting, 0);
  const startedGroup = [...started]
    .reverse()
    .map((id) => debtGroups.find((g) => g.pendingIds.includes(id)))
    .find(Boolean);
  const focusGroupKey = startedGroup?.key ?? debtGroups.find((g) => g.toTransfer > 0)?.key;
  const focusCreditId = vm.owed.find((c) => c.status === 'PAID')?.id;
  /* Пока играет Штамп, подтверждённая строка стоит на своём месте в «Вам
     должны», хотя сервер уже спрошен и итог уже вырос. */
  const closingId = closing?.row.id;
  const owedShown =
    closing && !vm.owed.some((c) => c.id === closing.row.id)
      ? [...vm.owed.slice(0, closing.index), closing.row, ...vm.owed.slice(closing.index)]
      : vm.owed;
  const undoableShown = vm.undoable.filter((c) => c.id !== closingId);
  /* «Отметить все» идёт запросами по одному, а оптимистика уже перевела долги
     в «ждёт»: кнопка держится на месте занятой, отмена этих долгов закрыта. */
  const lineLabel = (d: { reference: BudgetReference; amount: number }) =>
    `${d.reference.subject ? `${d.reference.subject}, ` : ''}${formatPrice(d.amount)}`;
  const anyLink = debtGroups.some((g) => g.toTransfer > 0 && safeLinkOf(g.payTo));
  /* Одна живая строка на итог секции: после одной отметки срабатывали до пяти
     объявлений — итог, строка ожидания, тост… */
  const debtsSpoken = [
    toTransferShown > 0 ? `К переводу ${formatPrice(toTransferShown)}` : '',
    awaitingShown > 0 ? `ждёт подтверждения ${formatPrice(awaitingShown)}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  /* FlipGroup: подтверждённая оплата переезжает из «Вам должны» в «Можно
     отменить», а оплата, отмеченная коллегой по SSE, поднимается в начало
     списка. Без движения строка исчезала бы в одном месте и возникала в другом.
     Ключ credit: общий у двух секций — это одна и та же транзакция. */
  return (
    <FlipGroup className={`rl ${styles.screen}`}>
      {vm.myDebts.length > 0 && (
        <section className={styles.group} aria-labelledby="budget-debts-heading">
          <div className={styles.groupHead}>
            <h2 id="budget-debts-heading" className={styles.groupTitle}>
              Мои долги
            </h2>
            {/* Только то, что ещё переводить. Отмеченное уже ушло, и сложенное
                с ним «600 ₽» после отметки звало переводить второй раз. */}
            {toTransferShown > 0 && (
              <span className={`tnum ${styles.groupTotal} ${styles.groupTotalOwed}`} aria-hidden>
                <span className={styles.groupTotalLabel}>к переводу</span> {priceText(toTransferShown)}
              </span>
            )}
          </div>
          <span className="sr-only" role="status">
            {debtsSpoken}
          </span>
          {awaitingShown > 0 && (
            <p className={styles.groupAwaiting} aria-hidden>
              <Icon name="clock" size={14} />
              <span className="tnum">{`${priceText(awaitingShown)} ждёт подтверждения`}</span>
            </p>
          )}
          {/* Главное недоразумение экрана: человек нажимал «Оплатил» и уходил в
              уверенности, что рассчитался. Заметка называет обе кнопки и не
              спорит с «Перевести»: та открывает банк, а не переводит сама. */}
          {toTransferShown > 0 && (
            <p className={styles.groupNote}>
              {anyLink
                ? '«Перевести» откроет ваш банк — деньги переводите там. Потом нажмите «Отметить», и получатель увидит.'
                : 'Переведите по номеру или лично, потом нажмите «Отметить» — получатель увидит.'}
            </p>
          )}
          <div data-flip-list role="list">
            {debtGroups.map((g) => {
              const lead = g.key === focusGroupKey;
              const isStarted = groupStarted(g);
              const single = g.debts.length === 1 ? g.debts[0] : null;
              const markOne = g.pendingIds.length === 1 ? (g.debts.find((d) => d.id === g.pendingIds[0]) ?? null) : null;
              /* Отметка ведёт, когда перевод уже начат или начинать его
                 отсюда нечем. До этого она контурная: «Отметить» был самой
                 заметной кнопкой строки и читался как «заплатить». */
              const markLeads = lead && (isStarted || !hasPayPath(g.payTo));
              const live = g.debts.some((d) => liveChanges.has(liveKey.debt(d.id)));
              const marking = g.debts.filter((d) => markingIds.includes(d.id));
              const mark =
                marking.length > 0 ? (
                  <Button
                    variant="outline"
                    loading
                    aria-label={`Отметить все: ${g.name}, ${formatPrice(marking.reduce((sum, d) => sum + d.amount, 0))}`}
                  >
                    Отметить все
                  </Button>
                ) : g.pendingIds.length === 0 ? null : markOne ? (
                  <Button
                    variant={markLeads ? 'primary' : 'outline'}
                    loading={isBusy(markOne.id, 'mark')}
                    aria-label={`Отметить оплату: ${g.name}, ${formatPrice(markOne.amount)}`}
                    onClick={() => {
                      clearFailed([markOne.id]);
                      markPaid.mutate(markOne.id, {
                        onError: () => markFailed([markOne.id]),
                        onSettled: () => focusRow(`debtor:${g.key}`),
                      });
                    }}
                  >
                    Отметить
                  </Button>
                ) : (
                  <Button
                    variant={markLeads ? 'primary' : 'outline'}
                    aria-label={`Отметить все: ${g.name}, ${formatPrice(g.toTransfer)}`}
                    onClick={() => {
                      const items = g.debts
                        .filter((d) => d.status === 'PENDING')
                        .map((d) => ({ id: d.id, label: lineLabel(d) }));
                      clearFailed(items.map((i) => i.id));
                      markAllPaid.mutate(items, {
                        onSuccess: ({ failed }) => {
                          if (failed.length > 0) markFailed(failed.map((f) => f.id));
                        },
                        onSettled: () => focusRow(`debtor:${g.key}`),
                      });
                    }}
                  >
                    Отметить все
                  </Button>
                );
              /* Из банка человек возвращается сюда: строка напоминает, что
                 получатель узнает о переводе только по отметке. */
              const prompt =
                g.toTransfer > 0 && isStarted ? (
                  <p className={styles.transferPrompt} role="status">
                    Перевели? Отметьте оплату — {g.name} увидит.
                  </p>
                ) : null;
              const singleKey = single ? `debt:${single.id}` : '';
              const singlePanel = single ? `details-debt-${single.id}` : '';
              return (
                <div
                  key={g.key}
                  role="listitem"
                  tabIndex={-1}
                  data-flip={`debtor:${g.key}`}
                  className={`${liveClass(styles.row, live)} ${styles.rowWide}`}
                >
                  <div className={styles.avatar} aria-hidden>
                    {g.name[0].toUpperCase()}
                  </div>
                  <div className={styles.rowMain}>
                    <span className={styles.rowPerson}>
                      <span className={styles.rowName}>{g.name}</span>
                      {g.toTransfer === 0 && (
                        <Status tone="neutral" icon="clock">
                          Ждёт
                        </Status>
                      )}
                      {single?.status === 'PAID' && single.waiting && (
                        <span className={styles.rowPersonNote}>{waitingText(single.waiting)}</span>
                      )}
                    </span>
                    {single ? (
                      <Reference value={single.reference} />
                    ) : (
                      <span className={styles.rowRef}>
                        {g.toTransfer > 0 && g.awaiting > 0
                          ? `${g.pendingIds.length} из ${g.debts.length} к переводу`
                          : pluralize(g.debts.length, 'долг', 'долга', 'долгов')}
                      </span>
                    )}
                    {/* Сумма — главное на денежном экране: сколько переводить,
                        а когда всё отмечено — сколько ждёт подтверждения. */}
                    {/* Ждущее подтверждения — спокойнее долга: это уже не задача. */}
                    <span className={`tnum ${styles.rowAmount}${g.toTransfer > 0 ? '' : ` ${styles.rowAmountWaiting}`}`}>
                      {formatPrice(g.toTransfer > 0 ? g.toTransfer : g.awaiting)}
                    </span>
                    {single?.status === 'PENDING' && failedIds.has(single.id) && (
                      <span className={styles.markFailed}>Не отмечено — отметьте ещё раз</span>
                    )}
                    {/* Куда переводить — здесь, а не в чате с ботом: это
                        единственный момент, когда номер нужен. Без реквизитов
                        блок раньше просто пропадал, и было не понять, куда
                        платить. */}
                    {g.toTransfer > 0 &&
                      (g.payTo ? (
                        <PayTo
                          value={g.payTo}
                          name={g.name}
                          amount={g.toTransfer}
                          started={isStarted}
                          lead={lead}
                          onStart={() => startTransfer(g.pendingIds)}
                          mark={mark}
                          prompt={prompt}
                        />
                      ) : (
                        <>
                          <span className={styles.payToNote}>Реквизитов нет — спросите лично</span>
                          <span className={styles.actionBar}>{mark}</span>
                        </>
                      ))}
                    {single && (single.details.informative || single.status === 'PAID') && (
                      <span className={styles.rowLinks}>
                        {single.details.informative && (
                          <MoreToggle
                            open={expanded.has(singleKey)}
                            controls={singlePanel}
                            label={`${g.name}, ${formatPrice(single.amount)}`}
                            onToggle={() => toggle(singleKey, singlePanel)}
                          />
                        )}
                        {single.status === 'PAID' && (
                          <RowLink
                            label={`Отменить отметку: ${g.name}, ${formatPrice(single.amount)}`}
                            busy={isBusy(single.id, 'cancel')}
                            locked={markingIds.includes(single.id)}
                            onClick={() => cancelMark.mutate(single.id, { onSettled: () => focusRow(`debtor:${g.key}`) })}
                          >
                            Отменить отметку
                          </RowLink>
                        )}
                      </span>
                    )}
                    {/* Несколько долгов одному человеку — строки внутри карточки:
                        перевод и номер у них общие, а разбивка и отметка — свои. */}
                    {!single && (
                      <div className={styles.debtLines}>
                        {g.debts.map((d) => {
                          const key = `debt:${d.id}`;
                          const panelId = `details-debt-${d.id}`;
                          const open = expanded.has(key);
                          return (
                            <div key={d.id} className={styles.debtLine}>
                              <div className={styles.debtLineHead}>
                                <Reference value={d.reference} />
                                <span
                                  className={`tnum ${styles.debtLineAmount}${d.status === 'PAID' ? ` ${styles.rowAmountWaiting}` : ''}`}
                                >
                                  {formatPrice(d.amount)}
                                </span>
                              </div>
                              {d.status === 'PENDING' && failedIds.has(d.id) && (
                                <span className={styles.markFailed}>Не отмечено — отметьте ещё раз</span>
                              )}
                              {/* Чип «Ждёт» у строки — только если в карточке есть что
                                  переводить: иначе его уже говорит карточка, и четыре
                                  одинаковых чипа подряд были шумом. */}
                              {d.status === 'PAID' && (g.toTransfer > 0 || d.waiting) && (
                                <span className={styles.debtLineState}>
                                  {g.toTransfer > 0 && (
                                    <Status tone="neutral" icon="clock">
                                      Ждёт
                                    </Status>
                                  )}
                                  {d.waiting && <span className={styles.rowWaiting}>{waitingText(d.waiting)}</span>}
                                </span>
                              )}
                              {(d.details.informative || d.status === 'PAID' || g.pendingIds.length > 1) && (
                                <span className={styles.rowLinks}>
                                  {d.details.informative && (
                                    <MoreToggle
                                      open={open}
                                      controls={panelId}
                                      label={`${g.name}, ${formatPrice(d.amount)}`}
                                      onToggle={() => toggle(key, panelId)}
                                    />
                                  )}
                                  {d.status === 'PENDING' && g.pendingIds.length > 1 && (
                                    /* Кнопка, а не строчная ссылка: «Отметить» сообщает
                                       человеку о деньгах, «Подробнее» лишь раскрывает
                                       — выглядеть одинаково они не должны. */
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      icon="check"
                                      loading={isBusy(d.id, 'mark')}
                                      disabled={markingIds.includes(d.id)}
                                      aria-label={`Отметить оплату: ${g.name}, ${lineLabel(d)}`}
                                      className={styles.lineMark}
                                      onClick={() => {
                                        clearFailed([d.id]);
                                        markPaid.mutate(d.id, {
                                          onError: () => markFailed([d.id]),
                                          onSettled: () => focusRow(`debtor:${g.key}`),
                                        });
                                      }}
                                    >
                                      Отметить
                                    </Button>
                                  )}
                                  {d.status === 'PAID' && (
                                    <RowLink
                                      label={`Отменить отметку: ${g.name}, ${lineLabel(d)}`}
                                      busy={isBusy(d.id, 'cancel')}
                                      locked={markingIds.includes(d.id)}
                                      onClick={() => cancelMark.mutate(d.id, { onSettled: () => focusRow(`debtor:${g.key}`) })}
                                    >
                                      Отменить отметку
                                    </RowLink>
                                  )}
                                </span>
                              )}
                              {open && <Details id={panelId} value={d.details} />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Панель в DOM сразу за своей кнопкой: диктор читает разбивку
                      следующей. На экране она под строкой — это делает сетка. */}
                  {single && expanded.has(singleKey) && <Details id={singlePanel} value={single.details} />}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {vm.settledRecently && vm.myDebts.length === 0 && (
        <div className={styles.successLine}>
          <Seal sealRef={settledRef} />
          <div className={styles.successText}>
            <span className={styles.successTitle}>
              {vm.settled.count > 1 ? 'Долги закрыты' : vm.settled.count === 1 ? 'Долг закрыт' : 'Долгов нет'}
            </span>
            <span className={styles.successSub}>
              {vm.settled.count > 0
                ? `${namesLine(vm.settled.names)} · ${priceText(vm.settled.total)} · оплата подтверждена`
                : 'все оплаты подтверждены'}
            </span>
          </div>
        </div>
      )}

      {owedShown.length > 0 && (
        <section className={styles.group} aria-labelledby="budget-owed-heading">
          <div className={styles.groupHead}>
            <h2 id="budget-owed-heading" className={styles.groupTitle}>
              Вам должны
            </h2>
            {/* Денежный цвет — у пришедших денег: «0 ₽ из 390 ₽» зелёным
                читалось как уже собранная сумма. */}
            <span className={`tnum ${styles.groupTotal} ${styles.groupTotalOwed}`} role="status">
              <span className={vm.owedReceived > 0 ? styles.groupTotalReceived : undefined}>
                {formatPrice(vm.owedReceived)}
              </span>{' '}
              из {formatPrice(vm.owedExpected)}
            </span>
          </div>
          {/* Полоса — сразу под итогом, который она рисует: между ними стояли
              предупреждение и «Напомнить всем». */}
          <div
            className={styles.progress}
            role="progressbar"
            /* progressbar без имени — serious-нарушение (axe: aria-progressbar-name);
               aria-valuetext его не заменяет. */
            aria-label="Собрано от участников"
            aria-valuemin={0}
            aria-valuemax={vm.owedExpected}
            aria-valuenow={vm.owedReceived}
            aria-valuetext={`Получено ${formatPrice(vm.owedReceived)} из ${formatPrice(vm.owedExpected)}`}
          >
            <span
              className={styles.progressFill}
              style={{
                transform: `translateX(${(vm.owedExpected > 0 ? (vm.owedReceived / vm.owedExpected) * 100 : 0) - 100}%)`,
              }}
            />
          </div>
          {/* Пока кто-то ещё не перевёл, пустые реквизиты — причина, по которой
              он и не переведёт. Когда все отметили оплату, говорить поздно. */}
          {pendingDebtors.length > 0 && (
            <PaymentMissingNotice className={styles.paymentNotice}>
              Реквизитов нет — должники не знают, куда переводить.
            </PaymentMissingNotice>
          )}
          {/* Массовое напоминание — от двух должников: на одном оно ничего не
              экономит, а кнопку в шапку добавляет. Контурная, как «Напомнить»
              в строках. */}
          {remindable.length > 1 && (
            <div className={styles.groupAction}>
              <Button
                variant="outline"
                size="sm"
                icon="bell"
                loading={remindAll.isPending}
                onClick={() => setRemindingAll(true)}
              >
                Напомнить всем · {remindable.length}
              </Button>
            </div>
          )}
          <div data-flip-list role="list">
            {owedShown.map((c) => {
              const key = `credit:${c.id}`;
              const panelId = `details-credit-${c.id}`;
              const open = expanded.has(key);
              return (
                <div
                  key={c.id}
                  role="listitem"
                  tabIndex={-1}
                  data-flip={key}
                  className={rowClass(styles.row, liveChanges, liveKey.debt(c.id))}
                >
                  <div className={styles.avatar} aria-hidden>
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className={styles.rowMain}>
                    {/* Чип, а не фраза: «отметил оплату» вытесняла имя. «Отмечено»,
                        а не «Отметил»: чип стоял и у Марии. */}
                    <span className={styles.rowPerson}>
                      <span className={styles.rowName}>{c.name}</span>
                      {c.id === closingId ? (
                        <Stamped play>
                          <Status tone="success" icon="check">
                            Закрыт
                          </Status>
                        </Stamped>
                      ) : (
                        c.status === 'PAID' && (
                          <Status tone="neutral" icon="clock">
                            Отмечено
                          </Status>
                        )
                      )}
                    </span>
                    <Reference value={c.reference} />
                    <span className={`tnum ${styles.rowAmount}`}>{formatPrice(c.amount)}</span>
                    {/* Память о напоминаниях: без неё сборщик напоминает повторно,
                        не зная, что уже напоминал. У отмеченной оплаты она ни к
                        чему — напоминать больше не о чем. */}
                    {c.reminded && c.status === 'PENDING' && (
                      <span className={styles.rowWaiting}>
                        <Parts text={[c.reminded, c.remindAgain].filter(Boolean).join(' · ')} />
                      </span>
                    )}
                    {c.details.informative && (
                      <span className={styles.rowLinks}>
                        <MoreToggle
                          open={open}
                          controls={panelId}
                          label={`${c.name}, ${formatPrice(c.amount)}`}
                          onToggle={() => toggle(key, panelId)}
                        />
                      </span>
                    )}
                  </div>
                  {open && <Details id={panelId} value={c.details} />}
                  {/* Пока печатается «Закрыт», кнопки нет: штамп и есть ответ на
                      нажатие, а спиннер рядом спорил с ним. */}
                  {c.id === closingId ? (
                    /* Невидимое место под кнопку: без него подпись «за что»
                       раскладывалась шире, и строка прыгала посреди штампа. */
                    <Button variant="outline" className={`${styles.rowAction} ${styles.holdSpace}`} aria-hidden tabIndex={-1}>
                      Подтвердить
                    </Button>
                  ) : c.status === 'PAID' ? (
                    <Button
                      variant={c.id === focusCreditId ? 'primary' : 'outline'}
                      className={styles.rowAction}
                      loading={isBusy(c.id, 'confirm')}
                      aria-label={`Подтвердить: ${c.name}, ${formatPrice(c.amount)}`}
                      onClick={() => setConfirming(c)}
                    >
                      Подтвердить
                    </Button>
                  ) : c.canRemind ? (
                    /* Контурная, не серая: серая secondary читалась как
                       неактивная. И не сплошная: колонка сплошных «Напомнить»
                       прятала «Подтвердить», где нужно решение сборщика. */
                    <Button
                      variant="outline"
                      className={styles.rowAction}
                      loading={isBusy(c.id, 'remind')}
                      disabled={remindAll.isPending}
                      aria-label={`Напомнить: ${c.name}, ${formatPrice(c.amount)}`}
                      onClick={() => sendReminder.mutate(c.id)}
                    >
                      Напомнить
                    </Button>
                  ) : (
                    /* Пауза между напоминаниями — шесть часов, её держит сервер.
                       aria-disabled, а не disabled: кнопка остаётся в обходе с
                       клавиатуры, и диктор прочитает, что напоминание уже ушло. */
                    <Button
                      variant="outline"
                      className={`${styles.rowAction} is-disabled`}
                      aria-disabled="true"
                      aria-label={`Напомнили: ${c.name}, ${formatPrice(c.amount)}`}
                    >
                      Напомнили
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Итог цикла — первым после активных долгов, выше списка отмены: там
          его видели последним, если вообще видели. */}
      {vm.allCollected && owedShown.length === 0 && (
        <div className={styles.successLine}>
          <Seal sealRef={collectedRef} />
          <div className={styles.successText}>
            <span className={styles.successTitle}>Все рассчитались</span>
            <span className={styles.successSub}>
              {namesLine(vm.collectedNames)} · {priceText(vm.owedExpected)}
            </span>
          </div>
        </div>
      )}

      {/* Отмена промаха. Подтверждённое уходит из активных, и до этого блока
          исправить ошибочное подтверждение было нельзя вообще. Окно — сутки,
          хозяин правила сервер; здесь только показ. */}
      {undoableShown.length > 0 && (
        <section className={styles.group} aria-labelledby="budget-undo-heading">
          <div className={styles.groupHead}>
            <h2 id="budget-undo-heading" className={styles.groupTitle}>
              Подтверждено сегодня
            </h2>
          </div>
          <p className={styles.groupNote}>
            Если подтвердили по ошибке — отмените в течение суток. Участник получит уведомление.
          </p>
          <div data-flip-list role="list">
            {undoableShown.map((c) => {
              const key = `credit:${c.id}`;
              const panelId = `details-undo-${c.id}`;
              const open = expanded.has(key);
              return (
                <div
                  key={c.id}
                  role="listitem"
                  tabIndex={-1}
                  data-flip={key}
                  className={`${rowClass(styles.row, liveChanges, liveKey.debt(c.id))} ${styles.rowWide}`}
                >
                  <div className={styles.avatar} aria-hidden>
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className={styles.rowMain}>
                    <span className={styles.rowPerson}>
                      <span className={styles.rowName}>{c.name}</span>
                      <Stamped play={closedNow.has(c.id)}>
                        <Status tone="success" icon="check">
                          Закрыт
                        </Status>
                      </Stamped>
                    </span>
                    <Reference value={c.reference} />
                    <span className={`tnum ${styles.rowAmount}`}>{formatPrice(c.amount)}</span>
                    <span className={styles.rowLinks}>
                      {c.details.informative && (
                        <MoreToggle
                          open={open}
                          controls={panelId}
                          label={`${c.name}, ${formatPrice(c.amount)}`}
                          onToggle={() => toggle(key, panelId)}
                        />
                      )}
                      <RowLink
                        label={`Отменить подтверждение: ${c.name}, ${formatPrice(c.amount)}`}
                        busy={undoConfirmation.isPending && undoConfirmation.variables === c.id}
                        onClick={() => setUndoing(c)}
                      >
                        Отменить
                      </RowLink>
                    </span>
                  </div>
                  {open && <Details id={panelId} value={c.details} />}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {confirming && (
        <ConfirmDialog
          title="Подтвердить оплату?"
          /* За что долг — прямо в вопросе: в строке имя и блюдо могли быть
             обрезаны, а сверяют их с выпиской банка. Раньше здесь стояло
             «отменить нельзя» — после появления окна отмены это стало
             неправдой. Копия обязана совпадать с поведением. */
          description={`${confirming.name}, ${formatPrice(confirming.amount)}${referenceText(confirming.reference)}. Сначала проверьте, что перевод пришёл. Передумать можно в течение суток.`}
          confirmLabel="Подтвердить"
          pending={isBusy(confirming.id, 'confirm')}
          onConfirm={() => {
            const row = confirming;
            const id = row.id;
            const index = vm.owed.findIndex((c) => c.id === id);
            const next = vm.owed[index + 1]?.id ?? vm.owed[index - 1]?.id;
            setConfirming(null);
            /* «Закрыт» — только после «да» сервера: раньше чип и «Все
               рассчитались» появлялись до ответа и при отказе откатывались.
               Пока ждём, «Подтвердить» занята и держит фокус. */
            confirmPayment.mutate(id, {
              onSuccess: () => {
                /* Фокус сначала — на саму строку: она стоит на месте, пока
                   печатается «Закрыт». Дальше — когда оттиск осел. */
                focusRow(`credit:${id}`, `credit:${id}`);
                const moveOn = () => {
                  if (next != null) focusRow(`credit:${next}`, `credit:${id}`);
                  else window.requestAnimationFrame(() => focusRow(`credit:${id}`));
                };
                /* Где Штамп сыграть нельзя (нет WAAPI, reduced-motion), строка
                   переезжает сразу, а «Закрыт» печатается на новом месте. */
                if (!canStamp()) {
                  setClosedNow((prev) => new Set(prev).add(id));
                  moveOn();
                  return;
                }
                setClosing({ row, index });
                window.clearTimeout(closingTimer.current);
                closingTimer.current = window.setTimeout(() => {
                  setClosing(null);
                  moveOn();
                }, STAMP_MS);
              },
            });
          }}
          onCancel={() => setConfirming(null)}
        />
      )}

      {undoing && (
        <ConfirmDialog
          title="Отменить подтверждение?"
          /* Сервер возвращает долг в «отмечен», а не в «не оплачен»: отметку
             должника он не стирает, и обещать обратное было неправдой. */
          description={`${undoing.name} — ${formatPrice(undoing.amount)}. Долг снова будет ждать вашего подтверждения, участник получит уведомление.`}
          confirmLabel="Отменить подтверждение"
          cancelLabel="Оставить"
          destructive
          pending={undoConfirmation.isPending}
          onConfirm={() => {
            const id = undoing.id;
            setUndoing(null);
            undoConfirmation.mutate(id);
          }}
          onCancel={() => setUndoing(null)}
        />
      )}

      {remindingAll && (
        <ConfirmDialog
          title={`Напомнить ${pluralize(remindable.length, 'участнику', 'участникам', 'участникам')}?`}
          description={`${namesLine(remindable.map((c) => c.name))} получат сообщение в Telegram. Отменить отправку нельзя.`}
          confirmLabel="Напомнить всем"
          pending={remindAll.isPending}
          onConfirm={() => {
            setRemindingAll(false);
            remindEveryone();
          }}
          onCancel={() => setRemindingAll(false)}
        />
      )}
    </FlipGroup>
  );
}
