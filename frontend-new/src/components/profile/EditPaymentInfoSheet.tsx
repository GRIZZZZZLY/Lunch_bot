import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { PaymentInfo } from '@/services/user.service';

interface Props {
  open: boolean;
  initial?: PaymentInfo;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentInfo) => void | Promise<void>;
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
    <>
      <div className="scrim" onClick={onClose} />
      <div className="bs" role="dialog" aria-label="Реквизиты СБП">
        <div className="handle" />
        <div className="bs-head">
          <div className="bs-ttl">Реквизиты СБП</div>
          <button className="bs-close" onClick={onClose} aria-label="Закрыть"><X size={14} /></button>
        </div>
        <div className="form">
          <div className="field">
            <label>Телефон СБП</label>
            <input
              className="inp"
              value={sbpPhone}
              onChange={(e) => setSbpPhone(e.target.value)}
              placeholder="+7 (900) 000-00-00"
              inputMode="tel"
            />
          </div>
          <div className="field">
            <label>Банк</label>
            <input
              className="inp"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Тинькофф, Сбербанк…"
            />
          </div>
          <div className="field">
            <label>Номер карты (опционально)</label>
            <input
              className="inp"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="0000 0000 0000 0000"
              inputMode="numeric"
            />
          </div>
          <div className="bs-foot">
            <button className="btn ghost" onClick={onClose} disabled={busy}>Отмена</button>
            <button className="btn primary" onClick={handleSave} disabled={busy}>
              {busy ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
