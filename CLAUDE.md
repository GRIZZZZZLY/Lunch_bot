# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telegram Food Bot - a production-ready Telegram bot with Mini App for organizing food voting in groups. Built with Grammy.js, Express, React, and Prisma ORM. Features deep linking, real-time updates, push notifications, and multiple fallback mechanisms.

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
- 100% fallback compatibility (works without Mini App via `/vote` command)

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
- `roulette.service.ts` - Responsible person selection

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

Key relationships:
- Poll → Group (many-to-one)
- Poll → Votes (one-to-many)
- Poll → PollResult (one-to-one)
- Vote → User, MenuItem (many-to-one)

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

### 5. Fallback Mechanisms

For users without Mini App support:
- `/vote` command in group → inline keyboard with menu items
- Direct callback query handling in bot
- No external URLs, pure Telegram UI

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

Full checklist: `telegram-food-bot/docs/05-testing/TESTING_GUIDE_FULL.md`

### Automated Tests

Backend has unit tests for services:
```bash
cd backend
npm test
```

Frontend needs test expansion (currently minimal coverage).

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

- **Database location**: `backend/prisma/dev.db` (SQLite file)
- **Backup before migrations**: Database contains production data
- **Proxy configuration**: Required for Telegram API in some regions (check `backend/src/config/bot.config.ts`)
- **ngrok auth**: Free tier has limitations, consider paid for stable URLs
- **Poll expiration**: Polls auto-close after `duration` minutes (default 30)
- **Admin users**: Set via `npm run make-admin` in backend
- **Menu button**: Must be configured in BotFather settings

## Documentation

Comprehensive docs in `telegram-food-bot/docs/`:
- 01-getting-started/ - Setup guides
- 02-development/ - Dev workflows, scripts
- 03-architecture/ - System design, features
- 04-deployment/ - Production deployment
- 05-testing/ - Testing scenarios
- 06-guides/ - User guides
- 07-api/ - API documentation (TODO: needs expansion)

Always check docs before making architectural changes.

## Performance Considerations

- Frontend uses React.lazy() for code splitting
- Virtual scrolling for long menu lists
- Aggressive React Query caching with smart invalidation
- Optimistic updates for votes
- Debounced search inputs
- Image lazy loading
- Service worker for PWA support

## Known Issues

- Poll caching can cause stale data → Always use `cacheUtils.clearStalePollsCache()`
- Deep links may fail on very old Telegram versions → Fallback to `/vote` command
- ngrok URLs change on restart → Run URL updater script after restart
- Telegram Mini App not available in some regions → Fallback mechanisms handle this

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
3. Try alternative: `/vote` command
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
