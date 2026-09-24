# Tab header and notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The top bar of the four root tabs stops being a logo strip and becomes the tab title plus a team status slot, and every notification appears in that bar's frame on every screen.

**Architecture:** Root tabs reuse the detail screens' `ScreenHeaderContext`: a page declares its title and subtitle, `RootLayout` renders them in `Header`, and falls back to the tab label from `ROOT_TABS`. A pure module `lib/teamActivity.ts` turns "active polls and store runs of all my teams" (two existing endpoints called without `groupId`) into a model for the team slot. Toasts keep `useToastStore` and its 68 call sites, become single-slot, and render in a fixed layer whose geometry equals the header bar.

**Tech Stack:** React 18, TypeScript, react-router 6, @tanstack/react-query 5, zustand, CSS modules, Vitest + Testing Library, Playwright.

**Spec:** [frontend-new/docs/design-guidelines/screens.md](../../../frontend-new/docs/design-guidelines/screens.md) — sections «Шапка вкладок» and «Уведомления».

## Global Constraints

- All user-facing strings exactly as in the spec: «Голосуем · 12:41», «Голосуем · завершается…», «Закупка · сбор», «Закупка · в магазине», «Тихо», sheet title «Команды», «Закрыть уведомление», aria-label of the team trigger `Команда: <название>. Сменить`.
- No emoji or text glyphs as icons; only `Icon` from `frontend-new/src/components/rl/Icon.tsx` (`chevronDown`, `check`, `x`, `alert`, `info`).
- No `transition-all`; animate only `transform` and `opacity`; colour feedback may use `transition: color/background-color`.
- Every interactive element has `hover`, `focus-visible` and `active` states and a hit area of at least 44×44 px.
- Only existing tokens from `frontend-new/src/styles/tokens.css` (`--vote-tint`, `--vote-on-tint`, `--shop-tint`, `--shop-on-tint`, `--accent`, `--accent-foreground`, `--accent-tint`, `--surface`, `--surface-secondary`, `--focus-ring`, `--radius-pill`, `--radius-control-sm`, `--space-*`, `--text-*`, `--motion-fast`, `--ease-out`, `--safe-area-top`).
- Header bar: sticky wrapper padding `calc(8px + var(--safe-area-top, 0px)) 12px 8px`, bar height 56 px, class `surf-elevated`. Notification frame: same top, same 12 px side inset inside the 430 px column, `min-height: 56px`, class `surf-elevated`.
- Status data: one request `GET /polls/active` and one `GET /store-runs/active`, both without `groupId`, `refetchInterval: 30_000`. No backend changes.
- Checks before the branch is done (from `CLAUDE.md`): `npm --prefix frontend-new run type-check`, `run type-check:e2e`, `run lint`, `test`, `run build`, `run test:e2e:smoke`.
- Work on branch `feat/header-notifications`, never directly on `main`.

## Review Focus

1. Group ids come in three types: `Poll.groupId` is a string, `StoreRun.groupId` is a number, `group.id` is a number and `currentGroupId` is a string. A run in team 10 must light up team "10". Pinned in Task 4 (`buildTeamActivity` test with numeric run id).
2. Two notifications in the same tick (an error, then a success from another handler) must leave exactly one visible and the earlier one leaving, never a stack. Pinned in Task 1.
3. A notification while a bottom sheet is open must sit above the sheet's dimming and its close button must receive the click. Pinned in Task 6 (`elementFromPoint` check in the probe).
4. A poll whose timer reached zero before the server closed it must read «Голосуем · завершается…», not «Голосуем · 00:00». Pinned in Task 5 (`ActivityLine` test).
5. Activity reported for a team the person is no longer an active member of must not be counted in the dot. Pinned in Task 4 (`teamSlotModel` test with unknown id).

---

### Task 0: Branch

- [ ] **Step 1: Create the branch**

Run: `git switch -c feat/header-notifications`
Expected: `Switched to a new branch 'feat/header-notifications'`

---

### Task 1: One notification on screen

**Files:**
- Modify: `frontend-new/src/store/useToastStore.ts:39-55`
- Test: `frontend-new/src/store/__tests__/useToastStore.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `useToastStore` with unchanged API (`push`, `dismiss`, `clear`, `toasts`); after any `push` that is not a duplicate, at most one toast has `leaving !== true`.

- [ ] **Step 1: Write the failing test and adjust the one that assumed a stack**

In `useToastStore.test.ts`, replace the test `'различает сообщения по типу и заголовку'` with:

```ts
  it('различает сообщения по типу и заголовку', () => {
    const { push } = useToastStore.getState();
    const a = push({ type: 'success', message: 'Готово' });
    const b = push({ type: 'error', message: 'Готово' });
    const c = push({ type: 'success', message: 'Готово', title: 'Закупка' });

    expect(new Set([a, b, c]).size).toBe(3);
  });
```

and add to `describe('useToastStore — уход', ...)`:

```ts
  it('на экране одно уведомление: новое сменяет текущее', () => {
    vi.useFakeTimers();
    const { push } = useToastStore.getState();
    const first = push({ type: 'error', message: 'Не удалось' });
    const second = push({ type: 'success', message: 'Сохранено' });

    const { toasts } = useToastStore.getState();
    expect(toasts.filter((t) => !t.leaving).map((t) => t.id)).toEqual([second]);
    expect(toasts.find((t) => t.id === first)?.leaving).toBe(true);

    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(useToastStore.getState().toasts.map((t) => t.id)).toEqual([second]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix frontend-new test -- src/store/__tests__/useToastStore.test.ts`
Expected: FAIL in `на экране одно уведомление` — two toasts without `leaving`.

- [ ] **Step 3: Implement**

In `useToastStore.ts`, right after the `hapticNotify` line and before `set(...)`, insert:

```ts
    /* На экране одно уведомление: рамка шапки вмещает ровно одно. Новое
       сменяет текущее, а прежнее уходит тем же двухшаговым путём, что и по
       таймеру, — смена читается как замена, а не как обрыв. */
    for (const t of get().toasts) if (!t.leaving) get().dismiss(t.id);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix frontend-new test -- src/store/__tests__/useToastStore.test.ts`
Expected: PASS, all tests (including `повторное снятие уходящего тоста не трогает соседей`).

- [ ] **Step 5: Commit**

```bash
git add frontend-new/src/store/useToastStore.ts frontend-new/src/store/__tests__/useToastStore.test.ts
git commit -m "feat(toast): one notification on screen, a new one replaces the current"
```

---

### Task 2: Notification in the header frame

**Files:**
- Modify: `frontend-new/src/components/common/ToastContainer.tsx` (whole file)
- Modify: `frontend-new/src/styles/toast.css` (whole file)
- Modify: `frontend-new/src/components/layout/Header.tsx:27-34` (wrapper padding only)
- Test: `frontend-new/src/components/common/__tests__/ToastContainer.test.tsx` (create)

**Interfaces:**
- Consumes: `useToastStore` from Task 1.
- Produces: `ToastContainer` renders a permanent `role="region"` named «Уведомления»; each toast has class `toast surf-elevated`; close button named «Закрыть уведомление».

- [ ] **Step 1: Write the failing test**

Create `frontend-new/src/components/common/__tests__/ToastContainer.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastContainer } from '../ToastContainer';
import { useToastStore } from '@/store/useToastStore';

beforeEach(() => {
  useToastStore.getState().clear();
});

describe('ToastContainer', () => {
  it('область объявлений есть и без уведомлений', () => {
    render(<ToastContainer />);
    expect(screen.getByRole('region', { name: 'Уведомления' })).toBeInTheDocument();
  });

  it('ошибка объявляется как alert и сменяет прежнее уведомление', () => {
    const { container } = render(<ToastContainer />);
    act(() => {
      useToastStore.getState().push({ type: 'success', message: 'Сохранено' });
      useToastStore.getState().push({ type: 'error', message: 'Не удалось' });
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось');
    expect(container.querySelectorAll('.toast:not(.is-leaving)')).toHaveLength(1);
  });

  it('крестик снимает уведомление', async () => {
    const { container } = render(<ToastContainer />);
    act(() => {
      useToastStore.getState().push({ type: 'info', message: 'Сбор закрыт' });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть уведомление' }));
    expect(container.querySelector('.toast')).toHaveClass('is-leaving');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix frontend-new test -- src/components/common/__tests__/ToastContainer.test.tsx`
Expected: FAIL in `область объявлений есть и без уведомлений` — the container returns `null` when empty.

- [ ] **Step 3: Implement the container**

Replace `frontend-new/src/components/common/ToastContainer.tsx` with:

```tsx
import { Icon, type IconName } from '@/components/rl/Icon';
import { useToastStore, type ToastType } from '@/store/useToastStore';
import '@/styles/toast.css';

const ICON: Record<ToastType, IconName> = {
  success: 'check',
  error: 'x',
  warning: 'alert',
  info: 'info',
};

/* Уведомление занимает рамку шапки вкладок (components/layout/Header.tsx):
   тот же отступ сверху, те же поля, высота и поверхность. На вкладках оно
   ложится ровно поверх шапки, на detail-экранах выезжает в то же место.
   Слой выше шторок и их затемнения. */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  /* Область объявлений живёт всегда: live-region, появившийся вместе с первым
     сообщением, экранный диктор может не заметить. */
  return (
    <div className="rl toast-stack" role="region" aria-label="Уведомления" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast surf-elevated toast-${t.type}${t.leaving ? ' is-leaving' : ''}`}
          role={t.type === 'error' ? 'alert' : 'status'}
        >
          <span className="toast-icon" aria-hidden>
            <Icon name={ICON[t.type]} size={14} />
          </span>
          <div className="toast-body">
            {t.title && <div className="toast-title">{t.title}</div>}
            <div className="toast-msg">{t.message}</div>
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => dismiss(t.id)}
            aria-label="Закрыть уведомление"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Implement the styles**

Replace `frontend-new/src/styles/toast.css` with:

```css
/* Рамка уведомления = рамка шапки вкладок (Header.tsx): отступ сверху 8 px
   плюс безопасная зона, поля 12 px внутри колонки 430 px, высота от 56 px.
   Поверхность даёт тот же класс surf-elevated, что и у шапки. Менять эти
   числа — только вместе с шапкой, иначе уведомление перестанет совпадать с
   ней по краям. */
.toast-stack {
  position: fixed;
  top: calc(8px + var(--safe-area-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  width: calc(min(100%, 430px) - 24px);
  z-index: 1000;
  /* Одна ячейка сетки: уходящее и входящее уведомления лежат друг на друге,
     а не стопкой. */
  display: grid;
  pointer-events: none;
}

.toast {
  grid-area: 1 / 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  /* Справа 4 px: у крестика своя область 44×44, она и держит поле. */
  padding: 8px 4px 8px 16px;
  pointer-events: auto;
  animation: toast-in 220ms cubic-bezier(.2,.7,.2,1) both;
  color: var(--text-primary);
  font-size: var(--text-13);
  line-height: 1.3;
}

.toast-icon {
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Те же семантические пары, что у InlineNotice и Status. */
.toast-success .toast-icon { background: var(--success); color: var(--success-foreground); }
.toast-error   .toast-icon { background: var(--danger);  color: var(--danger-foreground); }
.toast-warning .toast-icon { background: var(--warning); color: var(--warning-foreground); }
.toast-info    .toast-icon { background: var(--info);    color: var(--info-foreground); }

.toast-body {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-weight: 600;
  margin-bottom: 2px;
}

/* Без обрезки: длинный текст (ошибки сервера) растит рамку вниз. */
.toast-msg {
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.toast-close {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-control-sm);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color var(--motion-fast) var(--ease-out);
}

@media (hover: hover) {
  .toast-close:hover {
    color: var(--text-primary);
  }
}

.toast-close:active {
  opacity: 0.8;
}

.toast-close:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--focus-ring);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Уход. Длительность обязана совпадать с TOAST_EXIT_MS в
   store/useToastStore.ts. При prefers-reduced-motion глобальное правило из
   redesign-v2.css сводит обе анимации к мгновенной смене. */
.toast.is-leaving {
  animation: toast-out 180ms var(--ease-out) both;
  pointer-events: none;
}

@keyframes toast-out {
  to {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
}
```

- [ ] **Step 5: Give the tab header the same top offset**

In `frontend-new/src/components/layout/Header.tsx`, replace the wrapper style block

```tsx
        // Обёртка прозрачная: точечная фактура (body::before) должна
        // просвечивать в отступах, иначе шапка снова читается плашкой.
        padding: '8px 12px',
```

with

```tsx
        // Обёртка прозрачная: точечная фактура (body::before) должна
        // просвечивать в отступах, иначе шапка снова читается плашкой.
        // Безопасная зона — как у шапки detail-экранов; эти же числа
        // повторяет рамка уведомления (styles/toast.css).
        padding: 'calc(8px + var(--safe-area-top, 0px)) 12px 8px',
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm --prefix frontend-new test -- src/components/common src/store`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend-new/src/components/common/ToastContainer.tsx frontend-new/src/components/common/__tests__/ToastContainer.test.tsx frontend-new/src/styles/toast.css frontend-new/src/components/layout/Header.tsx
git commit -m "feat(toast): notification sits in the header frame, above sheets"
```

---

### Task 3: Tab title in the header

**Files:**
- Modify: `frontend-new/src/app/layouts/screenHeader.tsx` (whole file)
- Modify: `frontend-new/src/app/layouts/DetailLayout.tsx:5,20,27,47-56`
- Modify: `frontend-new/src/app/layouts/RootLayout.tsx` (whole file)
- Modify: `frontend-new/src/components/layout/Header.tsx` (whole file)
- Create: `frontend-new/src/features/home/hooks/useGreetingHeader.tsx`
- Delete: `frontend-new/src/features/home/components/Greeting.tsx`
- Modify: `frontend-new/src/features/home/HomePage.tsx:17,134` and the `FirstScreenSkeleton` call
- Modify: `frontend-new/src/features/home/components/FirstScreenSkeleton.tsx`
- Modify: `frontend-new/src/features/home/HomePage.module.css:15-33`
- Modify: `frontend-new/src/features/menu/MenuPage.tsx:127-141`, `MenuPage.module.css:10-29`
- Modify: `frontend-new/src/features/stats/StatsPage.tsx` (four `<h1 className={styles.title}>Статистика</h1>`), `StatsPage.module.css:9-15`
- Modify: `frontend-new/src/features/profile/ProfilePage.tsx:89`
- Test: `frontend-new/src/app/layouts/__tests__/layouts.test.tsx`, `frontend-new/src/features/home/hooks/__tests__/useGreetingHeader.test.tsx` (create), `frontend-new/src/features/home/__tests__/HomePage.test.tsx:173`
- Modify: `frontend-new/tests/production/production-smoke.spec.ts:24`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `ScreenHeaderState { title: ReactNode; action?: ReactNode; subtitle?: ReactNode }`
  - `useScreenHeader(title: ReactNode, action?: ReactNode, subtitle?: ReactNode): void`
  - `useScreenHeaderState(): { header: ScreenHeaderState; api: ScreenHeaderApi }`
  - `Header({ title, subtitle, team }: { title?: ReactNode; subtitle?: ReactNode; team?: ReactNode })` — renders `title` in the screen's only `h1`.
  - `useGreetingHeader(name: string | undefined, loading: boolean): void`

- [ ] **Step 1: Write the failing layout tests**

In `layouts.test.tsx` add a probe next to `DetailProbe`:

```tsx
function TabProbe() {
  useScreenHeader('Заголовок вкладки', undefined, 'Подпись вкладки');
  return <div>tab-контент</div>;
}
```

add two routes inside the `<Route element={<RootLayout />}>` block:

```tsx
            <Route path="/tab" element={<TabProbe />} />
            <Route path="/stats" element={<div>stats-контент</div>} />
```

and extend `describe('RootLayout', ...)`:

```tsx
  it('заголовок и подпись страницы — в шапке, заголовок — h1 экрана', () => {
    renderApp('/tab');
    expect(screen.getByRole('heading', { level: 1, name: 'Заголовок вкладки' })).toBeInTheDocument();
    expect(screen.getByText('Подпись вкладки')).toBeInTheDocument();
  });

  it('без заголовка страницы шапка берёт название вкладки, логотипа нет', () => {
    renderApp('/stats');
    expect(screen.getByRole('heading', { level: 1, name: 'Статистика' })).toBeInTheDocument();
    expect(screen.queryByText('Rocket Lunch')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Write the failing greeting test**

Create `frontend-new/src/features/home/hooks/__tests__/useGreetingHeader.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ScreenHeaderContext } from '@/app/layouts/screenHeader';
import { dateCaption } from '../../lib/selectors';
import { useGreetingHeader } from '../useGreetingHeader';

function Probe({ name, loading }: { name?: string; loading: boolean }) {
  useGreetingHeader(name, loading);
  return null;
}

describe('useGreetingHeader', () => {
  it('отдаёт шапке приветствие с именем и дату подписью', () => {
    const set = vi.fn();
    render(
      <ScreenHeaderContext.Provider value={{ set, reset: vi.fn() }}>
        <Probe name="Игорь" loading={false} />
      </ScreenHeaderContext.Provider>,
    );
    expect(set).toHaveBeenLastCalledWith({
      title: expect.stringMatching(/^(Доброе утро|Добрый день|Добрый вечер), Игорь$/),
      action: undefined,
      subtitle: dateCaption(new Date()),
    });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm --prefix frontend-new test -- src/app/layouts src/features/home/hooks/__tests__/useGreetingHeader.test.tsx`
Expected: FAIL — no `h1` in the root header; module `../useGreetingHeader` not found.

- [ ] **Step 4: Extend the header context**

Replace `frontend-new/src/app/layouts/screenHeader.tsx` with:

```tsx
/* Контекст заголовка экрана. DetailLayout и RootLayout рендерят единую шапку;
   страницы объявляют title/action/subtitle через useScreenHeader. */
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface ScreenHeaderState {
  title: ReactNode;
  action?: ReactNode;
  /** Строка под заголовком: дата на Главной, «12 блюд · Офис» в Меню. */
  subtitle?: ReactNode;
}

export interface ScreenHeaderApi {
  set: (state: ScreenHeaderState) => void;
  reset: () => void;
}

export const ScreenHeaderContext = createContext<ScreenHeaderApi | null>(null);

const EMPTY_HEADER: ScreenHeaderState = { title: '' };

/** Состояние шапки для layout'а: одно на detail-экраны и на корневые вкладки. */
export function useScreenHeaderState() {
  const [header, setHeader] = useState<ScreenHeaderState>(EMPTY_HEADER);
  const api = useMemo<ScreenHeaderApi>(
    () => ({
      set: (next) =>
        setHeader((prev) =>
          prev.title === next.title && prev.action === next.action && prev.subtitle === next.subtitle
            ? prev
            : next,
        ),
      reset: () => setHeader(EMPTY_HEADER),
    }),
    [],
  );
  return { header, api };
}

/**
 * Объявляет заголовок, action-слот и подпись текущего экрана.
 * ВАЖНО: JSX в `title`/`action`/`subtitle` обязан быть мемоизирован
 * (useMemo), иначе каждый рендер страницы будет обновлять layout и зациклит
 * рендер. Строки можно передавать как есть.
 */
export function useScreenHeader(title: ReactNode, action?: ReactNode, subtitle?: ReactNode) {
  const ctx = useContext(ScreenHeaderContext);
  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.set({ title, action, subtitle });
    return () => ctx.reset();
  }, [ctx, title, action, subtitle]);
}
```

- [ ] **Step 5: Use the shared state in DetailLayout**

In `DetailLayout.tsx`:
- change the React import to `import { Suspense, useCallback, useEffect, useRef } from 'react';`
- change the screenHeader import to

```tsx
import { ScreenHeaderContext, useScreenHeaderState } from './screenHeader';
```

- delete `const EMPTY_HEADER: ScreenHeaderState = { title: '' };`
- replace `const [header, setHeaderState] = useState<ScreenHeaderState>(EMPTY_HEADER);` with `const { header, api: headerApi } = useScreenHeaderState();`
- delete the whole `const headerApi = useMemo<ScreenHeaderApi>(...)` block.

- [ ] **Step 6: Rewrite the Header**

Replace `frontend-new/src/components/layout/Header.tsx` with:

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { SchemeThemeToggle } from '@/components/rl/SchemeThemeToggle';
import { useBootReveal } from '@/lib/motion';

interface HeaderProps {
  /** Заголовок вкладки — единственный h1 экрана. */
  title?: ReactNode;
  /** Строка под заголовком. */
  subtitle?: ReactNode;
  /** Плашка команд справа; null — нет. */
  team?: ReactNode;
}

/* Шапка корневых вкладок: заголовок вкладки, плашка команд, тема. Логотипа и
   названия продукта нет — Telegram и так показывает имя бота. Правила —
   docs/design-guidelines/screens.md, «Шапка вкладок». */
export function Header({ title, subtitle, team }: HeaderProps) {
  // Верхняя грань кадра: при первом открытии оседает сверху (styles/motion.css).
  const boot = useBootReveal();
  // Подложка под шапкой нужна только над прокрученным содержимым (redesign-v2.css).
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`rl app-header${scrolled ? ' is-scrolled' : ''}${boot ? ' anim-boot-top' : ''}`}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        // Обёртка прозрачная: точечная фактура (body::before) должна
        // просвечивать в отступах, иначе шапка снова читается плашкой.
        // Безопасная зона — как у шапки detail-экранов; эти же числа
        // повторяет рамка уведомления (styles/toast.css).
        padding: 'calc(8px + var(--safe-area-top, 0px)) 12px 8px',
      }}
    >
      <header
        className="surf-elevated"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 56,
          padding: '0 16px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {title ? (
            <h1
              className="font-head tight"
              style={{
                margin: 0,
                fontSize: 'var(--text-16)',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <div
              className="tnum"
              style={{
                marginTop: 2,
                fontSize: 'var(--text-11)',
                color: 'var(--text-tertiary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {team}
        <SchemeThemeToggle />
      </header>
    </div>
  );
}
```

- [ ] **Step 7: Provide the context in RootLayout**

Replace `frontend-new/src/app/layouts/RootLayout.tsx` with:

```tsx
/* Layout root-вкладок: шапка вкладки + BottomNavigation.
   Telegram BackButton здесь скрыт (им управляет только DetailLayout и оверлеи). */
import { Suspense, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { TeamSwitcher } from '@/components/layout/TeamSwitcher';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { RouteFallback } from '@/components/common/RouteFallback';
import { ToastContainer } from '@/components/common/ToastContainer';
import { ROOT_TABS } from '@/app/navigation';
import { useBootReveal, usePageTransition, useRouteFocus } from '@/lib/motion';
import { ScreenHeaderContext, useScreenHeaderState } from './screenHeader';

export function RootLayout() {
  const mainRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const { header, api } = useScreenHeaderState();
  /* Пока ленивый чанк вкладки грузится, страница заголовок ещё не объявила:
     шапка берёт название вкладки из нижней навигации, а не пустеет. */
  const tabLabel = ROOT_TABS.find((t) => t.to === pathname)?.label;
  /* Сборка кадра висит на <main>, а не на контейнере страницы: тот пересоздаётся
     под key={pathname} и уже несёт анимацию перехода. Две анимации на одном
     узле — это снова два прихода подряд. */
  const boot = useBootReveal();
  usePageTransition(pageRef, pathname);
  useRouteFocus(mainRef, pathname);

  return (
    <div className="flex flex-col min-h-[100dvh] mx-auto w-full max-w-[430px]">
      <ScreenHeaderContext.Provider value={api}>
        {/* В меню свой переключатель группы, второй в шапке дублировал бы его. */}
        <Header
          title={header.title || tabLabel}
          subtitle={header.subtitle}
          team={pathname === '/menu' ? null : <TeamSwitcher />}
        />

        <main
          ref={mainRef}
          tabIndex={-1}
          className={`flex-1 overflow-y-auto${boot ? ' anim-boot-content' : ''}`}
          style={{ paddingBottom: 'calc(88px + var(--safe-area-bottom, 0px))' }}
        >
          <ErrorBoundary>
            {/* key по пути — то, что перезапускает анимацию входа: без него React
                переиспользует этот div, и на смене таба ничего не проигрывается.
                Страницу это не ломает: она и так размонтируется при смене
                маршрута. */}
            <div key={pathname} ref={pageRef} className="anim-page">
              {/* Граница Suspense внутри layout'а, а не над ним: сверху она
                  снимала вместе со страницей шапку и таббар, и загрузка чанка
                  читалась как мигание всего приложения. */}
              <Suspense fallback={<RouteFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </ErrorBoundary>
        </main>
      </ScreenHeaderContext.Provider>

      <BottomNavigation items={ROOT_TABS} />
      <ToastContainer />
    </div>
  );
}
```

(`TeamSwitcher` keeps its current props-free API here; Task 5 replaces it with `TeamSlot`.)

- [ ] **Step 8: Move the greeting into the header**

Create `frontend-new/src/features/home/hooks/useGreetingHeader.tsx`:

```tsx
import { useMemo } from 'react';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { Skeleton } from '@/shared/ui';
import { dateCaption, greetingFor } from '../lib/selectors';

/** Приветствие Главной — заголовок шапки вкладок, а не строка в ленте. */
export function useGreetingHeader(name: string | undefined, loading: boolean) {
  const skeleton = useMemo(() => <Skeleton variant="text" width={160} height={16} />, []);
  const now = new Date();
  const title = loading ? skeleton : `${greetingFor(now.getHours())}${name ? `, ${name}` : ''}`;
  useScreenHeader(title, undefined, dateCaption(now));
}
```

Delete `frontend-new/src/features/home/components/Greeting.tsx`.

In `HomePage.tsx`:
- replace `import { Greeting } from './components/Greeting';` with `import { useGreetingHeader } from './hooks/useGreetingHeader';`
- right after `const { user, isLoading: authLoading } = useAuth();` add `useGreetingHeader(user?.firstName, authLoading);`
- delete the line `<Greeting name={user?.firstName} loading={authLoading} />`
- change `<FirstScreenSkeleton name={user?.firstName} visible={showSkeleton} />` to `<FirstScreenSkeleton visible={showSkeleton} />`

In `FirstScreenSkeleton.tsx`: delete `import { Greeting } from './Greeting';`, the `name?: string;` prop, `name` from the destructuring, and the line `<Greeting name={name} loading />`.

Run: `grep -rn "styles\.\(greeting\|caption\|hello\)" frontend-new/src/features/home`
Expected: no output. Then delete the `/* приветствие */` block with `.greeting`, `.caption`, `.hello` from `HomePage.module.css:15-33`.

In `HomePage.test.tsx` delete line 173 (`expect(screen.getByText(/Добрый|Доброе/)).toBeInTheDocument();`) — the greeting is now the layout's, covered by `useGreetingHeader.test.tsx`.

- [ ] **Step 9: Menu, Statistics, Profile**

In `MenuPage.tsx` add the import `import { useScreenHeader } from '@/app/layouts/screenHeader';`, and replace the block

```tsx
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Меню</h1>
          ...
        </div>
      </div>
```

(lines 127-141) with nothing; above `return (` add:

```tsx
  // Число — только когда меню прочитано: пока идёт загрузка или она упала,
  // «0 блюд» выдавало сбой за пустое меню.
  const headerSubtitle = [
    !isLoading && !error ? pluralize(dishes.length, 'блюдо', 'блюда', 'блюд') : null,
    activeGroup?.title,
  ]
    .filter(Boolean)
    .join(' · ');
  useScreenHeader('Меню', undefined, headerSubtitle || undefined);
```

This hook call must sit before any early `return` in `MenuPage` (there is none today; keep it that way). Delete `.head`, `.title`, `.subtitle` from `MenuPage.module.css:10-29`.

In `StatsPage.tsx` add `import { useScreenHeader } from '@/app/layouts/screenHeader';`, add `useScreenHeader('Статистика');` as the first line inside `StatsPage()`, delete all four `<h1 className={styles.title}>Статистика</h1>` lines, and delete `.title` from `StatsPage.module.css:9-15`. (The fallback from `ROOT_TABS` would show the same word; the explicit call keeps the title if the tab label ever changes.)

In `ProfilePage.tsx` add `import { useScreenHeader } from '@/app/layouts/screenHeader';`, add `useScreenHeader('Профиль');` as the first line inside the component, and change `<h1 className={styles.name}>{name}</h1>` to `<h2 className={styles.name}>{name}</h2>` — the header `h1` is the screen's only one.

- [ ] **Step 10: Production smoke no longer looks for the logo text**

In `frontend-new/tests/production/production-smoke.spec.ts` replace

```ts
      { name: 'Главная', path: '/', text: 'Rocket Lunch' },
```

with

```ts
      { name: 'Главная', path: '/', text: /^(Доброе утро|Добрый день|Добрый вечер)/ },
```

- [ ] **Step 11: Run the tests**

Run: `npm --prefix frontend-new test`
Expected: PASS, whole suite.

Run: `npm --prefix frontend-new run type-check && npm --prefix frontend-new run type-check:e2e && npm --prefix frontend-new run lint`
Expected: no errors, no warnings.

- [ ] **Step 12: Commit**

```bash
git add -A frontend-new/src frontend-new/tests/production/production-smoke.spec.ts
git commit -m "feat(header): tab title and greeting live in the tab header, logo removed"
```

---

### Task 4: Team activity model

**Files:**
- Modify: `frontend-new/src/lib/queryClient.ts:43-44,78-80`
- Create: `frontend-new/src/lib/teamActivity.ts`
- Create: `frontend-new/src/hooks/useTeamActivity.ts`
- Test: `frontend-new/src/lib/__tests__/teamActivity.test.ts` (create)

**Interfaces:**
- Consumes: `pollEndsAt` from `frontend-new/src/features/home/lib/selectors.ts`; `pollsService.getActive(groupId?)`; `storeRunService.getActive(groupId?)`.
- Produces:
  - `type ActiveRunStatus = 'COLLECTING' | 'SHOPPING'`
  - `interface TeamActivity { pollEndsAt?: string; run?: { id: number; status: ActiveRunStatus } }`
  - `type ActivityByTeam = Record<string, TeamActivity>`
  - `buildTeamActivity(polls: Poll[], runs: StoreRunListItem[]): ActivityByTeam`
  - `type TeamSlotModel = { kind: 'none' } | { kind: 'poll'; endsAt: string } | { kind: 'run'; runId: number; status: ActiveRunStatus } | { kind: 'switcher'; busyCount: number }`
  - `teamSlotModel(args: { teamIds: string[]; currentGroupId: string | null; activity: ActivityByTeam; onHome: boolean }): TeamSlotModel`
  - `formatRemaining(cd: { hours: number; minutes: number; seconds: number }): string`
  - `runStatusText(status: ActiveRunStatus, capital?: boolean): string`
  - `useTeamActivity(enabled: boolean): ActivityByTeam | null`
  - `queryKeys.polls.activeAllTeams`, `queryKeys.storeRuns.activeAllTeams()`

- [ ] **Step 1: Write the failing tests**

Create `frontend-new/src/lib/__tests__/teamActivity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Poll } from '@/types/models';
import type { StoreRunListItem, StoreRunStatus } from '@/services/store-run.service';
import {
  buildTeamActivity,
  formatRemaining,
  runStatusText,
  teamSlotModel,
  type ActivityByTeam,
} from '../teamActivity';

const poll = (groupId: string, status: Poll['status'] = 'ACTIVE') =>
  ({
    id: 1,
    groupId,
    status,
    duration: 15,
    createdAt: '2026-09-24T12:00:00.000Z',
    startedAt: '2026-09-24T12:00:00.000Z',
  }) as Poll;

const run = (groupId: number, status: StoreRunStatus, id = 601) =>
  ({ id, groupId, status }) as StoreRunListItem;

describe('buildTeamActivity', () => {
  it('сводит голосования и закупки по команде: id группы у закупки — число, у голосования — строка', () => {
    const a = buildTeamActivity([poll('10')], [run(10, 'COLLECTING'), run(20, 'SHOPPING', 602)]);
    expect(a['10']).toEqual({
      pollEndsAt: '2026-09-24T12:15:00.000Z',
      run: { id: 601, status: 'COLLECTING' },
    });
    expect(a['20']).toEqual({ run: { id: 602, status: 'SHOPPING' } });
  });

  it('завершённые голосования и рассчитанные или отменённые закупки не считаются', () => {
    const a = buildTeamActivity(
      [poll('10', 'COMPLETED')],
      [run(10, 'SETTLED'), run(10, 'CANCELLED', 603)],
    );
    expect(a).toEqual({});
  });
});

describe('teamSlotModel', () => {
  const both: ActivityByTeam = {
    '10': { pollEndsAt: '2026-09-24T12:15:00.000Z', run: { id: 601, status: 'COLLECTING' } },
  };
  const one = (activity: ActivityByTeam, onHome: boolean) =>
    teamSlotModel({ teamIds: ['10'], currentGroupId: '10', activity, onHome });

  it('одна команда на Главной — плашки нет', () => {
    expect(one(both, true)).toEqual({ kind: 'none' });
  });

  it('одна команда вне Главной: голосование важнее закупки', () => {
    expect(one(both, false)).toEqual({ kind: 'poll', endsAt: '2026-09-24T12:15:00.000Z' });
  });

  it('одна команда вне Главной: закупка, если голосования нет', () => {
    expect(one({ '10': { run: { id: 601, status: 'SHOPPING' } } }, false)).toEqual({
      kind: 'run',
      runId: 601,
      status: 'SHOPPING',
    });
  });

  it('одна команда, ничего не идёт — плашки нет', () => {
    expect(one({}, false)).toEqual({ kind: 'none' });
  });

  const busy: ActivityByTeam = {
    '10': { pollEndsAt: '2026-09-24T12:15:00.000Z' },
    '20': { run: { id: 602, status: 'SHOPPING' } },
    '99': { pollEndsAt: '2026-09-24T12:15:00.000Z' },
  };
  const many = (onHome: boolean) =>
    teamSlotModel({ teamIds: ['10', '20'], currentGroupId: '10', activity: busy, onHome });

  it('две команды на Главной считают только другие', () => {
    expect(many(true)).toEqual({ kind: 'switcher', busyCount: 1 });
  });

  it('две команды вне Главной считают и текущую; команда не из списка не считается', () => {
    expect(many(false)).toEqual({ kind: 'switcher', busyCount: 2 });
  });
});

describe('тексты статуса', () => {
  it('остаток времени как у таймера талона', () => {
    expect(formatRemaining({ hours: 0, minutes: 12, seconds: 41 })).toBe('12:41');
    expect(formatRemaining({ hours: 0, minutes: 3, seconds: 5 })).toBe('03:05');
    expect(formatRemaining({ hours: 1, minutes: 5, seconds: 12 })).toBe('1:05:12');
  });

  it('фаза закупки', () => {
    expect(runStatusText('COLLECTING')).toBe('Закупка · сбор');
    expect(runStatusText('SHOPPING', false)).toBe('закупка · в магазине');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix frontend-new test -- src/lib/__tests__/teamActivity.test.ts`
Expected: FAIL — module `../teamActivity` not found.

- [ ] **Step 3: Implement the model**

Create `frontend-new/src/lib/teamActivity.ts`:

```ts
/* Что идёт в командах человека — для плашки команд в шапке вкладок.
   Правила показа — docs/design-guidelines/screens.md, «Плашка команд». */
import { pollEndsAt } from '@/features/home/lib/selectors';
import type { StoreRunListItem } from '@/services/store-run.service';
import type { Poll } from '@/types/models';

export type ActiveRunStatus = 'COLLECTING' | 'SHOPPING';

export interface TeamActivity {
  /** Окончание идущего голосования (ISO). */
  pollEndsAt?: string;
  run?: { id: number; status: ActiveRunStatus };
}

/** Ключ — id группы строкой, как `currentGroupId`. */
export type ActivityByTeam = Record<string, TeamActivity>;

const isActiveRun = (status: string): status is ActiveRunStatus =>
  status === 'COLLECTING' || status === 'SHOPPING';

/* Id группы приходит строкой у голосования и числом у закупки — ключ
   приводится к строке, иначе закупка команды 10 не попала бы в «10». */
export function buildTeamActivity(polls: Poll[], runs: StoreRunListItem[]): ActivityByTeam {
  const out: ActivityByTeam = {};
  for (const p of polls) {
    if (p.status !== 'ACTIVE') continue;
    const key = String(p.groupId);
    out[key] = { ...out[key], pollEndsAt: pollEndsAt(p) };
  }
  for (const r of runs) {
    if (!isActiveRun(r.status)) continue;
    const key = String(r.groupId);
    if (out[key]?.run) continue;
    out[key] = { ...out[key], run: { id: r.id, status: r.status } };
  }
  return out;
}

const isBusy = (a: TeamActivity | undefined) => !!a && (!!a.pollEndsAt || !!a.run);

export type TeamSlotModel =
  | { kind: 'none' }
  | { kind: 'poll'; endsAt: string }
  | { kind: 'run'; runId: number; status: ActiveRunStatus }
  | { kind: 'switcher'; busyCount: number };

export function teamSlotModel({
  teamIds,
  currentGroupId,
  activity,
  onHome,
}: {
  /** Активные команды человека, id строкой. */
  teamIds: string[];
  currentGroupId: string | null;
  activity: ActivityByTeam;
  onHome: boolean;
}): TeamSlotModel {
  if (teamIds.length >= 2) {
    /* На Главной текущая команда и так на экране — точка говорит о других. */
    const busyCount = teamIds.filter(
      (id) => !(onHome && id === currentGroupId) && isBusy(activity[id]),
    ).length;
    return { kind: 'switcher', busyCount };
  }
  if (onHome || !currentGroupId) return { kind: 'none' };
  const a = activity[currentGroupId];
  if (a?.pollEndsAt) return { kind: 'poll', endsAt: a.pollEndsAt };
  if (a?.run) return { kind: 'run', runId: a.run.id, status: a.run.status };
  return { kind: 'none' };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** «12:41», больше часа — «1:05:12»: тот же формат, что у таймера талона. */
export function formatRemaining(cd: { hours: number; minutes: number; seconds: number }): string {
  return cd.hours > 0
    ? `${cd.hours}:${pad(cd.minutes)}:${pad(cd.seconds)}`
    : `${pad(cd.minutes)}:${pad(cd.seconds)}`;
}

/* Фазы теми же словами, что в секции «Сейчас» (NowSection: «Сбор», «В магазине»). */
const RUN_PHASE: Record<ActiveRunStatus, string> = {
  COLLECTING: 'сбор',
  SHOPPING: 'в магазине',
};

export function runStatusText(status: ActiveRunStatus, capital = true): string {
  return `${capital ? 'Закупка' : 'закупка'} · ${RUN_PHASE[status]}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm --prefix frontend-new test -- src/lib/__tests__/teamActivity.test.ts`
Expected: PASS.

- [ ] **Step 5: Cache keys and the data hook**

In `frontend-new/src/lib/queryClient.ts`, inside `polls`, after `activeForGroup`, add:

```ts
    /** Активные голосования всех команд человека (плашка команд в шапке).
        Под префиксом `active`: инвалидации после голоса и создания его задевают. */
    activeAllTeams: ['polls', 'active', '*'] as const,
```

and inside `storeRuns`, after `activeForGroup`, add:

```ts
    /** Активные закупки всех команд человека (плашка команд в шапке). */
    activeAllTeams: () => ['storeRuns', 'active', '*'] as const,
```

Create `frontend-new/src/hooks/useTeamActivity.ts`:

```ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { buildTeamActivity, type ActivityByTeam } from '@/lib/teamActivity';
import { pollsService } from '@/services/polls.service';
import { storeRunService } from '@/services/store-run.service';
import { useAppStore } from '@/store/useAppStore';
import type { Poll } from '@/types/models';

/**
 * Что идёт во всех командах человека: по одному запросу голосований и
 * закупок без `groupId` — сервер тогда отвечает по всем его командам.
 *
 * `null` — ответа ещё нет или запрос упал: плашка тогда молчит, а не
 * выдумывает «тихо».
 */
export function useTeamActivity(enabled: boolean): ActivityByTeam | null {
  const authed = useAppStore((s) => s.authStatus) === 'authenticated';
  const on = enabled && authed;
  const polls = useQuery({
    queryKey: queryKeys.polls.activeAllTeams,
    queryFn: async () => ((await pollsService.getActive()).data ?? []) as Poll[],
    enabled: on,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const runs = useQuery({
    queryKey: queryKeys.storeRuns.activeAllTeams(),
    queryFn: async () => (await storeRunService.getActive()).data ?? [],
    enabled: on,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const failed = polls.isError || runs.isError;
  return useMemo(
    () => (!failed && polls.data && runs.data ? buildTeamActivity(polls.data, runs.data) : null),
    [failed, polls.data, runs.data],
  );
}
```

- [ ] **Step 6: Type-check and lint**

Run: `npm --prefix frontend-new run type-check && npm --prefix frontend-new run lint`
Expected: no errors, no warnings.

- [ ] **Step 7: Commit**

```bash
git add frontend-new/src/lib/teamActivity.ts frontend-new/src/lib/__tests__/teamActivity.test.ts frontend-new/src/lib/queryClient.ts frontend-new/src/hooks/useTeamActivity.ts
git commit -m "feat(header): team activity model across all of the person's teams"
```

---

### Task 5: Team slot in the header

**Files:**
- Create: `frontend-new/src/components/layout/ActivityLine.tsx`
- Create: `frontend-new/src/components/layout/TeamSlot.tsx`, `frontend-new/src/components/layout/TeamSlot.module.css`
- Modify: `frontend-new/src/components/layout/TeamSwitcher.tsx` (whole file), `TeamSwitcher.module.css` (trigger block and new rules)
- Modify: `frontend-new/src/app/layouts/RootLayout.tsx` (the `Header` call and imports)
- Modify: `frontend-new/src/features/menu/MenuPage.tsx` (group tablist, `switchGroup`, `groupTabs`)
- Test: `frontend-new/src/components/layout/__tests__/ActivityLine.test.tsx`, `TeamSlot.test.tsx` (create), `TeamSwitcher.test.tsx` (update), `frontend-new/src/features/menu/__tests__/MenuPage.test.tsx:141-148`
- Modify: `frontend-new/tests/e2e/specs/team-context.spec.ts:33-37,57-60`, `frontend-new/tests/production/production-smoke.spec.ts:34-37`

**Interfaces:**
- Consumes: from Task 4 — `TeamActivity`, `ActivityByTeam`, `teamSlotModel`, `formatRemaining`, `runStatusText`, `useTeamActivity`; from Task 3 — `Header({ team })`.
- Produces:
  - `PollStatusText({ endsAt }: { endsAt: string })`
  - `ActivityLine({ activity }: { activity: TeamActivity })`
  - `TeamSlot()` — no props
  - `TeamSwitcher({ activity, busyCount }: { activity: ActivityByTeam | null; busyCount: number })`

- [ ] **Step 1: Write the failing tests**

Create `frontend-new/src/components/layout/__tests__/ActivityLine.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ActivityLine } from '../ActivityLine';

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-09-24T12:00:00.000Z') });
});
afterEach(() => {
  vi.useRealTimers();
});

const inFuture = '2026-09-24T12:12:41.000Z';

describe('ActivityLine', () => {
  it('голосование — живой остаток времени', () => {
    const { container } = render(<ActivityLine activity={{ pollEndsAt: inFuture }} />);
    expect(container).toHaveTextContent('Голосуем · 12:41');
  });

  it('таймер истёк, а сервер ещё не закрыл — «завершается», не нули', () => {
    const { container } = render(<ActivityLine activity={{ pollEndsAt: '2026-09-24T11:59:00.000Z' }} />);
    expect(container).toHaveTextContent('Голосуем · завершается…');
  });

  it('голосование и закупка — через запятую', () => {
    const { container } = render(
      <ActivityLine activity={{ pollEndsAt: inFuture, run: { id: 601, status: 'COLLECTING' } }} />,
    );
    expect(container).toHaveTextContent('Голосуем · 12:41, закупка · сбор');
  });

  it('ничего не идёт — «Тихо»', () => {
    const { container } = render(<ActivityLine activity={{}} />);
    expect(container).toHaveTextContent('Тихо');
  });
});
```

Create `frontend-new/src/components/layout/__tests__/TeamSlot.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ActivityByTeam } from '@/lib/teamActivity';
import { useAppStore } from '@/store/useAppStore';

const h = vi.hoisted(() => ({
  groups: [] as unknown[],
  activity: null as ActivityByTeam | null,
}));

vi.mock('@/hooks/useUser', () => ({ useMyGroups: () => ({ data: h.groups }) }));
vi.mock('@/hooks/useTeamActivity', () => ({ useTeamActivity: () => h.activity }));

import { TeamSlot } from '../TeamSlot';

const group = (id: number, title: string) => ({
  id,
  title,
  telegramId: String(-id),
  type: 'group',
  isActive: true,
  role: 'MEMBER',
});

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <TeamSlot />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const endsAt = new Date(Date.now() + 10 * 60_000).toISOString();

beforeEach(() => {
  h.groups = [group(10, 'Офис')];
  h.activity = { '10': { pollEndsAt: endsAt } };
  useAppStore.setState({ currentGroupId: '10' });
});

describe('TeamSlot — одна команда', () => {
  it('на Главной плашки нет', () => {
    renderAt('/');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('вне Главной голосование ведёт на Главную', async () => {
    renderAt('/menu');
    await userEvent.click(screen.getByRole('button', { name: /^Голосуем · / }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/);
  });

  it('вне Главной закупка ведёт на экран закупки', async () => {
    h.activity = { '10': { run: { id: 601, status: 'COLLECTING' } } };
    renderAt('/stats');
    await userEvent.click(screen.getByRole('button', { name: 'Закупка · сбор' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/store-run/601');
  });

  it('статусы не пришли — плашки нет', () => {
    h.activity = null;
    renderAt('/profile');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('TeamSlot — две команды', () => {
  beforeEach(() => {
    h.groups = [group(10, 'Офис'), group(20, 'Розница')];
  });

  it('на Главной голосование текущей команды точкой не считается', () => {
    renderAt('/');
    const trigger = screen.getByRole('button', { name: 'Команда: Офис. Сменить' });
    expect(trigger).not.toHaveAccessibleDescription();
  });

  it('на Главной точка говорит о других командах', () => {
    h.activity = { '20': { pollEndsAt: endsAt } };
    renderAt('/');
    expect(screen.getByRole('button', { name: 'Команда: Офис. Сменить' })).toHaveAccessibleDescription(
      'Что-то идёт в командах: 1',
    );
  });

  it('вне Главной точка считает и текущую', () => {
    h.activity = { '10': { pollEndsAt: endsAt }, '20': { run: { id: 602, status: 'SHOPPING' } } };
    renderAt('/menu');
    expect(screen.getByRole('button', { name: 'Команда: Офис. Сменить' })).toHaveAccessibleDescription(
      'Что-то идёт в командах: 2',
    );
  });
});
```

In `TeamSwitcher.test.tsx`:
- add `import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';`
- add under the `group` helper:

```tsx
function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderSwitcher(props: Parameters<typeof TeamSwitcher>[0] = { activity: null, busyCount: 0 }) {
  return render(
    <MemoryRouter initialEntries={['/stats']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <TeamSwitcher {...props} />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}
```

- replace every `render(<TeamSwitcher />)` with `renderSwitcher()`; in `'с одной командой не показывается'` replace `const { container } = render(<TeamSwitcher />); expect(container).toBeEmptyDOMElement();` with `renderSwitcher(); expect(screen.queryByRole('button')).not.toBeInTheDocument();`
- in `'меняет команду из списка своих активных групп'` replace `expect(options.map((o) => o.textContent)).toEqual(['Офис', 'Розница']);` with `expect(options.map((o) => o.getAttribute('aria-label'))).toEqual(['Офис', 'Розница']);`, and after `await userEvent.click(screen.getByRole('radio', { name: 'Розница' }));` add `expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/);`
- add:

```tsx
  it('в шторке у каждой команды строка статуса', async () => {
    renderSwitcher({ activity: { '20': { run: { id: 602, status: 'SHOPPING' } } }, busyCount: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'Команда: Офис. Сменить' }));

    expect(screen.getByRole('dialog', { name: 'Команды' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Розница' })).toHaveAccessibleDescription('Закупка · в магазине');
    expect(screen.getByRole('radio', { name: 'Офис' })).toHaveAccessibleDescription('Тихо');
  });
```

In `MenuPage.test.tsx` replace the whole `describe('MenuPage — глобальная группа', ...)` block with:

```tsx
describe('MenuPage — смена команды', () => {
  it('ряда команд нет, а смена команды в шапке сбрасывает поиск', () => {
    h.state.groups = [group(10, 'Офис', 'ADMIN'), group(20, 'Розница')];
    useAppStore.setState({ currentGroupId: '10' });
    render(<MenuPage />);
    expect(screen.queryByRole('tab', { name: 'Розница' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Поиск блюд' }), { target: { value: 'суп' } });
    act(() => useAppStore.setState({ currentGroupId: '20' }));
    expect(screen.getByRole('textbox', { name: 'Поиск блюд' })).toHaveValue('');
  });
});
```

and add `act` to the `@testing-library/react` import of that file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix frontend-new test -- src/components/layout src/features/menu`
Expected: FAIL — `../ActivityLine` and `../TeamSlot` not found; `TeamSwitcher` has no status lines; Menu still renders the `Розница` tab.

- [ ] **Step 3: ActivityLine**

Create `frontend-new/src/components/layout/ActivityLine.tsx`:

```tsx
import { formatRemaining, runStatusText, type TeamActivity } from '@/lib/teamActivity';
import { useCountdown } from '@/shared/lib/useCountdown';

/** «Голосуем · 12:41», живой. Истёк, а сервер ещё не закрыл, — «завершается». */
export function PollStatusText({ endsAt }: { endsAt: string }) {
  const cd = useCountdown(endsAt);
  return <>{cd.isExpired ? 'Голосуем · завершается…' : `Голосуем · ${formatRemaining(cd)}`}</>;
}

/** Строка статуса команды в шторке «Команды». */
export function ActivityLine({ activity }: { activity: TeamActivity }) {
  const { pollEndsAt, run } = activity;
  if (pollEndsAt && run) {
    return (
      <>
        <PollStatusText endsAt={pollEndsAt} />, {runStatusText(run.status, false)}
      </>
    );
  }
  if (pollEndsAt) return <PollStatusText endsAt={pollEndsAt} />;
  if (run) return <>{runStatusText(run.status)}</>;
  return <>Тихо</>;
}
```

- [ ] **Step 4: TeamSwitcher with statuses**

Replace `frontend-new/src/components/layout/TeamSwitcher.tsx` with:

```tsx
/**
 * Текущая команда и её смена — плашка «Офис ▾» в шапке вкладок, когда команд
 * две и больше. Точка на плашке — сколько команд сейчас заняты (правило —
 * lib/teamActivity.ts, teamSlotModel), шторка «Команды» — статус каждой.
 *
 * С одной командой не показывается: выбирать не из чего.
 */
import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BottomSheet } from '@/components/rl/BottomSheet';
import { Icon } from '@/components/rl/Icon';
import { useMyGroups } from '@/hooks/useUser';
import type { ActivityByTeam } from '@/lib/teamActivity';
import { useAppStore } from '@/store/useAppStore';
import { ActivityLine } from './ActivityLine';
import styles from './TeamSwitcher.module.css';

interface TeamSwitcherProps {
  /** Статусы команд; null — ещё не пришли или запрос упал: строк статуса нет. */
  activity: ActivityByTeam | null;
  busyCount: number;
}

export function TeamSwitcher({ activity, busyCount }: TeamSwitcherProps) {
  const navigate = useNavigate();
  const currentGroupId = useAppStore((s) => s.currentGroupId);
  const setCurrentGroupId = useAppStore((s) => s.setCurrentGroupId);
  const { data: groups = [] } = useMyGroups();
  const activeGroups = useMemo(() => groups.filter((g) => g.isActive), [groups]);
  const [open, setOpen] = useState(false);
  const uid = useId();

  const current = activeGroups.find((g) => String(g.id) === currentGroupId);
  if (activeGroups.length < 2 || !current) return null;

  const busyId = `${uid}-busy`;

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-label={`Команда: ${current.title}. Сменить`}
        aria-describedby={busyCount > 0 ? busyId : undefined}
        onClick={() => setOpen(true)}
      >
        <span className={styles.title}>{current.title}</span>
        <Icon name="chevronDown" size={14} />
        {busyCount > 0 && (
          <>
            <span className={styles.dot} aria-hidden>
              {busyCount}
            </span>
            <span id={busyId} className="sr-only">
              Что-то идёт в командах: {busyCount}
            </span>
          </>
        )}
      </button>

      {open && (
        <BottomSheet title="Команды" onClose={() => setOpen(false)}>
          <div role="radiogroup" aria-label="Команда" className={styles.list}>
            {activeGroups.map((g) => {
              const id = String(g.id);
              const selected = id === currentGroupId;
              const statusId = `${uid}-${id}`;
              return (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={g.title}
                  aria-describedby={activity ? statusId : undefined}
                  className={styles.option}
                  onClick={() => {
                    setCurrentGroupId(id);
                    setOpen(false);
                    navigate('/');
                  }}
                >
                  <span className={styles.optionMain}>
                    <span className={styles.optionTitle}>{g.title}</span>
                    {activity && (
                      <span id={statusId} className={`tnum ${styles.optionStatus}`}>
                        <ActivityLine activity={activity[id] ?? {}} />
                      </span>
                    )}
                  </span>
                  {selected && <Icon name="check" size={16} />}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
```

In `TeamSwitcher.module.css` replace the first comment and the `.trigger` rule (everything above `.trigger::after`) with:

```css
/* Плашка текущей команды справа в шапке вкладок. Видимая высота 32 px,
   область касания — 44 px невидимым псевдоэлементом. */
.trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  flex: 0 1 auto;
  min-width: 0;
  max-width: 55%;
  height: 32px;
  padding: 0 var(--space-2) 0 var(--space-3);
  border: none;
  border-radius: var(--radius-pill);
  background: var(--surface-secondary);
  font: inherit;
  font-size: var(--text-13);
  font-weight: 600;
  line-height: 1;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color var(--motion-fast) var(--ease-out);
}
```

replace the `.trigger:hover` rule inside `@media (hover: hover)` with

```css
  .trigger:hover {
    background: var(--accent-tint);
  }
```

replace `.trigger:focus-visible`'s `box-shadow` with `0 0 0 2px var(--surface), 0 0 0 4px var(--focus-ring)`, and append at the end of the file:

```css
.dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-foreground);
  font-size: var(--text-11);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.optionMain {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding-block: var(--space-2);
}

.optionTitle {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.optionStatus {
  font-size: var(--text-13);
  font-weight: 500;
  color: var(--text-secondary);
}

.option[aria-checked='true'] .optionStatus {
  color: inherit;
  opacity: 0.8;
}
```

- [ ] **Step 5: TeamSlot**

Create `frontend-new/src/components/layout/TeamSlot.module.css`:

```css
/* Одиночная плашка статуса (одна команда, не Главная). Цвет — значение:
   голосование в паре vote, закупка в паре shop, как у Status. Видимая
   высота 32 px, область касания — 44 px псевдоэлементом. */
.chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 60%;
  height: 32px;
  padding: 0 var(--space-3);
  border: none;
  border-radius: var(--radius-pill);
  font: inherit;
  font-size: var(--text-13);
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: opacity var(--motion-fast) var(--ease-out);
}

.chip::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: var(--control-md);
  transform: translateY(-50%);
}

.text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.vote {
  background: var(--vote-tint);
  color: var(--vote-on-tint);
}

.shop {
  background: var(--shop-tint);
  color: var(--shop-on-tint);
}

@media (hover: hover) {
  .chip:hover {
    opacity: 0.9;
  }
}

.chip:active {
  opacity: 0.8;
}

.chip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--focus-ring);
}
```

Create `frontend-new/src/components/layout/TeamSlot.tsx`:

```tsx
/* Правая часть шапки вкладок: одиночная плашка статуса или плашка команды.
   Правила — docs/design-guidelines/screens.md, «Плашка команд»; решение
   принимает teamSlotModel (lib/teamActivity.ts). */
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMyGroups } from '@/hooks/useUser';
import { useTeamActivity } from '@/hooks/useTeamActivity';
import { runStatusText, teamSlotModel } from '@/lib/teamActivity';
import { useAppStore } from '@/store/useAppStore';
import { PollStatusText } from './ActivityLine';
import { TeamSwitcher } from './TeamSwitcher';
import styles from './TeamSlot.module.css';

export function TeamSlot() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onHome = pathname === '/';
  const currentGroupId = useAppStore((s) => s.currentGroupId);
  const { data: groups = [] } = useMyGroups();
  const teamIds = useMemo(
    () => groups.filter((g) => g.isActive).map((g) => String(g.id)),
    [groups],
  );
  /* Одной команде на Главной плашка не нужна — не тратим и запросы. */
  const activity = useTeamActivity(teamIds.length >= 2 || !onHome);
  const model = teamSlotModel({ teamIds, currentGroupId, activity: activity ?? {}, onHome });

  switch (model.kind) {
    case 'switcher':
      return <TeamSwitcher activity={activity} busyCount={model.busyCount} />;
    case 'poll':
      return (
        <button type="button" className={`${styles.chip} ${styles.vote}`} onClick={() => navigate('/')}>
          <span className={styles.text}>
            <PollStatusText endsAt={model.endsAt} />
          </span>
        </button>
      );
    case 'run':
      return (
        <button
          type="button"
          className={`${styles.chip} ${styles.shop}`}
          onClick={() => navigate(`/store-run/${model.runId}`)}
        >
          <span className={styles.text}>{runStatusText(model.status)}</span>
        </button>
      );
    default:
      return null;
  }
}
```

- [ ] **Step 6: Wire it into RootLayout**

In `RootLayout.tsx` replace `import { TeamSwitcher } from '@/components/layout/TeamSwitcher';` with `import { TeamSlot } from '@/components/layout/TeamSlot';`, delete the comment `{/* В меню свой переключатель группы, второй в шапке дублировал бы его. */}`, and change the `team` prop to `team={<TeamSlot />}`.

- [ ] **Step 7: Menu loses its own team row**

In `MenuPage.tsx`:
- delete the `{activeGroups.length > 1 && ( <div className={styles.cats} role="tablist" aria-label="Группа"> ... </div> )}` block;
- delete `const groupTabs = useRovingFocus(...)`, the `switchGroup` function and `const setCurrentGroupId = useAppStore(...)`;
- after the `const [query, setQuery] = useState('');` line add:

```tsx
  /* Команду меняют в шапке (шторка «Команды»), а фильтры принадлежат прежней
     команде: её категорий у новой может не быть. Сброс — во время рендера, а
     не эффектом, иначе один кадр показывал бы новое меню со старым фильтром. */
  const [filtersFor, setFiltersFor] = useState(currentGroupId);
  if (filtersFor !== currentGroupId) {
    setFiltersFor(currentGroupId);
    setCategory('all');
    setQuery('');
  }
```

- delete `import { useRovingFocus } from '@/shared/lib/useRovingFocus';` — the group row was its only user.
- update the file's top comment: the sentence saying the group is switched here now reads «Команду меняют в шапке вкладок; useAppStore.currentGroupId меняет весь продукт (голосование, закупки, бюджет)».

- [ ] **Step 8: Run the unit tests**

Run: `npm --prefix frontend-new test`
Expected: PASS, whole suite.

- [ ] **Step 9: Browser tests follow the new switcher**

In `tests/e2e/specs/team-context.spec.ts` replace the test `'в меню не дублирует его собственный переключатель'` with:

```ts
  test('в меню команда меняется той же плашкой в шапке', async ({ appPage }) => {
    await appPage.goto('/menu');
    await expect(appPage.getByRole('tab', { name: 'Команда Ракета' })).toHaveCount(0);
    await expect(
      appPage.getByRole('button', { name: 'Команда: Команда Ракета. Сменить' }),
    ).toBeVisible();
  });
```

and in `'«Открыть меню группы» делает её текущей'` replace the `getByRole('tab', { name: 'Команда Спутник' })...toHaveAttribute('aria-selected', 'true')` assertion with:

```ts
      await expect(
        appPage.getByRole('button', { name: 'Команда: Команда Спутник. Сменить' }),
      ).toBeVisible();
```

In `tests/production/production-smoke.spec.ts` replace

```ts
    const groupTab = appPage.getByRole('tab', { name: identity.groupName, exact: true });
    if ((await groupTab.count()) > 0) await groupTab.click();
```

with

```ts
    const teamTrigger = appPage.getByRole('button', { name: /^Команда: .*\. Сменить$/ });
    if (
      (await teamTrigger.count()) > 0 &&
      (await teamTrigger.getAttribute('aria-label')) !== `Команда: ${identity.groupName}. Сменить`
    ) {
      await teamTrigger.click();
      await appPage.getByRole('radio', { name: identity.groupName, exact: true }).click();
      // Выбор команды открывает Главную — возвращаемся в меню.
      await navigation.getByRole('link', { name: 'Меню' }).click();
    }
```

Run: `npm --prefix frontend-new run type-check:e2e && npm --prefix frontend-new run test:e2e -- tests/e2e/specs/team-context.spec.ts tests/e2e/specs/menu.spec.ts tests/e2e/specs/routes-auth.spec.ts tests/e2e/specs/profile-stats-admin.spec.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A frontend-new/src frontend-new/tests
git commit -m "feat(header): team slot with live status and a Teams sheet, menu drops its team row"
```

---

### Task 6: Verify against the spec on screen

**Files:**
- Create (throwaway, gitignored): `frontend-new/tmp/probe/header.spec.ts`

- [ ] **Step 1: Full checks**

Run each, from the repo root:

```bash
npm --prefix frontend-new run type-check
npm --prefix frontend-new run type-check:e2e
npm --prefix frontend-new run lint
npm --prefix frontend-new test
npm --prefix frontend-new run build
npm --prefix frontend-new run test:e2e:smoke
```

Expected: all pass. The e2e smoke needs the build from the previous command.

- [ ] **Step 2: Write the screenshot probe**

Create `frontend-new/tmp/probe/header.spec.ts`:

```ts
/* Проба шапки вкладок и уведомлений: снимки в устоявшемся состоянии, обе темы.
   Не тест продукта. Запуск: npx playwright test -c tmp/probe/playwright.probe.config.ts header */
import * as path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../../tests/e2e/fixtures/test';

const OUT = path.resolve(process.cwd(), 'tmp/probe/out/header');
const settle = (page: Page) => page.waitForTimeout(900);

async function both(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: `${OUT}/${name}-a.png` });
  const toggle = page.getByRole('button', { name: /^(Светлая|Тёмная) тема$/ }).first();
  if (await toggle.count()) {
    await toggle.click();
    await settle(page);
    await page.screenshot({ path: `${OUT}/${name}-b.png` });
    await toggle.click();
  }
}

test.describe('одна команда', () => {
  test.use({ scenario: 'active-poll-unvoted' });
  test('вкладки', async ({ appPage }) => {
    await appPage.goto('/');
    await both(appPage, '1-home');
    await appPage.goto('/menu');
    await expect(appPage.getByRole('button', { name: /^Голосуем · / })).toBeVisible();
    await both(appPage, '1-menu-poll');
    await appPage.goto('/stats');
    await both(appPage, '1-stats');
    await appPage.goto('/profile');
    await both(appPage, '1-profile');
  });
});

test.describe('закупка', () => {
  test.use({ scenario: 'store-collecting' });
  test('плашка закупки', async ({ appPage }) => {
    await appPage.goto('/stats');
    await expect(appPage.getByRole('button', { name: 'Закупка · сбор' })).toBeVisible();
    await both(appPage, '2-stats-run');
  });
});

test.describe('несколько команд', () => {
  test.use({ scenario: 'groups-multiple' });
  test('плашка, шторка и уведомление над шторкой', async ({ appPage }) => {
    await appPage.goto('/');
    await both(appPage, '3-home-multi');
    await appPage.getByRole('button', { name: /^Команда: .*\. Сменить$/ }).click();
    await both(appPage, '3-teams-sheet');
    await appPage.keyboard.press('Escape');

    // Участник по ссылке «Добавить блюдо» получает ошибку (5 с) — успеваем
    // открыть шторку и проверить, что уведомление лежит над ней.
    await appPage.goto('/?groupId=-100000000001&action=add');
    await expect(appPage.getByRole('alert')).toBeVisible();
    await appPage.getByRole('button', { name: /^Команда: .*\. Сменить$/ }).click();
    await appPage.waitForTimeout(400);
    const box = await appPage.locator('.toast:not(.is-leaving)').boundingBox();
    expect(box).not.toBeNull();
    const onTop = await appPage.evaluate(
      ([x, y]) => !!document.elementFromPoint(x, y)?.closest('.toast'),
      [box!.x + box!.width / 2, box!.y + box!.height / 2],
    );
    expect(onTop).toBe(true);
    const header = await appPage.locator('header.surf-elevated').boundingBox();
    expect(Math.round(box!.x)).toBe(Math.round(header!.x));
    expect(Math.round(box!.width)).toBe(Math.round(header!.width));
    expect(Math.round(box!.y)).toBe(Math.round(header!.y));
    await appPage.screenshot({ path: `${OUT}/3-toast-over-sheet.png` });
  });
});

test.describe('detail-экран', () => {
  test.use({ scenario: 'budget-responsible' });
  test('уведомление на экране без шапки вкладок', async ({ appPage }) => {
    await appPage.goto('/budget');
    await appPage.getByRole('button', { name: /^Напомнить: / }).first().click();
    await expect(appPage.getByRole('status').filter({ hasText: 'Напоминание отправлено' })).toBeVisible();
    await both(appPage, '4-detail-toast');
  });
});
```

- [ ] **Step 3: Run the probe**

Run: `cd frontend-new && npx playwright test -c tmp/probe/playwright.probe.config.ts header`
Expected: 5 tests pass; PNGs in `frontend-new/tmp/probe/out/header/`.

- [ ] **Step 4: Compare every screenshot with the spec and the visual rules**

Open each PNG (both themes) and check, writing down each mismatch:
- the header has no logo and no «Rocket Lunch»; the title and subtitle match the table in «Шапка вкладок»;
- the Home screen of a one-team person shows only the greeting; the feed starts right under the header, without a gap where the greeting was;
- chips: 32 px pill, vote colours for the poll, shop colours for the run, text not clipped at 390 px; «Офис ▾» with a dot only when the rule says so;
- the «Команды» sheet: each row shows a status line; the current team is highlighted and has a check mark;
- the notification frame coincides with the header bar edge to edge (the probe asserts x, width, y); two-line text fits; the close button is visible;
- light and dark themes are both readable.

Fix every mismatch in the owning file, re-run Step 3, repeat until none are left. The probe folder is gitignored; nothing from it is committed.

- [ ] **Step 5: Long server text**

Temporarily add, in `frontend-new/src/features/menu/MenuPage.tsx` inside the deep-link `useEffect`, a second call `toast.error('Сервер ответил длинной ошибкой, которая не помещается в две строки и должна растянуть рамку уведомления вниз, не обрезав ни одного слова в конце.')`, rebuild (`npm --prefix frontend-new run build`), re-run the probe's `несколько команд` test, check `3-toast-over-sheet.png`: the frame grew downward, no text cut. Then remove the temporary line and rebuild.

- [ ] **Step 6: Final commit of any fixes**

```bash
git add -A frontend-new/src frontend-new/tests
git commit -m "fix(header): visual fixes after the screenshot check"
```

(Skip if Step 4 found nothing to fix.)
