# Инвентарь состояний компонентов (для Penpot-макетов)

Для каждого компонента перечислены состояния, которые обязаны существовать в
макетах. Проверка: light/dark, длинный русский текст, 320px — для всех.
Живьём всё можно посмотреть на dev-витрине `/dev/ui` (npm run dev) и на
скриншотах `../frontend-redesign/screenshots/phase-2c|3c|3d/`.

## shared/ui

**Button** (`variant: primary | secondary | ghost | destructive`; `block`)
- normal · hover · pressed (scale) · focus-visible (двойное кольцо) ·
  disabled (opacity .45) · loading (спиннер, ширина не меняется).

**IconButton** (44×44, `ghost | secondary | destructive`)
- те же состояния; иконка 20px; aria-label обязателен.

**TextField** (label / hint / error / prefix / suffix / disabled)
- normal · focus-within (рамка + кольцо tint) · error (danger-рамка + текст
  под полем, role=alert) · disabled · заполненное/placeholder · inputMode=decimal.

**Status** (`neutral | accent | success | warning | danger | info`, опц. иконка)
- единственное состояние; текст обязателен (цвет не единственный канал).

**InlineNotice** (`info | warning | critical`, опц. title, вложенный контент/ссылка)
- 3 тона; с заголовком и без; с action-ссылкой («Показать»).

**ConfirmDialog** (на BottomSheet)
- открыт · destructive-confirm · pending (обе кнопки заблокированы, Escape/
  backdrop/BackButton не закрывают) · single-instance.

**Skeleton** (`text | circle | block`) — shimmer; отключается prefers-reduced-motion.

**EmptyState / ErrorState** — иконка + заголовок + описание (+ действие/Retry);
ErrorState пресеты network / forbidden / notFound.

## Store Run (feature)

**ShoppingProgress** — 0/0 (пустой) · частичный · полный; полоса + счётчики.

**ShoppingItemRow** — 7 состояний (см. baseline): REQUESTED · BOUGHT ·
NOT_FOUND · inline-editor открыт (пустой/prefilled/с ошибкой) · pending ·
disabled (во время settle) · длинные name/notes/owner.

**StoreItemRow (COLLECTING)** — own (edit/delete 44×44) · foreign (read-only) ·
с notes · quantity>1.

**CollectionCountdown** — активный (время+полоса, low <60с danger) ·
истёкший (InlineNotice «Сбор закрывается…»).

## Оболочка

**BottomSheet** — открыт · с footer-кнопками · прокручиваемый контент ·
safe-area отступ · focus-trap (не визуально, но слои: scrim `--overlay` +
поверхность `--elevated`).

**BottomNavigation** — 4 таба (конфигурируемо) · активный (tint+accent) ·
бейдж активных опросов · glass-подложка (временный стиль).

**ScreenHeader (DetailLayout)** — title (ellipsis) + action-слот (Status) ·
in-app «Назад» только вне Telegram · sticky.
