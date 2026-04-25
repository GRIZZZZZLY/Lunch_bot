# HomeHeroCard — Time Tint + Poll Status Design

**Date:** 2026-04-26  
**Status:** Approved

## Summary

Redesign the top greeting card on the Home page to add a time-of-day colour tint and a poll status badge. The card keeps its compact height and `bg-card` base — consistent with other cards in the project (BudgetWidget, HomeActionsSection tiles).

## Visual Approach

- **Base:** `bg-card` (unchanged)
- **Overlay:** `absolute inset-0` gradient div at low opacity — changes colour by time of day
- **Border:** coloured border matching the overlay tone
- **No decorative emoji / no full gradient fill** — minimal tint only

## Colour Mapping (time of day → project tokens)

| Period | Hours | Project colour | Border opacity | Overlay opacity |
|--------|-------|----------------|---------------|-----------------|
| Morning | 06:00–11:00 | `peach` — `rgba(251,146,60,…)` | /28 | /12 |
| Afternoon | 11:00–16:00 | `mint` — `rgba(92,174,135,…)` | /28 | /12 |
| Evening | 16:00–22:00 | `lavender` — `rgba(139,92,246,…)` | /28 | /12 |
| Night | 22:00–06:00 | `butter` — `rgba(255,191,31,…)` | /28 | /10 |

`useTimeBasedGradient` already exists — only its colour values need updating to project tokens. The hook's light/dark split is removed; the overlay adapts automatically because it sits on top of `bg-card`.

## Poll Status Badge

A small badge rendered below the subtitle text. Hidden when no poll is relevant.

| `pollStatus` value | Badge text | Colour |
|--------------------|-----------|--------|
| `none` | *(hidden)* | — |
| `scheduled` | `🗳 Голосование в HH:MM` | muted border tone |
| `active` | `🗳 Идёт голосование` | lavender + **pulse animation** |
| `completed-result` | `✅ Борщ · Отв: Саша` | peach |
| `completed` | `✅ Голосование завершено` | mint |

## New Props on HomeHeroCard

```ts
pollStatus?: 'none' | 'scheduled' | 'active' | 'completed' | 'completed-result'
pollMeta?: {
  time?: string        // "11:00" for scheduled
  winner?: string      // "Борщ" for completed-result
  responsible?: string // "Саша" for completed-result
}
```

## Animations

| Name | Target | Spec |
|------|--------|------|
| Entrance (existing) | whole card | `opacity 0→1, y -12→0`, 280ms easeOut — keep as-is |
| Shimmer | overlay | `motion.div`, `backgroundPositionX ['0%','200%']`, 4s linear infinite; gradient `from-white/5 to-transparent` |
| Pulse | badge (active only) | `scale [1,1.04,1], opacity [1,0.85,1]`, 2s easeInOut infinite |

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/hooks/useTimeBasedGradient.ts` | Replace colour values with project tokens (peach/mint/lavender/butter); remove light/dark split; export `TimeConfig` type with `border`, `overlay`, `shadow` fields |
| `frontend/src/components/home/HomeHeroCard.tsx` | Add overlay div + shimmer motion.div; add badge with conditional pulse; accept `pollStatus` + `pollMeta` props |
| `frontend/src/pages/HomePage.tsx` | Derive `pollStatus` + `pollMeta` from existing query data and pass to `HomeHeroCard` |

## Out of Scope

- No decorative time emoji
- No full-bleed gradient fill
- No changes to greeting/message text logic (stays in `contextual-messages.ts`)
- No new API calls — poll data already fetched on Home page
