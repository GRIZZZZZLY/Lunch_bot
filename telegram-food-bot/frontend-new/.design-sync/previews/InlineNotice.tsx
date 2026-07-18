import { InlineNotice } from 'telegram-food-bot-frontend-new';

const column = { display: 'flex', flexDirection: 'column' as const, gap: 10, width: 340 };

export function Info() {
  return (
    <div style={column}>
      <InlineNotice tone="info">
        Завершите расчёт после покупки. Незавершённая закупка может быть отменена автоматически.
      </InlineNotice>
    </div>
  );
}

export function Warning() {
  return (
    <div style={column}>
      <InlineNotice tone="warning" title="3 позиции без цены">
        Они не попадут в расчёт долгов.
      </InlineNotice>
    </div>
  );
}

export function Critical() {
  return (
    <div style={column}>
      <InlineNotice tone="critical" title="Сбор закрывается">
        Добавить позиции больше нельзя.
      </InlineNotice>
    </div>
  );
}
