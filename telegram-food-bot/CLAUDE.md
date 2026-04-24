# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Telegram Food Bot** - a production-ready Telegram bot with Mini App for organizing food voting in groups. Built with Grammy.js, Express, React, and Prisma ORM. Features deep linking, real-time updates, push notifications, budget tracking, and multiple fallback mechanisms.

**Current Status:** ✅ Production Ready
**Version:** 2.0.0
**Git Branch:** `feature/new_version` (NOT main - important!)
**Domain:** rocket-lunch.duckdns.org
**Bot:** @rocket_lunch_bot
**Tests:** 197/202 passing (97.5%)

### Recent Major Features
- ✅ **Budget Tracker** - Adaptive widget with 6 scenarios, СБП integration
- ✅ **VPS Deployment** - Full automation scripts, zero-downtime updates
- ✅ **CI/CD Pipeline** - GitHub Actions, Docker builds, automated tests
- ⚠️ **Gamification Removed** - Simplified UX (removed from dev build)

## Common Commands

### Development

**Start development environment (recommended):**
```powershell
cd telegram-food-bot
.\start-dev.ps1
```
Opens 5 windows: Backend (3001), Frontend (5173), Proxy (8080), ngrok, URL Updater

**Start PROD-DEV mode (hybrid optimization):**
```powershell
cd telegram-food-bot
.\start-prod-dev.ps1
```
Production builds with watch mode, console.log preserved, source maps enabled

**Start production mode:**
```powershell
cd telegram-food-bot
.\start-prod.ps1
```

### Backend Commands

```powershell
cd telegram-food-bot/backend

# Development
npm run dev              # Start with tsx watch (hot reload)
npm run build           # Compile TypeScript
npm run start           # Run compiled code
npm run prod-dev        # Build + watch (for PROD-DEV mode)

# Database
npm run db:push         # Push schema changes
npm run db:migrate      # Create migration
npm run db:generate     # Generate Prisma client
npm run db:studio       # Open Prisma Studio
npm run db:seed         # Seed menu items
npm run db:seed:clear   # Clear and reseed

# Testing
npm test                # Run Jest tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
npm run test:flow       # Run flow tests (test-app-flow.js)

# Scripts
npm run make-admin      # Make user admin
npm run list-users      # List all users
npm run check-polls     # Check active polls
npm run close-expired-polls  # Close expired polls

# Code Quality
npm run lint            # ESLint check
npm run lint:fix        # Auto-fix issues
npm run format          # Prettier format
```

### Frontend Commands

```powershell
cd telegram-food-bot/frontend

# Development
npm run dev             # Start Vite dev server (5173)
npm run build           # Production build
npm run build:prod-dev  # PROD-DEV build with watch
npm run preview         # Preview production build

# Testing
npm test                # Run Vitest
npm run test:ui         # Vitest UI
npm run test:coverage   # With coverage

# Code Quality
npm run lint            # ESLint check
npm run lint:fix        # Auto-fix issues
npm run format          # Prettier format
npm run type-check      # TypeScript check (no emit)

# Storybook
npm run storybook       # Start Storybook
npm run build-storybook # Build Storybook
```

## Architecture

### Monorepo Structure

```
telegram-food-bot/
├── backend/              # Node.js + TypeScript + Grammy + Express
│   ├── src/
│   │   ├── api/          # REST API endpoints
│   │   │   ├── controllers/  # Request handlers
│   │   │   ├── routes/       # Route definitions
│   │   │   └── middleware/   # Auth, validation, CORS
│   │   ├── bot/          # Telegram bot logic
│   │   │   ├── commands/     # Bot commands (/start, /vote, etc)
│   │   │   ├── handlers/     # Callback query handlers
│   │   │   ├── keyboards/    # Telegram keyboards
│   │   │   ├── middleware/   # Bot middleware
│   │   │   └── events/       # Group events
│   │   ├── services/     # Business logic layer
│   │   ├── database/     # Prisma client + seeders
│   │   ├── config/       # Configuration files
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Utilities (logger, crypto, etc)
│   └── prisma/           # Database schema + migrations
│
├── frontend/             # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/        # Page components (HomePage, VotingPage, etc)
│   │   ├── components/   # Reusable components
│   │   │   ├── common/       # Generic UI components
│   │   │   ├── voting/       # Voting-specific components
│   │   │   ├── polls/        # Poll components
│   │   │   ├── menu/         # Menu management
│   │   │   └── layout/       # Layout components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # API client (axios)
│   │   ├── store/        # Zustand state management
│   │   └── lib/          # React Query, Sentry, utils
│   └── public/           # Static assets
│
├── scripts/              # PowerShell automation scripts
└── docs/                 # Comprehensive documentation
```

### Key Architecture Patterns

**1. Hybrid Communication Flow:**
- Group Chat → Deep Link → Personal Chat → Mini App
- Minimizes group spam (3 messages max per poll)
- Mini App first approach (all interactions through web interface)

**2. Data Flow:**
```
Frontend (React) → API (Express) → Services → Database (Prisma/SQLite)
                      ↓
                  Bot (Grammy) → Telegram API
```

**3. Service Layer Pattern:**
All business logic in services (`backend/src/services/`):
- `poll.service.ts` - Poll CRUD, state management
- `vote.service.ts` - Voting logic
- `menu.service.ts` - Menu management
- `user.service.ts` - User management
- `notification.service.ts` - Push notifications
- `responsible.service.ts` - Responsible person selection (roulette/volunteer)
- `budget.service.ts` - Budget tracking, transactions, debts/credits

**4. State Management:**
- Frontend: Zustand (global state) + React Query (server state)
- Backend: Stateless services + SQLite persistence

### Database Schema (Prisma)

Core models:
- `User` - Telegram users with admin flags
- `Group` - Telegram groups
- `MenuItem` - Food items with categories
- `Poll` - Voting sessions (status: ACTIVE/COMPLETED/CANCELLED)
- `Vote` - User votes (one per user per poll)
- `PollResult` - Final results with winner and responsible person
- `Transaction` - Budget tracking (PENDING → PAID → CONFIRMED)
- `ResponsibleSelection` - Track who was responsible (volunteer/roulette)
- `PaymentReminder` - Automated payment reminders

Key relationships:
- Poll → Group (many-to-one)
- Poll → Votes (one-to-many)
- Poll → PollResult (one-to-one)
- Poll → Transactions (one-to-many) - NEW
- Vote → User, MenuItem (many-to-one)
- Transaction → Poll, Debtor, Creditor (many-to-one)

### Deep Linking Flow

1. **Poll Creation** → Message in group with "Проголосовать" button
2. **Button Click** → Opens personal chat with bot via `t.me/<bot>?start=vote_<pollId>`
3. **Bot /start** → Validates poll, sends Mini App button with `?pollId=<id>`
4. **Mini App Launch** → Parses `pollId` from URL, navigates to `/poll/:id`
5. **Voting** → User votes, results update in real-time

**Files involved:**
- `backend/src/bot/handlers/poll.handlers.ts:handleOpenPollButton()`
- `backend/src/bot/commands/start.ts`
- `frontend/src/App.tsx` (useEffect for pollId parsing)
- `frontend/src/pages/VotingPage.tsx`

### Budget Tracker System

**Workflow after poll completion:**
1. Poll closes → `ResponsibleService` selects responsible person
2. `BudgetService` creates transactions for all participants
3. Frontend shows adaptive widget based on 6 scenarios:
   - **Urgent Debt** (<5 min after poll) - with СБП quick pay
   - **Waiting Confirmation** - user marked payment
   - **Success Message** - payment confirmed (with confetti)
   - **Overview** - all debts/credits summary
   - **Responsible View** - for the person who paid
   - **Hidden** - no active debts

**Files involved:**
- `backend/src/services/budget.service.ts`
- `backend/src/services/responsible.service.ts`
- `backend/src/api/routes/budget.routes.ts`
- `frontend/src/components/budget/BudgetWidget.tsx`
- `frontend/src/hooks/useBudgetWidget.ts`

**API Endpoints:**
- `GET /api/budget/debts` - get user debts
- `GET /api/budget/credits` - get user credits
- `POST /api/budget/mark-paid` - mark as paid
- `POST /api/budget/confirm-payment` - confirm payment
- `POST /api/budget/cancel-mark` - cancel mark

### Environment Modes

**DEV Mode** (start-dev.ps1):
- Frontend: Vite dev server with hot reload
- Backend: tsx watch mode
- Proxy server unifies endpoints
- ngrok for HTTPS tunneling
- Best for: Active UI development

**PROD-DEV Mode** (start-prod-dev.ps1):
- Frontend: Production build with watch mode
- Backend: Compiled TypeScript with watch
- SKIP_TELEGRAM_VALIDATION enabled
- Console.log preserved, source maps enabled
- Best for: Testing production builds locally

**PRODUCTION Mode** (start-prod.ps1):
- Frontend: Optimized build served by backend
- Backend: Single server on port 3001
- Full validation, no debug output
- Best for: Final testing before deployment

## Critical Implementation Details

### 1. Poll Lifecycle

```
ACTIVE → voting in progress
  ↓ (time expires OR admin closes)
COMPLETED → roulette spins, winner selected
  ↓
Results posted to group
```

**Never cache polls in localStorage** - always fetch fresh to avoid stale data. See `frontend/src/lib/queryClient.ts:cacheUtils.clearStalePollsCache()`.

### 2. Telegram Authentication

Backend validates `initData` from Telegram Mini App:
- `backend/src/api/middleware/telegram-auth.ts:validateTelegramAuth()`
- Uses HMAC-SHA256 with bot token as secret
- Can be skipped in dev with `SKIP_TELEGRAM_VALIDATION=true`

### 3. Real-time Updates

Frontend uses React Query with aggressive refetching:
- Active polls: refetch every 5s
- Votes: refetch on window focus
- `staleTime: 0` for polls (always fresh)

### 4. Notification System

Push notifications via Telegram API:
- `backend/src/services/notification.service.ts`
- Triggers: poll started, poll reminder, poll closed
- Uses `bot.api.sendMessage()` with deep links

### 5. Mini App First Approach

All user interactions through Mini App:
- Deep linking for poll access from groups
- Rich UI with real-time updates
- No fallback commands needed (99%+ compatibility)

## Testing

### Manual Testing Flow

1. Start dev environment: `.\start-dev.ps1`
2. Get ngrok URL from window #4
3. Paste in window #5 (URL Updater)
4. Open @rocket_lunch_bot in Telegram
5. Add bot to test group
6. Run `/startpoll` in group
7. Click "Проголосовать" button
8. Test voting flow in Mini App

**Quick testing guides:**
- [START_TESTING_UX.md](START_TESTING_UX.md) - UX testing checklist
- [TESTING_INSTRUCTIONS.md](TESTING_INSTRUCTIONS.md) - Detailed instructions
- [QUICK_TEST_CHECKLIST.md](QUICK_TEST_CHECKLIST.md) - Quick checklist

### Automated Tests

**Backend:** 197/202 tests passing (97.5%)
```bash
cd telegram-food-bot/backend
npm test                # Run all tests
npm run test:coverage   # With coverage (~85%)
npm run test:flow       # Run flow tests (9 tests, 100% success)
```

**Known issues:** 5 integration auth tests need fixing (low priority)

**Frontend:** Minimal coverage (needs expansion)
```bash
cd telegram-food-bot/frontend
npm test                # Run Vitest
```

## Common Development Tasks

### Adding a New Bot Command

1. Create command file: `backend/src/bot/commands/mycommand.ts`
2. Export function: `export async function myCommand(ctx: BotContext) { ... }`
3. Register in `backend/src/bot/bot.ts`: `bot.command('mycommand', myCommand)`
4. Add to help command: `backend/src/bot/commands/help.ts`

### Adding a New API Endpoint

1. Create route: `backend/src/api/routes/myroute.routes.ts`
2. Create controller: `backend/src/api/controllers/myroute.controller.ts`
3. Add service method: `backend/src/services/myservice.ts`
4. Register route in `backend/src/api/server.ts`
5. Add types: `backend/src/types/api.types.ts`
6. Update frontend service: `frontend/src/services/api.ts`

### Adding a New Frontend Page

1. Create page: `frontend/src/pages/MyPage.tsx`
2. Add route in `frontend/src/App.tsx`
3. Add navigation item in `frontend/src/components/layout/BottomNavigation.tsx`
4. Lazy load for code splitting: `const MyPage = lazy(() => import('./pages/MyPage'))`

### Modifying Database Schema

1. Edit `backend/prisma/schema.prisma`
2. Run migration:
   ```bash
   cd backend
   npm run db:migrate
   ```
3. Generate Prisma Client: `npm run db:generate`
4. Update TypeScript types if needed
5. Update seeders if needed

## Environment Variables

Critical variables:

**Backend (.env):**
```
TELEGRAM_BOT_TOKEN=<from BotFather>
WEBAPP_URL=<ngrok URL or production URL>
API_PORT=3001
JWT_SECRET=<random string>
NODE_ENV=development|production
SKIP_TELEGRAM_VALIDATION=true|false
```

**Frontend (.env):**
```
VITE_API_URL=<backend URL>
VITE_BOT_USERNAME=<bot username>
```

Multiple .env files for different modes:
- `.env.development` - DEV mode
- `.env.prod-dev` - PROD-DEV mode
- `.env.production` - PRODUCTION mode

Start scripts automatically copy correct .env file.

## Production Deployment

### VPS Deployment (Recommended) ⭐

**Quick start:** See [START_HERE.md](START_HERE.md) - main entry point

**Automated deployment scripts:**
- `telegram-food-bot/deploy-vps.sh` - Full deployment
- `telegram-food-bot/update-vps.sh` - Zero-downtime updates
- `telegram-food-bot/backup-db.sh` - Database backup
- `telegram-food-bot/setup-cron-backup.sh` - Auto-backups

**Key steps (35-40 minutes):**
1. Install dependencies (Node.js 22, PM2, Nginx, Certbot)
2. Clone repo → checkout `feature/new_version` branch
3. Run `./deploy-vps.sh` (auto-installs, builds, starts)
4. Configure Nginx + SSL certificate
5. Set Telegram webhook and menu button

**Deployment guides:**
- [QUICK_VPS_DEPLOY.md](QUICK_VPS_DEPLOY.md) - Quick reference (5 min)
- [VPS_DEPLOYMENT_GUIDE_NEW.md](VPS_DEPLOYMENT_GUIDE_NEW.md) - Full guide (20 min)
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Checklist

**Important notes:**
- ⚠️ Project is on `feature/new_version` branch (NOT main)
- ✅ Scripts auto-switch to correct branch
- ✅ Zero-downtime updates via PM2 reload
- ✅ Configured for rocket-lunch.duckdns.org

### Manual Deployment

Full guide: `telegram-food-bot/docs/04-deployment/README.md`

Key steps:
1. Build frontend: `cd frontend && npm run build`
2. Build backend: `cd backend && npm run build`
3. Set environment variables (production .env)
4. Run migrations: `npm run db:migrate:prod`
5. Start backend: `npm start` (serves API + static files)
6. Configure webhook: Point to `https://yourdomain.com/webhook`
7. Set menu button: Use BotFather or API

Backend serves frontend static files from `frontend/dist/` in production.

## Important Notes

- **Git Branch**: Project is on `feature/new_version` (NOT main) - deployment scripts handle this
- **Database location**: `backend/prisma/dev.db` (SQLite file) - production needs PostgreSQL
- **Backup before migrations**: Database contains production data
- **Proxy configuration**: Required for Telegram API in some regions (check `backend/src/config/bot.config.ts`)
- **ngrok auth**: Free tier has limitations, consider paid for stable URLs
- **Poll expiration**: Polls auto-close after `duration` minutes (default 30)
- **Admin users**: Set via `npm run make-admin` in backend
- **Menu button**: Must be configured in BotFather settings
- **Budget Tracker**: Automatically creates transactions after poll completion
- **Zero-downtime updates**: Use `./update-vps.sh` for production updates

## Documentation

Документация структурирована в `../docs/` (на уровень выше `telegram-food-bot/`):

**В корне `telegram-food-bot/`:**
- [README.md](README.md) — обзор проекта
- [CLAUDE.md](CLAUDE.md) — этот файл
- [AGENTS.md](AGENTS.md) — гайд для AI-агентов
- [CHANGELOG.md](CHANGELOG.md) — история версий
- [DEPLOYMENT.md](DEPLOYMENT.md) — основной deploy-гайд
- [MIGRATION_RUNBOOK.md](MIGRATION_RUNBOOK.md) — план миграции на PostgreSQL

**`../docs/` структура:**
- [docs/AUDIT_REPORT_2026-04-17.md](../docs/AUDIT_REPORT_2026-04-17.md) — последний аудит проекта
- [docs/SECURITY_TODO.md](../docs/SECURITY_TODO.md) — ⚠️ отложенные security-действия (ротация секретов)
- [docs/00-start/](../docs/00-start/) — точка входа
- [docs/01-deployment/](../docs/01-deployment/) — VPS, deploy, git workflow
- [docs/02-monitoring/](../docs/02-monitoring/) — Sentry, Glitchtip, Redis, GitHub Secrets
- [docs/03-testing/](../docs/03-testing/) — testing guides, mobile troubleshooting
- [docs/04-features/](../docs/04-features/) — Budget Tracker, Engagement Strategy, Countdown, Smart Homepage, дизайн-система
- [docs/05-production/](../docs/05-production/) — production checklists, build modes
- [docs/99-archive/](../docs/99-archive/) — исторические отчёты, старые fix-report'ы

Always check docs before making architectural changes.

## Performance Considerations

- Frontend uses React.lazy() for code splitting
- Virtual scrolling for long menu lists
- Aggressive React Query caching with smart invalidation
- Optimistic updates for votes
- Debounced search inputs
- Image lazy loading
- Service worker for PWA support

## Known Issues & Solutions

**Fixed:**
- ✅ Poll caching causing stale data → Fixed: polls never cached in localStorage
- ✅ Menu items filtering → Fixed: proper display after poll creation
- ✅ Navigation after poll creation → Fixed: auto-redirect with cache clear
- ✅ InlineVotingCard BigInt crash → Fixed: validation with try-catch
- ✅ Admin delete button → Fixed: now uses completePoll instead of delete

**Active (low priority):**
- ⚠️ 5 integration auth tests failing → Need fixing
- ⚠️ Frontend test coverage low → Need expansion
- ⚠️ SQLite in production → Plan migration to PostgreSQL

**By design:**
- 💡 Deep links work in 99%+ Telegram versions
- 💡 ngrok URLs change on restart → Run URL updater script after restart
- 💡 Mini App requires HTTPS (use ngrok or production domain)

**Documentation:**
- [PERSISTENT_CACHE_FIX.md](telegram-food-bot/PERSISTENT_CACHE_FIX.md) - Poll caching fix
- [CACHE_FIX_REPORT.md](telegram-food-bot/CACHE_FIX_REPORT.md) - Menu filtering fix
- [INLINE_VOTING_AUDIT_REPORT.md](telegram-food-bot/INLINE_VOTING_AUDIT_REPORT.md) - Voting fixes

## Security

- NEVER commit `.env` files with real tokens
- Telegram auth validation is critical (don't skip in production)
- JWT tokens for API authentication
- CORS configured for specific origins
- Input validation via Zod schemas
- SQL injection prevented by Prisma ORM
- XSS protection via DOMPurify

## Troubleshooting

**Bot not responding:**
1. Check if backend is running
2. Verify `TELEGRAM_BOT_TOKEN` in .env
3. Check webhook status: `npm run check-webhook` (in backend)
4. Delete webhook for polling: `..\delete-webhook.ps1`

**Mini App not opening:**
1. Verify `WEBAPP_URL` matches ngrok URL
2. Check menu button is set in BotFather
3. Ensure HTTPS (not HTTP)
4. Check browser console for errors

**Database errors:**
1. Run migrations: `npm run db:push`
2. Generate Prisma Client: `npm run db:generate`
3. Check database file exists: `backend/prisma/dev.db`

**Build errors:**
1. Clear node_modules: `rm -rf node_modules && npm install`
2. Clear Vite cache: `rm -rf frontend/.vite`
3. Clear TypeScript cache: `rm -rf backend/dist`

## Code Style

- TypeScript strict mode enabled
- ESLint + Prettier configured
- Use async/await over promises
- Services should be stateless
- Components should be functional (React hooks)
- Use Prisma Client, never raw SQL
- Logger for all significant events: `logger.info()`, `logger.error()`
- Error boundaries for React components

---

## Current Project Status

### ✅ Production Ready (v2.0.0)

**What's Working:**
- ✅ All core features implemented
- ✅ Budget tracker with 6 adaptive scenarios
- ✅ VPS deployment automation ready
- ✅ 197/202 tests passing (97.5%)
- ✅ CI/CD pipeline configured
- ✅ Comprehensive documentation (70+ files)
- ✅ Multiple environment modes (DEV/PROD-DEV/PROD)
- ✅ Zero-downtime update scripts

**Ready for Deployment:**
- Domain: rocket-lunch.duckdns.org
- Branch: feature/new_version
- Scripts: `./deploy-vps.sh` and `./update-vps.sh`
- Documentation: See [START_HERE.md](START_HERE.md)

### 📋 Next Steps

**Immediate (this week):**
1. Deploy to VPS using automated scripts
2. Configure Sentry DSN for monitoring
3. Test in production environment
4. Gather user feedback

**Short-term (1-2 weeks):**
5. Fix 5 failing auth tests
6. Expand frontend test coverage
7. Performance optimization
8. Prepare PostgreSQL migration

**Medium-term (1-2 months):**
9. Implement monetization (plan ready in ENGAGEMENT_STRATEGY.md)
10. Add gamification (optional, plan ready)
11. Multi-winner polls
12. Integrations (Яндекс.Еда, etc.)

### 📊 Metrics

- **Backend:** ~15,000 lines of TypeScript
- **Frontend:** ~20,000 lines of TypeScript/React
- **Tests:** 202 total (197 passing)
- **Coverage:** Backend ~85%, Frontend needs expansion
- **Documentation:** 70+ markdown files
- **Bundle size:** ~500 KB (production)

---

## Quick Reference Links

**For Development:**
- [Start dev](telegram-food-bot/) → `.\start-dev.ps1`
- [Start PROD-DEV](telegram-food-bot/) → `.\start-prod-dev.ps1`
- [Run tests](telegram-food-bot/backend/) → `npm test`

**For Deployment:**
- [START_HERE.md](START_HERE.md) - Main guide
- [QUICK_VPS_DEPLOY.md](QUICK_VPS_DEPLOY.md) - Quick reference
- [Deploy script](telegram-food-bot/) → `./deploy-vps.sh`
- [Update script](telegram-food-bot/) → `./update-vps.sh`

**For Documentation:**
- [README.md](README.md) - Project overview
- [BUDGET_TRACKER_IMPLEMENTATION.md](BUDGET_TRACKER_IMPLEMENTATION.md) - Budget feature
- [ENGAGEMENT_STRATEGY.md](ENGAGEMENT_STRATEGY.md) - Monetization plan
- [Session summaries](.) - Check SESSION_SUMMARY_*.md files

---

**Last updated:** 2025-10-29
**Status:** ✅ Production Ready - Ready for VPS deployment
"" 
"" 
# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
