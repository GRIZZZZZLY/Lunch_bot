# AGENTS.md

Guidelines for AI coding agents working in this repository.

## Project Overview

Telegram Food Bot - a monorepo with Node.js/TypeScript backend (Grammy.js, Express, Prisma) and React/TypeScript frontend (Vite, Zustand, React Query).

## Build/Lint/Test Commands

### Backend (`backend/`)

```bash
npm run build           # Compile TypeScript
npm run dev             # Start with tsx watch (hot reload)
npm test                # Run Jest tests
npm run test:watch      # Jest watch mode
npm run test:coverage   # Tests with coverage
npm run lint            # ESLint check
npm run lint:fix        # ESLint auto-fix
npm run format          # Prettier format
npm run db:push         # Push Prisma schema changes
npm run db:generate     # Generate Prisma client
```

**Running single tests (Jest):**
```bash
npm test -- --testPathPattern="poll.service"     # Match pattern
npm test -- src/__tests__/poll.service.test.ts   # Specific file
npm test -- -t "should create a new poll"        # Match test name
```

### Frontend (`frontend/`)

```bash
npm run build           # Vite production build
npm run dev             # Dev server (port 5173)
npm test                # Run Vitest
npm run test:ui         # Vitest UI
npm run lint            # ESLint check
npm run lint:fix        # ESLint auto-fix
npm run format          # Prettier format
npm run type-check      # TypeScript check (no emit)
```

**Running single tests (Vitest):**
```bash
npm test -- VotingPage                           # Match pattern
npm test -- tests/components/VotingPage.test.tsx # Specific file
npm test -- -t "should render"                   # Match test name
```

## Code Style Guidelines

### Formatting (Prettier)

- Semicolons: required
- Quotes: single quotes, JSX single quotes
- Trailing commas: ES5
- Print width: 80
- Tab width: 2 (spaces, not tabs)
- Arrow parens: avoid when possible

### TypeScript

- **Backend:** strict mode, explicit return types required
- **Frontend:** relaxed strict, return types optional
- Use interfaces for objects, type aliases for unions
- Avoid `any`, prefer `unknown` for truly unknown types
- Use path aliases (`@/`) for imports

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files (services) | `*.service.ts` | `poll.service.ts` |
| Files (controllers) | `*.controller.ts` | `poll.controller.ts` |
| Files (routes) | `*.routes.ts` | `poll.routes.ts` |
| Files (types) | `*.types.ts` | `poll.types.ts` |
| Files (React) | PascalCase.tsx | `VotingPage.tsx` |
| Files (hooks) | `use*.ts` | `usePolls.ts` |
| Files (tests) | `*.test.ts(x)` | `poll.service.test.ts` |
| Classes | PascalCase | `PollService` |
| Functions | camelCase | `createPoll` |
| Interfaces/Types | PascalCase | `CreatePollData` |
| Constants | SCREAMING_SNAKE | `CACHE_TTL` |
| DB columns | snake_case via `@map()` | `first_name` |

### Import Order

1. External libraries (node_modules)
2. Internal modules with path aliases (`@/`)
3. Relative imports

```typescript
// External
import { Request, Response } from 'express';
import { Poll, Vote } from '@prisma/client';

// Internal aliases
import { prisma } from '@/database/client';
import { logger } from '@/utils/logger';
import { CreatePollData } from '@/types/poll.types';

// Relative
import { GroupService } from './group.service';
```

### Error Handling

**Backend Services:**
```typescript
static async createPoll(data: CreatePollData): Promise<Poll> {
  try {
    const poll = await prisma.poll.create({ data });
    logger.info(`Poll created: ${poll.id}`);
    return poll;
  } catch (error) {
    logger.error('Error creating poll:', error);
    throw new Error('Failed to create poll');
  }
}
```

**Backend Controllers:**
```typescript
static async getPolls(req: Request, res: Response): Promise<void> {
  try {
    const polls = await PollService.getActivePolls();
    res.json({ success: true, data: polls, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Error getting polls:', error);
    res.status(500).json({ success: false, error: 'Failed to get polls', code: 'INTERNAL_ERROR' });
  }
}
```

**Frontend (React Query):**
```typescript
const response = await pollsService.getActivePolls();
if (!response.success) {
  throw new Error(response.error || 'Failed to fetch polls');
}
return response.data;
```

### Type Patterns

**API Responses:**
```typescript
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
}
```

**DTOs:**
```typescript
export interface CreatePollData {
  groupId: number;
  duration: number;
  createdBy: number;
  title?: string;
}
```

### React Patterns

**Components:**
```typescript
export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive';
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', onClick }) => {
  // ...
};
```

**Hooks:**
```typescript
export function useActivePolls(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.polls.active(),
    queryFn: async () => { /* ... */ },
    enabled: options?.enabled ?? true,
  });
}
```

## Critical Rules

1. **Logger over console**: Use `logger.info/error/warn()`, never `console.log` in production code
2. **Prisma only**: Never use raw SQL, always use Prisma ORM
3. **BigInt serialization**: Use `serializeBigInt()` helper for JSON responses
4. **CSS**: Tailwind with `cn()` utility for class merging
5. **Service pattern**: Static methods in class-based services
6. **Never cache polls**: Always fetch fresh to avoid stale data
7. **Branch**: Project is on `feature/new_version` branch, NOT main

## Test File Locations

- **Backend:** `src/__tests__/` and `src/services/__tests__/`
- **Frontend:** `tests/` directory
- **Coverage threshold:** 70% minimum

## Key Entry Points

- Backend entry: `backend/src/index.ts`
- API routes: `backend/src/api/server.ts`
- Bot setup: `backend/src/bot/bot.ts`
- Frontend entry: `frontend/src/main.tsx`
- App router: `frontend/src/App.tsx`

## Path Aliases

**Backend:** `@/` -> `src/`, plus `@/bot/*`, `@/api/*`, `@/services/*`, `@/utils/*`, `@/types/*`
**Frontend:** `@/` -> `src/`, plus `@/components/*`, `@/pages/*`, `@/hooks/*`, `@/services/*`
