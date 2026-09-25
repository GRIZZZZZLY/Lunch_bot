/* Секция «Сейчас»: победитель последнего голосования, активные закупки,
   компактная строка бюджета, кнопка «Закупка в магазине» (FAB удалён).

   Карточка носит ту же анатомию билета, что и талон: перфорация с боковыми
   вырезами отделяет содержимое от корешка, корешок — единственное действие
   секции. Два блока главной читаются как два талона одной книжки, а не как
   талон и произвольная карточка. */
import type { ReactNode } from 'react';
import { Status, type StatusTone } from '@/shared/ui';
import { Button } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';
import { formatPrice } from '@/features/store-run/lib/selectors';
import type { StoreRunListItem } from '@/services/store-run.service';
import { plural, pluralItems, type BudgetRowModel } from '../lib/selectors';
import styles from '../HomePage.module.css';

/* Домен закупки говорит шафраном (--shop), расчёт — щавелем (--money):
   статус голосования на этом же экране носит терракоту и не сливается. */
const RUN_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  COLLECTING: { tone: 'shop', label: 'Сбор' },
  SHOPPING: { tone: 'shop', label: 'В магазине' },
  SETTLED: { tone: 'money', label: 'Рассчитано' },
  CANCELLED: { tone: 'danger', label: 'Отменено' },
};

/* Стрелка перехода, как у строки победителя: без неё строки «Сейчас», ведущие
   на другой экран, не отличались от подписей. */
function RowChevron() {
  return (
    <span className={styles.rowSub} aria-hidden>
      <Icon name="chevronRight" size={16} />
    </span>
  );
}

function BudgetMain({ budget }: { budget: Exclude<BudgetRowModel, { kind: 'hidden' }> }) {
  return (
    <>
      <span className={`${styles.rowIcon} ${styles.money}`} aria-hidden>
        <Icon name="wallet" size={18} />
      </span>
      <span className={styles.rowMain}>
        <span className={styles.rowName}>Расчёты</span>
        <span className={styles.rowSub}>
          {/* «К переводу», как в «Расчётах». Без «за обед»: долг бывает и
              за магазин. */}
          {budget.kind === 'debt' &&
            (budget.payableCount > 1 ? (
              <>
                К переводу ·{' '}
                <span className="tnum">{plural(budget.payableCount, 'долг', 'долга', 'долгов')}</span>
              </>
            ) : (
              'К переводу'
            ))}
          {budget.kind === 'awaiting' && 'Оплата ждёт подтверждения'}
          {/* Отмеченные оплаты — первым: это задача сборщика, а «вам должны»
              и «получено» — только сводка. */}
          {budget.kind === 'collector' &&
            (budget.toConfirm > 0 ? (
              <span className={styles.rowSubTask}>
                {plural(budget.toConfirm, 'оплата ждёт', 'оплаты ждут', 'оплат ждут')} подтверждения
              </span>
            ) : budget.confirmed > 0 ? (
              <>
                Вам должны участники · получено{' '}
                <span className="tnum">{formatPrice(budget.confirmed)}</span>
              </>
            ) : (
              'Вам должны участники'
            ))}
        </span>
      </span>
    </>
  );
}

export function NowSection({
  winner,
  runs,
  budget,
  onOpenRun,
  onOpenBudget,
  onNewRun,
}: {
  winner: ReactNode;
  runs: StoreRunListItem[];
  budget: BudgetRowModel;
  onOpenRun: (id: number) => void;
  onOpenBudget: () => void;
  onNewRun: () => void;
}) {
  const hasContent = winner != null || runs.length > 0 || budget.kind !== 'hidden';

  return (
    <section className={styles.group} aria-labelledby="now-heading">
      <div className={styles.groupHead}>
        <h2 id="now-heading" className={styles.kicker}>
          Сейчас
        </h2>
      </div>

      {winner}

      {runs.map((r) => {
        const st = RUN_STATUS[r.status] ?? { tone: 'neutral' as const, label: r.status };
        return (
          <button
            key={r.id}
            type="button"
            className={`${styles.row} ${styles.tappable}`}
            onClick={() => onOpenRun(r.id)}
          >
            <span className={`${styles.rowIcon} ${styles.shop}`} aria-hidden>
              <Icon name="cart" size={18} />
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowName}>{r.storeName}</span>
              <span className={styles.rowSub}>
                {r.initiator.firstName} ·{' '}
                <span className={`tnum ${styles.prog}`}>{pluralItems(r.items.length)}</span>
              </span>
            </span>
            <Status tone={st.tone}>{st.label}</Status>
            <RowChevron />
          </button>
        );
      })}

      {/* Строка целиком — одна кнопка в «Расчёты», как строки закупок и
          победителя. Кнопки «Отметить · 260 ₽» здесь больше нет: она отмечала
          долг одним касанием, а реквизитов на экране не было, и человек
          отмечал, не переведя денег. Отметка живёт в «Расчётах», рядом с тем,
          куда переводить. */}
      {budget.kind !== 'hidden' && (
        <button type="button" className={`${styles.row} ${styles.tappable}`} onClick={onOpenBudget}>
          <BudgetMain budget={budget} />
          {/* Свой долг — нейтральным, как итог «Мои долги»: зелёный у суммы,
              которую вы должны, читался как плюс на счёте. */}
          <span className={`tnum ${styles.moneyVal}${budget.kind === 'debt' ? ` ${styles.moneyValOwed}` : ''}`}>
            {formatPrice(budget.amount)}
          </span>
          <RowChevron />
        </button>
      )}

      {!hasContent && (
        <div className={styles.row}>
          <span className={styles.rowSub}>Пока тихо — ни закупок, ни долгов.</span>
        </div>
      )}

      <div className={styles.perf}>
        <span className={styles.notch} />
      </div>

      {/* Корешок секции. Подложка светлая (та же, что у CTA талона): кнопка
          отрывается вместе с корешком, и прозрачный ghost на этом месте читался
          как подпись, а не как действие. Плата за это — вторая заметная кнопка
          на экране; кегль и вес держат её ниже «Запустить голосование». */}
      <div className={styles.ctaWrap}>
        {/* Иконка корзины отделяет корешок от CTA талона: две одинаковые
            заливки подряд иначе различаются только текстом. */}
        <Button className={styles.stubCta} icon="cart" block onClick={onNewRun}>
          Закупка в магазине
        </Button>
      </div>
    </section>
  );
}
