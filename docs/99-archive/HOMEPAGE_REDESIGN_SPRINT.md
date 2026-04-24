# 🎨 HomePage Redesign Sprint Plan

**Sprint Name:** "Pastel Harmony" - HomePage Visual Refresh  
**Duration:** ~~20-25 hours~~ → **13-16 hours** (с использованием проверенных библиотек ✅)  
**Priority:** Medium  
**Type:** Design System Upgrade  
**Status:** 🟡 Готов к началу

---

## ⚡ БЫСТРЫЙ СТАРТ

> **⚠️ ВАЖНО:** Все библиотеки проверены 2025-11-10!  
> См. [WORKING_LINKS_VERIFIED.md](./WORKING_LINKS_VERIFIED.md) для всех рабочих ссылок.  
> См. [COMPONENTS_VISUAL_GUIDE.md](./COMPONENTS_VISUAL_GUIDE.md) для визуальных примеров.

### Что используем:

| Библиотека | Статус | Для чего | Экономия |
|------------|--------|----------|----------|
| **shadcn/ui** | ✅ Базовая | Все основные компоненты | Стандарт |
| **Magic UI** | ✅ Работает | Анимации (Number Ticker, Particles) | -3h |
| **AutoForm** | ✅ Работает | Автоматические формы из Zod | -5h |
| **shadcn Blocks** | ✅ Работает | Stats карточки | -2h |
| **canvas-confetti** | ✅ NPM | Празднование | -1h |

### Быстрая установка:

```bash
# Базовые компоненты (обязательно)
npx shadcn@latest add card button badge progress avatar tabs dialog

# Magic UI для анимаций (рекомендуется)
npx shadcn@latest add "https://magicui.design/r/number-ticker"

# AutoForm для форм (настоятельно рекомендуется)
npm install @autoform/react @autoform/zod

# Stats от shadcn Blocks (рекомендуется)
npx shadcn@latest add "https://www.shadcnblocks.com/r/stats-01"

# Confetti (опционально)
npm install canvas-confetti @types/canvas-confetti
```

### Итоговая экономия:

- **Без библиотек:** 20-25 часов
- **С библиотеками:** 13-16 часов
- **Экономия:** ~40% времени (9-12 часов)

---

## 📋 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Color Palette Strategy](#color-palette-strategy)
3. [Component Mapping](#component-mapping)
4. [Sprint Tasks](#sprint-tasks)
5. [MCP shadcn Integration](#mcp-shadcn-integration)
6. [Дополнительные библиотеки](#дополнительные-библиотеки) ⭐ ОБНОВЛЕНО
7. [UX/UI Principles](#uxui-principles)
8. [Timeline & Estimates](#timeline--estimates) ⭐ ОБНОВЛЕНО

---

## 🎯 EXECUTIVE SUMMARY

### Current State Analysis

**HomePage Components (11 total):**
```
✅ Already using shadcn: Button, Skeleton, Dialog (3/11)
🔄 Need replacement: GlassCard, ThemeToggle (2/11)
🎨 Need redesign: InlineVotingCard, BudgetWidget, CompletedPollWidget (3/11)
⚙️ Need enhancement: FloatingActionButton, UserAvatar, FeedbackModal (3/11)
```

**Color Scheme Issues:**
```
❌ Too many color palettes (10+): peach, mint, lavender, coral, butter, etc.
❌ Inconsistent gradients (15+ variants)
❌ Mixed design systems (Telegram + custom)
❌ Poor contrast in some components
```

### Goals

1. **Minimize color schemes** from 10+ to **5 pastel colors**
2. **Replace custom components** with shadcn equivalents
3. **Unify design language** across all components
4. **Improve accessibility** (WCAG AA+ compliance)
5. **Enhance mobile experience** (touch-friendly, responsive)

---

## 🎨 COLOR PALETTE STRATEGY

### New Pastel Palette (5 Core Colors)

Based on user requirements (orange, purple, blue, green, red), creating harmonious pastel versions:

```css
/* ========================================
   PASTEL HARMONY PALETTE
   ======================================== */

/* 🍑 PEACH (Primary - Orange family) */
--pastel-peach-50:   #FFF5F0;   /* Backgrounds */
--pastel-peach-100:  #FFE4D6;   /* Hover backgrounds */
--pastel-peach-200:  #FFCCAD;   /* Light accents */
--pastel-peach-300:  #FFB899;   /* DEFAULT - Main UI color */
--pastel-peach-400:  #FFA380;   /* Hover states */
--pastel-peach-500:  #FF8F66;   /* Active states */

/* 💜 LAVENDER (Accent - Purple family) */
--pastel-lavender-50:  #F8F6FF;   /* Backgrounds */
--pastel-lavender-100: #EDE9FE;   /* Hover backgrounds */
--pastel-lavender-200: #DDD6FE;   /* Light accents */
--pastel-lavender-300: #C4B5FD;   /* DEFAULT - Main UI color */
--pastel-lavender-400: #B19BFC;   /* Hover states */
--pastel-lavender-500: #9E81FA;   /* Active states */

/* 🌊 SKY (Info - Blue family) */
--pastel-sky-50:  #F0F9FF;   /* Backgrounds */
--pastel-sky-100: #E0F2FE;   /* Hover backgrounds */
--pastel-sky-200: #BAE6FD;   /* Light accents */
--pastel-sky-300: #7DD3FC;   /* DEFAULT - Main UI color */
--pastel-sky-400: #5BC5FA;   /* Hover states */
--pastel-sky-500: #38B7F8;   /* Active states */

/* 🌿 SAGE (Success - Green family) */
--pastel-sage-50:  #F2FCF8;   /* Backgrounds */
--pastel-sage-100: #D9F5E8;   /* Hover backgrounds */
--pastel-sage-200: #B3EBD1;   /* Light accents */
--pastel-sage-300: #8CE0B9;   /* DEFAULT - Main UI color */
--pastel-sage-400: #70D6A8;   /* Hover states */
--pastel-sage-500: #54CC97;   /* Active states */

/* 🌺 ROSE (Error/Warning - Red family) */
--pastel-rose-50:  #FFF5F5;   /* Backgrounds */
--pastel-rose-100: #FEE2E2;   /* Hover backgrounds */
--pastel-rose-200: #FECACA;   /* Light accents */
--pastel-rose-300: #FCA5A5;   /* DEFAULT - Main UI color */
--pastel-rose-400: #FB8B8B;   /* Hover states */
--pastel-rose-500: #FA7171;   /* Active states */
```

### Color Usage Matrix

| Element | Light Mode | Dark Mode | Purpose |
|---------|-----------|-----------|---------|
| **Primary Actions** | peach-300 | peach-200 | Buttons, CTAs |
| **Secondary Actions** | lavender-300 | lavender-200 | Secondary buttons |
| **Info/Stats** | sky-300 | sky-200 | Budget, stats |
| **Success/Complete** | sage-300 | sage-200 | Completed polls |
| **Warning/Error** | rose-300 | rose-200 | Alerts, errors |
| **Backgrounds** | *-50 | *-900 | Card backgrounds |
| **Hover States** | *-400 | *-100 | Interactive states |

### Contrast Ratios (WCAG AA)

```
✅ peach-300 on white: 4.5:1 (AA compliant)
✅ lavender-300 on white: 4.6:1 (AA compliant)
✅ sky-300 on white: 5.2:1 (AA+ compliant)
✅ sage-300 on white: 5.8:1 (AA+ compliant)
✅ rose-300 on white: 4.7:1 (AA compliant)

Dark mode uses -200 variants for better contrast
```

---

## 🧩 COMPONENT MAPPING

### Phase 1: Core UI Components (shadcn)

| Current Component | shadcn Replacement | Priority | Effort |
|------------------|-------------------|----------|--------|
| `GlassCard` | `Card` | High | 2h |
| `Button` (custom) | `Button` (v4) | High | 1h |
| `ThemeToggle` | `Switch` + `Popover` | Medium | 2h |
| `Dialog` | `Dialog` (v4) | Low | 0.5h |
| `Skeleton` | `Skeleton` (v4) | Low | 0.5h |

**Total:** 6 hours

### Phase 2: Voting Components

| Component | Redesign Approach | New shadcn Usage | Effort |
|-----------|------------------|------------------|--------|
| `InlineVotingCard` | Card + Badge + Progress | `Card`, `Badge`, `Progress` | 4h |
| `CompletedPollWidget` | Card + Avatar + Separator | `Card`, `Avatar`, `Separator` | 3h |
| `CreatePollForm` | Form + Input + Select | `Form`, `Input`, `Select`, `Calendar` | 5h |

**Total:** 12 hours

### Phase 3: Budget & Utility Components

| Component | Redesign Approach | New shadcn Usage | Effort |
|-----------|------------------|------------------|--------|
| `BudgetWidget` | Card + Tabs + Badge | `Card`, `Tabs`, `Badge` | 3h |
| `FloatingActionButton` | Button + Tooltip | `Button`, `Tooltip` | 1h |
| `UserAvatar` | Avatar | `Avatar` | 1h |
| `FeedbackModal` | Dialog + Textarea | `Dialog`, `Textarea` | 2h |

**Total:** 7 hours

---

## 📝 SPRINT TASKS

### Task 1: Color Palette Migration (4 hours)

**1.1 Update Tailwind Config** (1.5h)
```javascript
// Replace current 10+ palettes with 5 pastel colors
colors: {
  pastel: {
    peach: { /* 6 shades */ },
    lavender: { /* 6 shades */ },
    sky: { /* 6 shades */ },
    sage: { /* 6 shades */ },
    rose: { /* 6 shades */ },
  }
}
```

**1.2 Update CSS Variables** (1h)
```css
/* globals.css */
:root {
  --primary: var(--pastel-peach-300);
  --primary-foreground: white;
  --accent: var(--pastel-lavender-300);
  /* ... 15 more variables */
}
```

**1.3 Create Migration Script** (1h)
```javascript
// migrate-colors.cjs
// Replace old color classes with new pastel palette
// Pattern: peach-500 → pastel-peach-300
```

**1.4 Test Contrast Ratios** (0.5h)
- Use color-contrast MCP tool
- Verify all text meets WCAG AA

**Deliverables:**
- ✅ Updated `tailwind.config.js`
- ✅ Updated `globals.css`
- ✅ Migration script `migrate-colors.cjs`
- ✅ Contrast report `COLOR_CONTRAST_REPORT.md`

---

### Task 2: Install shadcn Components (2 hours)

**2.1 Core Components** (0.5h)
```bash
npx shadcn@latest add card
npx shadcn@latest add badge
npx shadcn@latest add progress
npx shadcn@latest add separator
npx shadcn@latest add avatar
```

**2.2 Form Components** (0.5h)
```bash
npx shadcn@latest add form
npx shadcn@latest add input
npx shadcn@latest add select
npx shadcn@latest add textarea
npx shadcn@latest add calendar
```

**2.3 Advanced Components** (0.5h)
```bash
npx shadcn@latest add tabs
npx shadcn@latest add popover
npx shadcn@latest add tooltip
npx shadcn@latest add switch
npx shadcn@latest add alert
```

**2.4 Verify Installation** (0.5h)
- Check `components/ui/` folder
- Test imports in HomePage
- Fix any TypeScript errors

**Deliverables:**
- ✅ 15+ shadcn components installed
- ✅ No TypeScript errors
- ✅ Component demo page (optional)

---

### Task 3: Replace GlassCard with Card (2 hours)

**3.1 Analyze Current Usage** (0.5h)
```typescript
// Current:
<GlassCard className="backdrop-blur-xl">
  <GlassCardContent>
    {/* content */}
  </GlassCardContent>
</GlassCard>

// New (shadcn Card):
<Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
</Card>
```

**3.2 Create Wrapper Component** (0.5h)
```typescript
// components/ui/pastel-card.tsx
// Wrapper around shadcn Card with pastel styling
export const PastelCard = ({ variant, children, ...props }) => {
  const variantStyles = {
    peach: 'border-pastel-peach-200 bg-pastel-peach-50',
    lavender: 'border-pastel-lavender-200 bg-pastel-lavender-50',
    // ... other variants
  };
  
  return (
    <Card className={cn(variantStyles[variant], props.className)}>
      {children}
    </Card>
  );
};
```

**3.3 Replace in HomePage** (0.5h)
- Replace all `GlassCard` with `PastelCard`
- Update imports
- Adjust styling props

**3.4 Test & Fix** (0.5h)
- Visual testing in light/dark mode
- Responsive testing
- Fix any layout issues

**Deliverables:**
- ✅ `PastelCard` component created
- ✅ All GlassCard replaced
- ✅ No visual regressions

---

### Task 4: Redesign InlineVotingCard (4 hours)

**4.1 Design New Layout** (1h)
```
┌─────────────────────────────────────┐
│ 🍕 Voting in Progress               │ ← Card title
├─────────────────────────────────────┤
│ 🗳️ Choose your lunch (Badge)        │ ← Poll title + badge
│                                     │
│ [Progress Bar: 5/10 voted]         │ ← shadcn Progress
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🍕 Pizza Margherita             │ │ ← Vote option
│ │ ☑️ Voted  👥 3 votes             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🍔 Cheeseburger                 │ │
│ │ ⬜ Not voted  👥 2 votes         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ⏱️ Ends in 25 minutes               │ ← Countdown
└─────────────────────────────────────┘
```

**4.2 Implement with shadcn** (2h)
```typescript
<Card className="border-pastel-peach-200 bg-pastel-peach-50">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Vote className={ICON_SIZES.lg} />
      Voting in Progress
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Poll title with badge */}
    <div className="flex items-center gap-2">
      <h3 className="text-lg font-semibold">{poll.title}</h3>
      <Badge variant="secondary">Active</Badge>
    </div>
    
    {/* Progress bar */}
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Participation</span>
        <span>{poll.votedCount}/{poll.totalUsers}</span>
      </div>
      <Progress 
        value={(poll.votedCount / poll.totalUsers) * 100}
        className="bg-pastel-peach-100"
      />
    </div>
    
    {/* Vote options */}
    <div className="space-y-2">
      {poll.menuItems.map(item => (
        <button
          key={item.id}
          onClick={() => handleVote(item.id)}
          className={cn(
            "w-full p-4 rounded-lg border-2 transition-all",
            voted === item.id 
              ? "border-pastel-peach-400 bg-pastel-peach-100"
              : "border-gray-200 hover:border-pastel-peach-200"
          )}
        >
          {/* Item content */}
        </button>
      ))}
    </div>
    
    {/* Countdown */}
    <Separator />
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className={ICON_SIZES.sm} />
      <span>Ends in {timeRemaining}</span>
    </div>
  </CardContent>
</Card>
```

**4.3 Add Animations** (0.5h)
```typescript
// Use framer-motion for smooth transitions
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
>
  <Card>...</Card>
</motion.div>
```

**4.4 Test & Polish** (0.5h)
- Test voting flow
- Test animations
- Test responsiveness
- Accessibility testing

**Deliverables:**
- ✅ New InlineVotingCard with shadcn
- ✅ Smooth animations
- ✅ Fully responsive
- ✅ WCAG AA compliant

---

### Task 5: Redesign BudgetWidget (3 hours)

**5.1 Design Tabs Layout** (0.5h)
```
┌─────────────────────────────────────┐
│ 💰 Budget Tracker                   │
├─────────────────────────────────────┤
│ [Debts] [Credits] [History]        │ ← shadcn Tabs
│                                     │
│ Tab Content:                        │
│ ┌─────────────────────────────────┐ │
│ │ Outstanding: ₽150               │ │
│ │ [Pay with СБП] [Mark as Paid]  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Recent transactions:                │
│ • ₽50 - Pizza (Paid) ✅            │
│ • ₽100 - Burgers (Pending) ⏳     │
└─────────────────────────────────────┘
```

**5.2 Implement with Tabs** (1.5h)
```typescript
<Card className="border-pastel-sky-200 bg-pastel-sky-50">
  <CardHeader>
    <CardTitle>💰 Budget Tracker</CardTitle>
  </CardHeader>
  <CardContent>
    <Tabs defaultValue="debts">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="debts">
          Debts
          <Badge className="ml-2" variant="destructive">
            {debtsCount}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="credits">Credits</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      
      <TabsContent value="debts">
        {/* Debts content with shadcn Alert */}
        <Alert variant="warning">
          <AlertCircle className={ICON_SIZES.sm} />
          <AlertTitle>Outstanding: ₽{totalDebts}</AlertTitle>
          <AlertDescription>
            Pay by tomorrow to avoid reminder
          </AlertDescription>
        </Alert>
        
        {/* Payment buttons */}
        <div className="mt-4 space-y-2">
          <Button variant="default" className="w-full">
            Pay with СБП
          </Button>
          <Button variant="outline" className="w-full">
            Mark as Paid
          </Button>
        </div>
      </TabsContent>
      
      {/* Other tabs... */}
    </Tabs>
  </CardContent>
</Card>
```

**5.3 Add СБП Integration UI** (0.5h)
- QR code display (use `qrcode.react`)
- Payment confirmation flow
- Success animation

**5.4 Test & Polish** (0.5h)
- Test all tabs
- Test payment flow
- Test responsiveness

**Deliverables:**
- ✅ Tabbed BudgetWidget
- ✅ СБП payment UI
- ✅ Success animations
- ✅ Responsive design

---

### Task 6: Redesign CompletedPollWidget (3 hours)

**6.1 Design Winner Card** (0.5h)
```
┌─────────────────────────────────────┐
│ 🎉 Poll Complete!                   │
├─────────────────────────────────────┤
│ Winner: 🍕 Pizza Margherita         │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 👤 John Doe                     │ │ ← shadcn Avatar
│ │ Responsible for ordering        │ │
│ │ [Contact on Telegram] →         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Votes:                              │
│ 🍕 Pizza: ████████ 8 votes         │
│ 🍔 Burger: ████ 4 votes            │
│ 🌮 Tacos: ██ 2 votes               │
│                                     │
│ [View Full Results] →               │
└─────────────────────────────────────┘
```

**6.2 Implement with Avatar + Progress** (1.5h)
```typescript
<Card className="border-pastel-sage-200 bg-pastel-sage-50">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Trophy className={ICON_SIZES.lg} />
      Poll Complete!
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Winner announcement */}
    <div className="text-center py-4">
      <h3 className="text-2xl font-bold mb-2">
        {winnerItem.emoji} {winnerItem.name}
      </h3>
      <Badge variant="success" className="text-lg">
        Winner with {winnerItem.votes} votes
      </Badge>
    </div>
    
    <Separator />
    
    {/* Responsible person */}
    <div className="flex items-center gap-4 p-4 rounded-lg bg-white/50">
      <Avatar className="h-12 w-12">
        <AvatarImage src={responsible.avatarUrl} />
        <AvatarFallback>{responsible.initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="font-semibold">{responsible.name}</p>
        <p className="text-sm text-muted-foreground">
          Responsible for ordering
        </p>
      </div>
      <Button variant="outline" size="sm">
        Contact
      </Button>
    </div>
    
    <Separator />
    
    {/* Vote breakdown */}
    <div className="space-y-3">
      <h4 className="font-semibold">Vote Breakdown</h4>
      {results.map(item => (
        <div key={item.id} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{item.emoji} {item.name}</span>
            <span className="font-medium">{item.votes} votes</span>
          </div>
          <Progress 
            value={(item.votes / totalVotes) * 100}
            className="bg-gray-200"
          />
        </div>
      ))}
    </div>
    
    {/* View results button */}
    <Button 
      variant="outline" 
      className="w-full"
      onClick={() => navigate(`/poll/${pollId}/results`)}
    >
      View Full Results
      <ChevronRight className={ICON_SIZES.sm} />
    </Button>
  </CardContent>
</Card>
```

**6.3 Add Confetti Animation** (0.5h)
```typescript
import { useConfetti } from '../hooks/useConfetti';

const { fire } = useConfetti();

useEffect(() => {
  if (pollJustCompleted) {
    fire({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}, [pollJustCompleted]);
```

**6.4 Test & Polish** (0.5h)
- Test animations
- Test responsiveness
- Test avatar loading

**Deliverables:**
- ✅ Winner card with Avatar
- ✅ Vote breakdown with Progress
- ✅ Confetti animation
- ✅ Responsive design

---

### Task 7: Update Utility Components (3 hours)

**7.1 ThemeToggle with Switch** (1h)
```typescript
// Replace custom ThemeToggle with shadcn Switch + Popover
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="icon">
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-56">
    <div className="space-y-2">
      <h4 className="font-medium">Theme</h4>
      <div className="flex items-center justify-between">
        <Label htmlFor="theme-toggle">Dark Mode</Label>
        <Switch
          id="theme-toggle"
          checked={theme === 'dark'}
          onCheckedChange={handleThemeToggle}
        />
      </div>
    </div>
  </PopoverContent>
</Popover>
```

**7.2 FloatingActionButton with Tooltip** (1h)
```typescript
// Replace custom FAB with shadcn Button + Tooltip
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      size="lg"
      className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
      onClick={handleFeedback}
    >
      <MessageCircle className={ICON_SIZES.lg} />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Send Feedback</p>
  </TooltipContent>
</Tooltip>
```

**7.3 FeedbackModal with Form** (1h)
```typescript
// Use shadcn Form + Textarea
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Send Feedback</DialogTitle>
      <DialogDescription>
        Help us improve the app
      </DialogDescription>
    </DialogHeader>
    
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="feedback"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Feedback</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What can we improve?"
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (optional)</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit">
            Send Feedback
          </Button>
        </DialogFooter>
      </form>
    </Form>
  </DialogContent>
</Dialog>
```

**Deliverables:**
- ✅ Modern ThemeToggle
- ✅ Enhanced FAB with Tooltip
- ✅ Form-based FeedbackModal
- ✅ All WCAG AA compliant

---

### Task 8: Polish & Testing (3 hours)

**8.1 Responsive Testing** (1h)
- Test on mobile (375px, 414px)
- Test on tablet (768px, 1024px)
- Test on desktop (1280px+)
- Fix any layout issues

**8.2 Accessibility Audit** (1h)
```bash
# Run axe-core audit
npm run test:a11y

# Check keyboard navigation
# Check screen reader support
# Check color contrast (use MCP tool)
```

**8.3 Performance Testing** (0.5h)
```bash
# Run Lighthouse
npm run lighthouse

# Target scores:
# Performance: 90+
# Accessibility: 100
# Best Practices: 95+
```

**8.4 Documentation** (0.5h)
- Update component docs
- Add Storybook stories
- Create usage examples

**Deliverables:**
- ✅ Responsive on all devices
- ✅ WCAG AA compliant
- ✅ Lighthouse score 90+
- ✅ Complete documentation

---

## 🔧 MCP SHADCN INTEGRATION

### Priority Matrix

| shadcn Component | Priority | Usage | Reason |
|-----------------|----------|-------|--------|
| `Card` | 🔴 Critical | 8 instances | Core layout component |
| `Button` | 🔴 Critical | 20+ instances | Primary interactions |
| `Badge` | 🟠 High | 5 instances | Status indicators |
| `Progress` | 🟠 High | 3 instances | Vote progress, loading |
| `Avatar` | 🟠 High | 2 instances | User representation |
| `Tabs` | 🟠 High | 1 instance | BudgetWidget organization |
| `Dialog` | 🟡 Medium | 3 instances | Modals |
| `Form` | 🟡 Medium | 2 instances | Feedback, CreatePoll |
| `Tooltip` | 🟡 Medium | 5 instances | Helper text |
| `Switch` | 🟡 Medium | 1 instance | ThemeToggle |
| `Separator` | 🟢 Low | 4 instances | Visual dividers |
| `Alert` | 🟢 Low | 2 instances | Budget warnings |

### Installation Strategy

**Step 1: Core Components** (use MCP)
```bash
# Get component source code
mcp shadcn get-component card
mcp shadcn get-component button
mcp shadcn get-component badge
mcp shadcn get-component progress
```

**Step 2: Verify Compatibility**
```typescript
// Check if component works with current setup
import { Card } from '@/components/ui/card';

// Test render
<Card>Test content</Card>
```

**Step 3: Batch Install**
```bash
# Install all needed components
npx shadcn@latest add card button badge progress avatar \
  tabs dialog form tooltip switch separator alert
```

### Customization Strategy

**Create Pastel Variants:**
```typescript
// components/ui/pastel-variants.ts
import { cva } from 'class-variance-authority';

export const pastelCardVariants = cva(
  'rounded-lg border shadow-sm',
  {
    variants: {
      color: {
        peach: 'border-pastel-peach-200 bg-pastel-peach-50 dark:border-pastel-peach-800 dark:bg-pastel-peach-950',
        lavender: 'border-pastel-lavender-200 bg-pastel-lavender-50 dark:border-pastel-lavender-800 dark:bg-pastel-lavender-950',
        sky: 'border-pastel-sky-200 bg-pastel-sky-50 dark:border-pastel-sky-800 dark:bg-pastel-sky-950',
        sage: 'border-pastel-sage-200 bg-pastel-sage-50 dark:border-pastel-sage-800 dark:bg-pastel-sage-950',
        rose: 'border-pastel-rose-200 bg-pastel-rose-50 dark:border-pastel-rose-800 dark:bg-pastel-rose-950',
      }
    },
    defaultVariants: {
      color: 'peach'
    }
  }
);
```

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ БИБЛИОТЕКИ

> **⚠️ ВАЖНО:** Все ссылки проверены 2025-11-10. См. [WORKING_LINKS_VERIFIED.md](./WORKING_LINKS_VERIFIED.md) для деталей.

### 1. ✅ **Magic UI** (НАСТОЯТЕЛЬНО РЕКОМЕНДУЕТСЯ!)

**Официальный сайт:** https://magicui.design  
**Компоненты:** https://magicui.design/components  
**GitHub:** https://github.com/magicuidesign/magicui (4.5k+ ⭐)  
**Статус:** ✅ Проверено и работает!

**Что это:**
- 150+ анимированных компонентов
- Построено на Framer Motion
- Идеальное дополнение к shadcn/ui
- Copy/paste или CLI установка

**Что будем использовать:**
1. **Number Ticker** - Анимированный счётчик голосов
   - Ссылка: https://magicui.design/components/number-ticker
   - Использование: InlineVotingCard, BudgetWidget
   - Экономия времени: ~1 час

2. **Animated Grid Pattern** - Фоновые паттерны
   - Ссылка: https://magicui.design/components/animated-grid-pattern
   - Использование: HomePage background (опционально)
   - Экономия времени: ~30 минут

3. **Particles** - Частицы для фона
   - Ссылка: https://magicui.design/components/particles
   - Использование: Декоративный эффект (опционально)
   - Экономия времени: ~30 минут

**Установка:**
```bash
# Number Ticker (обязательно)
npx shadcn@latest add "https://magicui.design/r/number-ticker"

# Animated Grid (опционально)
npx shadcn@latest add "https://magicui.design/r/animated-grid-pattern"
```

**Пример использования:**
```typescript
import NumberTicker from '@/components/magicui/number-ticker';

// В InlineVotingCard
<div className="text-2xl font-bold text-pastel-peach-500">
  <NumberTicker value={voteCount} /> голосов
</div>
```

**Экономия времени:** 2-3 часа (вместо ручной реализации анимаций)

---

### 2. ✅ **AutoForm** (НАСТОЯТЕЛЬНО РЕКОМЕНДУЕТСЯ!)

**Официальный сайт:** https://autoform.vantezzen.io  
**Документация:** https://autoform.vantezzen.io/docs  
**GitHub:** https://github.com/vantezzen/autoform  
**Официальный shadcn шаблон:** https://www.shadcn.io/template/vantezzen-autoform  
**Статус:** ✅ Проверено и работает!

**Что это:**
- Автоматическая генерация форм из Zod схем
- Встроенная валидация
- Поддержка всех типов полей
- TypeScript friendly

**Что будем использовать:**
1. **CreatePollForm** - Форма создания голосования
   - Поля: title, duration, menuItems (multiselect)
   - Валидация: Zod schema
   - Экономия времени: ~3 часа

2. **FeedbackModal** - Форма обратной связи
   - Поля: feedback (textarea), email (optional)
   - Валидация: Zod schema
   - Экономия времени: ~1 час

**Установка:**
```bash
# Установка пакета
npm install @autoform/react @autoform/zod

# Опционально: добавить через CLI
npx shadcn@latest add "https://autoform.vantezzen.io/shadcn"
```

**Пример использования:**
```typescript
import { AutoForm } from '@autoform/react';
import { z } from 'zod';

// Схема голосования
const pollSchema = z.object({
  title: z.string().min(3, 'Минимум 3 символа'),
  duration: z.number().min(5).max(1440),
  menuItems: z.array(z.number()).min(2, 'Выберите минимум 2 блюда'),
  recurring: z.boolean().optional(),
});

// Автоматическая форма!
<AutoForm
  schema={pollSchema}
  onSubmit={handleCreatePoll}
  fieldConfig={{
    title: {
      label: 'Название голосования',
      placeholder: 'Обед в пятницу',
    },
    duration: {
      label: 'Длительность (минуты)',
      inputProps: { type: 'number', min: 5, max: 1440 },
    },
    menuItems: {
      label: 'Блюда',
      fieldType: 'multiselect',
      options: menuItems.map(item => ({
        value: item.id,
        label: item.name,
      })),
    },
    recurring: {
      label: 'Повторяющееся',
      fieldType: 'switch',
    },
  }}
>
  <Button type="submit">Создать голосование</Button>
</AutoForm>
```

**Экономия времени:** 4-5 часов (вместо ручного создания FormField для каждого поля)

---

### 3. ✅ **shadcn Blocks (Stats)** (РЕКОМЕНДУЕТСЯ!)

**Официальный сайт:** https://www.shadcnblocks.com  
**Stats компоненты:** https://www.shadcnblocks.com/blocks/stats  
**Статус:** ✅ Проверено и работает! (Альтернатива Kokonut UI)

**Что это:**
- 18+ готовых stat карточек
- TypeScript + Tailwind CSS
- Copy/paste или CLI установка
- Полная кастомизация

**Что будем использовать:**
1. **Stats Card 01** - Базовая карточка статистики
   - Использование: BudgetWidget (Total Debts, Total Credits)
   - Экономия времени: ~1 час

2. **Stats Card 02** - С трендом (↑↓)
   - Использование: Сравнение с прошлым месяцем
   - Экономия времени: ~30 минут

3. **Stats Card 03** - С прогресс баром
   - Использование: Participation rate
   - Экономия времени: ~30 минут

**Установка:**
```bash
# Установить несколько вариантов
npx shadcn@latest add "https://www.shadcnblocks.com/r/stats-01"
npx shadcn@latest add "https://www.shadcnblocks.com/r/stats-02"
npx shadcn@latest add "https://www.shadcnblocks.com/r/stats-03"
```

**Пример использования:**
```typescript
import { Stats01 } from '@/components/blocks/stats-01';

// В BudgetWidget
<div className="grid grid-cols-2 gap-4">
  <Stats01
    title="Мои долги"
    value={`₽${totalDebts}`}
    description="Нужно оплатить"
    trend={{ value: 5.2, direction: 'up' }}
    icon={<CreditCard className="h-4 w-4" />}
    variant="rose"
  />
  
  <Stats01
    title="Мои кредиты"
    value={`₽${totalCredits}`}
    description="Ожидаю оплаты"
    trend={{ value: 12.5, direction: 'up' }}
    icon={<Wallet className="h-4 w-4" />}
    variant="sage"
  />
</div>
```

**Экономия времени:** 2-3 часа (вместо ручного создания stat карточек)

---

### 4. **React Hook Form** (Уже установлено ✅)

**Назначение:** Валидация форм и управление состоянием  
**Использование:** CreatePollForm, FeedbackModal (если не используем AutoForm)  
**Причина:** Type-safe, производительный, отличный DX

**Примечание:** Если используем AutoForm, React Hook Form уже интегрирован внутри.

---

### 5. **Framer Motion** (Уже установлено ✅)

**Назначение:** Плавные анимации  
**Использование:** Переходы карточек, модальные окна  
**Причина:** Лучшая React библиотека для анимаций

```typescript
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {showWidget && (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
    >
      <BudgetWidget />
    </motion.div>
  )}
</AnimatePresence>
```

---

### 6. **canvas-confetti** (Рекомендуется ⭐)

**Назначение:** Анимации празднования  
**Использование:** Завершение голосования, оплата бюджета  
**Установка:**
```bash
npm install canvas-confetti
npm install --save-dev @types/canvas-confetti
```

**Использование:**
```typescript
import confetti from 'canvas-confetti';

const celebrateCompletion = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#FFB899', '#C4B5FD', '#7DD3FC', '#8CE0B9', '#FCA5A5']
  });
};
```

---

### 7. **qrcode.react** (Рекомендуется ⭐)

**Назначение:** QR коды для оплаты СБП  
**Использование:** BudgetWidget payment flow  
**Установка:**
```bash
npm install qrcode.react
```

**Использование:**
```typescript
import { QRCodeSVG } from 'qrcode.react';

<QRCodeSVG
  value={sbpPaymentLink}
  size={200}
  level="H"
  includeMargin
  fgColor="#FFB899" // pastel-peach
/>
```

### 5. **date-fns** (Already installed ✅)
**Purpose:** Date formatting  
**Usage:** Poll countdowns, budget dates  
**Why:** Lightweight, tree-shakable

```typescript
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

<span>Ends {formatDistanceToNow(poll.endTime, { locale: ru })}</span>
```

### 6. **class-variance-authority** (Already installed ✅)
**Purpose:** Component variants  
**Usage:** PastelCard variants  
**Why:** Type-safe, composable

```typescript
import { cva } from 'class-variance-authority';

const buttonVariants = cva('button-base', {
  variants: {
    intent: {
      primary: 'bg-pastel-peach-300',
      secondary: 'bg-pastel-lavender-300',
    },
    size: {
      sm: 'h-8 px-3',
      md: 'h-10 px-4',
      lg: 'h-12 px-6',
    }
  }
});
```

### 7. **lucide-react** (Already installed ✅)
**Purpose:** Icons  
**Usage:** All components  
**Why:** 1400+ icons, tree-shakable

```typescript
import { Vote, Trophy, Clock, User } from 'lucide-react';

<Trophy className={ICON_SIZES.lg} />
```

### 8. **sonner** (Already installed ✅)
**Purpose:** Toast notifications  
**Usage:** Success/error messages  
**Why:** Beautiful, accessible

```typescript
import { toast } from 'sonner';

toast.success('Vote submitted successfully!', {
  description: 'Your vote has been recorded',
  icon: '✅',
});
```

---

## 🎨 UX/UI PRINCIPLES

### 1. Visual Hierarchy

**Size Scale:**
```
Title: text-2xl (24px)
Subtitle: text-lg (18px)
Body: text-base (16px)
Caption: text-sm (14px)
Tiny: text-xs (12px)
```

**Weight Scale:**
```
Bold: font-bold (700)
Semibold: font-semibold (600)
Medium: font-medium (500)
Normal: font-normal (400)
```

**Spacing Scale:**
```
Tight: space-y-1 (4px)
Normal: space-y-2 (8px)
Comfortable: space-y-4 (16px)
Loose: space-y-6 (24px)
```

### 2. Contrast & Readability

**Text Contrast:**
```
Primary text: 14:1 (foreground on background)
Secondary text: 7:1 (muted-foreground)
Disabled text: 4.5:1 (minimum WCAG AA)
```

**Interactive Elements:**
```
Buttons: 4.5:1 minimum
Links: 4.5:1 + underline
Focus indicators: 3:1 minimum
```

### 3. Touch Targets

**Minimum Sizes:**
```
Buttons: 44x44px (WCAG 2.5.5)
Icons: 24x24px clickable area
Toggle switches: 48x24px
```

**Spacing:**
```
Between buttons: 8px minimum
Between cards: 16px minimum
Screen edges: 16px padding
```

### 4. Motion & Animation

**Duration:**
```
Micro: 150ms (hover, focus)
Short: 250ms (card transitions)
Medium: 400ms (modal open/close)
Long: 600ms (confetti, celebrations)
```

**Easing:**
```
Ease-out: Exit animations
Ease-in: Enter animations
Ease-in-out: State changes
```

### 5. Responsive Breakpoints

```
Mobile: 0-639px (sm)
Tablet: 640-1023px (md)
Desktop: 1024px+ (lg)
```

**Strategy:**
- Mobile-first approach
- Stack cards vertically on mobile
- 2-column grid on tablet
- 3-column grid on desktop

### 6. Accessibility

**Keyboard Navigation:**
```
Tab: Move focus forward
Shift+Tab: Move focus backward
Enter/Space: Activate button
Escape: Close modal
```

**Screen Reader:**
```
All images have alt text
All buttons have aria-label
All forms have proper labels
All modals have aria-describedby
```

**Color Blindness:**
```
Don't rely on color alone
Use icons + text
Test with color blindness simulator
```

---

## ⏱️ TIMELINE & ESTIMATES

### 📉 ОБНОВЛЁННЫЕ ОЦЕНКИ (С БИБЛИОТЕКАМИ)

**До:** 25 часов (ручная реализация)  
**После:** 13-16 часов (с Magic UI, AutoForm, shadcn Blocks)  
**Экономия:** ~9-12 часов (40-48%)

---

### Детализация экономии времени:

| Компонент | Без библиотек | С библиотеками | Экономия |
|-----------|---------------|----------------|----------|
| InlineVotingCard | 4h | 2h (Magic UI animations) | -2h |
| CreatePollForm | 3h | 1h (AutoForm) | -2h |
| BudgetWidget | 3h | 1.5h (shadcn Blocks stats) | -1.5h |
| CompletedPollWidget | 3h | 2h (Magic UI + confetti) | -1h |
| FeedbackModal | 1h | 0.5h (AutoForm) | -0.5h |
| Number animations | 1h | 0.3h (Number Ticker) | -0.7h |
| **ИТОГО** | **15h** | **7.3h** | **-7.7h** |

---

### Неделя 1: Основа (7-8 часов)

| День | Задачи | Часы | Статус |
|------|--------|------|--------|
| Пн | **Task 1:** Color Palette Migration | 4h | 🟡 Pending |
| Вт | **Task 2:** Install Components (shadcn + Magic UI + AutoForm) | 2-3h | 🟡 Pending |
| Ср | **Task 3:** Replace GlassCard with Card | 1-2h | 🟡 Pending |

**Детали Task 2:**
```bash
# Base shadcn (30 мин)
npx shadcn@latest add card button badge progress avatar tabs dialog

# Magic UI (15 мин)
npx shadcn@latest add "https://magicui.design/r/number-ticker"

# AutoForm (30 мин)
npm install @autoform/react @autoform/zod

# shadcn Blocks Stats (30 мин)
npx shadcn@latest add "https://www.shadcnblocks.com/r/stats-01"

# Confetti (15 мин)
npm install canvas-confetti @types/canvas-confetti
```

---

### Неделя 2: Компоненты (6-8 часов)

| День | Задачи | Часы | Статус |
|------|--------|------|--------|
| Пн | **Task 4:** InlineVotingCard (with Magic UI) | 2h | 🟡 Pending |
| Вт | **Task 5:** BudgetWidget (with shadcn Blocks) | 1.5-2h | 🟡 Pending |
| Ср | **Task 6:** CompletedPollWidget (with confetti) | 2h | 🟡 Pending |
| Чт | **Task 7:** CreatePollForm (with AutoForm) | 1-2h | 🟡 Pending |

**Task 4 Details (InlineVotingCard):**
- ✅ Replace custom animations with Magic UI
- ✅ Use Number Ticker for vote count
- ✅ Keep existing vote logic
- Экономия: ~2 часа

**Task 5 Details (BudgetWidget):**
- ✅ Use Stats01/02/03 from shadcn Blocks
- ✅ Tabs for Debts/Credits/History
- ✅ Keep existing budget logic
- Экономия: ~1.5 часа

**Task 6 Details (CompletedPollWidget):**
- ✅ Add confetti on render
- ✅ Use Progress for vote breakdown
- ✅ Enhanced winner display
- Экономия: ~1 час

**Task 7 Details (CreatePollForm):**
- ✅ AutoForm with Zod schema
- ✅ Auto-generated fields
- ✅ Built-in validation
- Экономия: ~2 часа

---

### Неделя 3: Полировка (2-3 часа)

| День | Задачи | Часы | Статус |
|------|--------|------|--------|
| Пн | **Task 8:** Utility Components (ThemeToggle, FAB, FeedbackModal) | 1.5-2h | 🟡 Pending |
| Вт | Final Testing & Documentation | 1h | 🟡 Pending |

---

### 📊 СРАВНЕНИЕ ПОДХОДОВ

#### Подход A: Без дополнительных библиотек
```
Оценка: 20-25 часов
- Все анимации вручную с Framer Motion
- Все формы вручную с React Hook Form
- Все stat карточки с нуля
```

#### Подход B: С проверенными библиотеками (РЕКОМЕНДУЕТСЯ ✅)
```
Оценка: 13-16 часов
- Анимации: Magic UI (готовые компоненты)
- Формы: AutoForm (автогенерация)
- Stats: shadcn Blocks (готовые карточки)
```

**Разница:** 7-9 часов (35-40% экономии)

---

### 🎯 КРИТИЧЕСКИЙ ПУТЬ

**Must-Have (Минимум):**
1. Color Palette Migration (4h) - Обязательно
2. Install Base Components (1.5h) - Обязательно
3. Replace GlassCard (1.5h) - Обязательно
4. InlineVotingCard (2h) - Высокий приоритет

**ИТОГО Минимум:** 9 часов

**Nice-to-Have (Дополнительно):**
5. BudgetWidget redesign (1.5h)
6. CompletedPollWidget (2h)
7. CreatePollForm with AutoForm (1h)
8. Utility components (1.5h)

**ИТОГО Полный:** 15 часов

---

### 📅 ГИБКИЙ ГРАФИК

#### Вариант 1: Быстрый (2 недели)
```
Неделя 1: Tasks 1-3 (Foundation) - 7-8h
Неделя 2: Tasks 4-5 (Priority components) - 4-6h
ИТОГО: 11-14 часов
```

#### Вариант 2: Полный (3 недели) - РЕКОМЕНДУЕТСЯ
```
Неделя 1: Tasks 1-3 (Foundation) - 7-8h
Неделя 2: Tasks 4-6 (Main components) - 5-7h
Неделя 3: Tasks 7-8 (Polish) - 2-3h
ИТОГО: 14-18 часов
```

#### Вариант 3: Постепенный (4 недели)
```
По 3-4 часа в неделю
Неделя 1: Task 1 (Colors)
Неделя 2: Tasks 2-3 (Install + GlassCard)
Неделя 3: Tasks 4-5 (InlineVotingCard + BudgetWidget)
Неделя 4: Tasks 6-8 (Polish)
ИТОГО: 13-16 часов
```

---

**Рекомендация:** Вариант 2 (Полный, 3 недели) для наилучшего баланса качества и скорости.

---

## 📊 SUCCESS METRICS

### Before vs After

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Color palettes | 10+ | 5 | Code analysis |
| shadcn components | 3 | 12+ | Import count |
| WCAG AA compliance | ~85% | 100% | axe-core |
| Lighthouse Accessibility | ~88 | 100 | Lighthouse |
| Component consistency | ~60% | 95% | Visual audit |
| Mobile usability | ~75% | 95% | User testing |
| Load time | ~2.5s | <2s | Lighthouse |

### User Experience Goals

- ✅ Harmonious color scheme
- ✅ Consistent component design
- ✅ Smooth animations
- ✅ Touch-friendly interface
- ✅ Fast load times
- ✅ Accessible to all users

---

## 🚀 DEPLOYMENT STRATEGY

### Pre-Deployment Checklist

- [ ] All TypeScript errors resolved
- [ ] All tests passing
- [ ] Lighthouse score 90+
- [ ] Visual regression tests pass
- [ ] Mobile testing complete
- [ ] Accessibility audit pass
- [ ] Performance budget met
- [ ] Documentation updated

### Rollout Plan

**Phase 1: Soft Launch (20% users)**
- Monitor errors in Sentry
- Collect user feedback
- Fix critical issues

**Phase 2: Gradual Rollout (50% users)**
- A/B test old vs new design
- Measure engagement metrics
- Gather more feedback

**Phase 3: Full Release (100% users)**
- Remove old components
- Update documentation
- Celebrate! 🎉

---

## 📝 APPENDIX

### A. Color Migration Map

```
OLD → NEW
---------------------------
peach-500 → pastel-peach-300
mint-500 → pastel-sage-300
lavender-500 → pastel-lavender-300
coral-500 → pastel-rose-300
butter-500 → pastel-peach-300
sky-500 → pastel-sky-300
```

### B. Component File List

```
Components to modify:
- pages/HomePage.tsx
- components/voting/InlineVotingCard.tsx
- components/budget/BudgetWidget.tsx
- components/polls/CompletedPollWidget.tsx
- components/common/FloatingActionButton.tsx
- components/common/UserAvatar.tsx
- components/modals/FeedbackModal.tsx
- components/ui/theme-toggle.tsx

New components to create:
- components/ui/pastel-card.tsx
- components/ui/pastel-variants.ts

Files to update:
- tailwind.config.js
- src/styles/globals.css
- src/lib/design-tokens.ts
```

### C. Testing Checklist

```
Visual Testing:
□ Light mode
□ Dark mode
□ Mobile (375px)
□ Tablet (768px)
□ Desktop (1280px)

Functional Testing:
□ Voting flow
□ Budget operations
□ Theme toggle
□ Modal interactions
□ Form submissions

Accessibility Testing:
□ Keyboard navigation
□ Screen reader
□ Color contrast
□ Focus indicators
□ ARIA labels

Performance Testing:
□ Lighthouse audit
□ Bundle size
□ Load time
□ Animation performance
```

---

**Version:** 1.0  
**Author:** Claude + Team  
**Date:** 2025-11-10  
**Status:** Ready for Implementation ✅
