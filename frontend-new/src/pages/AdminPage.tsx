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
import { PROFILE_HISTORY_LIMIT, useMyGroups, usePollHistory } from '@/hooks/useUser';
import { useToast } from '@/hooks/useToast';
import { resolveTargetGroup } from '@/features/home/lib/selectors';
import type { CreatePollContext, CreatePollFormState } from '@/components/admin/types';
import { useActivePolls } from '@/hooks/usePolls';
import { useMenuItems } from '@/hooks/useMenu';
import { useAppStore } from '@/store/useAppStore';
import { buildDashboard, mapMenuToOptions } from '@/lib/adminMappers';
import { pollsService } from '@/services/polls.service';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { Icon, type IconName } from '@/components/rl/Icon';
import { SectionTitle } from '@/components/rl/parts';
import { InlineNotice } from '@/shared/ui';
import { useRovingFocus } from '@/shared/lib/useRovingFocus';
import styles from './AdminPage.module.css';

type Tab = 'dashboard' | 'users' | 'debts' | 'cleanup' | 'settings';
/* «Напомин.» было обрезанным словом, и пятая вкладка при этом всё равно
   уезжала за правый край на 390 px. Слово вернули целиком, а о том, что
   полосу можно листать, теперь говорит затенение у края. */
const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Обзор' },
  { id: 'users', label: 'Люди' },
  { id: 'debts', label: 'Долги' },
  { id: 'cleanup', label: 'Очистка' },
  { id: 'settings', label: 'Напоминания' },
];

const QUICK_ICON: Record<string, IconName> = {
  'create-poll': 'plus',
  'manage-menu': 'menu',
};

export function AdminPage() {
  const navigate = useNavigate();
  const groupId = useAppStore((s) => s.currentGroupId);
  const { user } = useAuth();
  const { data: myGroups = [] } = useMyGroups();
  const toast = useToast();
  useScreenHeader('Управление');
  const [tab, setTab] = useState<Tab>('dashboard');
  const activePollsQuery = useActivePolls();
  /* Тот же лимит, что у профиля и расчёта серии: три разных лимита к одному
     эндпоинту означали три отдельных запроса за одной и той же историей. */
  const historyQuery = usePollHistory({ limit: PROFILE_HISTORY_LIMIT });
  const menuQuery = useMenuItems({ activeOnly: true });
  const qc = useQueryClient();

  /* Подстановка пустого массива внутри useMemo, а не рядом с ним: `?? []`
     снаружи создаёт новый массив на каждый рендер, и мемоизация ниже теряется
     (тот же случай уже разбирался в бюджете). */
  const activePolls = useMemo(() => activePollsQuery.data ?? [], [activePollsQuery.data]);
  const history = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);
  const menuItems = useMemo(() => menuQuery.data ?? [], [menuQuery.data]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ closeAt: string } | null>(null);

  const data = useMemo(
    () => buildDashboard({ activePolls, history, menuCount: menuItems.length }),
    [activePolls, history, menuItems],
  );

  const adminGroups = useMemo(() => getAdminGroups(user, myGroups), [user, myGroups]);
  const isAdmin = isGlobalAdmin(user) || adminGroups.length > 0;
  const activeGroup = useMemo(
    () => myGroups.find((g) => String(g.id) === groupId),
    [myGroups, groupId],
  );

  /* Стрелками двигаем фокус по вкладкам — иначе tablist ведёт себя не так,
     как его объявляет разметка. */
  const tabsFocus = useRovingFocus(
    TABS.length,
    TABS.findIndex((t) => t.id === tab),
  );

  const ctx: CreatePollContext = useMemo(
    () => ({
      items: mapMenuToOptions(menuItems),
      minItems: 2,
      maxItems: 10,
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
      setLastCreated({ closeAt: formatCloseAt(duration) });
      setSheetOpen(false);
      setSuccessOpen(true);
    } catch (err) {
      // B6: ошибка создания больше не молчит
      toast.error(err instanceof Error ? err.message : 'Не удалось создать опрос');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className={`rl ${styles.screen}`}>
        <p className={styles.denied}>Раздел доступен только администраторам группы.</p>
      </div>
    );
  }

  const dashboardFailed =
    activePollsQuery.isError || historyQuery.isError || menuQuery.isError;
  const dashboardLoading =
    activePollsQuery.isLoading || historyQuery.isLoading || menuQuery.isLoading;

  return (
    <div className={`rl ${styles.screen}`}>
      {/* Заголовок был двойным: DetailLayout уже рисует h1 «Управление», а
          страница добавляла свой «Админ-панель». Вместо дубля — группа, к
          которой относится всё, что здесь делается. */}
      {activeGroup && <p className={styles.cardSub}>группа «{activeGroup.title}»</p>}

      <div className={styles.tabsWrap}>
        <div className={styles.tabs} role="tablist" aria-label="Разделы управления">
          {TABS.map((t, idx) => {
            const { ref, ...roving } = tabsFocus.getItemProps(idx);
            return (
              <button
                key={t.id}
                ref={ref}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={styles.tab}
                onClick={() => setTab(t.id)}
                {...roving}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'dashboard' && (
        <Dashboard
          data={data}
          failed={dashboardFailed}
          loading={dashboardLoading}
          onRetry={() => {
            activePollsQuery.refetch();
            historyQuery.refetch();
            menuQuery.refetch();
          }}
          onQuickAction={handleQuickAction}
          onOpenPoll={(id) => navigate(`/poll/${id}/results`)}
        />
      )}
      {tab === 'users' && <UserManagementCard />}
      {tab === 'debts' && <DebtManagementCard />}
      {tab === 'cleanup' && <DataCleanupCard />}
      {tab === 'settings' && <ReminderSettingsCard />}

      <CreatePollSheet open={sheetOpen} ctx={ctx} submitting={submitting} onClose={() => setSheetOpen(false)} onSubmit={handleSubmit} />
      <SuccessSheet
        open={successOpen}
        closeAt={lastCreated?.closeAt ?? ''}
        onOpen={() => setSuccessOpen(false)}
      />
    </div>
  );
}

function Dashboard({
  data,
  failed,
  loading,
  onRetry,
  onQuickAction,
  onOpenPoll,
}: {
  data: ReturnType<typeof buildDashboard>;
  failed: boolean;
  loading: boolean;
  onRetry: () => void;
  onQuickAction: (id: string) => void;
  onOpenPoll: (id: string) => void;
}) {
  /* Нечитаемые данные — это «неизвестно», а не «ноль». Раньше отказ сервера
     давал «0 опросов всего», «0 средн. голосов», «0 блюд в меню» и бодрое
     «Нет срочных задач» — пять уверенных утверждений, все ложные. */
  const unknown = failed || loading;
  const num = (v: string) => (unknown ? '—' : v);

  return (
    <div className={styles.panel}>
      {failed && (
        <InlineNotice tone="critical">
          Не удалось прочитать данные группы, поэтому показатели скрыты.{' '}
          <button type="button" className={styles.retry} onClick={onRetry}>
            Повторить
          </button>
        </InlineNotice>
      )}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{unknown ? 'Данные не прочитаны' : data.checklistHeading}</h2>
        {!unknown && data.checklist.length > 0 && (
          <div className={styles.checklist}>
            {data.checklist.map((it) => (
              <div key={it.id} className={`${styles.checkItem}${it.urgent ? ` ${styles.urgent}` : ''}`}>
                <Icon name={it.urgent ? 'alert' : 'clock'} size={16} />
                <span className={styles.checkItemLabel}>{it.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.quick}>
        {data.quickActions.map((qa) => (
          <button key={qa.id} type="button" className={styles.tile} onClick={() => onQuickAction(qa.id)}>
            <span className={styles.tileIcon}>
              <Icon name={QUICK_ICON[qa.id] ?? 'sparkle'} size={18} />
            </span>
            <span className={styles.tileMain}>
              <span className={styles.tileTitle}>{qa.title}</span>
              <span className={styles.tileSub}>{unknown && qa.id === 'manage-menu' ? '—' : qa.subtitle}</span>
            </span>
          </button>
        ))}
      </div>

      <div className={styles.stats}>
        {data.stats.map((s, i) => (
          <div key={i} className={styles.stat}>
            <b className={`tnum ${styles.statNum}`}>{num(s.num)}</b>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* График скрыт, пока опросов слишком мало: на двух-трёх это не ритм
          недели, а один случайный день, поданный как аналитика. */}
      {!unknown && data.chart.meaningful && (
        <div className={styles.card}>
          <SectionTitle
            icon="stats"
            right={<span className={`tnum ${styles.tileSub}`}>{data.chart.subtitle}</span>}
          >
            {data.chart.title}
          </SectionTitle>
          <div className={styles.chart}>
            {data.chart.bars.map((b, i) => (
              <div key={i} className={styles.chartCol}>
                <div className={styles.chartBarWrap}>
                  <div
                    className={`${styles.chartBar}${b.peak ? ` ${styles.peak}` : ''}${b.muted ? ` ${styles.muted}` : ''}`}
                    style={{ height: `${Math.max(4, b.value)}%` }}
                  />
                </div>
                <span className={styles.chartDay}>{b.day}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!unknown && data.polls.active.length > 0 && (
        <div>
          <SectionTitle icon="flame">Активные опросы</SectionTitle>
          <div className={styles.pollList}>
            {data.polls.active.map((p) => (
              <button key={p.id} type="button" className={styles.pollRow} onClick={() => onOpenPoll(p.id)}>
                <span className={styles.pollIcon}>
                  <Icon name="flame" size={20} />
                </span>
                <span className={styles.pollMain}>
                  <span className={styles.pollTitle}>{p.title}</span>
                  <span className={`tnum ${styles.pollMeta}`}>{p.meta}</span>
                </span>
                <Icon name="chevronRight" size={16} />
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
