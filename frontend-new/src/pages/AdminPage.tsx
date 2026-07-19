import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreatePollSheet } from '@/components/admin/CreatePollSheet';
import { SuccessSheet } from '@/components/admin/SuccessSheet';
import { UserManagementCard } from '@/components/admin/UserManagementCard';
import { DebtManagementCard } from '@/components/admin/DebtManagementCard';
import { DataCleanupCard } from '@/components/admin/DataCleanupCard';
import { ReminderSettingsCard } from '@/components/admin/ReminderSettingsCard';
import { useAuth } from '@/hooks/useAuth';
import { getAdminGroups, isGlobalAdmin } from '@/lib/permissions';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { useMyGroups } from '@/hooks/useUser';
import { useToast } from '@/hooks/useToast';
import { resolveTargetGroup } from '@/features/home/lib/selectors';
import type { CreatePollContext, CreatePollFormState } from '@/components/admin/types';
import { useActivePolls } from '@/hooks/usePolls';
import { usePollHistory } from '@/hooks/useUser';
import { useMenuItems } from '@/hooks/useMenu';
import { useAppStore } from '@/store/useAppStore';
import { buildDashboard, mapMenuToOptions } from '@/lib/adminMappers';
import { pollsService } from '@/services/polls.service';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { Badge, Chip } from '@/components/rl/primitives';
import { Icon, type IconName } from '@/components/rl/Icon';
import { SectionTitle } from '@/components/rl/parts';

type Tab = 'dashboard' | 'users' | 'debts' | 'cleanup' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Обзор' },
  { id: 'users', label: 'Люди' },
  { id: 'debts', label: 'Долги' },
  { id: 'cleanup', label: 'Очистка' },
  { id: 'settings', label: 'Напомин.' },
];

const QUICK_ICON: Record<string, IconName> = {
  'create-poll': 'plus',
  'manage-menu': 'menu',
  broadcast: 'bell',
  moderation: 'info',
};

export function AdminPage() {
  const navigate = useNavigate();
  const groupId = useAppStore((s) => s.currentGroupId);
  const { user } = useAuth();
  const isAdmin = isGlobalAdmin(user);
  const { data: myGroups = [] } = useMyGroups();
  const toast = useToast();
  useScreenHeader('Управление');
  const [tab, setTab] = useState<Tab>('dashboard');
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

  const adminGroups = useMemo(() => getAdminGroups(user, myGroups), [user, myGroups]);

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
      groups: adminGroups.map((g) => ({ id: String(g.id), title: g.title })),
    }),
    [menuItems, adminGroups],
  );

  const handleQuickAction = (id: string) => {
    if (id === 'create-poll') setSheetOpen(true);
    else if (id === 'manage-menu') navigate('/menu');
  };

  const handleSubmit = async (form: CreatePollFormState) => {
    // B6: явный выбор группы (форма → текущая → первая админская), не молчать
    const targetGroupId = resolveTargetGroup(form.groupId, groupId, adminGroups);
    if (!targetGroupId) {
      toast.error('Нет активной группы. Добавьте бота в групповой чат.');
      return;
    }
    setSubmitting(true);
    try {
      const duration = form.duration === '15m' ? 15 : form.duration === '1h' ? 60 : 30;
      await pollsService.createFromWebapp({
        groupId: targetGroupId,
        duration,
        selectedMenuItems: form.selectedItems.map((id) => Number(id)).filter(Number.isFinite),
        title: form.title.trim() || undefined,
        // Q1: одиночный выбор — multi-select UI не существует
        isMultiSelect: false,
      });
      qc.invalidateQueries({ queryKey: queryKeys.polls.active });
      setLastCreated({ participants: data.usersTotal || 0, closeAt: formatCloseAt(duration) });
      setSheetOpen(false);
      setSuccessOpen(true);
    } catch (err) {
      // B6: ошибка создания больше не молчит
      toast.error(err instanceof Error ? err.message : 'Не удалось создать опрос');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rl">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px 4px' }}>
        <h1 className="font-head tight" style={{ margin: 0, flex: 1, fontSize: 'var(--t-22)', fontWeight: 700 }}>
          Админ-панель
        </h1>
        <Badge tone="accent" icon="gear">
          только админам
        </Badge>
      </div>

      {isAdmin && (
        <div className="scroll-area" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 20px 4px' }}>
          {TABS.map((t) => (
            <Chip key={t.id} on={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>
      )}

      {!isAdmin && (
        <div style={{ padding: '12px 20px' }}>
          <div className="card" style={{ padding: 20, color: 'var(--text-secondary)', fontSize: 'var(--t-13)' }}>
            Раздел доступен только администраторам группы.
          </div>
        </div>
      )}

      {isAdmin && tab === 'dashboard' && (
        <Dashboard data={data} onQuickAction={handleQuickAction} onOpenPoll={(id) => navigate(`/poll/${id}/results`)} />
      )}
      {isAdmin && tab === 'users' && <div style={{ padding: 14 }}><UserManagementCard /></div>}
      {isAdmin && tab === 'debts' && <div style={{ padding: 14 }}><DebtManagementCard /></div>}
      {isAdmin && tab === 'cleanup' && <div style={{ padding: 14 }}><DataCleanupCard /></div>}
      {isAdmin && tab === 'settings' && <div style={{ padding: 14 }}><ReminderSettingsCard /></div>}

      <CreatePollSheet open={sheetOpen} ctx={ctx} submitting={submitting} onClose={() => setSheetOpen(false)} onSubmit={handleSubmit} />
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

function Dashboard({
  data,
  onQuickAction,
  onOpenPoll,
}: {
  data: ReturnType<typeof buildDashboard>;
  onQuickAction: (id: string) => void;
  onOpenPoll: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 20px 16px' }}>
      {/* checklist */}
      <div className="card" style={{ padding: 20 }}>
        <div className="font-head tight" style={{ fontSize: 'var(--t-18)', fontWeight: 700 }}>
          {data.checklistHeading}
        </div>
        <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)', marginTop: 2 }}>{data.checklistSubtitle}</div>
        {data.checklist.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.checklist.map((it) => (
              <div
                key={it.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 'var(--r-block)',
                  background: it.urgent ? 'var(--danger-tint)' : 'var(--bg-base)',
                  color: it.urgent ? 'var(--danger)' : 'var(--text-primary)',
                }}
              >
                <Icon name={it.urgent ? 'alert' : 'clock'} size={16} />
                <span style={{ flex: 1, fontSize: 'var(--t-13)' }}>{it.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {data.quickActions.map((qa) => (
          <button key={qa.id} className="tile" onClick={() => onQuickAction(qa.id)}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={QUICK_ICON[qa.id] ?? 'sparkle'} size={19} />
            </div>
            <div>
              <div className="font-head" style={{ fontSize: 'var(--t-13)', fontWeight: 600 }}>{qa.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{qa.subtitle}</div>
            </div>
          </button>
        ))}
      </div>

      {/* stats */}
      <div style={{ display: 'flex', gap: 10 }}>
        {data.stats.map((s, i) => (
          <div key={i} style={{ flex: 1, padding: 14, borderRadius: 'var(--r-block)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <div className="font-head tnum tight" style={{ fontSize: 'var(--t-22)', fontWeight: 700 }}>{s.num}</div>
            <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.2 }}>{s.label.replace(/<br\s*\/?>/g, ' ')}</div>
          </div>
        ))}
      </div>

      {/* weekday chart */}
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle icon="stats" right={<span className="tnum" style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)' }}>{data.chart.subtitle}</span>}>
          {data.chart.title}
        </SectionTitle>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90, paddingTop: 8 }}>
          {data.chart.bars.map((b, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%' }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(4, b.value)}%`,
                    borderRadius: 6,
                    background: b.peak ? 'var(--accent)' : b.muted ? 'var(--border-subtle)' : 'var(--accent-tint)',
                  }}
                />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{b.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* active polls */}
      {data.polls.active.length > 0 && (
        <div>
          <SectionTitle icon="flame">Активные опросы</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.polls.active.map((p) => (
              <button
                key={p.id}
                className="card press"
                onClick={() => onOpenPoll(p.id)}
                style={{ width: '100%', padding: 14, display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="flame" size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-head" style={{ fontSize: 'var(--t-15)', fontWeight: 600 }}>{p.title}</div>
                  <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }} className="tnum">{p.meta}</div>
                </div>
                <Badge tone="accent" icon="flame">Активен</Badge>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatCloseAt(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
