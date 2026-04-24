export interface UrgentDebtBannerProps {
  label: string;
  amount: number;
  onPay?: () => void;
}

export function UrgentDebtBanner({ label, amount, onPay }: UrgentDebtBannerProps) {
  return (
    <div className="debt-card">
      <div className="ic">₽</div>
      <div className="info">
        <div className="lbl">{label}</div>
        <div className="amt">{amount.toLocaleString('ru-RU')} ₽</div>
      </div>
      <button className="pay" onClick={onPay}>
        Оплатить СБП
      </button>
    </div>
  );
}
