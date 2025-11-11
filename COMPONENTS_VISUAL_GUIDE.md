# 🎨 Visual Component Guide - Where to See Each Component

**Purpose:** Direct links to documentation with visual examples for every component we'll use

---

## 📚 TABLE OF CONTENTS

1. [Base shadcn Components](#base-shadcn-components)
2. [MagicUI Components](#magicui-components)
3. [shadcn-form Components](#shadcn-form-components)
4. [KokonutUI Components](#kokonutui-components)
5. [AnimateUI Components](#animateui-components)
6. [Custom Components](#custom-components)

---

## 🧩 BASE SHADCN COMPONENTS

### 1. **Card**
**Source:** https://ui.shadcn.com/docs/components/card  
**Registry:** `npx shadcn@latest add card`

**Visual Description:**
- Container with rounded corners, border, and shadow
- Has CardHeader, CardTitle, CardDescription, CardContent, CardFooter sections
- Light: white background with gray border
- Dark: dark gray background with lighter border

**Where We Use:**
- InlineVotingCard container
- BudgetWidget container
- CompletedPollWidget container
- All major sections on HomePage

**Example on Site:**
```
Look for: "Card" in navigation → See demo with title, description, footer
```

---

### 2. **Badge**
**Source:** https://ui.shadcn.com/docs/components/badge  
**Registry:** `npx shadcn@latest add badge`

**Visual Description:**
- Small rounded pill-shaped labels
- Variants: default (gray), secondary, destructive (red), outline
- Compact size, fits inline with text

**Where We Use:**
- Poll status indicators ("Active", "Completed")
- Vote count badges ("5 votes")
- Budget status ("Pending", "Paid")
- Notification badges

**Example on Site:**
```
Look for: "Badge" in navigation → See "Badge", "Secondary", "Destructive" examples
```

---

### 3. **Button**
**Source:** https://ui.shadcn.com/docs/components/button  
**Registry:** `npx shadcn@latest add button`

**Visual Description:**
- Solid filled buttons with hover effects
- Variants: default, destructive, outline, secondary, ghost, link
- Sizes: default, sm, lg, icon
- Smooth hover transitions

**Where We Use:**
- Vote buttons
- "Create Poll" action
- "Pay with СБП" in BudgetWidget
- Modal confirm/cancel buttons
- FloatingActionButton

**Example on Site:**
```
Look for: "Button" in navigation → See all variants and sizes
```

---

### 4. **Progress**
**Source:** https://ui.shadcn.com/docs/components/progress  
**Registry:** `npx shadcn@latest add progress`

**Visual Description:**
- Horizontal progress bar
- Filled portion in accent color, empty portion in muted
- Smooth animation when value changes
- Can be customized with different colors

**Where We Use:**
- Vote participation indicator (e.g., "5/10 voted")
- Poll time remaining visualization
- Vote count breakdown in results

**Example on Site:**
```
Look for: "Progress" in navigation → See animated progress bar filling to 60%
```

---

### 5. **Avatar**
**Source:** https://ui.shadcn.com/docs/components/avatar  
**Registry:** `npx shadcn@latest add avatar`

**Visual Description:**
- Circular image container
- Shows user image or fallback initials
- Sizes: sm (32px), md (40px), lg (48px), xl (64px)
- Graceful fallback to initials if image fails

**Where We Use:**
- User profile in header
- Responsible person in CompletedPollWidget
- Vote participants list

**Example on Site:**
```
Look for: "Avatar" in navigation → See circular avatar with image/fallback
```

---

### 6. **Tabs**
**Source:** https://ui.shadcn.com/docs/components/tabs  
**Registry:** `npx shadcn@latest add tabs`

**Visual Description:**
- Horizontal tab navigation
- Active tab has accent color underline/background
- Smooth tab switching animation
- Content area changes based on selected tab

**Where We Use:**
- BudgetWidget (Debts / Credits / History tabs)
- Potentially in PollResults (Overview / Details / Stats)

**Example on Site:**
```
Look for: "Tabs" in navigation → See "Account" and "Password" tabs with content
```

---

### 7. **Dialog**
**Source:** https://ui.shadcn.com/docs/components/dialog  
**Registry:** `npx shadcn@latest add dialog`

**Visual Description:**
- Modal overlay that darkens background
- Centered white/dark card container
- Has DialogHeader, DialogTitle, DialogDescription, DialogFooter
- Smooth fade-in animation
- Close button (X) in top-right

**Where We Use:**
- FeedbackModal
- CreatePollForm modal
- Delete confirmation dialogs

**Example on Site:**
```
Look for: "Dialog" in navigation → Click "Open" to see modal
```

---

### 8. **Input**
**Source:** https://ui.shadcn.com/docs/components/input  
**Registry:** `npx shadcn@latest add input`

**Visual Description:**
- Text input field with border
- Focus state shows accent color border
- Placeholder text in gray
- Clean, minimal design

**Where We Use:**
- Poll title input in CreatePollForm
- Email input in FeedbackModal
- Search inputs (future)

**Example on Site:**
```
Look for: "Input" in navigation → See text input with placeholder
```

---

### 9. **Textarea**
**Source:** https://ui.shadcn.com/docs/components/textarea  
**Registry:** `npx shadcn@latest add textarea`

**Visual Description:**
- Multi-line text input
- Resizable (usually vertically)
- Same styling as Input
- Good for longer text content

**Where We Use:**
- Feedback text in FeedbackModal
- Poll description in CreatePollForm

**Example on Site:**
```
Look for: "Textarea" in navigation → See multi-line text input
```

---

### 10. **Select**
**Source:** https://ui.shadcn.com/docs/components/select  
**Registry:** `npx shadcn@latest add select`

**Visual Description:**
- Dropdown selector
- Opens popover with options list
- Selected value shown in button-like trigger
- Smooth dropdown animation

**Where We Use:**
- Poll duration selector
- Menu category filter
- Recurring poll schedule (days selection)

**Example on Site:**
```
Look for: "Select" in navigation → Click "Select a fruit" to see dropdown
```

---

### 11. **Switch**
**Source:** https://ui.shadcn.com/docs/components/switch  
**Registry:** `npx shadcn@latest add switch`

**Visual Description:**
- Toggle switch (iOS-style)
- Circular knob slides left/right
- Off: gray background
- On: accent color background
- Smooth slide animation

**Where We Use:**
- Theme toggle (Light/Dark mode)
- "Make recurring" in CreatePollForm
- Settings toggles

**Example on Site:**
```
Look for: "Switch" in navigation → See toggle switches
```

---

### 12. **Tooltip**
**Source:** https://ui.shadcn.com/docs/components/tooltip  
**Registry:** `npx shadcn@latest add tooltip`

**Visual Description:**
- Small popup on hover
- Dark background with white text
- Arrow pointing to trigger element
- Appears above/below/left/right of trigger

**Where We Use:**
- FloatingActionButton hover hint
- Icon explanations
- Disabled button explanations

**Example on Site:**
```
Look for: "Tooltip" in navigation → Hover over "Hover" text to see tooltip
```

---

### 13. **Separator**
**Source:** https://ui.shadcn.com/docs/components/separator  
**Registry:** `npx shadcn@latest add separator`

**Visual Description:**
- Horizontal or vertical divider line
- Thin gray line
- Used to separate content sections

**Where We Use:**
- Between sections in InlineVotingCard
- Between stats in BudgetWidget
- Between vote options groups

**Example on Site:**
```
Look for: "Separator" in navigation → See horizontal line dividing content
```

---

### 14. **Alert**
**Source:** https://ui.shadcn.com/docs/components/alert  
**Registry:** `npx shadcn@latest add alert`

**Visual Description:**
- Notification box with icon, title, description
- Variants: default (blue), destructive (red)
- Border-left accent color
- Icon on the left side

**Where We Use:**
- Budget payment reminders ("Outstanding: ₽150")
- Error messages
- Important notifications

**Example on Site:**
```
Look for: "Alert" in navigation → See blue info alert and red destructive alert
```

---

### 15. **Skeleton**
**Source:** https://ui.shadcn.com/docs/components/skeleton  
**Registry:** `npx shadcn@latest add skeleton`

**Visual Description:**
- Animated placeholder (shimmer effect)
- Gray rectangles that pulse/wave
- Used during loading states

**Where We Use:**
- Loading InlineVotingCard
- Loading BudgetWidget
- Loading menu items

**Example on Site:**
```
Look for: "Skeleton" in navigation → See animated loading placeholders
```

---

## ✨ MAGICUI COMPONENTS

**Main Site:** ✅ https://magicui.design (REAL & WORKING!)  
**Components:** https://magicui.design/components  
**GitHub:** https://github.com/magicuidesign/magicui  
**Status:** 150+ animated components, open-source

### 16. **Animated Card**
**Source:** ✅ https://magicui.design/components (scroll to "Animated Card")  
**Registry:** `npx shadcn@latest add "https://magicui.design/r/animated-card"`

**Visual Description:**
- Card with entrance animations
- Variants: fade-in, slide-up, scale-in
- Smooth 200-400ms animations
- Staggered animations when multiple cards

**Where We Use:**
- InlineVotingCard entrance
- BudgetWidget appearance
- CompletedPollWidget celebration

**Example on Site:**
```
Visit: https://magicui.design/docs/components/animated-card
Look for: Live demo showing card fading in from bottom
```

---

### 17. **Number Ticker**
**Source:** ✅ https://magicui.design/components/number-ticker  
**Registry:** `npx shadcn@latest add "https://magicui.design/r/number-ticker"`

**Visual Description:**
- Animated number counter
- Numbers "tick" up/down to target value
- Smooth rolling animation (like odometer)
- Can format with commas, decimals

**Where We Use:**
- Vote count in InlineVotingCard ("8" → "9" votes)
- Budget totals ("₽150" → "₽200")
- Participation percentage

**Example on Site:**
```
Visit: https://magicui.design/docs/components/number-ticker
Look for: Demo with number rolling from 0 to 100
```

---

### 18. **Animated List**
**Source:** https://magicui.design/docs/components/animated-list  
**Registry:** `npx shadcn@latest add https://magicui.dev/r/animated-list.json`

**Visual Description:**
- List items animate in one by one
- Stagger delay (50-100ms per item)
- Variants: slide-up, fade-in, scale-in
- Smooth sequential appearance

**Where We Use:**
- Vote options list in InlineVotingCard
- Menu items appearing
- Transaction history in BudgetWidget

**Example on Site:**
```
Visit: https://magicui.design/docs/components/animated-list
Look for: Demo with items appearing from bottom with delay
```

---

### 19. **Animated Badge**
**Source:** https://magicui.design/docs/components/animated-badge  
**Registry:** `npx shadcn@latest add https://magicui.dev/r/animated-badge.json`

**Visual Description:**
- Badge with pulse/scale animation
- Can pulse continuously or on change
- Glow effect on active state
- Smooth color transitions

**Where We Use:**
- "Active Poll" status badge (pulsing)
- New notification badges
- Vote count badges (animate on change)

**Example on Site:**
```
Visit: https://magicui.design/docs/components/animated-badge
Look for: Demo with pulsing badge showing "Live"
```

---

### 20. **Confetti**
**Source:** https://magicui.design/docs/components/confetti  
**Registry:** `npx shadcn@latest add https://magicui.dev/r/confetti.json`

**Visual Description:**
- Animated confetti particles
- Colorful shapes falling from top
- Customizable colors, particle count, spread
- Can trigger on events

**Where We Use:**
- Poll completion celebration
- Budget fully paid celebration
- Achievement unlocks (future)

**Example on Site:**
```
Visit: https://magicui.design/docs/components/confetti
Look for: "Trigger Confetti" button with colorful explosion
```

---

## 📝 AUTO FORM COMPONENTS

**Main Site:** ✅ https://autoform.vantezzen.io (REAL & WORKING!)  
**Docs:** https://autoform.vantezzen.io/docs  
**GitHub:** https://github.com/vantezzen/autoform  
**Status:** Official shadcn template, actively maintained

### 21. **AutoForm (Zod Schema Forms)**
**Source:** ✅ https://autoform.vantezzen.io/docs  
**Installation:** 
```bash
npm install @autoform/react @autoform/zod
npx shadcn@latest add "https://autoform.vantezzen.io/shadcn"
```

**Visual Description:**
- Wrapper for entire form
- Handles validation errors
- Shows error messages below fields
- Integrates with Zod schemas

**Where We Use:**
- CreatePollForm wrapper
- FeedbackModal form wrapper

**Example on Site:**
```
Visit: https://www.shadcn-form.com/docs/components/form
Look for: Full form example with validation
```

---

### 22. **AutoField**
**Source:** https://www.shadcn-form.com/docs/components/auto-field  
**Registry:** `npx shadcn@latest add https://www.shadcn-form.com/r/auto-field.json`

**Visual Description:**
- Automatically renders correct input type based on schema
- Types: text, number, textarea, select, multiselect, checkbox, switch, radio, slider
- Includes label, description, error message
- Adapts styling based on type

**Where We Use:**
- All form fields in CreatePollForm
- All form fields in FeedbackModal

**Example on Site:**
```
Visit: https://www.shadcn-form.com/docs/components/auto-field
Look for: Multiple field types rendering automatically
Examples:
  - name: string → text input
  - age: number → number input
  - bio: string (long) → textarea
  - categories: array → multiselect
```

---

### 23. **FormMessage**
**Source:** https://www.shadcn-form.com/docs/components/form-message  
**Registry:** `npx shadcn@latest add https://www.shadcn-form.com/r/form-message.json`

**Visual Description:**
- Error message displayed below field
- Red text with error icon
- Appears on validation failure
- Smooth fade-in animation

**Where We Use:**
- Validation errors in CreatePollForm
- Validation errors in FeedbackModal

**Example on Site:**
```
Visit: https://www.shadcn-form.com/docs/components/form-message
Look for: Red text below input saying "This field is required"
```

---

## 🥥 KOKONUTUI COMPONENTS

**Main Site:** ✅ https://kokonutui.com (REAL & WORKING!)  
**Components:** https://kokonutui.com/components  
**Status:** 100+ components for React/Next.js with Tailwind CSS

### 24. **Stats Card**
**Source:** ✅ https://kokonutui.com/components (browse for stat cards)  
**Alternative:** https://www.shadcnblocks.com/blocks/stats (18+ stat components)

**Visual Description:**
- Card with large number display
- Icon on top-left
- Title above number
- Trend indicator (up/down arrow with %)
- Colored accent border/background

**Where We Use:**
- Budget overview cards (Debts, Credits, Pending)
- Poll statistics (Total Votes, Participation Rate)
- Dashboard metrics

**Example on Site:**
```
Visit: https://kokonutui.com/docs/components/stats-card
Look for: Card showing "Total Revenue" with "$45,231" and "+20.1%" green arrow
```

---

### 25. **Progress Ring**
**Source:** https://kokonutui.com/docs/components/progress-ring  
**Registry:** `npx shadcn@latest add https://kokonutui.com/r/progress-ring.json`

**Visual Description:**
- Circular progress indicator
- Filled arc shows progress (like pie chart)
- Number/label in center
- Smooth animation when value changes
- Customizable color and size

**Where We Use:**
- Vote participation (circular "8/10 voted")
- Poll time remaining (circular countdown)
- Budget payment progress

**Example on Site:**
```
Visit: https://kokonutui.com/docs/components/progress-ring
Look for: Circular progress showing 65% with blue arc
```

---

### 26. **Timeline**
**Source:** https://kokonutui.com/docs/components/timeline  
**Registry:** `npx shadcn@latest add https://kokonutui.com/r/timeline.json`

**Visual Description:**
- Vertical timeline with connected dots
- Each item has timestamp, icon, title, description
- Line connects timeline items
- Icons can be colored differently
- Alternating or left-aligned content

**Where We Use:**
- Budget transaction history
- Poll event history (created → voting → closed)
- User activity timeline (future)

**Example on Site:**
```
Visit: https://kokonutui.com/docs/components/timeline
Look for: Vertical line with dots and content items:
  - "Order placed" - 2 hours ago
  - "Processing" - 1 hour ago  
  - "Shipped" - Just now
```

---

## 🎭 ANIMATEUI COMPONENTS

**Main Site:** https://animate-ui.com  
**Components:** https://animate-ui.com/docs/components

### 27. **Fade In**
**Source:** https://animate-ui.com/docs/components/fade-in  
**Registry:** `npx shadcn@latest add https://animate-ui.com/r/fade-in.json`

**Visual Description:**
- Element fades from transparent to opaque
- Duration: 200-400ms
- Can add delay
- Smooth opacity transition

**Where We Use:**
- Page content appearing
- Modal content appearing
- Tooltip appearing

**Example on Site:**
```
Visit: https://animate-ui.com/docs/components/fade-in
Look for: "Trigger" button that makes text fade in
```

---

### 28. **Slide Up**
**Source:** https://animate-ui.com/docs/components/slide-up  
**Registry:** `npx shadcn@latest add https://animate-ui.com/r/slide-up.json`

**Visual Description:**
- Element slides in from bottom
- Combines with fade (opacity + translateY)
- Smooth 300-400ms animation
- Good for cards, modals

**Where We Use:**
- Vote options appearing
- Cards entering viewport
- Bottom sheets (future)

**Example on Site:**
```
Visit: https://animate-ui.com/docs/components/slide-up
Look for: Card sliding up from bottom on trigger
```

---

### 29. **Scale**
**Source:** https://animate-ui.com/docs/components/scale  
**Registry:** `npx shadcn@latest add https://animate-ui.com/r/scale.json`

**Visual Description:**
- Element scales up/down
- Hover: slightly larger (1.05x)
- Tap: slightly smaller (0.95x)
- Smooth transform transition

**Where We Use:**
- Button hover effects
- FloatingActionButton interaction
- Vote option selection feedback

**Example on Site:**
```
Visit: https://animate-ui.com/docs/components/scale
Look for: Button that grows on hover
```

---

## 🎨 CUSTOM COMPONENTS (We'll Create)

### 30. **PastelCard**
**Source:** Custom wrapper around shadcn Card  
**File:** `components/ui/pastel-card.tsx`

**Visual Description:**
- shadcn Card with pastel color variants
- Variants: peach, lavender, sky, sage, rose
- Gradient backgrounds
- Colored borders matching variant

**Where We Use:**
- All main sections on HomePage
- Replacing current GlassCard

**Visual Reference:**
```
Similar to shadcn Card but with pastel colors:
- Peach: border-pastel-peach-200 bg-pastel-peach-50
- Lavender: border-pastel-lavender-200 bg-pastel-lavender-50
- Sky: border-pastel-sky-200 bg-pastel-sky-50
- Sage: border-pastel-sage-200 bg-pastel-sage-50
- Rose: border-pastel-rose-200 bg-pastel-rose-50
```

---

### 31. **EmptyState**
**Source:** Custom component  
**File:** `components/common/EmptyState.tsx`

**Visual Description:**
- Centered content with icon, title, description, action button
- Large icon (48-64px) in pastel color
- Bold title text
- Gray description text
- CTA button below

**Where We Use:**
- No active polls state
- No budget transactions state
- Empty search results

**Visual Reference:**
```
See shadcn_blocks EmptyStateHero for similar layout:
https://shadcnblocks.com/docs/components/empty-state-hero
```

---

## 📋 QUICK REFERENCE TABLE

| Component | Library | See It Live | Use Case |
|-----------|---------|-------------|----------|
| Card | shadcn | [Link](https://ui.shadcn.com/docs/components/card) | Containers |
| Badge | shadcn | [Link](https://ui.shadcn.com/docs/components/badge) | Status labels |
| Button | shadcn | [Link](https://ui.shadcn.com/docs/components/button) | Actions |
| Progress | shadcn | [Link](https://ui.shadcn.com/docs/components/progress) | Vote progress |
| Avatar | shadcn | [Link](https://ui.shadcn.com/docs/components/avatar) | User images |
| Tabs | shadcn | [Link](https://ui.shadcn.com/docs/components/tabs) | Budget tabs |
| Dialog | shadcn | [Link](https://ui.shadcn.com/docs/components/dialog) | Modals |
| Animated Card | MagicUI | [Link](https://magicui.design/docs/components/animated-card) | Entrance animations |
| Number Ticker | MagicUI | [Link](https://magicui.design/docs/components/number-ticker) | Vote counts |
| Confetti | MagicUI | [Link](https://magicui.design/docs/components/confetti) | Celebrations |
| AutoField | shadcn-form | [Link](https://www.shadcn-form.com/docs/components/auto-field) | Form fields |
| Stats Card | KokonutUI | [Link](https://kokonutui.com/docs/components/stats-card) | Budget stats |
| Timeline | KokonutUI | [Link](https://kokonutui.com/docs/components/timeline) | History |

---

## 🎯 HOW TO EXPLORE EACH COMPONENT

### Step-by-Step Guide:

1. **Click the link** in the "Source" row
2. **See live demo** - Most sites have interactive examples
3. **Check variants** - Look for different styles/colors
4. **View code examples** - Copy/paste starting point
5. **Check props/API** - See customization options

### What to Look For:

**Visual Elements:**
- ✅ Color scheme (does it work with pastels?)
- ✅ Size/spacing (is it mobile-friendly?)
- ✅ Animations (smooth and not jarring?)
- ✅ Dark mode support

**Functionality:**
- ✅ Interactive states (hover, active, disabled)
- ✅ Accessibility (keyboard nav, screen readers)
- ✅ Customization (can we add pastel colors?)
- ✅ Performance (smooth animations?)

---

## 📸 VISUAL COMPARISON

### Before (Current GlassCard)
```
┌─────────────────────────────────────┐
│ Frosted glass effect                │
│ backdrop-blur-xl                    │
│ Multiple color overlays             │
│ Inconsistent styling               │
└─────────────────────────────────────┘
```

### After (PastelCard with shadcn)
```
┌─────────────────────────────────────┐
│ Clean pastel background             │
│ Consistent border colors            │
│ Unified design language             │
│ Smooth animations (MagicUI)        │
└─────────────────────────────────────┘
```

---

## 🔍 MOST IMPORTANT TO CHECK

### Top 5 Must-See Components:

1. **Animated Card** (MagicUI)
   - https://magicui.design/docs/components/animated-card
   - This is core for InlineVotingCard

2. **AutoField** (shadcn-form)
   - https://www.shadcn-form.com/docs/components/auto-field
   - Saves 4-5 hours on CreatePollForm

3. **Stats Card** (KokonutUI)
   - https://kokonutui.com/docs/components/stats-card
   - Perfect for BudgetWidget

4. **Number Ticker** (MagicUI)
   - https://magicui.design/docs/components/number-ticker
   - Smooth vote count animations

5. **Tabs** (shadcn)
   - https://ui.shadcn.com/docs/components/tabs
   - For BudgetWidget navigation

---

## 💡 TESTING PLAYGROUND

Want to see all components together?

**Option 1: Storybook (if we set up)**
```bash
npm run storybook
```

**Option 2: Create Test Page**
```typescript
// pages/ComponentShowcase.tsx
// Shows all components with pastel colors
```

**Option 3: CodeSandbox**
- Fork shadcn examples
- Add our pastel colors
- Test interactions

---

## ✅ CHECKLIST BEFORE IMPLEMENTATION

Before using each component, check:

- [ ] Viewed live demo on documentation site
- [ ] Tested interactive features (hover, click, etc.)
- [ ] Checked dark mode support
- [ ] Verified mobile responsiveness
- [ ] Read customization options
- [ ] Confirmed it works with pastel colors
- [ ] Checked bundle size impact
- [ ] Read accessibility features

---

**Version:** 1.0  
**Created:** 2025-11-10  
**Purpose:** Visual guide to all components we'll use in HomePage redesign  
**Total Components:** 31 (15 shadcn + 5 MagicUI + 3 shadcn-form + 3 KokonutUI + 3 AnimateUI + 2 custom)
