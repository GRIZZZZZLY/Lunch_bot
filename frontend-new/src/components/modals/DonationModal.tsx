import { useState, type ChangeEvent } from 'react';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';

const PRESETS = [100, 250, 500, 1000];

interface Props {
  open: boolean;
  onClose: () => void;
  sbpPhone?: string;
}

export function DonationModal({ open, onClose, sbpPhone }: Props) {
  const [amount, setAmount] = useState(250);
  const [custom, setCustom] = useState('');

  if (!open) return null;

  const finalAmount = custom ? Number(custom) || 0 : amount;

  const handlePay = () => {
    if (!finalAmount || !sbpPhone) return;
    const clean = sbpPhone.replace(/\D/g, '');
    window.open(
      `https://qr.nspk.ru/AS10000000?type=02&bank=100000000004&sum=${finalAmount * 100}&cur=RUB&phone=${clean}`,
      '_blank',
    );
    onClose();
  };

  return (
    <BottomSheet
      title="Поддержать проект"
      onClose={onClose}
      footer={
        <Button variant="primary" icon="heart" style={{ width: '100%' }} disabled={!finalAmount || !sbpPhone} onClick={handlePay}>
          Оплатить {finalAmount} ₽ через СБП
        </Button>
      }
    >
      <p style={{ margin: '0 0 14px', fontSize: 'var(--text-13)', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        Rocket Lunch — open source. Ваш донат покрывает сервер и помогает добавлять новые фичи.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {PRESETS.map((p) => {
          const on = amount === p && !custom;
          return (
            <button
              key={p}
              type="button"
              className="press"
              onClick={() => {
                setAmount(p);
                setCustom('');
              }}
              style={{
                padding: 14,
                borderRadius: 'var(--radius-block)',
                border: `1px solid ${on ? 'var(--focus-ring)' : 'var(--divider)'}`,
                background: on ? 'var(--accent-tint)' : 'var(--surface)',
                color: on ? 'var(--accent)' : 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 'var(--text-15)',
                cursor: 'pointer',
              }}
            >
              <span className="tnum">{p}</span> ₽
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 'var(--text-13)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Своя сумма</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 44,
            padding: '0 12px',
            border: '1px solid var(--divider)',
            borderRadius: 'var(--radius-block)',
            background: 'var(--surface)',
          }}
        >
          {/* fontSize 16px — порог, ниже которого iOS приближает страницу при
              фокусе на поле. Единственное поле проекта со стилем в разметке,
              поэтому правило продублировано здесь. */}
          <input
            aria-label="Своя сумма"
            value={custom}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCustom(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="0"
            className="tnum"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 'var(--text-16)', background: 'transparent', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}
          />
          <span style={{ color: 'var(--text-tertiary)' }}>₽</span>
        </div>
      </div>

      {!sbpPhone && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-block)', background: 'var(--warning-tint)', color: 'var(--warning)', fontSize: 'var(--text-13)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="alert" size={16} /> СБП-телефон получателя пока не настроен.
        </div>
      )}
    </BottomSheet>
  );
}
