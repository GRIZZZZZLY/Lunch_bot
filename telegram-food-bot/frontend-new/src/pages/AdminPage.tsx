import { useMemo, useState } from 'react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { CreatePollSheet } from '@/components/admin/CreatePollSheet';
import { SuccessSheet } from '@/components/admin/SuccessSheet';
import { UserManagementCard } from '@/components/admin/UserManagementCard';
import { DebtManagementCard } from '@/components/admin/DebtManagementCard';
import { DataCleanupCard } from '@/components/admin/DataCleanupCard';
import { ReminderSettingsCard } from '@/components/admin/ReminderSettingsCard';
import { useAuth } from '@/hooks/useAuth';
import type { CreatePollContext, CreatePollFormState } from '@/components/admin/types';
import { useActivePolls } from '@/hooks/usePolls';
import { usePollHistory } from '@/hooks/useUser';
import { useMenuItems } from '@/hooks/useMenu';
import { useAppStore } from '@/store/useAppStore';
import { buildDashboard, mapMenuToOptions } from '@/lib/adminMappers';
import { pollsService } from '@/services/polls.service';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';

export function AdminPage() {
  const groupId = useAppStore((s) => s.currentGroupId);
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const [tab, setTab] = useState<'dashboard' | 'users' | 'debts' | 'cleanup' | 'settings'>('dashboard');
  const { data: activePolls = [] } = useActivePolls();
  const { data: history = [] } = usePollHistory({ limit: 60 });
  const { data: menuItems = [] } = useMenuItems({ activeOnly: true });
  const qc = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ participants: number; closeAt: string } | null>(null);

  const data = useMemo(
    () => buildDashboard({ activePolls, history, menuCount: menuItems.length }),
    [activePolls, history, menuItems],
  );

  const ctx: CreatePollContext = useMemo(
    () => ({
      items: mapMenuToOptions(menuItems),
      minItems: 2,
      maxItems: 10,
      audiences: [
        { key: 'all', label: 'Все', sub: 'группа целиком' },
        { key: 'regulars', label: 'Только постоянные', sub: 'скоро' },
        { key: 'manual', label: 'Выбрать вручную', sub: 'скоро' },
      ],
    }),
    [menuItems],
  );

  const handleQuickAction = (id: string) => {
    if (id === 'create-poll') setSheetOpen(true);
  };

  const handleSubmit = async (form: CreatePollFormState) => {
    if (!groupId) {
      console.warn('[AdminPage] No currentGroupId set; cannot create poll');
      return;
    }
    setSubmitting(true);
    try {
      const duration = form.duration === '15m' ? 15 : form.duration === '1h' ? 60 : 30;
      await pollsService.createFromWebapp({
        groupId,
        duration,
        selectedMenuItems: form.selectedItems.map((id) => Number(id)).filter(Number.isFinite),
        title: form.title.trim() || undefined,
        isMultiSelect: true,
        maxSelections: 3,
      });
      qc.invalidateQueries({ queryKey: queryKeys.polls.active });
      setLastCreated({
        participants: data.usersTotal || 0,
        closeAt: formatCloseAt(duration),
      });
      setSheetOpen(false);
      setSuccessOpen(true);
    } catch (err) {
      console.error('[AdminPage] createPoll failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100dvh - 120px)' }}>
      {isAdmin && (
        <div style={tabsWrap}>
          <TabBtn active={tab === 'dashboard'} onClick={() => setTab('dashboard')}>Обзор</TabBtn>
          <TabBtn active={tab === 'users'} onClick={() => setTab('users')}>Люди</TabBtn>
          <TabBtn active={tab === 'debts'} onClick={() => setTab('debts')}>Долги</TabBtn>
          <TabBtn active={tab === 'cleanup'} onClick={() => setTab('cleanup')}>Очистка</TabBtn>
          <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')}>Напомин.</TabBtn>
        </div>
      )}

      {tab === 'dashboard' && (
        <AdminDashboard data={data} onQuickAction={handleQuickAction} />
      )}
      {tab === 'users' && isAdmin && (
        <div style={{ padding: 14 }}><UserManagementCard /></div>
      )}
      {tab === 'debts' && isAdmin && (
        <div style={{ padding: 14 }}><DebtManagementCard /></div>
      )}
      {tab === 'cleanup' && isAdmin && (
        <div style={{ padding: 14 }}><DataCleanupCard /></div>
      )}
      {tab === 'settings' && isAdmin && (
        <div style={{ padding: 14 }}><ReminderSettingsCard /></div>
      )}

      <CreatePollSheet
        open={sheetOpen}
        ctx={ctx}
        submitting={submitting}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmit}
      />
      <SuccessSheet
        open={successOpen}
        participants={lastCreated?.participants ?? 0}
        closeAt={lastCreated?.closeAt ?? ''}
        onShare={() => undefined}
        onOpen={() => setSuccessOpen(false)}
      />
    </div>
  );
}

function formatCloseAt(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: 'none',
        background: active ? 'var(--ink-1, #1b1b1b)' : 'var(--surf-2, #F1F1F4)',
        color: active ? '#fff' : 'var(--ink-1, #333)',
        borderRadius: 999,
        padding: '6px 12px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

const tabsWrap: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '10px 14px 0',
  overflowX: 'auto',
};
