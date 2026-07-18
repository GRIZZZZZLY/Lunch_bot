# Rocket Lunch UI — правила использования

Мобильный Telegram Mini App (430px, русский язык). Тёплая палитра «графит и мёд».

## Обязательная обёртка

Все цветовые токены определены на `<html data-theme="light">` (или `"dark"`).
Без атрибута компоненты рендерятся БЕЗ стилей. Оберни приложение в
`RocketLunchUI.DSThemeRoot` — он выставляет атрибут сам:

```jsx
<DSThemeRoot theme="light">
  <App />
</DSThemeRoot>
```

## Идиома стилинга

Компоненты стилизованы внутри (CSS Modules) — **не выдумывай CSS-классы для
них и не переопределяй их стили**. Собственный layout-клей пиши инлайн-стилями
или своим CSS **только на токенах** `var(--*)`:

- Поверхности: `--canvas` (фон экрана), `--surface`, `--surface-secondary`, `--elevated` (шторки), `--overlay` (скрим)
- Текст: `--text-primary`, `--text-secondary`, `--text-tertiary`; разделители: `--divider`
- Акцент: `--accent`, `--accent-foreground`, `--accent-hover`, `--accent-active`, `--accent-tint`; фокус: `--focus-ring`
- Семантика: `--success`, `--warning`, `--danger`, `--info` (+ `-tint` у каждого)
- Отступы: `--space-1|2|3|4|6|8|12|16` (4…64px); радиусы: `--radius-card` (26), `--radius-block` (17), `--radius-control` (17), `--radius-pill`
- Шрифт: `--text-11|13|15|16|18|22|28`; `--font-body` (Onest — всё), `--font-brand` (Unbounded — ТОЛЬКО логотип/редкие крупные заголовки)
- Высоты контролов: `--control-sm|md|lg` (38/44/52); motion: `--motion-fast|base|slow`, `--ease-out|spring`

Тап-цели ≥44px. Никаких градиентов/glow/glass в своём клее — плоские
поверхности, разделители, вертикальный ритм.

## Правила компонентов

- `Button`: варианты `primary|secondary|ghost|destructive`; `loading` не меняет ширину; `block` — на всю ширину. Одна primary-CTA на экран.
- `IconButton`: `aria-label` обязателен; имена иконок: `plus, edit, trash, x, check, clock, cart, ban, info, search, bell, home, menu, stats, user, crown, send, sparkle, flame`.
- `TextField`: `label` всегда; для цены — `inputMode="decimal"` + `suffix="₽"`; ошибки через `error`, подсказки через `hint`.
- `Status`: компактная метка, текст обязателен (цвет — не единственный канал); `tone` + опц. `icon`.
- `InlineNotice`: `info|warning|critical` — сообщение по месту, не карточка.
- `EmptyState`/`ErrorState`: пустые/ошибочные экраны; у ErrorState пресеты `network|forbidden|notFound` + `onRetry`.
- `ConfirmDialog`: подтверждение необратимых действий (`destructive`, `pending`); одновременно активен один.
- `Skeleton`: `text|circle|block` — состояния загрузки.

## Где истина

Токены и стили: `styles.css` (тянет `_ds_bundle.css`). API компонента: `components/general/<Name>/<Name>.d.ts`; примеры: `<Name>.prompt.md`.

## Идиоматичный пример

```jsx
<DSThemeRoot theme="light">
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', background: 'var(--canvas)' }}>
    <Status tone="warning" icon="cart">В магазине</Status>
    <TextField label="Цена за всё (×2), ₽" inputMode="decimal" suffix="₽" hint="0 — допустимо" />
    <Button block>Рассчитать</Button>
  </div>
</DSThemeRoot>
```
