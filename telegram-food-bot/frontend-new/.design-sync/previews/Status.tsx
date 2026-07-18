import { Status } from 'telegram-food-bot-frontend-new';

export function RunStatuses() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <Status tone="accent" icon="clock">Сбор</Status>
      <Status tone="warning" icon="cart">В магазине</Status>
      <Status tone="success" icon="check">Рассчитано</Status>
      <Status tone="danger" icon="ban">Отменено</Status>
    </div>
  );
}

export function ItemStatuses() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <Status tone="neutral">Запрошено</Status>
      <Status tone="success" icon="check">Куплено</Status>
      <Status tone="danger">Не нашли</Status>
      <Status tone="info">Обновляется</Status>
    </div>
  );
}
