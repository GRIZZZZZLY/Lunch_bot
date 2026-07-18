/* CANCELLED — read-only история. Причина по cancellationKind (однозначно:
   ручной cancel из SHOPPING API не разрешает). История сгруппирована по
   участникам (как история запроса) на переиспользуемой read-only строке. */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { Button, EmptyState, InlineNotice, Status } from '@/shared/ui';
import type { StoreRunWithRelations } from '@/services/store-run.service';
import { cancellationKind, groupItemsByParticipant } from '../lib/selectors';
import { ReadOnlyShoppingItemRow } from '../components/ReadOnlyShoppingItemRow';
import styles from '../StoreRunPage.module.css';

export function CancelledView({
  run,
  currentUserId,
}: {
  run: StoreRunWithRelations;
  currentUserId: number | null;
}) {
  const navigate = useNavigate();
  const kind = cancellationKind(run);
  const items = run.items;

  const statusAction = useMemo(
    () => (
      <Status tone="danger" icon="ban">
        Отменено
      </Status>
    ),
    [],
  );
  useScreenHeader(run.storeName, statusAction);

  const groups = useMemo(
    () => groupItemsByParticipant(items, currentUserId),
    [items, currentUserId],
  );

  return (
    <div className={styles.screen}>
      <InlineNotice tone="warning">
        {kind === 'manual'
          ? 'Закупка отменена инициатором.'
          : 'Закупка отменена автоматически: расчёт не был завершён вовремя.'}
      </InlineNotice>

      {items.length === 0 ? (
        <EmptyState icon="cart" title="В закупке не было позиций" />
      ) : (
        groups.map((group) => (
          <section key={group.userId} className={styles.section}>
            <div className={styles.sectionHead}>
              {group.isMine ? 'Ваши позиции' : group.user?.firstName ?? 'Участник'}{' '}
              <span className={styles.sectionCount}>· {group.items.length}</span>
            </div>
            <div className={styles.rows}>
              {group.items.map((item) => (
                <ReadOnlyShoppingItemRow key={item.id} item={item} showOwner={false} requestedLabel="Запрошено" />
              ))}
            </div>
          </section>
        ))
      )}

      <div className={styles.endNav}>
        <Button variant="secondary" onClick={() => navigate('/')}>
          На главную
        </Button>
      </div>
    </div>
  );
}
