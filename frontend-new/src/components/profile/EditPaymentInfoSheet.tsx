import { useState, type ChangeEvent, type ReactNode } from 'react';
import type { PaymentInfo } from '@/services/user.service';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button, Field } from '@/components/rl/primitives';
import { InlineNotice } from '@/shared/ui';
import {
  PHONE_PREFIX,
  formatPhoneInput,
  isPhoneEmpty,
  normalizePhone,
  validatePaymentLink,
  validatePhone,
} from '@/shared/lib/phone';

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
  /* Поле открывается с «+7 »: код страны у всех один, и набирать его руками
     каждый раз незачем. */
  const [phone, setPhone] = useState(() => formatPhoneInput(initial?.paymentPhone ?? '') || PHONE_PREFIX);
  const [details, setDetails] = useState(initial?.paymentDetails ?? '');
  const [link, setLink] = useState(initial?.paymentCard ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  /* Показываем ошибки полей только после попытки сохранить: подчёркивать
     «не хватает цифр» на третьей набранной цифре — ругаться на человека,
     который ещё печатает. */
  const [tried, setTried] = useState(false);

  const phoneError = tried ? validatePhone(phone) : null;
  const linkError = tried ? validatePaymentLink(link) : null;

  /* Раньше handleSave вызывал onSubmit и выбрасывал возвращённый промис.
     Отказ сервера при этом не показывался НИГДЕ: лист оставался открытым,
     кнопка переставала крутиться, сообщения не было, а в консоли висело
     необработанное отклонение. Человек уходил уверенным, что реквизиты
     сохранены, — и потом не понимал, почему деньги не приходят. */
  const handleSave = async () => {
    setTried(true);
    if (validatePhone(phone) || validatePaymentLink(link)) return;
    setSaveError(null);
    try {
      /* Имена — как на проводе. Раньше уходили sbpPhone/bankName/cardNumber,
         которых API не знает: PUT отвечал 200 и записывал undefined в каждое
         поле. Ничего не сохранялось, и сказать об этом было нечему — отказа
         ведь не было. */
      await onSubmit({
        paymentPhone: normalizePhone(phone),
        paymentDetails: details.trim() || undefined,
        paymentCard: link.trim() || undefined,
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
          value={phone}
          /* Формат наводится по мере набора, а не после: иначе человек видит
             собственный номер в чужом виде только на экране профиля. */
          onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(formatPhoneInput(e.target.value))}
          onFocus={() => setPhone((v) => v || PHONE_PREFIX)}
          /* Уход с поля, где остался один префикс, — это «номер не задан».
             Иначе «+7» ушло бы на сервер как реквизит. */
          onBlur={() => setPhone((v) => (isPhoneEmpty(v) ? '' : v))}
          placeholder="+7 900 000-00-00"
          inputMode="tel"
          className="tnum"
          aria-invalid={!!phoneError}
          aria-describedby={phoneError ? 'payment-sbp-phone-error' : undefined}
        />
      </FormField>
      <FormField label="Банк" htmlFor="payment-bank-name">
        <Field id="payment-bank-name" value={details} onChange={(e: ChangeEvent<HTMLInputElement>) => setDetails(e.target.value)} placeholder="Тинькофф, Сбербанк…" />
      </FormField>
      {/* Ссылка вместо номера карты: банк отдаёт её кнопкой «поделиться», и по
          ней плательщик попадает сразу в свой банк — это быстрее, чем копировать
          цифры. Колонка в базе осталась paymentCard: переименовывать её ради
          подписи не стоило миграции. */}
      <FormField label="Ссылка на СБП (опционально)" htmlFor="payment-link" error={linkError}>
        <Field
          id="payment-link"
          value={link}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setLink(e.target.value)}
          placeholder="https://www.tinkoff.ru/rm/..."
          inputMode="url"
          autoComplete="url"
          aria-invalid={!!linkError}
          aria-describedby={linkError ? 'payment-link-error' : undefined}
        />
      </FormField>
    </BottomSheet>
  );
}
