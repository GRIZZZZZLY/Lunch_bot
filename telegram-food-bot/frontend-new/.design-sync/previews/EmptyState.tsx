import { Button, EmptyState } from 'telegram-food-bot-frontend-new';

export function Basic() {
  return (
    <div style={{ width: 320 }}>
      <EmptyState
        icon="clock"
        title="История пуста"
        description="Завершённые голосования появятся здесь."
      />
    </div>
  );
}

export function WithAction() {
  return (
    <div style={{ width: 320 }}>
      <EmptyState
        icon="cart"
        title="Пока пусто"
        description="Добавьте первую позицию — остальные подтянутся."
        action={<Button variant="secondary">Добавить позицию</Button>}
      />
    </div>
  );
}
