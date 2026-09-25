/* Расчёты (Phase 6b, система C). Полный сценарный цикл на сырых
   транзакциях: должник отмечает оплату и отменяет отметку, сборщик
   подтверждает оплату и напоминает. Две роли могут сосуществовать. */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import {
  useCancelMark,
  useConfirmPayment,
  useCredits,
  useDebts,
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
  type DebtDetails,
  type PayTo as PayToVM,
} from './lib/buildBudget';
import styles from './BudgetPage.module.css';

type BusyKind = 'mark' | 'cancel' | 'confirm' | 'remind';

/* Строка, изменившаяся по потоку, помечается на полторы секунды. Своё действие
   сюда не попадает: у него есть нажатие, спиннер и оптимистичное обновление. */
function rowClass(base: string, live: ReadonlySet<string>, key: string): string {
  return live.has(key) ? `${base} live-flash live-money is-live` : `${base} live-flash live-money`;
}

/**
 * Куда переводить. Раньше реквизиты существовали только в сообщении бота, и с
 * экрана оплаты заплатить было нельзя — приходилось выходить в чат и искать
 * нужное сообщение. Телефон СБП первым: это основной способ в продукте.
 *
 * Копирование — не обязательный путь: номер остаётся видимым текстом, поэтому
 * недоступный clipboard (небезопасный контекст) ничего не ломает.
 */
function PayTo({
  value,
  name,
  amount,
  started,
  lead,
  onStart,
}: {
  value: PayToVM;
  name: string;
  amount: number;
  /** Перевод уже начат: ведёт отметка, а не перевод. */
  started: boolean;
  /** Строка в фокусе секции: сплошная кнопка на экране одна. */
  lead: boolean;
  onStart: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  /* Ссылка главнее телефона: по ней плательщик попадает прямо в свой банк, а
     номер надо скопировать, переключиться в банк и вставить. Телефон при этом
     остаётся видимым — на случай, если ссылка не откроется. */
  const link = safeLinkOf(value);
  const item = value.phone ? { label: 'СБП', text: value.phone } : null;

  if (!item && !link) {
    return value.note ? <span className={styles.payToNote}>{value.note}</span> : null;
  }

  /* Скопированный номер — тоже начало перевода: дальше человек уходит в банк.
     Отмечаем сразу, не дожидаясь clipboard, — он бывает недоступен. */
  const copy = () => {
    if (!item) return;
    onStart();
    navigator.clipboard
      ?.writeText(item.text)
      .then(() => setCopied(item.text))
      .catch(() => undefined);
  };

  return (
    <span className={styles.payTo}>
      {/* Ведущая кнопка строки, пока перевод не начат: заметка над списком
          говорит «переведите сами», и самой заметной должна быть кнопка,
          которая переводит, а не та, что сообщает «уже перевёл». */}
      {link && (
        <Button
          variant={lead && !started ? 'primary' : 'outline'}
          iconRight="arrowRight"
          aria-label={`Перевести ${formatPrice(amount)}: ${name}`}
          /* openExternalLink, а не <a target="_blank">: внутри Mini App обычная
             вкладка открывается так, что вернуться в приложение нельзя. */
          onClick={() => {
            onStart();
            openExternalLink(link);
          }}
        >
          Перевести {formatPrice(amount)}
        </Button>
      )}
      {item && (
        <button
          type="button"
          className={styles.payToItem}
          aria-label={`Скопировать ${item.label}: ${item.text}`}
          onClick={copy}
        >
          <span className={styles.payToLabel}>{item.label}</span>
          <span className="tnum">{item.text}</span>
          <Icon name={copied ? 'check' : 'copy'} size={14} />
        </button>
      )}
      {/* Успех копирования нужно объявить: иконка меняется молча. */}
      <span className="sr-only" role="status">
        {copied ? 'Скопировано' : ''}
      </span>
    </span>
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
  onClick,
  children,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.more}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={onClick}
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
  const startTransfer = (id: number) =>
    setStarted((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
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
  const collectedRef = useStampOnArrival(vm.allCollected && vm.owed.length === 0, ready);

  /* Скелет повторяет строку — аватар, подпись, сумма, кнопка, — чтобы приход
     данных не перестраивал экран. */
  if (loading) {
    return (
      <div className={`rl ${styles.screen}`}>
        {showSkeleton && (
          <div className={styles.group}>
            <div className={styles.groupHead}>
              <Skeleton variant="text" width="30%" />
            </div>
            {[0, 1].map((i) => (
              <div key={i} className={styles.row}>
                <Skeleton variant="circle" width={40} className={styles.avatarSkeleton} />
                <div className={styles.rowMain}>
                  <Skeleton variant="text" width="45%" />
                  <Skeleton variant="text" width="30%" className={styles.skeletonGap} />
                </div>
                <Skeleton variant="block" width={112} height={44} className={styles.rowAction} />
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
     У должника ведёт последний начатый перевод, а если начатых нет — верхний
     неоплаченный долг. У сборщика — первая отмеченная оплата. */
  const pendingDebtIds = vm.myDebts.filter((d) => d.status === 'PENDING').map((d) => d.id);
  const focusDebtId =
    [...started].reverse().find((id) => pendingDebtIds.includes(id)) ?? pendingDebtIds[0];
  const focusCreditId = vm.owed.find((c) => c.status === 'PAID')?.id;

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
                с ним «600 ₽» после отметки звало переводить второй раз.
                Итог меняется после каждого действия — озвучиваем. */}
            {vm.myDebtToTransfer > 0 && (
              <span className={`tnum ${styles.groupTotal} ${styles.groupTotalOwed}`} role="status">
                <span className={styles.groupTotalLabel}>к переводу</span> {formatPrice(vm.myDebtToTransfer)}
              </span>
            )}
          </div>
          {vm.myDebtAwaiting > 0 && (
            <p className={styles.groupAwaiting} role="status">
              <Icon name="clock" size={14} />
              <span className="tnum">{`${formatPrice(vm.myDebtAwaiting)} ждёт подтверждения`}</span>
            </p>
          )}
          {/* Главное недоразумение экрана: человек нажимал «Оплатил» и уходил в
              уверенности, что рассчитался. Говорим прямо, один раз на секцию, —
              и только пока есть что переводить. */}
          {vm.myDebtToTransfer > 0 && (
            <p className={styles.groupNote}>
              Переведите деньги сами, а кнопкой сообщите об этом получателю —
              приложение денег не переводит.
            </p>
          )}
          <div data-flip-list role="list">
            {vm.myDebts.map((d) => {
              const key = `debt:${d.id}`;
              const panelId = `details-debt-${d.id}`;
              const open = expanded.has(key);
              const lead = d.id === focusDebtId;
              /* Отметка ведёт, когда перевод уже начат или начинать его
                 отсюда нечем. До этого она контурная: «Отметить» был самой
                 заметной кнопкой строки и читался как «заплатить». */
              const markLeads = lead && (started.has(d.id) || !hasPayPath(d.payTo));
              return (
                <div
                  key={d.id}
                  role="listitem"
                  data-flip={key}
                  className={rowClass(styles.row, liveChanges, liveKey.debt(d.id))}
                >
                  <div className={styles.avatar} aria-hidden>
                    {d.name[0].toUpperCase()}
                  </div>
                  <div className={styles.rowMain}>
                    {/* Сумма — главное на денежном экране, имя контрагента вторично.
                        Статус говорит чип у имени: текстовый дубль не нужен. */}
                    <span className={styles.rowPerson}>
                      <span className={styles.rowName}>{d.name}</span>
                      {d.status === 'PAID' && (
                        <Status tone="neutral" icon="clock">
                          Ждёт
                        </Status>
                      )}
                    </span>
                    <Reference value={d.reference} />
                    <span className={`tnum ${styles.rowAmount}`}>{formatPrice(d.amount)}</span>
                    {/* Куда переводить — здесь, а не в чате с ботом: это единственный
                        момент, когда номер нужен. Показываем до отметки; после неё
                        важнее, сколько уже ждём подтверждения. Без реквизитов блок
                        раньше просто пропадал, и было не понять, куда платить. */}
                    {d.status === 'PENDING' &&
                      (d.payTo ? (
                        <PayTo
                          value={d.payTo}
                          name={d.name}
                          amount={d.amount}
                          started={started.has(d.id)}
                          lead={lead}
                          onStart={() => startTransfer(d.id)}
                        />
                      ) : (
                        <span className={styles.payToNote}>Реквизитов нет — спросите лично</span>
                      ))}
                    {/* Из банка человек возвращается сюда: строка напоминает, что
                        получатель узнает о переводе только по отметке. */}
                    {d.status === 'PENDING' && started.has(d.id) && (
                      <p className={styles.transferPrompt} role="status">
                        Перевели? Отметьте оплату — {d.name} увидит.
                      </p>
                    )}
                    {/* Без слова «подтверждения»: его говорит чип «Ждёт». */}
                    {d.status === 'PAID' && d.waiting && (
                      <span className={styles.rowWaiting}>уже {d.waiting}</span>
                    )}
                    {(d.details.informative || d.status === 'PAID') && (
                      <span className={styles.rowLinks}>
                        {d.details.informative && (
                          <MoreToggle
                            open={open}
                            controls={panelId}
                            label={`${d.name}, ${formatPrice(d.amount)}`}
                            onToggle={() => toggle(key, panelId)}
                          />
                        )}
                        {d.status === 'PAID' && (
                          <RowLink
                            label={`Отменить отметку: ${d.name}, ${formatPrice(d.amount)}`}
                            busy={isBusy(d.id, 'cancel')}
                            onClick={() => cancelMark.mutate(d.id)}
                          >
                            Отменить отметку
                          </RowLink>
                        )}
                      </span>
                    )}
                  </div>
                  {/* Панель в DOM сразу за своей кнопкой: диктор читает разбивку
                      следующей, а не после кнопки действия. На экране она под
                      строкой — это делает сетка. */}
                  {open && <Details id={panelId} value={d.details} />}
                  {d.status === 'PENDING' && (
                    <Button
                      variant={markLeads ? 'primary' : 'outline'}
                      className={styles.rowAction}
                      loading={isBusy(d.id, 'mark')}
                      aria-label={`Отметить оплату: ${d.name}, ${formatPrice(d.amount)}`}
                      onClick={() => markPaid.mutate(d.id)}
                    >
                      Отметить
                    </Button>
                  )}
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
                ? `${namesLine(vm.settled.names)} · ${formatPrice(vm.settled.total)} · оплата подтверждена`
                : 'все оплаты подтверждены'}
            </span>
          </div>
        </div>
      )}

      {vm.owed.length > 0 && (
        <section className={styles.group} aria-labelledby="budget-owed-heading">
          <div className={styles.groupHead}>
            <h2 id="budget-owed-heading" className={styles.groupTitle}>
              Вам должны
            </h2>
            {/* Денежный цвет — у пришедших денег: «0 ₽ из 390 ₽» зелёным
                читалось как уже собранная сумма. */}
            <span
              className={`tnum ${styles.groupTotal}${vm.owedReceived === 0 ? ` ${styles.groupTotalOwed}` : ''}`}
              role="status"
            >
              {formatPrice(vm.owedReceived)} из {formatPrice(vm.owedExpected)}
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
            {vm.owed.map((c) => {
              const key = `credit:${c.id}`;
              const panelId = `details-credit-${c.id}`;
              const open = expanded.has(key);
              return (
                <div
                  key={c.id}
                  role="listitem"
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
                      {c.status === 'PAID' && (
                        <Status tone="neutral" icon="clock">
                          Отмечено
                        </Status>
                      )}
                    </span>
                    <Reference value={c.reference} />
                    <span className={`tnum ${styles.rowAmount}`}>{formatPrice(c.amount)}</span>
                    {/* Память о напоминаниях: без неё сборщик напоминает повторно,
                        не зная, что уже напоминал. У отмеченной оплаты она ни к
                        чему — напоминать больше не о чем. */}
                    {c.reminded && c.status === 'PENDING' && (
                      <span className={styles.rowWaiting}>
                        <Parts text={c.reminded} />
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
                  {c.status === 'PAID' ? (
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
      {vm.allCollected && vm.owed.length === 0 && (
        <div className={styles.successLine}>
          <Seal sealRef={collectedRef} />
          <div className={styles.successText}>
            <span className={styles.successTitle}>Все рассчитались</span>
            <span className={styles.successSub}>
              {namesLine(vm.collectedNames)} · {formatPrice(vm.owedExpected)}
            </span>
          </div>
        </div>
      )}

      {/* Отмена промаха. Подтверждённое уходит из активных, и до этого блока
          исправить ошибочное подтверждение было нельзя вообще. Окно — сутки,
          хозяин правила сервер; здесь только показ. */}
      {vm.undoable.length > 0 && (
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
            {vm.undoable.map((c) => {
              const key = `credit:${c.id}`;
              const panelId = `details-undo-${c.id}`;
              const open = expanded.has(key);
              return (
                <div
                  key={c.id}
                  role="listitem"
                  data-flip={key}
                  className={rowClass(styles.row, liveChanges, liveKey.debt(c.id))}
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
            const id = confirming.id;
            setConfirming(null);
            setClosedNow((prev) => new Set(prev).add(id));
            confirmPayment.mutate(id);
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
