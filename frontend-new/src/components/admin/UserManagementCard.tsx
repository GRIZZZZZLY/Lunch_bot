import { useState, type ChangeEvent } from 'react';
import { useAdminUsers, useToggleAdmin, useToggleActive } from '@/hooks/useAdmin';
import type { UserWithActivity } from '@/services/admin.service';
import { Button, Field } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';
import { InlineNotice } from '@/shared/ui';
import { formatPrice } from '@/features/store-run/lib/selectors';
import { pluralize } from '@/shared/lib/pluralize';
import styles from './AdminCards.module.css';

export function UserManagementCard() {
  const { data: users = [], isLoading, isError, refetch } = useAdminUsers();
  const toggleAdmin = useToggleAdmin();
  const toggleActive = useToggleActive();
  const [search, setSearch] = useState('');

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.firstName.toLowerCase().includes(q) ||
      (u.username ?? '').toLowerCase().includes(q) ||
      u.telegramId.includes(q)
    );
  });

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          Пользователи{' '}
          {!isError && <span className={`tnum ${styles.muted}`}>{isLoading ? '—' : users.length}</span>}
        </h2>
      </div>

      {/* Отказ чтения раньше выглядел как «Нет пользователей» — то есть как
          факт про группу, а не как несостоявшийся запрос. */}
      {isError ? (
        <InlineNotice tone="critical">
          Не удалось загрузить участников.{' '}
          <button type="button" className={styles.retry} onClick={() => refetch()}>
            Повторить
          </button>
        </InlineNotice>
      ) : (
        <>
          <div className={styles.field}>
            <Field
              aria-label="Поиск участника"
              value={search}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="Поиск участника"
            />
          </div>

          {isLoading && <p className={styles.muted}>Загрузка…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className={styles.muted}>
              {search.trim() ? 'Никого не нашлось по запросу' : 'В группе пока нет участников'}
            </p>
          )}

          <div>
            {filtered.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                busyAdmin={toggleAdmin.isPending && toggleAdmin.variables?.userId === u.id}
                busyActive={toggleActive.isPending && toggleActive.variables?.userId === u.id}
                onToggleAdmin={() => toggleAdmin.mutate({ userId: u.id, isAdmin: !u.isAdmin })}
                onToggleActive={() => toggleActive.mutate({ userId: u.id, isActive: !u.isActive })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UserRow({
  user,
  busyAdmin,
  busyActive,
  onToggleAdmin,
  onToggleActive,
}: {
  user: UserWithActivity;
  busyAdmin: boolean;
  busyActive: boolean;
  onToggleAdmin: () => void;
  onToggleActive: () => void;
}) {
  const name = user.firstName + (user.lastName ? ' ' + user.lastName : '');
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowName}>
          {name}
          {user.username && <span className={styles.muted}> @{user.username}</span>}
        </span>
        <span className={styles.rowSub}>
          <Icon name="stats" size={12} />{' '}
          <span className="tnum">{pluralize(user.totalVotes, 'голос', 'голоса', 'голосов')}</span>
          {' · '}
          {/* pendingDebts — это СУММА, а подписана была «долгов»: человек с
              долгом 420 ₽ показывался как «420 долгов». */}
          <Icon name="wallet" size={12} /> <span className="tnum">долг {formatPrice(user.pendingDebts)}</span>
        </span>
      </div>
      <div className={styles.rowActions}>
        {/* Подписи говорят, что произойдёт по нажатию, а не в каком человек
            состоянии: кнопка «Активен» блокировала участника. */}
        <Button
          size="sm"
          variant={user.isAdmin ? 'success' : 'secondary'}
          icon="crown"
          loading={busyAdmin}
          aria-label={user.isAdmin ? `Снять админа: ${name}` : `Сделать админом: ${name}`}
          onClick={onToggleAdmin}
        >
          {user.isAdmin ? 'Снять' : 'Админ'}
        </Button>
        <Button
          size="sm"
          variant={user.isActive ? 'ghost' : 'danger'}
          loading={busyActive}
          aria-label={user.isActive ? `Заблокировать: ${name}` : `Разблокировать: ${name}`}
          onClick={onToggleActive}
        >
          {user.isActive ? 'Блок' : 'Вернуть'}
        </Button>
      </div>
    </div>
  );
}
