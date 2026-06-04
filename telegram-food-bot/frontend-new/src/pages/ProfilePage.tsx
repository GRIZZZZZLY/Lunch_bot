import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePaymentInfo, usePollHistory, useUpdatePaymentInfo } from '@/hooks/useUser';
import { useStreak } from '@/hooks/useStreak';
import { EditPaymentInfoSheet } from '@/components/profile/EditPaymentInfoSheet';
import { FeedbackModal } from '@/components/modals/FeedbackModal';
import { DonationModal } from '@/components/modals/DonationModal';
import { Avatar, Badge, Button, Switch } from '@/components/rl/primitives';
import { Icon, type IconName } from '@/components/rl/Icon';
import { SchemeThemeToggle } from '@/components/rl/SchemeThemeToggle';

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  return `+${digits[0]} *** ${digits.slice(-2)}`;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: paymentInfo } = usePaymentInfo();
  const updatePayment = useUpdatePaymentInfo();
  const { data: history = [] } = usePollHistory({ limit: 30 });
  const { streak } = useStreak();

  const [sbpOpen, setSbpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [donationOpen, setDonationOpen] = useState(false);
  const [notif, setNotif] = useState(true);

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Гость';
  const handle = user?.username ? `@${user.username}` : 'Участник команды';
  const wins = history.filter((p) => p.status === 'COMPLETED').length;
  const activity = history.length > 0 ? `${Math.round((wins / history.length) * 100)}%` : '—';

  return (
    <div className="rl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 20px 16px' }}>
        {/* profile header */}
        <div className="card anim-rise" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={name} size={60} ring />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-head tight" style={{ fontSize: 'var(--t-18)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name}
            </div>
            <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>{handle}</div>
            {streak.current >= 3 && (
              <div style={{ marginTop: 8 }}>
                <Badge tone={streak.atRisk ? 'warning' : 'accent'} icon="flame">
                  {streak.current} дней подряд
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* mini stats */}
        <div className="anim-rise" style={{ display: 'flex', gap: 10, animationDelay: '55ms' }}>
          <MiniStat value={history.length} label="Голосований" accent />
          <MiniStat value={wins} label="Завершено" />
          <MiniStat value={activity} label="Активность" />
        </div>

        {/* settings */}
        <div className="card anim-rise" style={{ overflow: 'hidden', animationDelay: '110ms' }}>
          <div className="row-divider">
            <Row icon="sparkle" label="Оформление" control={<SchemeThemeToggle />} />
            <Row
              icon="bell"
              label="Уведомления"
              control={<Switch on={notif} onChange={setNotif} aria-label="Уведомления" />}
            />
            <Row
              icon="bank"
              label="Реквизиты СБП"
              value={paymentInfo?.sbpPhone ? maskPhone(paymentInfo.sbpPhone) : 'не задано'}
              onClick={() => setSbpOpen(true)}
            />
            <Row icon="info" label="Язык" value="Русский" />
          </div>
        </div>

        {/* navigation */}
        <div className="card anim-rise" style={{ overflow: 'hidden', animationDelay: '165ms' }}>
          <div className="row-divider">
            <Row icon="sparkle" label="Мои предложения" onClick={() => navigate('/suggestions/mine')} />
            <Row icon="clock" label="История голосований" onClick={() => navigate('/poll/history')} />
          </div>
        </div>

        {/* actions */}
        <div className="anim-rise" style={{ display: 'flex', flexDirection: 'column', gap: 10, animationDelay: '220ms' }}>
          <Button variant="outline" icon="heart" style={{ width: '100%' }} onClick={() => setDonationOpen(true)}>
            Поддержать проект
          </Button>
          <Button variant="ghost" icon="alert" style={{ width: '100%' }} onClick={() => setFeedbackOpen(true)}>
            Сообщить о проблеме
          </Button>
        </div>
      </div>

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
      <DonationModal open={donationOpen} onClose={() => setDonationOpen(false)} sbpPhone={paymentInfo?.sbpPhone} />
    </div>
  );
}

function MiniStat({ value, label, accent }: { value: ReactNode; label: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, padding: 14, borderRadius: 'var(--r-block)', background: accent ? 'var(--accent-tint)' : 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
      <div className="font-head tnum tight" style={{ fontSize: 'var(--t-22)', fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  control,
  onClick,
}: {
  icon: IconName;
  label: string;
  value?: string;
  control?: ReactNode;
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  return (
    <div
      className="list-item"
      style={{ cursor: interactive ? 'pointer' : 'default' }}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
    >
      <Icon name={icon} size={20} style={{ color: 'var(--text-secondary)' }} />
      <span style={{ flex: 1, fontSize: 'var(--t-15)' }}>{label}</span>
      {value && (
        <span className="tnum" style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>
          {value}
        </span>
      )}
      {control}
      {interactive && !control && <Icon name="chevronRight" size={18} style={{ color: 'var(--text-tertiary)' }} />}
    </div>
  );
}
