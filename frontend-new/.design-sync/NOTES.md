# design-sync notes — frontend-new (Rocket Lunch)

- Репо — приложение (Vite), не библиотека: DS-поверхность = `src/shared/ui` (9 примитивов Phase 2C) + `src/styles/tokens.css` + self-host шрифты `public/fonts`.
- Storybook отсутствует в frontend-new; Storybook в соседнем `frontend/` — про другие (легаси) компоненты, НЕ использовать.
- node_modules ставится через `npm ci` (package-lock). При sync 2026-07-18 install пропущен: зависимости были поставлены и проверены в тот же день (билды/тесты зелёные).
- Компоненты на CSS Modules + семантические токены; тема через `<html data-theme="light|dark">` (+класс `dark`). Провайдера нет; для рендера нужен только `data-theme` на корне и подключённый styles.css.
- Icon для IconButton/Status/EmptyState/ErrorState/InlineNotice живёт вне shared/ui: `src/components/rl/Icon.tsx`; ConfirmDialog строится на `src/components/rl/BottomSheet.tsx` + `src/lib/backButton.ts` (Telegram BackButton — в браузере no-op).
- Визуал примитивов — временный baseline до Penpot-рестайла (см. docs/design-handoff/).

## Sync 2026-07-18 — что сработало
- Дискавери: `componentSrcMap` обязателен (нет .d.ts-дерева — приложение, не пакет); entry = `src/shared/ui/index.ts` через `--entry`.
- Токены: `cssEntry: src/styles/tokens.css` (tokensGlob работает только с tokensPkg из node_modules). Конвертер сам переписал `/fonts/...` url на `fonts/` и дропнул мёртвые @font-face.
- Шрифты: `.design-sync/ds-fonts.css` (@font-face с относительными путями) в `extraFonts`.
- Тема: `.design-sync/ds-theme-root.tsx` (DSThemeRoot) через `extraEntries` + `provider` — выставляет `data-theme` на html.
- ConfirmDialog (fixed-оверлей): превью в Frame с `transform: translateZ(0)` (containing block для fixed) + override `cardMode: single`; InlineNotice — `cardMode: column` (grid overflow).
- Playwright: ставить в .ds-sync ту же версию, что в scripts/screenshot-runner (1.59.1) — chromium уже в кэше.

## Known render warns
- (пусто — финальный render check 9/9 чистый, bad/thin/variantsIdentical = 0)

## Re-sync risks
- Визуал примитивов — временный baseline: после Penpot-рестайла НУЖЕН re-sync (стили/токены изменятся; грейды по renderHash пересчитаются сами).
- `ds-fonts.css` дублирует @font-face из tokens.css — при смене шрифтов в продукте обновить ОБА файла.
- Иконки для conventions.md перечислены из `components/rl/Icon.tsx` — при добавлении компонентов с новыми иконками сверить список.
- `DSThemeRoot`/`ds-theme-root.tsx` живёт вне src/ — приложение о нём не знает; это sync-only артефакт.
- Превью импортируют из 'telegram-food-bot-frontend-new' (имя пакета приложения) — при переименовании пакета обновить все .design-sync/previews/*.tsx.
