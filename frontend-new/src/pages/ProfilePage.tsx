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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13, padding: '12px 16px calc(104px + env(safe-area-inset-bottom))' }}>
        {/* profile header — по центру, аватар в двойном кольце (макет) */}
        <div className="anim-rise" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 6, textAlign: 'center' }}>
          <div
            style={{
              borderRadius: '50%',
              boxShadow:
                '0 0 0 3px var(--bg-base), 0 0 0 4.5px color-mix(in srgb, var(--accent) 45%, transparent), 0 14px 30px -10px color-mix(in srgb, var(--accent) 40%, transparent)',
            }}
          >
            <Avatar name={name} size={76} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span className="font-head" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {name}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{handle}</span>
            {streak.current >= 3 && (
              <div style={{ marginTop: 6 }}>
                <Badge tone={streak.atRisk ? 'warning' : 'accent'} icon="flame">
                  {streak.current} дней подряд
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* mini stats — три плитки по центру (макет) */}
        <div className="anim-rise" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9, animationDelay: '55ms' }}>
          <MiniStat value={history.length} label="Голосований" />
          <MiniStat value={wins} label="Завершено" />
          <MiniStat value={activity} label="Активность" accent />
        </div>

        {/* settings */}
        <div className="card anim-rise" style={{ borderRadius: 22, overflow: 'hidden', animationDelay: '110ms' }}>
          <div className="row-divider">
            <Row icon="moon" label="Оформление" control={<SchemeThemeToggle />} />
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
            <Row icon="globe" label="Язык" value="Русский" />
          </div>
        </div>

        {/* navigation */}
        <div className="card anim-rise" style={{ borderRadius: 22, overflow: 'hidden', animationDelay: '165ms' }}>
          <div className="row-divider">
            <Row icon="sparkle" label="Мои предложения" tone="warning" onClick={() => navigate('/suggestions/mine')} />
            <Row icon="clock" label="История голосований" tone="warning" onClick={() => navigate('/poll/history')} />
          </div>
        </div>

        {/* actions */}
        <div className="anim-rise" style={{ display: 'flex', flexDirection: 'column', gap: 10, animationDelay: '220ms' }}>
          <button
            className="press"
            onClick={() => setDonationOpen(true)}
            style={{
              height: 50,
              borderRadius: 17,
              border: 'none',
              cursor: 'pointer',
              background: 'var(--accent-tint)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <Icon name="heart" size={16} />
            Поддержать проект
          </button>
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
    <div
      className="card"
      style={{
        borderRadius: 18,
        boxShadow: 'var(--shadow-1)',
        padding: '12px 6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <span className="tnum" style={{ fontSize: 18, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>
        {value}
      </span>
      <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{label}</span>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  control,
  tone = 'accent',
  onClick,
}: {
  icon: IconName;
  label: string;
  value?: string;
  control?: ReactNode;
  tone?: 'accent' | 'warning';
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  const color = tone === 'warning' ? 'var(--warning)' : 'var(--accent)';
  return (
    <div
      className="list-item"
      style={{ cursor: interactive ? 'pointer' : 'default', padding: '11px 14px', gap: 12 }}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          flexShrink: 0,
          background: `color-mix(in srgb, ${color} 10%, transparent)`,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={17} />
      </div>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label}</span>
      {value && (
        <span className="tnum" style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
          {value}
        </span>
      )}
      {control}
      {interactive && !control && <Icon name="chevronRight" size={15} stroke={2} style={{ color: 'var(--text-tertiary)' }} />}
    </div>
  );
}
