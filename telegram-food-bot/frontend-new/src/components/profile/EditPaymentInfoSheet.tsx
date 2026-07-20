import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import type { PaymentInfo } from '@/services/user.service';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button, Field } from '@/components/rl/primitives';

interface Props {
  open: boolean;
  initial?: PaymentInfo;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentInfo) => void | Promise<void>;
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

export function EditPaymentInfoSheet({ open, initial, busy, onClose, onSubmit }: Props) {
  const [sbpPhone, setSbpPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [cardNumber, setCardNumber] = useState('');

  useEffect(() => {
    if (open) {
      setSbpPhone(initial?.sbpPhone ?? '');
      setBankName(initial?.bankName ?? '');
      setCardNumber(initial?.cardNumber ?? '');
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSave = () => {
    onSubmit({
      sbpPhone: sbpPhone.trim() || undefined,
      bankName: bankName.trim() || undefined,
      cardNumber: cardNumber.trim() || undefined,
    });
  };

  return (
    <BottomSheet
      title="Реквизиты СБП"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" style={{ flex: 1 }} disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" icon="check" style={{ flex: 1 }} loading={busy} onClick={handleSave}>
            Сохранить
          </Button>
        </>
      }
    >
      <FormField label="Телефон СБП" htmlFor="payment-sbp-phone">
        <Field id="payment-sbp-phone" value={sbpPhone} onChange={(e: ChangeEvent<HTMLInputElement>) => setSbpPhone(e.target.value)} placeholder="+7 (900) 000-00-00" inputMode="tel" className="tnum" />
      </FormField>
      <FormField label="Банк" htmlFor="payment-bank-name">
        <Field id="payment-bank-name" value={bankName} onChange={(e: ChangeEvent<HTMLInputElement>) => setBankName(e.target.value)} placeholder="Тинькофф, Сбербанк…" />
      </FormField>
      <FormField label="Номер карты (опционально)" htmlFor="payment-card-number">
        <Field id="payment-card-number" value={cardNumber} onChange={(e: ChangeEvent<HTMLInputElement>) => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" inputMode="numeric" className="tnum" />
      </FormField>
    </BottomSheet>
  );
}
