import { TextField } from 'telegram-food-bot-frontend-new';

const column = { display: 'flex', flexDirection: 'column' as const, gap: 14, width: 300 };

export function Basic() {
  return (
    <div style={column}>
      <TextField label="Что купить" placeholder="Молоко, хлеб…" />
    </div>
  );
}

export function WithHint() {
  return (
    <div style={column}>
      <TextField label="Заметка (необязательно)" defaultValue="синяя пачка" hint="До 500 символов" />
    </div>
  );
}

export function Price() {
  return (
    <div style={column}>
      <TextField
        label="Цена за всё (×2), ₽"
        inputMode="decimal"
        defaultValue="112,50"
        suffix="₽"
        hint="Цена всей строки, не за штуку. 0 — допустимо."
      />
    </div>
  );
}

export function WithError() {
  return (
    <div style={column}>
      <TextField label="Название" defaultValue="" error="Укажите название" />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={column}>
      <TextField label="Магазин" defaultValue="Пятёрочка у офиса" disabled />
    </div>
  );
}
