import { Button } from 'telegram-food-bot-frontend-new';

export function Variants() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <Button>Запустить голосование</Button>
      <Button variant="secondary">Добавить позицию</Button>
      <Button variant="ghost">Отмена</Button>
      <Button variant="destructive">Удалить</Button>
    </div>
  );
}

export function States() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <Button disabled>Закрыть сбор</Button>
      <Button loading>Сохранить</Button>
      <Button variant="secondary" disabled>
        Недоступно
      </Button>
    </div>
  );
}

export function Block() {
  return (
    <div style={{ width: 320 }}>
      <Button block>Рассчитать</Button>
    </div>
  );
}
