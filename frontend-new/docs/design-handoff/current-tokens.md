# Токены, реально используемые прототипом (Phase 2B–3D)

Источник: `src/styles/tokens.css`. Ниже — рабочее подмножество, на котором
построены shared/ui и Store Run. **Compatibility aliases (--bg-base, --ink,
--pri, --t-*, --sp-* и т.п.) частью новой системы НЕ считаются** — они
обслуживают легаси до фазы 7 и в Penpot не переносятся.

## Цвет (семантика; значения безопасно менять после Penpot)

| Токен | Назначение | Light | Dark |
|---|---|---|---|
| `--canvas` | фон экрана (+tg-synced подхват из Telegram) | #F1F3F6 | #121317 |
| `--surface` | поверхность полей/кнопок secondary | #FFFFFF | #1E2025 |
| `--surface-secondary` | вторичная подложка (ghost hover, иконки состояний) | #F3F5F8 | #17181C |
| `--elevated` | плавающие поверхности (BottomSheet) | #FFFFFF | #26282F |
| `--text-primary/-secondary/-tertiary` | текстовая иерархия | #1D2127 / #5D646F / #8B929E | #F1F3F7 / #AEB5C0 / #787F8C |
| `--divider` | разделители, фон progress-бара, neutral-Status | rgba(55,65,90,.10) | rgba(228,235,248,.08) |
| `--accent` (+`-hover/-active/-tint/-foreground`) | primary-кнопка, активный прогресс, Status accent | #B27708… | #F0AB46… |
| `--success`/`-tint`/`-foreground` | Status «Куплено» | #47823A… | #8FCB7F… |
| `--warning`/`-tint` | Status «В магазине», warning-notice | #A97B0E… | #E8B54A… |
| `--danger`/`-tint`/`-foreground` | destructive, Status «Не нашли», critical-notice, ошибка поля | #C2503B… | #EE7A5F… |
| `--info`/`-tint` | info-notice | #2A7BD6… | #56A8F5… |
| `--overlay` | scrim шторок | rgba(8,12,18,.45) | .55 |
| `--focus-ring` | focus-visible, focus поля | rgba(214,137,20,.55) | rgba(240,171,70,.5) |

Материалы `--card-grad/--float-grad/--surface-glass/--shadow-1..3` использует
легаси и BottomSheet-поверхность; после Penpot пересматриваются свободно.

## Шкалы (менять можно, компоненты параметризованы)

- spacing: `--space-1..16` (4/8/12/16/24/32/48/64)
- type: `--text-11/13/15/16/18/22/28`; `--font-body` = Onest (self-host),
  `--font-brand` = Unbounded (только бренд; сейчас через легаси-alias
  `--font-head` стоит на заголовках — кандидат на пересмотр в Penpot)
- radius: `--radius-card 26 / --radius-block 17 / --radius-control 17 / --radius-pill`
- control: `--control-sm 38 / --control-md 44 (минимум touch) / --control-lg 52`
- motion: `--motion-fast 150 / base 220 / slow 300`, `--ease-out/-spring`;
  слой `styles/motion.css` добавляет `--motion-page 260 / --motion-in 200` и
  расстояния `--shift-page 16 / --shift-in 10 / --shift-boot 14`.
  `.anim-boot-*` — сборка кадра при первом открытии (шапка, контент, таббар),
  `.anim-page` — навигация, `.anim-in` — то, что изменилось при открытом экране.
  Приход данных не анимируется. Заметность даёт расстояние: 8 px не читались.
- z-index: `--z-header 40 / --z-nav 40 / --z-scrim 44 / --z-fab 45 / --z-overlay 60 / --z-sheet 61 / --z-toast 70`
- safe-area: `--safe-area-*`, `--viewport-stable-height` (JS-синхронизация с Telegram) — **не трогать**, инфраструктура

## Что фиксировано НЕ визуально

`--control-md ≥ 44px` (touch), safe-area/z-index слои, focus-ring обязан быть
видимым. Остальные значения — свободны для Penpot.
