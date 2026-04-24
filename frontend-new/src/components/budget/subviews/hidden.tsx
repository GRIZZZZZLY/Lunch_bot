import type { BudgetData } from '../types';

/* HiddenState — null or tiny pill (variant b for users with history) */
export function HiddenState({ data }: { data: BudgetData }) {
  if (!data.hasHistory) return null;
  return (
    <div className="bw-hidden-pill">
      <span className="tiny-pip" aria-hidden />
      <span>Бюджет в балансе · долгов нет</span>
    </div>
  );
}
