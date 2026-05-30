# Spec: Poll Bottom Sheet Redesign (Step 1)

**Date:** 2026-05-30  
**Status:** Approved  
**Scope:** `frontend/src/components/polls/CreatePollForm.tsx` — Step 1 UI only

---

## Problem

The current Step 1 of the bottom sheet has three issues:

1. **Not full-height** — sheet is capped at `max-h-[92vh]` and doesn't feel like a native full-screen panel.
2. **Cards too large** — each setting wrapped in a `PastelCard` with generous padding; the form is cramped and requires scrolling even with only 3 settings.
3. **Encoding bug** — Cyrillic strings in `CreatePollForm.tsx` are corrupted (file saved with wrong encoding). Labels render as `РŸРёСЂ…` in production.

---

## Solution: Variant B — Rows without cards

Replace the card-based layout with a lightweight row-based layout (section-label + icon row + inline control). No `PastelCard` wrappers on settings. Style matches existing lavender/peach token system.

---

## Visual Design

### Layout structure (Step 1)

```
┌─────────────────────────────────┐
│          ▬▬▬  drag handle       │
│ ═══════════  ───────────────    │  ← progress bar (lavender active / muted idle)
│ Создать голосование         ✕   │  ← header
├─────────────────────────────────┤
│ ГРУППА                          │  ← section-label (10px uppercase muted)
│ [🍽️] Тест на проде          ●  │  ← row: icon + name + check-circle
├─────────────────────────────────┤
│ ДЛИТЕЛЬНОСТЬ           30 мин   │  ← section-label + current value (accent)
│ [15м] [30м] [1ч] [2ч]          │  ← preset pills (slim)
│ ●━━━━━━━━━━━━━━━━━  ──────     │  ← 2px slider with thumb
│ 5 мин                  4 часа   │  ← min/max labels
├─────────────────────────────────┤
│ ТИП ГОЛОСА                      │  ← section-label
│ [Одно блюдо]  [Несколько]       │  ← segmented control (pill toggle)
├─────────────────────────────────┤
│  [Далее · Выбрать блюда →]      │  ← full-width CTA button
└─────────────────────────────────┘
```

### Colors

| Token | Dark | Light |
|---|---|---|
| Background | `#161c26` (`bg-background`) | `#f0ece6` |
| Section label | `text-muted-foreground` 9.5px uppercase | same |
| Row icon bg | `bg-lavender-500/12` | `bg-peach-500/10` |
| Accent / selected | `lavender-400` `#A78BFA` | `peach-500` `#D86A2C` |
| Preset selected bg | `bg-lavender-500/15 border-lavender-500/40` | `bg-peach-500/10 border-peach-500/35` |
| Slider / check | `#8B5CF6` | `#D86A2C` |
| CTA button | `bg-lavender-500` gradient | `bg-peach-500` gradient |
| Separator | `border-white/[0.04]` | `border-black/[0.05]` |

### Sheet height

Change bottom sheet container in `HomePage.tsx`:
```
max-h-[92vh] → max-h-[96dvh]
```

Use `dvh` (dynamic viewport height) to avoid iOS Safari bar interference.

---

## Encoding Fix

All Cyrillic string literals in `CreatePollForm.tsx` are corrupted. They must be replaced with correct UTF-8 strings. Full replacement list:

| Corrupted | Correct |
|---|---|
| `Р¤РѕСЂРјР° СЃРѕР·РґР°РЅРёСЏ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ` | `Форма создания голосования` |
| `РЎРєСЂРѕРёС‚СЊ РЅР°РЅРѕСЃРёС‚СЊ РіРѕР»РѕСЃРѕРІР°РЅРёРµ` | `Создать голосование` |
| `Р"Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ` | `Длительность` |
| `РњРёРЅСѓС‚` | `Минут` |
| `Р§Р°СЃРѕРІ` | `Часов` |
| `Р'С‹Р±РµСЂРёС‚Рµ РіСЂСѓРїРїСѓ` | `Выберите группу` |
| `РћРґРЅРѕ Р±Р»СЋРґРѕ` | `Одно блюдо` |
| `РќРµСЃРєРѕР»СЊРєРѕ Р±Р»СЋРґ` | `Несколько блюд` |
| `Р"Р°Р»РµРµ` | `Далее` |
| `Р'С‹Р±СЂР°С‚СЊ Р±Р»СЋРґР°` | `Выбрать блюда` |

**Approach:** Re-encode the file. Open as bytes → detect encoding → resave as UTF-8. Or do a bulk `sed` replacement of all corrupted sequences.

---

## Implementation Scope

### Files to change

1. **`frontend/src/components/polls/CreatePollForm.tsx`**
   - Fix encoding (all Cyrillic strings)
   - Step 1 return block: remove `PastelCard` wrappers, replace with row layout
   - Keep: drag handle, progress bar, step logic, canAdvance(), DURATION_PRESETS, all state
   - Keep: Step 2 unchanged

2. **`frontend/src/pages/HomePage.tsx`**
   - Change `max-h-[92vh]` → `max-h-[96dvh]` on the bottom sheet container

### What NOT to change

- Step 2 (menu item selection) — unchanged
- All state/logic in CreatePollForm — unchanged
- Group fetching, validation, onSuccess/onCancel — unchanged
- Bottom sheet animation in HomePage — unchanged

---

## Acceptance Criteria

- [ ] Step 1 renders without PastelCard boxes, only rows with section labels
- [ ] All Cyrillic text readable (no garbled characters)
- [ ] Sheet height is noticeably taller (96dvh)
- [ ] Dark mode: lavender accent, light mode: peach accent
- [ ] `canAdvance()` still gates the Далее button (disabled when no group)
- [ ] Duration presets highlight the selected value
- [ ] Segmented control shows selected vote type
- [ ] Step 2 still works after navigating to it
