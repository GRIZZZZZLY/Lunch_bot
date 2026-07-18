/* SETTLED — read-only итог. Role-aware summary на селекторах Phase 3B;
   breakdown считается на клиенте (API его не отдаёт). Никаких мутаций.
   «На главную» — вторичная кнопка в конце контента, не sticky. */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { Button, InlineNotice, Status } from '@/shared/ui';
import type { StoreRunWithRelations } from '@/services/store-run.service';
import {
  computeBreakdown,
  formatPrice,
  initiatorOwnTotal,
  isInitiator as isInitiatorOf,
  personalDebtTotal,
  purchasedTotal,
  receivableTotal,
} from '../lib/selectors';
import { ParticipantBreakdown } from '../components/ParticipantBreakdown';
import styles from '../StoreRunPage.module.css';

export function SettledView({
  run,
  currentUserId,
}: {
  run: StoreRunWithRelations;
  currentUserId: number | null;
}) {
  const navigate = useNavigate();
  const isInitiator = isInitiatorOf(run, currentUserId);
  const items = run.items;

  const statusAction = useMemo(
    () => (
      <Status tone="success" icon="check">
        Рассчитано
      </Status>
    ),
    [],
  );
  useScreenHeader(run.storeName, statusAction);

  const total = purchasedTotal(items);
  const receivable = receivableTotal(items, run.initiatorId);
  const own = initiatorOwnTotal(items, run.initiatorId);
  const myDebt = currentUserId != null ? personalDebtTotal(items, currentUserId, run.initiatorId) : 0;
  const breakdown = useMemo(() => computeBreakdown(items, run.initiatorId), [items, run.initiatorId]);

  return (
    <div className={styles.screen}>
      <div className={styles.summaryFigures}>
        {isInitiator ? (
          <>
            <div className={styles.figureMain}>
              Вам должны: <strong className="tnum">{formatPrice(receivable)}</strong>
            </div>
            <div className={styles.figureRow}>
              <span>Ваши покупки</span>
              <strong className="tnum">{formatPrice(own)}</strong>
            </div>
            <div className={styles.figureRow}>
              <span>Итого закупки</span>
              <strong className="tnum">{formatPrice(total)}</strong>
            </div>
          </>
        ) : (
          <>
            {myDebt > 0 ? (
              <div className={styles.figureMain}>
                Ваша часть: <strong className="tnum">{formatPrice(myDebt)}</strong>
              </div>
            ) : (
              <div className={styles.figureRow}>С вас ничего не требуется</div>
            )}
            <div className={styles.figureRow}>
              <span>Итого закупки</span>
              <strong className="tnum">{formatPrice(total)}</strong>
            </div>
          </>
        )}
      </div>

      {receivable > 0 ? (
        <InlineNotice tone="info">Расчёты созданы. Участники увидят суммы в Telegram.</InlineNotice>
      ) : (
        <InlineNotice tone="info">Дополнительные расчёты не требуются.</InlineNotice>
      )}

      {breakdown.length > 0 && (
        <ParticipantBreakdown entries={breakdown} currentUserId={currentUserId} />
      )}

      <div className={styles.endNav}>
        <Button variant="secondary" onClick={() => navigate('/')}>
          На главную
        </Button>
      </div>
    </div>
  );
}
