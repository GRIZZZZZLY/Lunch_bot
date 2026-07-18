import { IconButton } from 'telegram-food-bot-frontend-new';

export function Variants() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <IconButton name="edit" aria-label="Изменить позицию" />
      <IconButton name="plus" aria-label="Добавить" variant="secondary" />
      <IconButton name="trash" aria-label="Удалить" variant="destructive" />
    </div>
  );
}

export function States() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <IconButton name="check" aria-label="Готово" variant="secondary" loading />
      <IconButton name="x" aria-label="Закрыть" disabled />
    </div>
  );
}
