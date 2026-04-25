# HomeHeroCard Time-Tint + Poll Status — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a time-of-day colour tint and a poll status badge to the top greeting card on the Home page.

**Architecture:** `useTimeBasedGradient` is updated to return project-token colour values (peach/mint/lavender/butter). `HomeHeroCard` renders an absolute overlay div + shimmer motion.div using those values, plus an optional badge with pulse animation driven by new `pollStatus`/`pollMeta` props. `HomePage` derives those props from existing `activePoll` and `todayCompletedPoll` query data — no new API calls.

**Tech Stack:** React, framer-motion, Tailwind CSS, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/hooks/useTimeBasedGradient.ts` | Modify | Export project-token colours for border/overlay/shadow per time period |
| `frontend/src/components/home/HomeHeroCard.tsx` | Modify | Consume time colours; render overlay, shimmer, poll badge |
| `frontend/src/pages/HomePage.tsx` | Modify | Derive `pollStatus`/`pollMeta` from existing queries; pass to `HomeHeroCard` |

---

## Task 1: Update `useTimeBasedGradient` with project-token colours

**Files:**
- Modify: `frontend/src/hooks/useTimeBasedGradient.ts`

### What changes

Replace the current rgba splits (light/dark) with a single set of values aligned to project tokens (peach / mint / lavender / butter). Add a new exported type `TimeColors` and field `colors` on the return value.

- [ ] **1.1 Replace the GRADIENTS constant and add TimeColors type**

Open `frontend/src/hooks/useTimeBasedGradient.ts` and replace the file content with:

```ts
import { useState, useEffect } from 'react';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeColors {
  border: string;   // rgba for Tailwind border colour
  overlay: string;  // CSS linear-gradient for overlay div
  shadow: string;   // box-shadow value
  glow: string;     // rgba base for ring/badge accents
}

export interface GradientColors {
  from: string;
  to: string;
  textColor: string;
  timeOfDay: TimeOfDay;
  label: string;
  colors: TimeColors;
}

// Project-token aligned colours
// peach=morning  mint=afternoon  lavender=evening  butter=night
const TIME_COLORS: Record<TimeOfDay, TimeColors> = {
  morning: {
    border: 'rgba(251,146,60,0.28)',
    overlay: 'linear-gradient(135deg,rgba(251,146,60,0.12) 0%,rgba(234,88,12,0.06) 100%)',
    shadow: '0 8px 20px rgba(251,146,60,0.10)',
    glow: 'rgba(251,146,60,',   // append opacity + ")"
  },
  afternoon: {
    border: 'rgba(92,174,135,0.28)',
    overlay: 'linear-gradient(135deg,rgba(92,174,135,0.12) 0%,rgba(52,211,153,0.06) 100%)',
    shadow: '0 8px 20px rgba(92,174,135,0.10)',
    glow: 'rgba(92,174,135,',
  },
  evening: {
    border: 'rgba(139,92,246,0.28)',
    overlay: 'linear-gradient(135deg,rgba(139,92,246,0.12) 0%,rgba(109,40,217,0.06) 100%)',
    shadow: '0 8px 20px rgba(139,92,246,0.10)',
    glow: 'rgba(139,92,246,',
  },
  night: {
    border: 'rgba(255,191,31,0.28)',
    overlay: 'linear-gradient(135deg,rgba(255,191,31,0.10) 0%,rgba(234,179,8,0.05) 100%)',
    shadow: '0 8px 20px rgba(255,191,31,0.08)',
    glow: 'rgba(255,191,31,',
  },
};

// Legacy gradient colours kept for any existing consumers
const GRADIENTS = {
  morning: { from: 'rgba(255,237,213,0.7)', to: 'rgba(254,215,170,0.7)', textColor: '#9A3412', label: 'завтрака' },
  afternoon: { from: 'rgba(134,239,172,0.7)', to: 'rgba(74,222,128,0.7)', textColor: '#166534', label: 'обеда' },
  evening: { from: 'rgba(191,219,254,0.7)', to: 'rgba(147,197,253,0.7)', textColor: '#1E40AF', label: 'ужина' },
  night: { from: 'rgba(196,181,253,0.7)', to: 'rgba(167,139,250,0.7)', textColor: '#5B21B6', label: 'перекуса' },
} as const;

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 16) return 'afternoon';
  if (hour >= 16 && hour < 22) return 'evening';
  return 'night';
}

export function useTimeBasedGradient(
  _isDark: boolean = false,
  updateInterval: number = 60000,
): GradientColors & { gradient: string } {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => getTimeOfDay());

  useEffect(() => {
    const update = () => setTimeOfDay(getTimeOfDay());
    update();
    const id = setInterval(update, updateInterval);
    return () => clearInterval(id);
  }, [updateInterval]);

  const g = GRADIENTS[timeOfDay];
  const gradient = `linear-gradient(135deg,${g.from},${g.to})`;

  return {
    gradient,
    from: g.from,
    to: g.to,
    textColor: g.textColor,
    timeOfDay,
    label: g.label,
    colors: TIME_COLORS[timeOfDay],
  };
}

export function useTimeBasedGradientVars(_isDark: boolean = false) {
  const { from, to, textColor } = useTimeBasedGradient(_isDark);
  return {
    '--gradient-from': from,
    '--gradient-to': to,
    '--gradient-text': textColor,
  } as React.CSSProperties;
}

export function getTimeBasedGradientStatic(
  _isDark: boolean = false,
  customTime?: TimeOfDay,
): GradientColors & { gradient: string } {
  const timeOfDay = customTime || getTimeOfDay();
  const g = GRADIENTS[timeOfDay];
  const gradient = `linear-gradient(135deg,${g.from},${g.to})`;
  return {
    gradient,
    from: g.from,
    to: g.to,
    textColor: g.textColor,
    timeOfDay,
    label: g.label,
    colors: TIME_COLORS[timeOfDay],
  };
}
```

- [ ] **1.2 Verify TypeScript compiles**

```bash
cd frontend && npm run type-check 2>&1 | tail -20
```

Expected: no errors (or only pre-existing errors unrelated to this file).

- [ ] **1.3 Commit**

```bash
git add frontend/src/hooks/useTimeBasedGradient.ts
git commit -m "feat(hero): update useTimeBasedGradient with project-token colours"
```

---

## Task 2: Update `HomeHeroCard` — overlay, shimmer, badge

**Files:**
- Modify: `frontend/src/components/home/HomeHeroCard.tsx`

### What changes

Add:
1. `pollStatus` and `pollMeta` props
2. `TimeColors` prop (passed from parent)
3. Coloured border + shadow via inline style
4. Absolute overlay div with time-based gradient
5. Shimmer `motion.div` on top of overlay
6. Poll status badge below the subtitle, with pulse on `active`

- [ ] **2.1 Replace `HomeHeroCard.tsx` content**

```tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { UserAvatar } from '../common/UserAvatar';
import { ThemeToggle } from '../ui/theme-toggle';
import { TYPOGRAPHY_SMALL } from '@/lib/typography';
import { cn } from '@/lib/utils';
import { TimeColors } from '@/hooks/useTimeBasedGradient';

export type PollStatus = 'none' | 'active' | 'completed' | 'completed-result';

export interface PollMeta {
  time?: string;       // e.g. "11:30" for scheduled/active end time
  winner?: string;     // e.g. "Борщ"
  responsible?: string;// e.g. "Саша"
}

interface HomeHeroCardProps {
  greeting: string;
  message: string;
  currentStreak?: number;
  user?: { id?: number; firstName?: string; lastName?: string | null } | null;
  onAvatarClick: () => void;
  timeColors?: TimeColors;
  pollStatus?: PollStatus;
  pollMeta?: PollMeta;
}

function PollBadge({ status, meta }: { status: PollStatus; meta: PollMeta }) {
  if (status === 'none') return null;

  const isActive = status === 'active';

  let text = '';
  let bg = '';
  let border = ''
  let color = '';

  if (status === 'active') {
    text = meta.time ? `🗳 Голосование до ${meta.time}` : '🗳 Идёт голосование';
    bg = 'rgba(139,92,246,0.12)';
    border = 'rgba(139,92,246,0.30)';
    color = '#c4b5fd';
  } else if (status === 'completed-result') {
    const parts = ['✅', meta.winner, meta.responsible ? `· Отв: ${meta.responsible}` : ''].filter(Boolean);
    text = parts.join(' ');
    bg = 'rgba(251,146,60,0.12)';
    border = 'rgba(251,146,60,0.28)';
    color = '#fb923c';
  } else {
    // completed
    text = '✅ Голосование завершено';
    bg = 'rgba(92,174,135,0.12)';
    border = 'rgba(92,174,135,0.28)';
    color = '#6ee7b7';
  }

  const badge = (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border"
      style={{ background: bg, borderColor: border, color }}
    >
      {text}
    </span>
  );

  if (isActive) {
    return (
      <motion.div
        className="mt-1.5"
        animate={{ scale: [1, 1.04, 1], opacity: [1, 0.85, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {badge}
      </motion.div>
    );
  }

  return <div className="mt-1.5">{badge}</div>;
}

export const HomeHeroCard: React.FC<HomeHeroCardProps> = ({
  greeting,
  message,
  currentStreak = 0,
  user,
  onAvatarClick,
  timeColors,
  pollStatus = 'none',
  pollMeta = {},
}) => (
  <motion.div
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: 'easeOut' }}
    className="relative overflow-hidden rounded-2xl bg-card border"
    style={{
      borderColor: timeColors?.border ?? 'var(--border)',
      boxShadow: timeColors?.shadow,
    }}
  >
    {/* Time-of-day overlay */}
    {timeColors && (
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{ background: timeColors.overlay }}
      />
    )}

    {/* Shimmer */}
    {timeColors && (
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.05) 50%,transparent 60%)',
          backgroundSize: '200% 100%',
        }}
        animate={{ backgroundPositionX: ['0%', '200%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />
    )}

    {/* Content */}
    <div className="relative z-10 flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-foreground text-2xl font-bold tracking-tight leading-snug">
            {greeting}
          </h1>
          {message ? (
            <p className={cn('mt-1 text-foreground/70 dark:text-muted-foreground', TYPOGRAPHY_SMALL.className)}>
              {message}
            </p>
          ) : null}
          <PollBadge status={pollStatus} meta={pollMeta} />
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <ThemeToggle variant="ghost" size="sm" />
        <div className="flex flex-col items-center gap-1">
          <div className="cursor-pointer" onClick={onAvatarClick}>
            <UserAvatar
              userId={user?.id}
              firstName={user?.firstName || 'User'}
              lastName={user?.lastName || undefined}
              size="md"
              className="ring-2 ring-primary/20"
            />
          </div>
          {currentStreak > 0 && (
            <div className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <Flame className="size-3.5 fill-current" />
              <span>{currentStreak} дн.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  </motion.div>
);
```

- [ ] **2.2 Type-check**

```bash
cd frontend && npm run type-check 2>&1 | tail -20
```

Expected: no new errors.

- [ ] **2.3 Commit**

```bash
git add frontend/src/components/home/HomeHeroCard.tsx
git commit -m "feat(hero): overlay + shimmer + poll badge in HomeHeroCard"
```

---

## Task 3: Wire up in `HomePage`

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx`

### What changes

1. Pass `timeColors` from `useTimeBasedGradient` to `HomeHeroCard`
2. Derive `pollStatus` and `pollMeta` from existing `activePoll` and `todayCompletedPoll`

- [ ] **3.1 Add imports at the top of `HomePage.tsx`**

Add to the existing import block (near the other `../components/home/` imports):

```ts
import { type PollStatus, type PollMeta } from '../components/home/HomeHeroCard';
```

- [ ] **3.2 Derive pollStatus/pollMeta — add after `todayCompletedPoll` is declared (~line 190)**

Find the block ending with `useTodayCompletedPoll(...)` (~line 186–189) and add immediately after it:

```ts
// Derive hero card poll status from existing query data
const heroPollStatus: PollStatus = (() => {
  if (activePoll) return 'active';
  if (todayCompletedPoll) {
    const result = (todayCompletedPoll as any).result;
    if (result) return 'completed-result';
    return 'completed';
  }
  return 'none';
})();

const heroPollMeta: PollMeta = (() => {
  if (activePoll) {
    const endDate = activePoll.endTime ? new Date(activePoll.endTime) : null;
    const time = endDate
      ? `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`
      : undefined;
    return { time };
  }
  if (todayCompletedPoll) {
    const result = (todayCompletedPoll as any).result;
    if (result) {
      const winner = result.winnerItem?.name as string | undefined;
      const responsible = result.responsibleUser
        ? (result.responsibleUser.firstName as string)
        : undefined;
      return { winner, responsible };
    }
  }
  return {};
})();
```

- [ ] **3.3 Pass new props to `HomeHeroCard`**

Find the existing `<HomeHeroCard` call (~line 708) and add three props:

```tsx
<HomeHeroCard
  greeting={contextualGreeting.greeting}
  message={contextualGreeting.message}
  currentStreak={userStreak.currentStreak}
  user={user}
  onAvatarClick={() => navigate('/profile')}
  timeColors={gradientColors.colors}
  pollStatus={heroPollStatus}
  pollMeta={heroPollMeta}
/>
```

- [ ] **3.4 Type-check**

```bash
cd frontend && npm run type-check 2>&1 | tail -20
```

Expected: no new errors.

- [ ] **3.5 Commit**

```bash
git add frontend/src/pages/HomePage.tsx
git commit -m "feat(hero): wire time-colors and poll status into HomeHeroCard"
```

---

## Task 4: Visual smoke test

- [ ] **4.1 Start the app**

```powershell
cd telegram-food-bot
.\start-prod-dev.ps1
```

- [ ] **4.2 Check each time period manually**

Open browser devtools console and run to simulate time periods:

```js
// Test morning tint (peach border)
// Change system clock or verify current time gives expected colour.
// In the Network tab confirm HomeHeroCard renders with border-color rgba(251,146,60,…)
```

- [ ] **4.3 Verify badge states**

| Scenario | Expected badge |
|----------|---------------|
| `activePoll` exists | lavender pulsing badge "🗳 Голосование до HH:MM" |
| `todayCompletedPoll` with result | peach badge "✅ Борщ · Отв: Саша" |
| `todayCompletedPoll` without result | mint badge "✅ Голосование завершено" |
| Neither | no badge rendered |

- [ ] **4.4 Final commit**

```bash
git add -A
git commit -m "feat(hero): time-tint + poll status badge complete"
```
