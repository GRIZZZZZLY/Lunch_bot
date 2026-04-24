import { useState } from 'react';
import { useAdminUsers, useToggleAdmin, useToggleActive } from '@/hooks/useAdmin';
import type { UserWithActivity } from '@/services/admin.service';

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
    <div className="card" style={cardStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>Пользователи ({users.length})</div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск"
          style={searchStyle}
        />
      </div>

      {isLoading && <div style={muted}>Загрузка…</div>}
      {!isLoading && filtered.length === 0 && <div style={muted}>Нет пользователей</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            onToggleAdmin={() =>
              toggleAdmin.mutate({ userId: u.id, isAdmin: !u.isAdmin })
            }
            onToggleActive={() =>
              toggleActive.mutate({ userId: u.id, isActive: !u.isActive })
            }
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
    <div style={rowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>
          {name}
          {user.username && <span style={muted}> @{user.username}</span>}
        </div>
        <div style={subStyle}>
          🗳 {user.totalVotes} · 💸 {user.pendingDebts} долгов
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={onToggleAdmin}
          style={{ ...btn, background: user.isAdmin ? '#FEE9B6' : '#EEE' }}
        >
          {user.isAdmin ? '⭐ Админ' : 'Сделать админом'}
        </button>
        <button
          onClick={onToggleActive}
          style={{ ...btn, background: user.isActive ? '#E5F3E5' : '#FCDADA' }}
        >
          {user.isActive ? 'Активен' : 'Заблок.'}
        </button>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surf-1, #fff)',
  borderRadius: 16,
  padding: 14,
  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
};
const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
  gap: 8,
};
const titleStyle: React.CSSProperties = { fontWeight: 700, fontSize: 15 };
const searchStyle: React.CSSProperties = {
  border: '1px solid var(--line-2, #eee)',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 13,
  outline: 'none',
};
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  background: 'var(--surf-2, #F7F7F9)',
  borderRadius: 10,
};
const btn: React.CSSProperties = {
  border: 'none',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
};
const muted: React.CSSProperties = { color: 'var(--ink-2, #888)', fontSize: 12 };
const subStyle: React.CSSProperties = { color: 'var(--ink-2, #888)', fontSize: 12, marginTop: 2 };
