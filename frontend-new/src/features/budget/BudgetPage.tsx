/* Бюджет команды (Phase 6b, система C). Полный сценарный цикл на сырых
   транзакциях: должник отмечает оплату и отменяет отметку, сборщик
   подтверждает оплату и напоминает. Две роли могут сосуществовать. */
import { useMemo } from 'react';
import {
  useCancelMark,
  useConfirmPayment,
  useCredits,
  useDebts,
  useMarkPaid,
  useSendReminder,
} from '@/hooks/useBudget';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { EmptyState, ErrorState, Skeleton, Status } from '@/shared/ui';
import { Button } from '@/components/rl/primitives';
import { pluralize } from '@/shared/lib/pluralize';
import { formatPrice } from '@/features/store-run/lib/selectors';
import { buildBudget } from './lib/buildBudget';
import styles from './BudgetPage.module.css';

type BusyKind = 'mark' | 'cancel' | 'confirm' | 'remind';

export function BudgetPage() {
  useScreenHeader('Бюджет команды');
  const debtsQuery = useDebts();
  const creditsQuery = useCredits();
  const markPaid = useMarkPaid();
  const cancelMark = useCancelMark();
  const confirmPayment = useConfirmPayment();
  const sendReminder = useSendReminder();

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
            {/* Итог меняется после каждого действия — озвучиваем. */}
            <span className={`tnum ${styles.groupTotal}`} role="status">
              {formatPrice(vm.myDebtTotal)}
            </span>
          </div>
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
                <span className={`tnum ${styles.rowAmount}`}>{formatPrice(d.amount)}</span>
              </div>
              {d.status === 'PENDING' ? (
                <Button
                  variant="primary"
                  loading={isBusy(d.id, 'mark')}
                  aria-label={`Оплатил: ${d.name}, ${formatPrice(d.amount)}`}
                  onClick={() => markPaid.mutate(d.id)}
                >
                  Оплатил
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
                <span className={`tnum ${styles.rowAmount}`}>{formatPrice(c.amount)}</span>
              </div>
              {c.status === 'PAID' ? (
                <Button
                  variant="primary"
                  loading={isBusy(c.id, 'confirm')}
                  aria-label={`Подтвердить: ${c.name}, ${formatPrice(c.amount)}`}
                  onClick={() => confirmPayment.mutate(c.id)}
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
    </div>
  );
}
