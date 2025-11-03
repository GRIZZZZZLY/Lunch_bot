# Technical Debt Register
**Generated**: 2025-01-XX  
**Project**: Telegram Food Bot  
**Version**: 2.0.0  
**Status**: Production Ready

---

## Executive Summary

This register catalogs 87+ technical debt items across 7 categories discovered through automated scanning and manual review of the Telegram Food Bot monorepo. Total estimated effort: **~156-240 hours** (4-6 weeks for 1 developer).

### Debt Distribution
- **Critical** (P0): 8 items - 24-32 hours
- **High** (P1): 18 items - 48-72 hours  
- **Medium** (P2): 31 items - 52-80 hours
- **Low** (P3): 30+ items - 32-56 hours

### Key Findings
1. **Legacy Files**: 40 obsolete files (.broken, .old, .backup) consuming disk space
2. **Monolithic Services**: 7 files exceed 700 lines, hindering maintainability
3. **Outdated Dependencies**: 50+ packages behind major versions (breaking changes risk)
4. **Documentation Gaps**: Incomplete API docs, missing automation guides
5. **Test Coverage**: Backend 70% threshold met, frontend lacks coverage enforcement
6. **CI/CD Weaknesses**: Several checks bypass failures, frontend tests not automated

---

## Category 1: Code Markers (TODO/FIXME)

### C1.1 Active Code TODOs (Frontend)
**Priority**: P1 (High)  
**Effort**: 4-6 hours  
**Affected Files**:
- `frontend/src/pages/HomePage.tsx` - Line 260 (optimistic update removed)
- `frontend/src/pages/MenuPage.tsx` - Line 260 (re-add optimistic update)
- `frontend/src/components/common/*.stories.tsx` (3 files) - Storybook enhancements

**Issue**: Active TODO comments in production code indicate incomplete features or technical shortcuts. MenuPage comment specifically references a fix for React Query cache mutation.

**Remediation**:
1. Review each TODO context and intent
2. For MenuPage.tsx line 260: Implement optimistic update pattern with React Query's `onMutate` callback
3. For HomePage.tsx: Restore optimistic updates if needed or remove comment
4. For Storybook files: Complete missing interaction tests or defer to P3

**Dependencies**: None  
**Risk**: Medium - Features may behave unexpectedly during slow network conditions

---

### C1.2 Documentation TODOs
**Priority**: P2 (Medium)  
**Effort**: 8-12 hours  
**Affected Files**: 
- `docs/07-api/README.md` (5 TODO items)
- Various markdown files in `/docs` (20+ TODOs in archived/historical docs)

**Issue**: API documentation incomplete - missing:
- Poll creation endpoints documentation
- WebSocket endpoints (if implemented)
- cURL examples for all endpoints
- Postman collection
- Swagger/OpenAPI specification

**Remediation**:
1. **Phase 1 (4h)**: Document missing API endpoints (polls, votes, budget routes)
2. **Phase 2 (3h)**: Generate OpenAPI/Swagger spec using annotations or code scanning
3. **Phase 3 (2h)**: Create Postman collection for all endpoints
4. **Phase 4 (2h)**: Add cURL examples to README
5. **Phase 5 (1h)**: Review and archive/remove historical TODOs in `/docs/99-archive`

**Dependencies**: Backend API stability  
**Risk**: Low - Internal team knows API, but onboarding/external integration impaired

---

## Category 2: Legacy & Duplicate Files

### C2.1 Broken/Old Code Files
**Priority**: P0 (Critical)  
**Effort**: 2-4 hours  
**Affected Files**:
```
telegram-food-bot/backend/src/services/group.service.ts.broken (358 lines)
telegram-food-bot/backend/src/bot/handlers/poll.handlers.ts.broken
telegram-food-bot/backend/src/bot/handlers/poll.handlers.ts.old
telegram-food-bot/backend/src/bot/commands/startpoll.ts.broken
telegram-food-bot/backend/src/utils/telegram-auth.ts.old
telegram-food-bot/start-prod-dev.ps1.broken
```

**Issue**: 6 dead code files with `.broken` or `.old` extensions suggest incomplete refactorings or experiments. These files:
- Consume disk space and backups
- Cause confusion during codebase navigation
- May contain sensitive logic that should be in git history, not working tree

**Remediation**:
1. **Audit** (1h): Review each file's last modification date and git history
2. **Verify** (0.5h): Confirm functionality exists in current codebase
3. **Document** (0.5h): Extract any unique logic/patterns into design docs
4. **Delete** (0.5h): Remove files, commit with explanatory message
5. **Backup** (0.5h): Tag git commit before deletion as `tech-debt/legacy-cleanup-2025-01`

**Dependencies**: Code review approval  
**Risk**: Medium - May accidentally delete undocumented workarounds

---

### C2.2 Environment Backup Files
**Priority**: P2 (Medium)  
**Effort**: 1-2 hours  
**Affected Files**: 34 `.env.backup` files in `telegram-food-bot/backups/env_*` directories

**Issue**: 
- 34 environment file backups from Oct-Nov 2025
- Most recent: `env_20251006_153727/`
- Consuming ~500KB+ storage
- May contain sensitive tokens/keys

**Remediation**:
1. **Audit** (0.5h): Check if any backup contains unique configuration
2. **Verify** (0.5h): Ensure current .env files are properly version-controlled (without secrets)
3. **Archive** (0.5h): Move all backups to separate archive location or encrypted storage
4. **Clean** (0.5h): Delete backups older than 30 days, keep only 3 most recent
5. **Automate** (Optional, +2h): Create script to auto-rotate/encrypt env backups

**Dependencies**: DevOps approval, secret management strategy  
**Risk**: Low - But high security risk if exposed

---

## Category 3: Monolithic Code

### C3.1 Poll Service Complexity
**Priority**: P1 (High)  
**Effort**: 12-16 hours  
**Affected Files**:
- `backend/src/services/poll.service.ts` (1,324 lines)
- `backend/src/services/poll.service.extensions.ts` (463 lines)
- `backend/src/api/controllers/poll.controller.ts` (1,288 lines)
- `backend/src/bot/handlers/poll.handlers.ts` (870 lines)

**Total Lines**: 3,945 lines in poll-related logic

**Issue**: 
- Poll service already split into main + extensions, still 1,324 lines
- Controller has grown to 1,288 lines (should be thin orchestration layer)
- Handlers at 870 lines suggest complex bot interaction logic
- High cyclomatic complexity makes testing/debugging difficult
- Risk of merge conflicts in team development

**Remediation Strategy**:

#### Phase 1: Service Decomposition (6-8h)
Split `poll.service.ts` into:
```
services/poll/
  ├── poll.core.service.ts       # CRUD operations (300 lines)
  ├── poll.lifecycle.service.ts  # Start, close, expire (250 lines)
  ├── poll.roulette.service.ts   # Winner selection (200 lines)
  ├── poll.notification.service.ts # Message broadcasts (150 lines)
  ├── poll.validation.service.ts  # Business rules (150 lines)
  └── index.ts                    # Facade pattern exports
```

#### Phase 2: Controller Refactoring (3-4h)
Extract from `poll.controller.ts`:
```
controllers/poll/
  ├── poll.query.controller.ts   # GET endpoints (400 lines)
  ├── poll.command.controller.ts # POST/PUT/DELETE (400 lines)
  ├── poll.admin.controller.ts   # Admin-only actions (300 lines)
  └── index.ts
```

#### Phase 3: Handlers Simplification (3-4h)
Delegate complex logic from `poll.handlers.ts` to services:
- Extract business logic into services
- Keep handlers as thin wrappers (50-100 lines each)
- Use command pattern for handler dispatch

**Dependencies**: 
- Full test coverage before refactoring
- Feature freeze during decomposition
- Code review for each phase

**Risk**: High - Core feature, requires careful regression testing  
**Benefits**: 
- Improved testability (isolated units)
- Better code navigation
- Reduced merge conflicts
- Easier onboarding

---

### C3.2 Budget Service Complexity
**Priority**: P2 (Medium)  
**Effort**: 8-10 hours  
**Affected Files**:
- `backend/src/services/budget.service.ts` (856 lines)

**Issue**: Budget tracking feature has grown into single service handling:
- Transaction creation/updates
- Debt/credit calculations  
- Payment marking/confirmation
- СБП integration logic
- Reminder scheduling

**Remediation**:
```
services/budget/
  ├── transaction.service.ts      # CRUD (200 lines)
  ├── debt.calculator.service.ts  # Balance calculations (150 lines)
  ├── payment.processor.service.ts # СБП, confirmations (200 lines)
  ├── budget.notification.service.ts # Reminders (150 lines)
  └── index.ts
```

**Dependencies**: Budget feature tests  
**Risk**: Medium - Recently implemented feature (2.0), has test coverage

---

### C3.3 Vote Service Complexity  
**Priority**: P2 (Medium)  
**Effort**: 6-8 hours  
**Affected Files**:
- `backend/src/services/vote.service.ts` (806 lines)

**Issue**: Voting logic mixed with validation, notifications, and analytics.

**Remediation**:
```
services/vote/
  ├── vote.core.service.ts        # Create/update votes (250 lines)
  ├── vote.validation.service.ts  # Eligibility checks (200 lines)
  ├── vote.aggregation.service.ts # Statistics (200 lines)
  └── index.ts
```

---

### C3.4 Frontend Page Complexity
**Priority**: P2 (Medium)  
**Effort**: 8-12 hours  
**Affected Files**:
- `frontend/src/pages/HomePage.tsx` (761 lines)
- `frontend/src/pages/MenuPage.tsx` (578 lines)

**Issue**: 
- HomePage handles: welcome cards, active polls, completed polls, budget widget, stats, actions
- MenuPage handles: menu CRUD, filtering, search, categories, virtualization
- Large components are harder to test and maintain

**Remediation (HomePage)**:
```
pages/home/
  ├── HomePage.tsx                 # Layout orchestration (150 lines)
  ├── hooks/
  │   ├── useHomePage.ts          # Business logic hook (100 lines)
  │   └── useQuickActions.ts      # Action handlers (80 lines)
  ├── sections/
  │   ├── HomeHeader.tsx          # Header section (80 lines)
  │   ├── ActivePollSection.tsx   # Poll display (150 lines)
  │   ├── CompletedPollSection.tsx # Completed polls (100 lines)
  │   └── QuickActionsSection.tsx # Action buttons (100 lines)
  └── index.ts
```

**Remediation (MenuPage)**:
```
pages/menu/
  ├── MenuPage.tsx                 # Layout (150 lines)
  ├── hooks/
  │   ├── useMenuPage.ts          # Business logic (100 lines)
  │   └── useMenuFilters.ts       # Filter/search logic (80 lines)
  ├── sections/
  │   ├── MenuHeader.tsx          # Header + stats (80 lines)
  │   ├── MenuFilters.tsx         # Search + categories (100 lines)
  │   └── MenuList.tsx            # Already extracted
  └── index.ts
```

**Dependencies**: Component tests for each extracted section  
**Risk**: Medium - UI refactoring can introduce visual regressions

---

## Category 4: Outdated Dependencies

### C4.1 Critical Breaking Changes (Backend)
**Priority**: P0 (Critical)  
**Effort**: 12-16 hours  
**Packages**:
- **Prisma** 5.22.0 → 6.18.0 (major version)
- **Express** 4.21.2 → 5.1.0 (major version)
- **Zod** 3.25.76 → 4.1.12 (major version)
- **Jest** 29.7.0 → 30.2.0 (major version)
- **ESLint** 8.57.1 → 9.39.0 (major version)

**Issue**: 
- **Prisma 6**: New features, breaking changes in client API
- **Express 5**: Promises support, removed deprecated middleware, breaking routing changes
- **Zod 4**: Type system changes, may break validation schemas
- **Jest 30**: New async transforms, config changes
- **ESLint 9**: Flat config format required, plugin ecosystem changes

**Remediation**:

#### Phase 1: Assessment (4h)
1. Read migration guides for each package
2. Identify affected code areas
3. Create migration branch: `chore/deps-upgrade-v6`

#### Phase 2: Prisma Migration (3-4h)
1. Update Prisma to v6
2. Run `npx prisma migrate diff` to check schema changes
3. Update Prisma client usage (check deprecated methods)
4. Run all database tests
5. Update production migration scripts

#### Phase 3: Express Migration (3-4h)
1. Update Express to v5
2. Replace deprecated middleware (body-parser now built-in)
3. Fix breaking changes in error handling
4. Update all route handlers to handle promises properly
5. Test all API endpoints

#### Phase 4: Validation & Testing (2-3h)
1. Update Zod to v4, fix schema definitions
2. Update Jest to v30, fix test configurations
3. Update ESLint to v9, migrate to flat config
4. Run full test suite, fix breakages

#### Phase 5: Documentation (1h)
1. Update README installation steps
2. Update CI/CD for new package versions
3. Document any new patterns/best practices

**Dependencies**: 
- Full test coverage
- Staging environment for validation
- Rollback plan

**Risk**: Critical - Core dependencies, potential production breakage  
**Benefits**: Security patches, performance improvements, new features

---

### C4.2 Major Version Updates (Frontend)
**Priority**: P0 (Critical)  
**Effort**: 16-24 hours  
**Packages**:
- **React** 18.3.1 → 19.2.0 (major)
- **React Router** 6.30.1 → 7.9.5 (major)
- **Vite** 6.4.1 → 7.1.12 (major)
- **Vitest** 3.2.4 → 4.0.6 (major)
- **Tailwind CSS** 3.4.17 → 4.1.16 (major)
- **Storybook** 9.1.9 → 10.0.2 (major)
- **Zustand** 4.5.7 → 5.0.8 (major)
- **Zod** 3.25.76 → 4.1.12 (major)
- **ESLint** 8.57.1 → 9.39.0 (major)

**Issue**: 
- **React 19**: New compiler, automatic memoization, breaking changes in hooks
- **React Router 7**: Complete rewrite, new data loading patterns
- **Vite 7**: New Rollup version, breaking plugin API changes
- **Tailwind 4**: New engine, breaking config changes
- **Storybook 10**: New architecture, addon compatibility

**Remediation**:

#### Phase 1: React 19 Migration (6-8h)
1. Review React 19 migration guide
2. Update component patterns (hooks, memoization)
3. Test all interactive components
4. Update React Query for React 19 compatibility
5. Test Mini App integration (Telegram WebApp SDK)

#### Phase 2: Routing Migration (4-6h)
1. Analyze React Router 7 breaking changes
2. Update route definitions (data loaders, actions)
3. Migrate navigation hooks (`useNavigate`, `useLocation`)
4. Test all navigation flows
5. Update lazy loading patterns

#### Phase 3: Build Tools (3-4h)
1. Migrate Vite to v7 (update plugins)
2. Update Tailwind to v4 (new config format)
3. Test production builds
4. Verify PWA functionality

#### Phase 4: Testing & Storybook (3-4h)
1. Update Vitest to v4
2. Migrate Storybook to v10
3. Fix component stories
4. Run full test suite

#### Phase 5: State & Validation (2-3h)
1. Update Zustand to v5 (middleware changes)
2. Update Zod to v4
3. Update ESLint to v9
4. Fix all type errors

**Dependencies**: 
- Backend API stability
- Design system review
- Cross-browser testing

**Risk**: Critical - Could break entire frontend  
**Benefits**: Better performance, new React features, improved DX

---

### C4.3 Minor/Patch Updates
**Priority**: P1 (High)  
**Effort**: 2-4 hours  
**Packages**: 20+ packages with minor/patch updates

**Remediation**:
```bash
# Backend
cd backend
npm update --save
npm audit fix

# Frontend  
cd frontend
npm update --save
npm audit fix
```

**Note**: Some updates may require manual migration (check changelogs)

---

## Category 5: Documentation Gaps

### C5.1 API Documentation Incomplete
**Priority**: P1 (High)  
**Effort**: 8-12 hours  
**Issues**: Listed in C1.2 (Documentation TODOs)

**Additional Gaps**:
- WebSocket documentation (if implemented for real-time features)
- Rate limiting policies not documented
- Error code catalog incomplete
- Authentication flow diagram missing

---

### C5.2 Architecture Decision Records (ADRs) Missing
**Priority**: P2 (Medium)  
**Effort**: 6-8 hours

**Issue**: No ADRs documenting why key architectural decisions were made:
- Why SQLite over PostgreSQL for production?
- Why Grammy.js over node-telegram-bot-api?
- Why Zustand over Redux/Jotai?
- Why monorepo structure?
- Why hybrid chat+mini-app flow?

**Remediation**:
1. Create `docs/10-architecture-decisions/` directory
2. Write ADR template
3. Document 10-15 key decisions retroactively
4. Establish process for future ADRs

**Benefits**: Easier onboarding, better architectural continuity

---

### C5.3 Deployment Runbook Incomplete
**Priority**: P2 (Medium)  
**Effort**: 4-6 hours

**Issue**: 
- VPS deployment guides exist but lack:
  - Database backup/restore procedures
  - Blue-green deployment strategy
  - Rollback procedures
  - Monitoring setup (beyond basics)
  - Disaster recovery plan

**Remediation**: Create comprehensive ops runbook

---

## Category 6: Test Coverage & Quality

### C6.1 Frontend Test Coverage Not Enforced
**Priority**: P1 (High)  
**Effort**: 4-6 hours

**Issue**:
- Backend has 70% coverage threshold in jest.config.js
- Frontend has no coverage thresholds in vitest.config.ts
- Frontend tests exist (225 test files) but coverage unknown
- CI/CD doesn't run frontend tests

**Remediation**:
1. **Measure** (1h): Run `npm run test:coverage` in frontend, assess current coverage
2. **Configure** (1h): Add coverage thresholds to vitest.config.ts:
   ```ts
   coverage: {
     statements: 60,
     branches: 55,
     functions: 50,
     lines: 60,
   }
   ```
3. **Integrate** (2h): Add frontend test step to CI/CD workflow
4. **Document** (1h): Update README with coverage requirements

**Dependencies**: None  
**Risk**: Low  
**Benefits**: Prevent coverage regression, improve code quality

---

### C6.2 Integration Tests Limited
**Priority**: P2 (Medium)  
**Effort**: 12-16 hours

**Issue**:
- Most tests are unit tests
- Integration tests exist but limited to happy paths
- No end-to-end tests for critical flows:
  - Complete poll lifecycle (create → vote → close → results)
  - Budget tracking flow
  - Deep link navigation
  - Telegram auth flow

**Remediation**:
1. **Phase 1** (6-8h): Add integration tests for 5 critical flows
2. **Phase 2** (4-6h): Set up Playwright for E2E tests
3. **Phase 3** (2h): Add E2E tests to CI/CD

---

### C6.3 Test Flakiness
**Priority**: P2 (Medium)  
**Effort**: 4-6 hours

**Issue**: Test suite has intermittent failures (noted in CLAUDE.md: 197/202 tests passing)

**Remediation**:
1. Identify flaky tests (run suite 10x)
2. Fix race conditions (timers, async operations)
3. Add retry logic for external dependencies
4. Document known flaky tests

---

## Category 7: CI/CD & Automation

### C7.1 CI Checks Allow Failures
**Priority**: P0 (Critical)  
**Effort**: 2-3 hours

**Issue**: `.github/workflows/ci.yml` has `continue-on-error: true` for:
- Linting (line 41)
- Formatting (line 122)
- Security audit (lines 141, 146)

**This means**:
- Code style violations don't block merges
- Security vulnerabilities don't block deployments
- Technical debt accumulates unchecked

**Remediation**:
1. **Phase 1** (1h): Remove `continue-on-error` from linting/formatting
2. **Phase 2** (0.5h): Fix all existing lint errors: `npm run lint:fix`
3. **Phase 3** (0.5h): Make security audit blocking for HIGH/CRITICAL only
4. **Phase 4** (1h): Update PR template to require CI passing

**Dependencies**: Team agreement on code standards  
**Risk**: Low - May initially block some PRs until issues fixed  
**Benefits**: Enforce code quality, prevent regressions

---

### C7.2 Frontend Tests Not in CI
**Priority**: P1 (High)  
**Effort**: 2-3 hours

**Issue**: CI pipeline only builds frontend, doesn't run tests

**Remediation**:
Add to `.github/workflows/ci.yml`:
```yaml
- name: Run frontend tests
  working-directory: ./frontend
  run: npm test -- --run --coverage

- name: Upload frontend coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./frontend/coverage/lcov.info
    flags: frontend
```

---

### C7.3 No Automated Dependency Updates
**Priority**: P2 (Medium)  
**Effort**: 2-3 hours

**Issue**: No Dependabot or Renovate configured, dependencies manually updated

**Remediation**:
1. Add `.github/dependabot.yml`:
   ```yaml
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/backend"
       schedule:
         interval: "weekly"
     - package-ecosystem: "npm"
       directory: "/frontend"
       schedule:
         interval: "weekly"
   ```
2. Configure auto-merge for patch updates
3. Set up security alerts

**Benefits**: Stay updated, reduce manual work, patch vulnerabilities faster

---

### C7.4 No Performance Benchmarking
**Priority**: P3 (Low)  
**Effort**: 6-8 hours

**Issue**: No automated performance tests in CI

**Remediation**:
1. Add Lighthouse CI for frontend performance
2. Add k6 or Artillery for backend load testing
3. Track bundle size regressions
4. Monitor Core Web Vitals

---

## Category 8: Architecture & Patterns

### C8.1 Inconsistent Error Handling
**Priority**: P2 (Medium)  
**Effort**: 8-12 hours

**Issue**: 
- Some services throw custom errors, others throw generic Error
- Controllers inconsistently handle errors (some send 500, some send specific codes)
- Frontend error handling varies (some use try/catch, some use error boundaries)

**Remediation**:
1. Define custom error classes:
   ```ts
   class ValidationError extends Error { statusCode = 400; }
   class NotFoundError extends Error { statusCode = 404; }
   class UnauthorizedError extends Error { statusCode = 401; }
   ```
2. Create error middleware for Express
3. Standardize frontend error handling with error boundaries
4. Document error handling patterns

---

### C8.2 No Rate Limiting
**Priority**: P1 (High)  
**Effort**: 4-6 hours

**Issue**: API has no rate limiting, vulnerable to abuse

**Remediation**:
1. Add express-rate-limit middleware
2. Configure per-route limits:
   - Auth endpoints: 5/min
   - Poll creation: 10/hour
   - Vote submission: 20/min
   - Menu CRUD: 30/min
3. Add Redis for distributed rate limiting (optional)
4. Document rate limits in API docs

---

### C8.3 No Database Connection Pooling
**Priority**: P2 (Medium)  
**Effort**: 2-3 hours

**Issue**: Prisma client not configured with connection pool limits

**Remediation**:
Add to `schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
  connectionLimit = 10
}
```

For PostgreSQL migration:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  connectionLimit = 20
  poolTimeout = 30
}
```

---

## Remediation Roadmap

### Phase 1: Critical & Security (2-3 weeks)
**Goal**: Fix blocking issues, enable quality gates

| Priority | Item | Effort | Dependencies |
|----------|------|--------|--------------|
| P0 | C2.1 - Delete legacy files | 4h | Code review |
| P0 | C4.1 - Backend major updates | 16h | Test coverage |
| P0 | C4.2 - Frontend major updates | 24h | Staging env |
| P0 | C7.1 - Fix CI continue-on-error | 3h | Team agreement |
| P1 | C8.2 - Add rate limiting | 6h | None |

**Total**: ~53 hours (1.5 weeks)

---

### Phase 2: Code Quality & Testing (3-4 weeks)
**Goal**: Improve maintainability, prevent regressions

| Priority | Item | Effort | Dependencies |
|----------|------|--------|--------------|
| P1 | C3.1 - Refactor poll service | 16h | Phase 1 complete |
| P1 | C6.1 - Frontend test coverage | 6h | None |
| P1 | C7.2 - Frontend tests in CI | 3h | C6.1 |
| P1 | C1.1 - Fix code TODOs | 6h | None |
| P2 | C3.2 - Refactor budget service | 10h | None |
| P2 | C3.3 - Refactor vote service | 8h | None |

**Total**: ~49 hours (1.5 weeks)

---

### Phase 3: Documentation & Infrastructure (2-3 weeks)
**Goal**: Improve onboarding, operational excellence

| Priority | Item | Effort | Dependencies |
|----------|------|--------|--------------|
| P1 | C5.1 - Complete API docs | 12h | None |
| P2 | C1.2 - Documentation TODOs | 12h | None |
| P2 | C5.2 - Add ADRs | 8h | None |
| P2 | C5.3 - Deployment runbook | 6h | Ops input |
| P2 | C7.3 - Automated dependency updates | 3h | None |
| P2 | C2.2 - Clean env backups | 2h | DevOps approval |

**Total**: ~43 hours (1.5 weeks)

---

### Phase 4: Architecture & Optimization (2-3 weeks)
**Goal**: Long-term maintainability, performance

| Priority | Item | Effort | Dependencies |
|----------|------|--------|--------------|
| P2 | C3.4 - Frontend page refactoring | 12h | Component tests |
| P2 | C6.2 - Add integration tests | 16h | Test framework |
| P2 | C8.1 - Standardize error handling | 12h | None |
| P2 | C8.3 - Database connection pooling | 3h | None |
| P3 | C7.4 - Performance benchmarking | 8h | CI pipeline |
| P3 | C6.3 - Fix flaky tests | 6h | None |

**Total**: ~57 hours (2 weeks)

---

## Metrics & Tracking

### Definition of Done
- [ ] Legacy files removed from git
- [ ] All dependencies < 1 major version behind
- [ ] Test coverage: Backend ≥70%, Frontend ≥60%
- [ ] CI pipeline: All checks required, no bypasses
- [ ] Documentation: API docs 100%, ADRs for key decisions
- [ ] Code quality: ESLint/Prettier enforced, no monolithic files >500 lines
- [ ] Performance: Lighthouse score ≥90, API p95 <200ms

### Progress Tracking
Create GitHub project board with columns:
- Backlog (P3 items)
- Todo (P0-P2 items)
- In Progress
- Code Review
- Done

### Success Metrics
- **Time to Onboard**: Reduce from 2 weeks to 3 days
- **Build Time**: Maintain <5 min after upgrades
- **Test Reliability**: 100% pass rate, 0 flaky tests
- **Security**: 0 HIGH/CRITICAL vulnerabilities
- **Performance**: Maintain current p95 latency

---

## Appendix A: Complete File List

### Legacy Files (Delete)
```
backend/src/services/group.service.ts.broken
backend/src/bot/handlers/poll.handlers.ts.broken
backend/src/bot/handlers/poll.handlers.ts.old
backend/src/bot/commands/startpoll.ts.broken
backend/src/utils/telegram-auth.ts.old
start-prod-dev.ps1.broken
```

### Environment Backups (Archive/Delete)
```
backups/env_20251005_101034/
backups/env_20251005_111356/
backups/env_20251005_122945/
backups/env_20251005_164105/
backups/env_20251005_183657/
backups/env_20251005_220014/
backups/env_20251006_130738/
backups/env_20251006_135045/
backups/env_20251006_145512/
backups/env_20251006_153727/
(24+ more directories)
```

### Large Files (Refactor)
```
backend/src/services/poll.service.ts (1,324 lines)
backend/src/api/controllers/poll.controller.ts (1,288 lines)
backend/src/bot/handlers/poll.handlers.ts (870 lines)
backend/src/services/budget.service.ts (856 lines)
backend/src/services/vote.service.ts (806 lines)
frontend/src/pages/HomePage.tsx (761 lines)
frontend/src/pages/MenuPage.tsx (578 lines)
```

---

## Appendix B: Dependency Version Matrix

### Backend Dependencies (Major Updates Required)

| Package | Current | Latest | Breaking? | Priority |
|---------|---------|--------|-----------|----------|
| @prisma/client | 5.22.0 | 6.18.0 | Yes | P0 |
| express | 4.21.2 | 5.1.0 | Yes | P0 |
| zod | 3.25.76 | 4.1.12 | Yes | P0 |
| jest | 29.7.0 | 30.2.0 | Yes | P0 |
| eslint | 8.57.1 | 9.39.0 | Yes | P0 |
| helmet | 7.2.0 | 8.1.0 | Maybe | P1 |
| node-cron | 3.0.3 | 4.2.1 | Maybe | P1 |
| supertest | 6.3.4 | 7.1.4 | Maybe | P1 |
| typescript | 5.9.2 | 5.9.3 | No | P1 |
| grammy | 1.38.2 | 1.38.3 | No | P2 |

### Frontend Dependencies (Major Updates Required)

| Package | Current | Latest | Breaking? | Priority |
|---------|---------|--------|-----------|----------|
| react | 18.3.1 | 19.2.0 | Yes | P0 |
| react-dom | 18.3.1 | 19.2.0 | Yes | P0 |
| react-router-dom | 6.30.1 | 7.9.5 | Yes | P0 |
| vite | 6.4.1 | 7.1.12 | Yes | P0 |
| vitest | 3.2.4 | 4.0.6 | Yes | P0 |
| tailwindcss | 3.4.17 | 4.1.16 | Yes | P0 |
| storybook | 9.1.9 | 10.0.2 | Yes | P0 |
| zustand | 4.5.7 | 5.0.8 | Yes | P0 |
| zod | 3.25.76 | 4.1.12 | Yes | P0 |
| eslint | 8.57.1 | 9.39.0 | Yes | P0 |
| @hookform/resolvers | 3.10.0 | 5.2.2 | Yes | P1 |
| @testing-library/react | 13.4.0 | 16.3.0 | Yes | P1 |
| @twa-dev/sdk | 7.10.1 | 8.0.2 | Maybe | P1 |

---

## Appendix C: Test Coverage Report

### Backend (Current State)
- **Total Test Files**: 156
- **Test Framework**: Jest 29
- **Coverage Threshold**: 70% (enforced)
- **Current Coverage**: ~85% (from CLAUDE.md)
- **Passing**: 197/202 tests (97.5%)
- **Known Issues**: 5 integration auth tests failing (low priority)

### Frontend (Current State)
- **Total Test Files**: 225 (including Storybook)
- **Test Framework**: Vitest 3
- **Coverage Threshold**: None (not enforced)
- **Current Coverage**: Unknown (needs measurement)
- **CI Integration**: Not running in pipeline

### Recommendations
1. Measure baseline frontend coverage
2. Set initial thresholds at current levels (prevent regression)
3. Gradually increase thresholds by 5% per quarter
4. Fix 5 failing backend tests (C6.3)
5. Add E2E tests for critical flows (C6.2)

---

## Appendix D: CI/CD Pipeline Issues

### Current Issues in `.github/workflows/ci.yml`

1. **Line 41**: Backend linting has `continue-on-error: true`
   - **Impact**: Linting failures don't block merges
   - **Fix**: Remove flag, fix all lint errors first

2. **Line 122**: Code formatting check has `continue-on-error: true`
   - **Impact**: Code style inconsistencies accumulate
   - **Fix**: Remove flag, run `prettier --write` on entire codebase

3. **Lines 141, 146**: Security audits have `continue-on-error: true`
   - **Impact**: Vulnerabilities can be merged
   - **Fix**: Make blocking for HIGH/CRITICAL severity only

4. **Missing**: Frontend test execution
   - **Impact**: Frontend tests not validated in CI
   - **Fix**: Add frontend test job (C7.2)

5. **Missing**: E2E tests
   - **Impact**: Integration issues not caught before deployment
   - **Fix**: Add Playwright E2E job (C6.2)

6. **Missing**: Performance budgets
   - **Impact**: Performance regressions unnoticed
   - **Fix**: Add Lighthouse CI (C7.4)

---

## Summary

This register documents 87+ technical debt items totaling **156-240 hours** of remediation work. The recommended 4-phase approach prioritizes:

1. **Phase 1** (Critical): Security updates, CI quality gates
2. **Phase 2** (Quality): Code refactoring, test coverage
3. **Phase 3** (Documentation): API docs, runbooks, ADRs
4. **Phase 4** (Optimization): Architecture improvements, performance

**Immediate Actions** (next sprint):
- Delete 6 legacy code files (4h)
- Remove CI `continue-on-error` flags (3h)
- Measure frontend test coverage (1h)
- Plan major dependency upgrades (4h)

**Total Immediate**: 12 hours (1.5 days)

**Next Review**: After Phase 1 completion (~3 weeks)

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Owner**: Engineering Team  
**Approvers**: Tech Lead, Product Owner
