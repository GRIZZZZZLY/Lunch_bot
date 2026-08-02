import { useState, type ChangeEvent, type ReactNode } from 'react';
import type { PaymentInfo } from '@/services/user.service';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button, Field } from '@/components/rl/primitives';
import { InlineNotice } from '@/shared/ui';
import { validateCard, validatePhone } from '@/shared/lib/phone';

interface Props {
  open: boolean;
  initial?: PaymentInfo;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentInfo) => void | Promise<void>;
}

function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <label
        htmlFor={htmlFor}
        style={{
          display: 'block',
          fontSize: 'var(--text-13)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {label}
      </label>
      {children}
      {error && (
        <span
          id={`${htmlFor}-error`}
          role="alert"
          style={{
            display: 'block',
            marginTop: 'var(--space-1)',
            fontSize: 'var(--text-11)',
            color: 'var(--danger-on-tint)',
          }}
        >
          {error}
        </span>
      )}
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
  const [saveError, setSaveError] = useState<string | null>(null);
  /* Показываем ошибки полей только после попытки сохранить: подчёркивать
     «не хватает цифр» на третьей набранной цифре — ругаться на человека,
     который ещё печатает. */
  const [tried, setTried] = useState(false);

  const phoneError = tried ? validatePhone(sbpPhone) : null;
  const cardError = tried ? validateCard(cardNumber) : null;

  /* Раньше handleSave вызывал onSubmit и выбрасывал возвращённый промис.
     Отказ сервера при этом не показывался НИГДЕ: лист оставался открытым,
     кнопка переставала крутиться, сообщения не было, а в консоли висело
     необработанное отклонение. Человек уходил уверенным, что реквизиты
     сохранены, — и потом не понимал, почему деньги не приходят. */
  const handleSave = async () => {
    setTried(true);
    if (validatePhone(sbpPhone) || validateCard(cardNumber)) return;
    setSaveError(null);
    try {
      await onSubmit({
        sbpPhone: sbpPhone.trim() || undefined,
        bankName: bankName.trim() || undefined,
        cardNumber: cardNumber.trim() || undefined,
      });
    } catch {
      setSaveError('Не удалось сохранить реквизиты. Проверьте связь и попробуйте ещё раз.');
    }
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
      {saveError && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <InlineNotice tone="critical">{saveError}</InlineNotice>
        </div>
      )}
      <FormField label="Телефон СБП" htmlFor="payment-sbp-phone" error={phoneError}>
        <Field
          id="payment-sbp-phone"
          value={sbpPhone}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSbpPhone(e.target.value)}
          placeholder="+7 (900) 000-00-00"
          inputMode="tel"
          className="tnum"
          aria-invalid={!!phoneError}
          aria-describedby={phoneError ? 'payment-sbp-phone-error' : undefined}
        />
      </FormField>
      <FormField label="Банк" htmlFor="payment-bank-name">
        <Field id="payment-bank-name" value={bankName} onChange={(e: ChangeEvent<HTMLInputElement>) => setBankName(e.target.value)} placeholder="Тинькофф, Сбербанк…" />
      </FormField>
      <FormField label="Номер карты (опционально)" htmlFor="payment-card-number" error={cardError}>
        <Field
          id="payment-card-number"
          value={cardNumber}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCardNumber(e.target.value)}
          placeholder="0000 0000 0000 0000"
          inputMode="numeric"
          className="tnum"
          aria-invalid={!!cardError}
          aria-describedby={cardError ? 'payment-card-number-error' : undefined}
        />
      </FormField>
    </BottomSheet>
  );
}
