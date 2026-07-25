import { useState, type ChangeEvent, type ReactNode } from 'react';
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
  if (!open) return null;

  return (
    <EditPaymentInfoForm
      initial={initial}
      busy={busy}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function EditPaymentInfoForm({ initial, busy, onClose, onSubmit }: Omit<Props, 'open'>) {
  const [sbpPhone, setSbpPhone] = useState(initial?.sbpPhone ?? '');
  const [bankName, setBankName] = useState(initial?.bankName ?? '');
  const [cardNumber, setCardNumber] = useState(initial?.cardNumber ?? '');

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
