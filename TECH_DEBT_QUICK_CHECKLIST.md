# Technical Debt Quick Checklist

> **Quick reference for the complete [Technical Debt Register](./TECHNICAL_DEBT_REGISTER.md)**

## 🔴 Critical (P0) - Do First

- [ ] **C2.1** - Delete 6 legacy `.broken` and `.old` files (4h)
- [ ] **C4.1** - Update backend: Prisma 5→6, Express 4→5, Zod 3→4, Jest 29→30, ESLint 8→9 (16h)
- [ ] **C4.2** - Update frontend: React 18→19, Vite 6→7, Tailwind 3→4, React Router 6→7 (24h)
- [ ] **C7.1** - Remove `continue-on-error` from CI linting/formatting/security checks (3h)

**Total**: 47 hours (~6 days)

---

## 🟠 High Priority (P1) - Do Soon

### Code Quality
- [ ] **C1.1** - Fix TODO comments in HomePage.tsx, MenuPage.tsx (6h)
- [ ] **C3.1** - Refactor poll.service.ts (1,324 lines) into smaller modules (16h)

### Testing
- [ ] **C6.1** - Add frontend test coverage thresholds, integrate with CI (6h)
- [ ] **C7.2** - Run frontend tests in CI pipeline (3h)

### Security & Infrastructure  
- [ ] **C8.2** - Add API rate limiting (6h)
- [ ] **C5.1** - Complete API documentation (12h)

### Dependencies
- [ ] **C4.3** - Update minor/patch versions for 20+ packages (4h)

**Total**: 53 hours (~7 days)

---

## 🟡 Medium Priority (P2) - Schedule

### Code Refactoring
- [ ] **C3.2** - Refactor budget.service.ts (856 lines) (10h)
- [ ] **C3.3** - Refactor vote.service.ts (806 lines) (8h)
- [ ] **C3.4** - Split HomePage.tsx (761 lines) and MenuPage.tsx (578 lines) (12h)

### Documentation
- [ ] **C1.2** - Complete 5 TODO items in API docs (12h)
- [ ] **C5.2** - Create Architecture Decision Records (ADRs) for 10-15 key decisions (8h)
- [ ] **C5.3** - Write complete deployment runbook (disaster recovery, rollback) (6h)

### Testing
- [ ] **C6.2** - Add integration tests for 5 critical user flows (16h)
- [ ] **C6.3** - Fix 5 flaky backend auth tests (6h)

### Infrastructure
- [ ] **C2.2** - Archive/delete 34 `.env.backup` files (2h)
- [ ] **C7.3** - Set up Dependabot/Renovate for automated dependency updates (3h)
- [ ] **C8.1** - Standardize error handling patterns across backend/frontend (12h)
- [ ] **C8.3** - Configure database connection pooling (3h)

**Total**: 98 hours (~12 days)

---

## 🟢 Low Priority (P3) - Backlog

- [ ] **C7.4** - Add performance benchmarking (Lighthouse CI, k6) (8h)
- [ ] **Storybook TODOs** - Complete interaction tests in 3 component stories (3h)
- [ ] **Archive Docs** - Review/remove 20+ TODOs in `/docs/99-archive` (2h)

**Total**: 13 hours (~2 days)

---

## Quick Actions (This Week)

### Immediate Wins (12 hours)
1. **Delete legacy files** (4h) - C2.1
   ```bash
   git rm backend/src/services/group.service.ts.broken
   git rm backend/src/bot/handlers/poll.handlers.ts.broken
   git rm backend/src/bot/handlers/poll.handlers.ts.old
   git rm backend/src/bot/commands/startpoll.ts.broken
   git rm backend/src/utils/telegram-auth.ts.old
   git rm start-prod-dev.ps1.broken
   git commit -m "chore: remove legacy .broken and .old files"
   ```

2. **Fix CI quality gates** (3h) - C7.1
   - Remove `continue-on-error: true` from 3 jobs in `.github/workflows/ci.yml`
   - Run `npm run lint:fix` in backend and frontend
   - Commit fixes

3. **Measure frontend coverage** (1h) - C6.1
   ```bash
   cd frontend
   npm run test:coverage
   # Document baseline in README
   ```

4. **Plan dependency upgrades** (4h) - C4.1 & C4.2
   - Read migration guides for major versions
   - Create branch: `chore/deps-upgrade-v6`
   - Document breaking changes

---

## Phase-Based Roadmap

### Phase 1: Critical & Security (2-3 weeks)
- C2.1, C4.1, C4.2, C7.1, C8.2
- **Goal**: Fix blocking issues, enable quality gates
- **Effort**: 53 hours

### Phase 2: Code Quality & Testing (3-4 weeks)
- C3.1, C6.1, C7.2, C1.1, C3.2, C3.3
- **Goal**: Improve maintainability, prevent regressions
- **Effort**: 49 hours

### Phase 3: Documentation & Infrastructure (2-3 weeks)
- C5.1, C1.2, C5.2, C5.3, C7.3, C2.2
- **Goal**: Improve onboarding, operational excellence
- **Effort**: 43 hours

### Phase 4: Architecture & Optimization (2-3 weeks)
- C3.4, C6.2, C8.1, C8.3, C7.4, C6.3
- **Goal**: Long-term maintainability, performance
- **Effort**: 57 hours

**Total**: 202 hours (5-6 weeks for 1 developer, 3-4 weeks for 2 developers)

---

## Success Metrics

### Before
- ❌ 6 legacy code files
- ❌ 34 .env.backup files  
- ⚠️ 5/202 tests failing
- ⚠️ CI allows lint/format/security failures
- ⚠️ Frontend tests not in CI
- ⚠️ No test coverage enforcement (frontend)
- ⚠️ 50+ packages >1 major version behind
- ⚠️ 7 files >700 lines

### After (Target)
- ✅ 0 legacy files
- ✅ Backups properly archived
- ✅ 202/202 tests passing
- ✅ CI blocks on quality issues
- ✅ Full test automation
- ✅ Frontend coverage ≥60%
- ✅ All deps <1 major version behind
- ✅ No files >500 lines

---

## Blockers & Dependencies

### Required Before Starting
- [ ] Team agreement on code standards
- [ ] Staging environment for testing major upgrades
- [ ] Backup production database
- [ ] Rollback plan documented

### During Execution
- [ ] Feature freeze during Phase 1 (major deps)
- [ ] Code review approval for refactorings
- [ ] DevOps approval for env cleanup
- [ ] Ops input for deployment runbook

---

## Tools & Commands

### Check outdated dependencies
```bash
cd backend && npm outdated
cd frontend && npm outdated
```

### Run all tests
```bash
# Backend
cd backend
npm test -- --coverage

# Frontend
cd frontend
npm test -- --coverage
```

### Find large files
```bash
cd backend/src
find . -name "*.ts" -type f ! -name "*.d.ts" -exec wc -l {} + | sort -rn | head -20
```

### Find TODO/FIXME
```bash
grep -r "TODO\|FIXME" --include="*.ts" --include="*.tsx" backend/src frontend/src
```

### CI/CD validation
```bash
# Local CI simulation
act -j backend-test  # Requires nektos/act
```

---

## References

- **Full Register**: [TECHNICAL_DEBT_REGISTER.md](./TECHNICAL_DEBT_REGISTER.md)
- **Project Docs**: [telegram-food-bot/docs/](./telegram-food-bot/docs/)
- **CLAUDE.md**: [CLAUDE.md](./CLAUDE.md) - AI assistant context
- **CI Pipeline**: [.github/workflows/ci.yml](./telegram-food-bot/.github/workflows/ci.yml)

---

**Last Updated**: 2025-01-XX  
**Next Review**: After Phase 1 completion
