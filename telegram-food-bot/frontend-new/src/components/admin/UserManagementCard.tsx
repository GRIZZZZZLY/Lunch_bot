import { useState, type ChangeEvent } from 'react';
import { useAdminUsers, useToggleAdmin, useToggleActive } from '@/hooks/useAdmin';
import type { UserWithActivity } from '@/services/admin.service';
import { Button, Field } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';

export function UserManagementCard() {
  const { data: users = [], isLoading } = useAdminUsers();
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
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div className="font-head" style={{ fontWeight: 700, fontSize: 'var(--t-16)' }}>
          Пользователи <span className="tnum" style={{ color: 'var(--text-tertiary)' }}>{users.length}</span>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Field value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Поиск участника" />
      </div>

      {isLoading && <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--t-13)' }}>Загрузка…</div>}
      {!isLoading && filtered.length === 0 && <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--t-13)' }}>Нет пользователей</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            onToggleAdmin={() => toggleAdmin.mutate({ userId: u.id, isAdmin: !u.isAdmin })}
            onToggleActive={() => toggleActive.mutate({ userId: u.id, isActive: !u.isActive })}
          />
        ))}
      </div>
    </div>
  );
}

function UserRow({
  user,
  onToggleAdmin,
  onToggleActive,
}: {
  user: UserWithActivity;
  onToggleAdmin: () => void;
  onToggleActive: () => void;
}) {
  const name = user.firstName + (user.lastName ? ' ' + user.lastName : '');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--r-block)', background: 'var(--bg-base)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--t-15)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
          {user.username && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> @{user.username}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, fontSize: 'var(--t-11)', color: 'var(--text-tertiary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Icon name="stats" size={12} /> <span className="tnum">{user.totalVotes}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Icon name="wallet" size={12} /> <span className="tnum">{user.pendingDebts}</span> долгов
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button size="sm" variant={user.isAdmin ? 'success' : 'secondary'} icon="crown" onClick={onToggleAdmin}>
          {user.isAdmin ? 'Админ' : 'Сделать'}
        </Button>
        <Button size="sm" variant={user.isActive ? 'ghost' : 'danger'} onClick={onToggleActive}>
          {user.isActive ? 'Активен' : 'Заблок.'}
        </Button>
      </div>
    </div>
  );
}
