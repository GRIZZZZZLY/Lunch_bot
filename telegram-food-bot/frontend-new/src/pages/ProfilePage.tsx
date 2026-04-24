import { useMemo, useState } from 'react';
import { ProfileScreen } from '@/components/profile/ProfileScreen';
import { HistoryScreen } from '@/components/profile/HistoryScreen';
import { EditPaymentInfoSheet } from '@/components/profile/EditPaymentInfoSheet';
import { FeedbackModal } from '@/components/modals/FeedbackModal';
import { DonationModal } from '@/components/modals/DonationModal';
import type { ProfileData, SettingRow } from '@/components/profile/types';
import { useAuth } from '@/hooks/useAuth';
import { useMe, usePaymentInfo, usePollHistory, useUpdatePaymentInfo } from '@/hooks/useUser';
import { useSendFeedback } from '@/hooks/useFeedback';
import { useStreak } from '@/hooks/useStreak';
import { buildHistoryDays, buildProfileUser, buildRecentPolls } from '@/lib/profileMappers';

type View = 'profile' | 'history';

export function ProfilePage() {
  const [view, setView] = useState<View>('profile');
  const [sbpOpen, setSbpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [donationOpen, setDonationOpen] = useState(false);
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: paymentInfo } = usePaymentInfo();
  const updatePayment = useUpdatePaymentInfo();
  const sendFeedback = useSendFeedback();
  const { data: history = [], isLoading: historyLoading } = usePollHistory({ limit: 30 });

  const isLoading = authLoading || meLoading || historyLoading;
  const { streak } = useStreak();
  const user = useMemo(() => {
    const base = buildProfileUser(me ?? null);
    if (streak.current >= 3) {
      base.pills = [
        ...base.pills,
        { text: `🔥 ${streak.current} дней`, tone: streak.atRisk ? 'muted' : 'peach' },
      ];
    }
    return base;
  }, [me, streak.current, streak.atRisk]);
  const recent = useMemo(() => buildRecentPolls(history, 3), [history]);
  const days = useMemo(() => buildHistoryDays(history), [history]);
  const wins = history.filter((p) => p.status === 'COMPLETED').length;

  const settings: SettingRow[] = [
    {
      id: 'notifications',
      icon: '🔔',
      label: 'Уведомления',
      value: '5 мин до закрытия',
      control: { type: 'toggle', on: true },
    },
    {
      id: 'theme',
      icon: '🌙',
      label: 'Тёмная тема',
      value: 'как в Telegram',
      control: { type: 'toggle', on: true },
    },
    {
      id: 'sbp',
      icon: '💳',
      label: 'Реквизиты СБП',
      value: paymentInfo?.sbpPhone ? maskPhone(paymentInfo.sbpPhone) : 'не задано',
      control: { type: 'chevron' },
    },
    {
      id: 'language',
      icon: '🌐',
      label: 'Язык',
      value: 'Русский',
      control: { type: 'chevron' },
    },
  ];

  const data: ProfileData = {
    user,
    stats: {
      polls: history.length,
      wins,
      activity: history.length > 0 ? `${Math.round((wins / history.length) * 100)}%` : '—',
    },
    recent,
    settings,
    isLoading,
    isEmpty: !isLoading && history.length === 0,
  };

  if (view === 'history') {
    return (
      <HistoryScreen
        data={{ days, isEmpty: !historyLoading && days.length === 0 }}
        onBack={() => setView('profile')}
      />
    );
  }

  return (
    <>
      <ProfileScreen
        data={data}
        onSeeAllHistory={() => setView('history')}
        onActivateSetting={(id) => {
          if (id === 'sbp') setSbpOpen(true);
        }}
        onFeedback={async (text) => {
          if (!text.trim()) return;
          await sendFeedback.mutateAsync({
            message: text,
            userId: authUser?.id,
            username: authUser?.username ?? undefined,
            firstName: authUser?.firstName ?? undefined,
          });
        }}
        onReportIssue={() => setFeedbackOpen(true)}
      />
      <EditPaymentInfoSheet
        open={sbpOpen}
        initial={paymentInfo}
        busy={updatePayment.isPending}
        onClose={() => setSbpOpen(false)}
        onSubmit={async (data) => {
          await updatePayment.mutateAsync(data);
          setSbpOpen(false);
        }}
      />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <DonationModal
        open={donationOpen}
        onClose={() => setDonationOpen(false)}
        sbpPhone={paymentInfo?.sbpPhone}
      />
    </>
  );
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  return `+${digits[0]} *** ${digits.slice(-2)}`;
}
