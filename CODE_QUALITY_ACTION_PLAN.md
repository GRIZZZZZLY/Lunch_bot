# Code Quality Improvement - Action Plan

## Overview
This document provides concrete, executable steps to address findings from the code quality review.

---

## Phase 1: Critical Fixes (Week 1) 🚨

### Task 1.1: Fix Backend ESLint Configuration
**Priority:** P0  
**Effort:** 15 minutes  
**Owner:** Backend team

**Steps:**
```bash
cd telegram-food-bot/backend

# Verify current packages
npm list @typescript-eslint/eslint-plugin
npm list @typescript-eslint/parser

# If missing or broken, reinstall
npm uninstall @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install --save-dev @typescript-eslint/eslint-plugin@^6.12.0 @typescript-eslint/parser@^6.12.0

# Test configuration
npm run lint

# Expected: Should run without "config not found" error
```

**Validation:**
- ESLint runs without errors about missing config
- Can see actual linting warnings/errors from code

---

### Task 1.2: Add Frontend Prettier Configuration
**Priority:** P1  
**Effort:** 10 minutes  
**Owner:** Frontend team

**Steps:**

1. Create `telegram-food-bot/frontend/.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "trailingComma": "es5",
  "jsxSingleQuote": false,
  "arrowParens": "avoid",
  "endOfLine": "lf",
  "bracketSpacing": true,
  "bracketSameLine": false
}
```

2. Format entire codebase:
```bash
cd telegram-food-bot/frontend
npm run format
```

3. Commit formatting changes as separate commit:
```bash
git add .
git commit -m "chore: apply prettier formatting"
```

**Validation:**
- All files follow consistent style
- `npm run format` shows "no changes"

---

### Task 1.3: Fix Backend Type Annotations in error.ts
**Priority:** P1  
**Effort:** 30 minutes  
**Owner:** Backend team

**Steps:**

1. Open `telegram-food-bot/backend/src/utils/error.ts`

2. Replace lines 193, 228, 237-241:

**Before:**
```typescript
export function formatErrorForLogging(error: Error, context?: any) { ... }

export function setupErrorHandlers(): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => { ... });
}

export function errorHandler(
  err: Error,
  req: any,
  res: any,
  next: any
): void { ... }
```

**After:**
```typescript
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

export function formatErrorForLogging(
  error: Error, 
  context?: Record<string, unknown>
) { ... }

export function setupErrorHandlers(): void {
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => { ... });
}

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => { ... }
```

**Validation:**
- TypeScript compilation succeeds
- ESLint shows fewer `any` warnings

---

### Task 1.4: Remove Technical Debt Files
**Priority:** P1  
**Effort:** 2 hours  
**Owner:** Both teams

**Backend:**

1. Review `telegram-food-bot/backend/src/services/notification.template.fix.ts`
   - If fix is needed: Apply changes to `notification.service.ts`
   - If obsolete: Delete file
   - Document decision in PR

**Frontend:**

2. Review `telegram-food-bot/frontend/src/components/menu/MenuForm.old.tsx`
   - Check git history: When was it replaced?
   - Verify `MenuForm.tsx` has all functionality
   - Delete if confirmed obsolete
   - If needed for reference: Move to `/docs/archive/`

**Steps:**
```bash
# After review, if obsolete:
git rm telegram-food-bot/backend/src/services/notification.template.fix.ts
git rm telegram-food-bot/frontend/src/components/menu/MenuForm.old.tsx
git commit -m "chore: remove obsolete backup files"
```

**Validation:**
- No `.old.*` or `.fix.*` files in `/src` directories
- All tests still pass

---

## Phase 2: Frontend Type Safety (Week 2-4) ⚠️

### Task 2.1: Enable TypeScript noUnusedLocals and noUnusedParameters
**Priority:** P1  
**Effort:** 4 hours  
**Owner:** Frontend team

**Steps:**

1. Edit `telegram-food-bot/frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": false,  // Keep false for now
    "noUnusedLocals": true,    // Enable ✅
    "noUnusedParameters": true  // Enable ✅
  }
}
```

2. Run type check to find violations:
```bash
npm run type-check 2>&1 | tee unused-vars.log
```

3. Fix violations:
   - Remove unused imports
   - Prefix unused parameters with `_` (e.g., `_event`)
   - Remove unused variables

4. Commit fixes:
```bash
git add .
git commit -m "fix: enable noUnusedLocals and noUnusedParameters"
```

**Validation:**
- `npm run type-check` passes without errors
- No unused variables remain

---

### Task 2.2: Plan Strict Mode Migration
**Priority:** P1  
**Effort:** Planning 4 hours, Execution 2-4 weeks  
**Owner:** Frontend tech lead

**Steps:**

1. Create migration document:

```markdown
# Frontend Strict TypeScript Migration Plan

## Phase 1: Enable strictNullChecks (Week 1)
- Files affected: ~50 (estimate from grep analysis)
- Strategy: Fix components bottom-up (leaves first)
- PR strategy: One PR per page/feature

## Phase 2: Fix Explicit Any (Week 2)
- 16 files with explicit `any` types
- Replace with proper types:
  - Event handlers → React.FormEvent, React.MouseEvent
  - API responses → Define interfaces
  - Chart data → Use library types

## Phase 3: Enable All Strict Checks (Week 3-4)
- Enable: strictFunctionTypes, strictPropertyInitialization
- Fix violations
- Celebrate! 🎉

## Escape Hatches
- Can use `!` for non-null assertion temporarily
- Can use `as unknown as Type` for complex cases
- Must document all workarounds
```

2. Create tracking issue in GitHub:
   - Label: "tech-debt"
   - Milestone: "v2.1"
   - Assign to team

**Validation:**
- Migration plan approved by team
- Timeline agreed upon

---

### Task 2.3: Add Frontend Vitest Configuration
**Priority:** P0  
**Effort:** 2 hours  
**Owner:** Frontend team

**Steps:**

1. Create `telegram-food-bot/frontend/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      exclude: [
        '**/*.stories.tsx',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/__dev__/**'
      ],
      thresholds: {
        lines: 50,      // Start low
        functions: 50,
        branches: 50,
        statements: 50
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

2. Create `telegram-food-bot/frontend/src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Auto-cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Telegram WebApp
global.Telegram = {
  WebApp: {
    ready: vi.fn(),
    expand: vi.fn(),
    close: vi.fn(),
    initDataUnsafe: {
      user: {
        id: 12345,
        first_name: 'Test',
        username: 'testuser'
      }
    }
  }
} as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

3. Install testing dependencies:
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest @vitest/ui jsdom
```

4. Update `package.json` scripts (already present ✅):
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

**Validation:**
- `npm test` runs without errors
- Can run tests in watch mode

---

### Task 2.4: Write First 10 Frontend Tests
**Priority:** P0  
**Effort:** 1 week  
**Owner:** Frontend team (pair programming)

**Test Priority Order:**

1. **Smoke Tests (Day 1)**
   - `src/components/common/Button.test.tsx`
   - `src/components/common/Badge.test.tsx`
   - Just test: "renders without crashing"

2. **Critical Flow Tests (Day 2-3)**
   - `src/pages/VotingHubPage.test.tsx`
   - `src/components/voting/VoteRouter.test.tsx`
   - Test: User can see polls, click to vote

3. **Hook Tests (Day 4-5)**
   - `src/hooks/usePolls.test.ts`
   - `src/hooks/useVote.test.ts`
   - Mock API responses, test state changes

**Example Test Template:**
```typescript
// src/components/common/Button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await userEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

**Validation:**
- 10 test files created
- `npm test` shows all passing
- Coverage report generated

---

## Phase 3: Backend Improvements (Week 3-4) 📋

### Task 3.1: Fix 5 Failing Auth Tests
**Priority:** P1  
**Effort:** 2 days  
**Owner:** Backend team

**Steps:**

1. Run failing tests:
```bash
cd telegram-food-bot/backend
npm test -- auth.routes.test.ts
```

2. Analyze failures (likely causes):
   - JWT token expiration in test
   - Database state not reset between tests
   - Missing environment variables

3. Fix patterns:
```typescript
// If token expiration issue:
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2024-01-01'));
});

afterEach(() => {
  jest.useRealTimers();
});

// If database state issue:
beforeEach(async () => {
  await prisma.user.deleteMany({});
  await prisma.session.deleteMany({});
});
```

4. Document fixes in PR

**Validation:**
- All 202 tests pass
- 100% test pass rate achieved

---

### Task 3.2: Add Controller Tests
**Priority:** P2  
**Effort:** 1 week  
**Owner:** Backend team

**Target Files:**
- `poll.controller.test.ts`
- `vote.controller.test.ts`
- `menu.controller.test.ts`

**Example Structure:**
```typescript
describe('PollController', () => {
  describe('getActivePolls', () => {
    it('returns 200 with active polls', async () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();
      
      // Act
      await PollController.getActivePolls(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array)
      });
    });
  });
});
```

**Validation:**
- 15+ new controller tests added
- Coverage increases by 5-10%

---

### Task 3.3: Increase Coverage Threshold
**Priority:** P3  
**Effort:** Ongoing  
**Owner:** Backend team

**Steps:**

1. Edit `telegram-food-bot/backend/jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    branches: 75,    // Was 70
    functions: 75,   // Was 70
    lines: 75,       // Was 70
    statements: 75   // Was 70
  }
}
```

2. Run coverage:
```bash
npm run test:coverage
```

3. Fix files below threshold:
   - Focus on services and controllers
   - Add missing edge case tests

**Validation:**
- All files meet 75% threshold
- CI passes

---

## Phase 4: Long-term Improvements (Backlog) 💡

### Task 4.1: Add Circular Dependency Detection
**Priority:** P3  
**Effort:** 4 hours  
**Owner:** Tech lead

**Steps:**

1. Install madge:
```bash
npm install --global madge
```

2. Check backend:
```bash
cd telegram-food-bot/backend
madge --circular --extensions ts src/
```

3. Check frontend:
```bash
cd telegram-food-bot/frontend
madge --circular --extensions tsx,ts src/
```

4. If circles found:
   - Document in issue
   - Plan refactoring
   - Add to backlog

5. Add to CI pipeline:
```yaml
# .github/workflows/ci.yml
- name: Check for circular dependencies
  run: |
    npm install -g madge
    cd backend && madge --circular --extensions ts src/
    cd ../frontend && madge --circular --extensions tsx,ts src/
```

**Validation:**
- No circular dependencies reported
- CI job added

---

### Task 4.2: Standardize Storybook Organization
**Priority:** P3  
**Effort:** 2 hours  
**Owner:** Frontend team

**Steps:**

1. Move all story files next to components:
```bash
# Move from src/stories/ to src/components/
mv src/stories/Button.stories.ts src/components/common/Button.stories.tsx
mv src/stories/Header.stories.ts src/components/layout/Header.stories.tsx
mv src/stories/Page.stories.ts src/pages/Page.stories.tsx
```

2. Delete `src/stories/` folder:
```bash
rm -rf src/stories/
```

3. Update imports in story files

**Validation:**
- `npm run storybook` runs successfully
- All stories visible in Storybook UI

---

### Task 4.3: Add Frontend Complexity Rules
**Priority:** P3  
**Effort:** 1 hour  
**Owner:** Frontend team

**Steps:**

1. Edit `telegram-food-bot/frontend/.eslintrc.cjs`:
```javascript
module.exports = {
  // ... existing config
  rules: {
    // ... existing rules
    'complexity': ['warn', 15],  // Cyclomatic complexity limit
    'max-depth': ['warn', 4],    // Nesting depth
    'max-lines-per-function': ['warn', 150],  // Function length
    'max-nested-callbacks': ['warn', 3]
  }
};
```

2. Run lint:
```bash
npm run lint
```

3. Fix violations or suppress with comments:
```typescript
// eslint-disable-next-line complexity
function complexFunction() { ... }
```

**Validation:**
- ESLint runs without errors
- Team agrees on thresholds

---

## Implementation Timeline

```
Week 1: Critical Fixes
├─ Day 1: Fix ESLint + Prettier config
├─ Day 2: Fix error.ts types
├─ Day 3: Remove tech debt files
└─ Day 4-5: Setup Vitest + Write first tests

Week 2: Frontend Type Safety Part 1
├─ Day 1: Enable noUnusedLocals/Parameters
├─ Day 2-3: Fix unused variables
└─ Day 4-5: Plan strict mode migration

Week 3: Frontend Type Safety Part 2
├─ Day 1-2: Enable strictNullChecks
├─ Day 3-4: Fix null safety violations
└─ Day 5: Write more tests (10 → 25 tests)

Week 4: Backend Improvements
├─ Day 1-2: Fix 5 failing auth tests
├─ Day 3-4: Add controller tests
└─ Day 5: Increase coverage threshold

Week 5+: Backlog Items
└─ Address P3 tasks as capacity allows
```

---

## Success Metrics

### Phase 1 Completion:
- ✅ ESLint runs without config errors
- ✅ Prettier config exists in both apps
- ✅ 0 `.old` or `.fix` files in `/src`
- ✅ 10+ frontend tests passing

### Phase 2 Completion:
- ✅ Frontend `noUnusedLocals` enabled
- ✅ Strict mode migration plan documented
- ✅ 25+ frontend tests passing
- ✅ Frontend coverage >30%

### Phase 3 Completion:
- ✅ 202/202 backend tests passing (100%)
- ✅ Backend coverage >75%
- ✅ All controllers have tests

### Phase 4 Completion:
- ✅ No circular dependencies
- ✅ All stories next to components
- ✅ Frontend complexity rules enforced

---

## Risk Mitigation

### Risk 1: Strict Mode Migration Breaks Production
**Mitigation:**
- Use feature flag for strict mode changes
- Deploy to staging first
- Test extensively before production
- Can revert via git

### Risk 2: Test Writing Takes Longer Than Expected
**Mitigation:**
- Start with smoke tests (easy wins)
- Pair programming for complex tests
- Use AI tools for test generation
- Don't block other work

### Risk 3: Team Resistance to Change
**Mitigation:**
- Show benefits: fewer bugs, easier refactoring
- Start with least controversial changes
- Provide training on testing
- Lead by example

---

## Resources

### Documentation:
- TypeScript Strict Mode: https://www.typescriptlang.org/tsconfig#strict
- React Testing Library: https://testing-library.com/react
- Vitest: https://vitest.dev

### Tools:
- madge (circular deps): https://github.com/pahen/madge
- ESLint: https://eslint.org
- Prettier: https://prettier.io

### Internal:
- CODE_QUALITY_REVIEW_REPORT.md (detailed analysis)
- TESTING_INSTRUCTIONS.md (existing test guide)
- Session summaries (historical context)

---

**Action Plan Created:** 2025-01-XX  
**Last Updated:** 2025-01-XX  
**Next Review:** After Phase 1 completion
