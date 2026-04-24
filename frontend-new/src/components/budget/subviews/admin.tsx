import type { BudgetCallbacks, BudgetData } from '../types';

/* P2a — roulette spinning */
export function SelectionInProgressCard() {
  return (
    <div className="bw lav">
      <div className="bw-media-row">
        <div className="bw-spinner" aria-hidden />
        <div className="tx">
          <div className="role-row">
            <span className="dot" />
            админ · наблюдение
          </div>
          <div className="title">Выбираем ответственного</div>
          <div className="sub">Рулетка запущена, подождите…</div>
        </div>
      </div>
      <div className="bw-hint">
        <span className="tiny-pip" aria-hidden /> спин ≈ 4 сек · далее уведомление в чате
      </div>
    </div>
  );
}

/* P2b — admin waiting for calc */
export function WaitingForCalculationCard({
  data,
  cbs,
}: {
  data: BudgetData;
  cbs: BudgetCallbacks;
}) {
  const name = data.responsiblePicked?.name ?? 'ответственному';
  return (
    <div className="bw butter">
      <div className="bw-media-row">
        <div className="bw-slow-clock" aria-hidden>
          ⏰
        </div>
        <div className="tx">
          <div className="role-row">
            <span className="dot" />
            админ · ждём
          </div>
          <div className="title">Ожидаем расчёт</div>
          <div className="sub">
            {name} получает заказ и скоро рассчитает расходы
          </div>
        </div>
      </div>
      <div className="bw-ctas">
        <button type="button" className="bw-btn ghost" onClick={cbs.onDmResponsible}>
          Написать {data.responsiblePicked?.name ?? ''}
        </button>
      </div>
    </div>
  );
}
