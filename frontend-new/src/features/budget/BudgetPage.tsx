/* Бюджет команды (Phase 6b, система C). Полный сценарный цикл на сырых
   транзакциях: должник отмечает оплату и отменяет отметку, сборщик
   подтверждает оплату и напоминает. Две роли могут сосуществовать. */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { Button } from '@/components/rl/primitives';
import { pluralize } from '@/shared/lib/pluralize';
import { isSafePaymentLink } from '@/shared/lib/phone';
import { openExternalLink } from '@/lib/telegram';
import { formatPrice } from '@/features/store-run/lib/selectors';
import { Icon } from '@/components/rl/Icon';
import {
  buildBudget,
  type BudgetReference,
  type CreditLineVM,
  type PayTo as PayToVM,
} from './lib/buildBudget';
import styles from './BudgetPage.module.css';

type BusyKind = 'mark' | 'cancel' | 'confirm' | 'remind';

/**
 * Куда переводить. Раньше реквизиты существовали только в сообщении бота, и с
 * экрана оплаты заплатить было нельзя — приходилось выходить в чат и искать
 * нужное сообщение. Телефон СБП первым: это основной способ в продукте.
 *
 * Копирование — не обязательный путь: номер остаётся видимым текстом, поэтому
 * недоступный clipboard (небезопасный контекст) ничего не ломает.
 */
function PayTo({ value }: { value: PayToVM }) {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  /* Ссылка главнее телефона: по ней плательщик попадает прямо в свой банк, а
     номер надо скопировать, переключиться в банк и вставить. Телефон при этом
     остаётся видимым — на случай, если ссылка не откроется. */
  const link = isSafePaymentLink(value.link) ? value.link! : undefined;
  const item = value.phone ? { label: 'СБП', text: value.phone } : null;

  if (!item && !link) {
    return value.note ? <span className={styles.payToNote}>{value.note}</span> : null;
  }

  const copy = () => {
    if (!item) return;
    navigator.clipboard
      ?.writeText(item.text)
      .then(() => setCopied(item.text))
      .catch(() => undefined);
  };

  return (
    <span className={styles.payTo}>
      {link && (
        <button
          type="button"
          className={styles.payToLink}
          /* openExternalLink, а не <a target="_blank">: внутри Mini App обычная
             вкладка открывается так, что вернуться в приложение нельзя. */
          onClick={() => openExternalLink(link)}
        >
          <Icon name="arrowRight" size={14} />
          Перевести по ссылке
        </button>
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

/* За что и когда. Дата держит ширину, название сжимается: иначе длинное
   «Пятёрочка у офиса» съедало дату, а именно она различает два долга
   одному и тому же человеку. */
function Reference({ value }: { value: BudgetReference }) {
  if (!value.subject && !value.when) return null;

  /* Ссылкой, если источник известен: 180 ₽ за «Пятёрочку» без разбивки —
     это просьба поверить на слово. Тап-зона добирается до 44 px
     псевдоэлементом (идиома .chip::after), чтобы строка не разрослась. */
  if (value.href) {
    return (
      <Link to={value.href} className={`${styles.rowRef} ${styles.rowRefLink}`}>
        {value.subject && <span className={styles.rowRefSubject}>{value.subject}</span>}
        {value.subject && value.when ? ' ' : null}
        {value.when && <span className={styles.rowRefWhen}>{value.when}</span>}
      </Link>
    );
  }

  return (
    <span className={styles.rowRef}>
      {value.subject && <span className={styles.rowRefSubject}>{value.subject}</span>}
      {/* Настоящий пробел, а не только flex-gap: видимую точку рисует CSS, и без
          этого узла текст строки склеивался бы в «Паста карбонара14 июля».
          Во flex-контейнере узел из одних пробелов элементом не становится,
          поэтому на вёрстку он не влияет. */}
      {value.subject && value.when ? ' ' : null}
      {value.when && <span className={styles.rowRefWhen}>{value.when}</span>}
    </span>
  );
}

export function BudgetPage() {
  useScreenHeader('Бюджет команды');
  /* Живой поток вместо двух опросов по 15 с. Опрос остаётся страховкой: пока
     поток не подтвердил соединение, запросы идут как раньше. */
  const streamStatus = useMoneyStream();
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

  /* Подтверждение необратимо: CONFIRMED нельзя отменить ни в интерфейсе, ни в
     API. Промах в списке из восьми человек закрывал чужой долг навсегда, а
     защита стояла на обратимом действии должника. */
  const [confirming, setConfirming] = useState<CreditLineVM | null>(null);
  const [remindingAll, setRemindingAll] = useState(false);
  const [undoing, setUndoing] = useState<CreditLineVM | null>(null);
  const pendingDebtors = vm.owed.filter((c) => c.status === 'PENDING');
  const remindEveryone = () => remindAll.mutate(pendingDebtors.map((c) => c.id));

  if (debtsQuery.isLoading || creditsQuery.isLoading) {
    return (
      <div className={`rl ${styles.screen}`}>
        <div className={styles.group} style={{ padding: 16 }}>
          <Skeleton variant="text" width="40%" />
          <div style={{ height: 12 }} />
          <Skeleton variant="block" height={56} />
        </div>
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

  return (
    <div className={`rl ${styles.screen}`}>
      {vm.myDebts.length > 0 && (
        <section className={styles.group} aria-labelledby="budget-debts-heading">
          <div className={styles.groupHead}>
            <h2 id="budget-debts-heading" className={styles.groupTitle}>
              Мои долги
            </h2>
            {/* Кнопка называется «Отметить», а не «Оплатил»: она ничего не
                переводит, и прошедшее время читалось как «уже списано».
                Инфинитив заодно снимает вопрос рода. */}
            {/* Итог меняется после каждого действия — озвучиваем. */}
            <span className={`tnum ${styles.groupTotal}`} role="status">
              {formatPrice(vm.myDebtTotal)}
            </span>
          </div>
          {/* Главное недоразумение экрана: человек нажимал «Оплатил» и уходил в
              уверенности, что рассчитался. Говорим прямо, один раз на секцию. */}
          <p className={styles.groupNote}>
            Переведите деньги сами, а кнопкой сообщите об этом получателю —
            приложение денег не переводит.
          </p>
          {vm.myDebts.map((d) => (
            <div key={d.id} className={styles.row}>
              <div className={styles.avatar} aria-hidden>
                {d.name[0].toUpperCase()}
              </div>
              <div className={styles.rowMain}>
                {/* Сумма — главное на денежном экране, имя контрагента вторично.
                    Статус говорит чип у имени: и текстовый дубль не нужен, и
                    зона действия остаётся под одну кнопку — строка не переносится. */}
                <span className={styles.rowPerson}>
                  <span className={styles.rowName}>{d.name}</span>
                  {d.status === 'PAID' && <Status tone="warning">Ждёт</Status>}
                </span>
                <Reference value={d.reference} />
                <span className={`tnum ${styles.rowAmount}`}>{formatPrice(d.amount)}</span>
                {/* Куда переводить — здесь, а не в чате с ботом: это единственный
                    момент, когда номер нужен. Показываем до отметки; после неё
                    важнее, сколько уже ждём подтверждения. */}
                {d.status === 'PENDING' && d.payTo && <PayTo value={d.payTo} />}
                {/* Без слова «подтверждения»: его говорит чип «Ждёт», а полная
                    фраза не влезала в ширину и обрезалась. */}
                {d.status === 'PAID' && d.waiting && (
                  <span className={styles.rowWaiting}>уже {d.waiting}</span>
                )}
              </div>
              {d.status === 'PENDING' ? (
                <Button
                  variant="primary"
                  loading={isBusy(d.id, 'mark')}
                  aria-label={`Отметить оплату: ${d.name}, ${formatPrice(d.amount)}`}
                  onClick={() => markPaid.mutate(d.id)}
                >
                  Отметить
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  loading={isBusy(d.id, 'cancel')}
                  aria-label={`Отменить отметку: ${d.name}, ${formatPrice(d.amount)}`}
                  onClick={() => cancelMark.mutate(d.id)}
                >
                  Отменить отметку
                </Button>
              )}
            </div>
          ))}
        </section>
      )}

      {vm.settledRecently && vm.myDebts.length === 0 && (
        <div className={styles.successLine}>
          <div className={styles.successText}>
            <span className={styles.successTitle}>Долг закрыт</span>
            <span className={styles.successSub}>оплата подтверждена сборщиком</span>
          </div>
          <Status tone="success">оплачено</Status>
        </div>
      )}

      {vm.owed.length > 0 && (
        <section className={styles.group} aria-labelledby="budget-owed-heading">
          <div className={styles.groupHead}>
            <h2 id="budget-owed-heading" className={styles.groupTitle}>
              Вам должны
            </h2>
            <span className={`tnum ${styles.groupTotal}`} role="status">
              {formatPrice(vm.owedReceived)} из {formatPrice(vm.owedExpected)}
            </span>
          </div>
          {/* Массовое напоминание — от двух должников: на одном оно ничего не
              экономит, а кнопку в шапку добавляет. */}
          {pendingDebtors.length > 1 && (
            <div className={styles.groupAction}>
              <Button
                variant="secondary"
                size="sm"
                icon="bell"
                loading={remindAll.isPending}
                onClick={() => setRemindingAll(true)}
              >
                Напомнить всем · {pendingDebtors.length}
              </Button>
            </div>
          )}
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
              style={{ width: `${vm.owedExpected > 0 ? (vm.owedReceived / vm.owedExpected) * 100 : 0}%` }}
            />
          </div>
          {vm.owed.map((c) => (
            <div key={c.id} className={styles.row}>
              <div className={styles.avatar} aria-hidden>
                {c.name[0].toUpperCase()}
              </div>
              <div className={styles.rowMain}>
                {/* Чип, а не фраза: «отметил оплату» занимала ~110 px и вытесняла
                    имя до «М…» — на 390 px было не видно, чей платёж
                    подтверждаешь. Заодно строка стала как в «Моих долгах». */}
                <span className={styles.rowPerson}>
                  <span className={styles.rowName}>{c.name}</span>
                  {c.status === 'PAID' && <Status tone="warning">Отметил</Status>}
                </span>
                <Reference value={c.reference} />
                <span className={`tnum ${styles.rowAmount}`}>{formatPrice(c.amount)}</span>
                {/* Память о напоминаниях: без неё сборщик напоминает повторно,
                    не зная, что уже напоминал. */}
                {c.reminded && <span className={styles.rowWaiting}>{c.reminded}</span>}
              </div>
              {c.status === 'PAID' ? (
                <Button
                  variant="primary"
                  loading={isBusy(c.id, 'confirm')}
                  aria-label={`Подтвердить: ${c.name}, ${formatPrice(c.amount)}`}
                  onClick={() => setConfirming(c)}
                >
                  Подтвердить
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  loading={isBusy(c.id, 'remind')}
                  aria-label={`Напомнить: ${c.name}, ${formatPrice(c.amount)}`}
                  onClick={() => sendReminder.mutate(c.id)}
                >
                  Напомнить
                </Button>
              )}
            </div>
          ))}
        </section>
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
          {vm.undoable.map((c) => (
            <div key={c.id} className={styles.row}>
              <div className={styles.avatar} aria-hidden>
                {c.name[0].toUpperCase()}
              </div>
              <div className={styles.rowMain}>
                <span className={styles.rowPerson}>
                  <span className={styles.rowName}>{c.name}</span>
                  <Status tone="success">Закрыт</Status>
                </span>
                <Reference value={c.reference} />
                <span className={`tnum ${styles.rowAmount}`}>{formatPrice(c.amount)}</span>
              </div>
              <Button
                variant="ghost"
                loading={undoConfirmation.isPending && undoConfirmation.variables === c.id}
                aria-label={`Отменить подтверждение: ${c.name}, ${formatPrice(c.amount)}`}
                onClick={() => setUndoing(c)}
              >
                Отменить
              </Button>
            </div>
          ))}
        </section>
      )}

      {vm.allCollected && vm.owed.length === 0 && (
        <div className={styles.successLine}>
          <div className={styles.successText}>
            <span className={styles.successTitle}>Все рассчитались</span>
            <span className={styles.successSub}>
              {pluralize(vm.owedCount, 'участник', 'участника', 'участников')} · {formatPrice(vm.owedExpected)}
            </span>
          </div>
          <Status tone="success">закрыто</Status>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title="Подтвердить оплату?"
          /* Раньше здесь стояло «отменить нельзя» — после появления окна отмены
             это стало неправдой. Копия обязана совпадать с поведением. */
          description={`${confirming.name} — ${formatPrice(confirming.amount)}. Долг закроется. Передумать можно в течение суток.`}
          confirmLabel="Подтвердить"
          pending={isBusy(confirming.id, 'confirm')}
          onConfirm={() => {
            const id = confirming.id;
            setConfirming(null);
            confirmPayment.mutate(id);
          }}
          onCancel={() => setConfirming(null)}
        />
      )}

      {undoing && (
        <ConfirmDialog
          title="Отменить подтверждение?"
          description={`Долг ${undoing.name} на ${formatPrice(undoing.amount)} снова станет неоплаченным, участник получит уведомление.`}
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
          title={`Напомнить ${pluralize(pendingDebtors.length, 'участнику', 'участникам', 'участникам')}?`}
          description="Каждый получит сообщение в Telegram. Отменить отправку нельзя."
          confirmLabel="Напомнить всем"
          pending={sendReminder.isPending}
          onConfirm={() => {
            setRemindingAll(false);
            remindEveryone();
          }}
          onCancel={() => setRemindingAll(false)}
        />
      )}
    </div>
  );
}
