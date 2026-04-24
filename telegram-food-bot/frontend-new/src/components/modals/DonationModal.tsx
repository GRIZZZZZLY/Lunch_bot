import { useState } from 'react';
import { Modal } from './Modal';

const PRESETS = [100, 250, 500, 1000];

interface Props {
  open: boolean;
  onClose: () => void;
  sbpPhone?: string;
}

export function DonationModal({ open, onClose, sbpPhone }: Props) {
  const [amount, setAmount] = useState(250);
  const [custom, setCustom] = useState('');

  const finalAmount = custom ? Number(custom) || 0 : amount;

  const handlePay = () => {
    if (!finalAmount) return;
    if (sbpPhone) {
      const clean = sbpPhone.replace(/\D/g, '');
      window.open(`https://qr.nspk.ru/AS10000000?type=02&bank=100000000004&sum=${finalAmount * 100}&cur=RUB&phone=${clean}`, '_blank');
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="💛 Поддержать проект">
      <div style={{ fontSize: 14, color: 'var(--ink-2, #666)', marginBottom: 14, lineHeight: 1.4 }}>
        Rocket Lunch — open source. Ваш донат покрывает сервер и помогает добавлять новые фичи.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => {
              setAmount(p);
              setCustom('');
            }}
            style={{
              padding: 14,
              border: '1px solid',
              borderColor: amount === p && !custom ? 'var(--ink-1, #1b1b1b)' : 'var(--line-2, #eee)',
              borderRadius: 12,
              background: amount === p && !custom ? 'var(--surf-2, #F2F2F5)' : 'transparent',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {p} ₽
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-2, #666)', marginBottom: 4 }}>Своя сумма</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--line-2, #eee)', borderRadius: 12, padding: '10px 12px' }}>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="0"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, background: 'transparent' }}
          />
          <span style={{ color: 'var(--ink-2, #888)' }}>₽</span>
        </div>
      </div>

      {!sbpPhone && (
        <div style={{ marginTop: 12, padding: 10, background: '#FFF4D6', borderRadius: 10, fontSize: 12, color: '#7A5A10' }}>
          СБП-телефон получателя пока не настроен.
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={!finalAmount || !sbpPhone}
        style={{
          width: '100%',
          marginTop: 16,
          border: 'none',
          background: 'var(--ink-1, #1b1b1b)',
          color: '#fff',
          padding: 14,
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          cursor: finalAmount && sbpPhone ? 'pointer' : 'not-allowed',
          opacity: finalAmount && sbpPhone ? 1 : 0.5,
        }}
      >
        Оплатить {finalAmount} ₽ через СБП
      </button>
    </Modal>
  );
}
