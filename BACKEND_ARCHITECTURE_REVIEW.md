# Backend Architecture Review: Telegram Food Bot

**Date:** 2025-01-XX  
**Project:** Telegram Food Bot  
**Backend Stack:** Node.js 18 + TypeScript + Grammy + Express + Prisma ORM + SQLite  
**Status:** Production Ready (v2.0.0)

---

## Executive Summary

The backend demonstrates **solid architectural foundations** with clear separation of concerns, comprehensive error handling, and production-ready features. However, **scaling limitations** exist due to stateful service design, in-memory job scheduling, and tight bot-service coupling. The architecture is optimized for single-instance deployment but requires significant refactoring for horizontal scaling.

**Overall Grade:** B+ (Production-ready for single instance, needs refactoring for multi-instance scaling)

---

## 1. Architectural Layers & Responsibilities

### 1.1 Layer Mapping

```
telegram-food-bot/backend/src/
├── index.ts                    # Application entry point, initialization orchestration
├── api/                        # REST API layer (Express)
│   ├── controllers/            # Request handlers (thin, delegate to services)
│   ├── routes/                 # Route definitions with middleware
│   ├── middleware/             # Auth, CORS, validation, error handling
│   └── server.ts              # Express app configuration
├── bot/                        # Telegram Bot layer (Grammy)
│   ├── commands/              # Bot command handlers (/start, /vote, etc.)
│   ├── handlers/              # Callback query handlers
│   ├── keyboards/             # Inline/reply keyboard builders
│   ├── middleware/            # Bot-specific middleware (auth, logging)
│   ├── events/                # Group event handlers (member join/leave)
│   └── bot.ts                # Bot initialization & configuration
├── services/                   # Business logic layer (core domain logic)
│   ├── poll.service.ts        # Poll CRUD, state transitions
│   ├── vote.service.ts        # Voting logic, validation
│   ├── menu.service.ts        # Menu management
│   ├── user.service.ts        # User management
│   ├── group.service.ts       # Group management
│   ├── notification.service.ts # Push notifications via Telegram API
│   ├── responsible.service.ts  # Roulette/volunteer selection
│   ├── budget.service.ts      # Budget tracking, transactions
│   ├── cache.service.ts       # Redis caching layer
│   ├── poll-reminder.service.ts # Scheduled reminders (timer-based)
│   └── poll.service.extensions.ts # Bot-specific poll operations
├── database/                   # Data access layer
│   ├── client.ts              # Prisma singleton with connection management
│   └── seeders/               # Database seeders
├── config/                     # Configuration modules
│   ├── api.config.ts          # API server config (ports, CORS, security)
│   ├── bot.config.ts          # Bot config (token, webhook, polling)
│   ├── redis.config.ts        # Redis connection config
│   ├── sentry.config.ts       # Error monitoring config
│   └── features.ts            # Feature flags
├── types/                      # TypeScript type definitions
│   ├── api.types.ts           # API request/response types
│   ├── bot.types.ts           # Bot context & session types
│   └── poll.types.ts          # Poll domain types
└── utils/                      # Shared utilities
    ├── logger.ts              # Winston logger configuration
    ├── error.ts               # Custom error classes & handlers
    └── crypto.ts              # Encryption utilities
```

---

## 2. Architectural Patterns & Quality

### 2.1 ✅ **Strengths**

#### **A. Separation of Concerns**
- **Clear layering**: API controllers delegate to services, services use data access via Prisma
- **Thin controllers**: Controllers focus on HTTP concerns (validation, serialization), business logic in services
- **Example**: `PollController.createPoll()` → `createPollFromWebApp()` → `PollService.createPoll()`

#### **B. Service Layer Pattern**
- Stateless service classes with static methods
- Encapsulated business logic (e.g., `VoteService.castVote()` validates vote, checks duplicates, saves)
- Services reused across API and bot layers

#### **C. Configuration Management**
- Environment-driven with validation at startup (`validateApiConfig()`, `validateConfig()`)
- Comprehensive config objects (`apiConfig`, `botConfig`) with sensible defaults
- Validation errors prevent app startup with misconfiguration

#### **D. Caching Strategy**
- Redis-based caching with structured keys (`CACHE_KEYS.*`)
- Cache-aside pattern (`getOrSet()`) for transparent caching
- Cache invalidation patterns (`CacheInvalidator.invalidatePoll()`)
- TTL-based expiration per data type

#### **E. Error Handling**
- Centralized error handler middleware (`errorHandler`)
- Custom error classes for domain-specific errors
- Comprehensive logging with Winston (structured logs)
- Sentry integration for production monitoring

#### **F. Database Access**
- Singleton Prisma client prevents connection leaks
- Global instance in dev for hot reload compatibility
- Query logging in development, error logging in production
- Graceful disconnect on SIGINT/SIGTERM

#### **G. Security Practices**
- Helmet middleware for HTTP headers
- CORS configuration with origin whitelist
- Telegram initData validation via HMAC-SHA256
- JWT-based authentication for API

---

### 2.2 ⚠️ **Weaknesses & Concerns**

#### **A. Bot-Service Coupling (CRITICAL)**

**Issue**: Services hold bot instances via module-level variables
```typescript
// services/poll.service.extensions.ts
let botInstance: any = null;
export function initializePollServiceBot(bot: any): void {
  botInstance = bot;
}
```

**Problems:**
- Tight coupling: Services depend on bot implementation details
- Testing difficulty: Mocking bot requires global state manipulation
- Type safety: `any` type bypasses TypeScript checks
- Hidden dependency: Bot must be initialized before service usage

**Impact**: High - Makes unit testing difficult, violates dependency inversion principle

**Recommendation**: Implement dependency injection pattern (see Section 4.1)

---

#### **B. Stateful Service Design (CRITICAL for scaling)**

**Issue**: `PollReminderService` maintains in-memory Map of timers
```typescript
export class PollReminderService {
  private static reminders = new Map<number, ScheduledReminder>();
  // ...
  static scheduleReminders(pollId, duration, chatId) {
    const timerId = setTimeout(...);
    this.reminders.set(pollId, { timerId });
  }
}
```

**Problems:**
- Lost on restart: Timers cleared if process crashes
- Not horizontally scalable: Can't run multiple API instances
- No persistence: No way to recover scheduled jobs
- Memory leaks: Member count cache in `poll.service.ts` never cleaned

**Impact**: High - Prevents horizontal scaling, job loss on restart

**Recommendation**: Replace with job queue (Bull/BullMQ) backed by Redis (see Section 4.2)

---

#### **C. Database Connection Pooling**

**Issue**: Prisma client created without explicit pool configuration
```typescript
const prisma = new PrismaClient({
  log: [...],
  // No connectionLimit, poolTimeout, etc.
});
```

**Problems:**
- Relies on Prisma defaults (typically 10 connections)
- No tuning for expected load
- No connection timeout configuration
- SQLite has limited concurrency (single-writer)

**Impact**: Medium - Could bottleneck under high load

**Recommendation**: 
```typescript
// For PostgreSQL migration:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  connectionLimit = 20
  poolTimeout = 20
}
```

---

#### **D. Mixed Concerns in Extensions**

**Issue**: `poll.service.extensions.ts` mixes business logic and presentation
```typescript
function createPollNotificationMessage(data: {...}): string {
  let message = `🗳️ **${title}**\n\n`;
  // Message formatting logic
}

export async function createPollFromWebApp(params: {...}) {
  // Business logic: create poll in DB
  const poll = await PollService.createPoll(...);
  
  // Presentation logic: format message
  const message = createPollNotificationMessage(...);
  
  // Bot interaction: send message
  await botInstance.api.sendMessage(...);
}
```

**Problems:**
- Violates SRP: Function handles DB, formatting, and messaging
- Hard to test: Can't test DB logic without mocking bot
- Difficult to reuse: Formatting coupled to this specific flow

**Impact**: Medium - Reduces maintainability, increases test complexity

**Recommendation**: Extract message formatting to `bot/keyboards/` or `bot/messages/` module

---

#### **E. Global Prototype Pollution**

**Issue**: BigInt serialization via prototype modification
```typescript
// api/server.ts:30
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};
```

**Problems:**
- Global side effect: Affects all code, including dependencies
- Can break libraries expecting BigInt behavior
- Hard to debug: Non-obvious source of serialization changes
- Testing issues: Global state shared across tests

**Impact**: Low-Medium - Rarely causes issues but violates best practices

**Recommendation**: Use custom serializer function instead (already exists in codebase as `serializeBigInt()`)

---

#### **F. Initialization Order Dependency**

**Issue**: Services must be initialized in specific order
```typescript
// index.ts
const bot = createBot();  // Creates bot
initializePollServiceBot(bot);  // Must happen before poll operations
feedbackService.initialize(bot);  // Must happen before feedback
```

**Problems:**
- Fragile: Easy to forget initialization steps
- No compile-time checks: Runtime errors if order wrong
- Hidden dependencies: Not clear from service API what's required

**Impact**: Medium - Causes runtime errors during refactoring

**Recommendation**: Use dependency injection container or factory pattern

---

#### **G. Webhook Registration in Index**

**Issue**: Webhook route registered in `index.ts` instead of routes file
```typescript
// index.ts:70
app.post('/webhook', async (req, res) => {
  await bot.handleUpdate(req.body);
  res.sendStatus(200);
});
```

**Problems:**
- Mixed concerns: Entry point handles routing
- Inconsistent: Other routes in `api/routes/`
- Harder to test: Route logic not in testable module

**Impact**: Low - Functional but inconsistent

**Recommendation**: Move to `api/routes/webhook.routes.ts`

---

## 3. Scaling Risks & Performance

### 3.1 **Horizontal Scaling Blockers**

| Component | Issue | Impact | Mitigation |
|-----------|-------|--------|------------|
| **PollReminderService** | In-memory timers | Critical | Replace with Redis-backed job queue |
| **Bot Instance** | Singleton per process | High | Use bot API proxy or webhook mode |
| **Member Count Cache** | In-memory Map | Medium | Move to Redis with TTL |
| **File Uploads** | Local filesystem | Medium | Use S3/object storage |

### 3.2 **Database Concerns**

**SQLite Limitations:**
- Single-writer concurrency model
- No connection pooling benefits
- File locking contention under load
- Not suitable for distributed deployment

**Recommendation**: Migrate to PostgreSQL for production scaling (documentation already mentions this)

### 3.3 **Long-Running Operations**

**Current Approach:**
```typescript
setTimeout(async () => {
  await autoCompletePoll(pollId, chatId, messageId);
}, duration * 60 * 1000);
```

**Risks:**
- Lost on process restart
- No retry mechanism
- No visibility into pending jobs
- No prioritization/scheduling

**Better Approach**: Job queue with persistence, retries, and monitoring

---

## 4. Dependency Direction Analysis

### 4.1 **Current Dependencies**

```
┌─────────────────────────────────────────────┐
│  index.ts (Entry Point)                      │
│  - Creates bot, API server                   │
│  - Initializes services with bot instance    │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌─────────────┐  ┌─────────────┐
│   bot.ts    │  │  server.ts  │
│  (Grammy)   │  │  (Express)  │
└──────┬──────┘  └──────┬──────┘
       │                │
       │         ┌──────┴──────┐
       │         ▼             ▼
       │   ┌────────────┐  ┌────────────┐
       │   │Controllers │  │   Routes   │
       │   └─────┬──────┘  └─────┬──────┘
       │         │               │
       └─────────┴───────┬───────┘
                         ▼
                  ┌──────────────┐
                  │   Services   │ ◄─── Holds bot instances
                  │              │      (BAD: cyclic dependency)
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │   Database   │
                  │   (Prisma)   │
                  └──────────────┘
```

**Problem**: Services depend on bot, but bot initializes services → circular dependency

### 4.2 **Recommended Dependencies**

```
┌─────────────────────────────────────────────┐
│  index.ts (Composition Root)                 │
│  - Creates dependencies                      │
│  - Wires up DI container                     │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌─────────────┐  ┌─────────────┐
│   bot.ts    │  │  server.ts  │
└──────┬──────┘  └──────┬──────┘
       │                │
       │         ┌──────┴──────┐
       │         ▼             ▼
       │   ┌────────────┐  ┌────────────┐
       │   │Controllers │  │   Routes   │
       │   └─────┬──────┘  └─────┬──────┘
       │         │               │
       └─────────┴───────┬───────┘
                         ▼
                  ┌──────────────┐
                  │   Services   │ ◄─── Accept bot as parameter
                  │              │      (GOOD: dependency injection)
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │   Database   │
                  └──────────────┘
```

**Benefits**: Services testable in isolation, no global state, clear dependencies

---

## 5. Documentation Drift

### 5.1 **Architecture vs Implementation**

| Documentation States | Actual Implementation | Impact |
|---------------------|----------------------|--------|
| PostgreSQL database | SQLite in dev | Medium - Plan exists to migrate |
| Webhook preferred | Defaults to polling | Low - Both work |
| Redis required | Optional with fallback | Low - Documented in code comments |
| Multi-instance ready | Stateful services | High - Not scalable as documented |

### 5.2 **Missing Documentation**

- **Service initialization order** not documented
- **Bot-service coupling** pattern not explained
- **Cache fallback behavior** not in architecture docs
- **Scaling limitations** not clearly stated
- **Job scheduling** approach not documented

---

## 6. Targeted Recommendations (Prioritized by Impact)

### 6.1 **CRITICAL (Production Blocker for Multi-Instance)**

#### **Priority 1: Implement Job Queue for Scheduled Tasks**

**Replace:** `PollReminderService` in-memory timers  
**With:** Bull/BullMQ backed by Redis

```typescript
// services/job-queue.service.ts
import Bull from 'bull';

const pollCompletionQueue = new Bull('poll-completion', {
  redis: redisConfig
});

pollCompletionQueue.process(async (job) => {
  const { pollId, chatId, messageId } = job.data;
  await autoCompletePoll(pollId, chatId, messageId);
});

// Schedule job
export function schedulePollCompletion(pollId, duration, chatId, messageId) {
  pollCompletionQueue.add(
    { pollId, chatId, messageId },
    { delay: duration * 60 * 1000, attempts: 3 }
  );
}
```

**Benefits:**
- Survives restarts
- Horizontally scalable
- Built-in retry logic
- Job monitoring dashboard

**Effort:** 2-3 days  
**Impact:** Enables horizontal scaling

---

#### **Priority 2: Implement Dependency Injection for Bot**

**Replace:** Module-level bot instances  
**With:** Constructor injection or factory pattern

```typescript
// services/poll.service.extensions.ts
export class PollNotificationService {
  constructor(private bot: Bot<BotContext>) {}
  
  async createPollFromWebApp(params: CreatePollParams) {
    // Use this.bot instead of global botInstance
    await this.bot.api.sendMessage(...);
  }
}

// index.ts
const bot = createBot();
const pollNotificationService = new PollNotificationService(bot);
```

**Benefits:**
- Testable in isolation
- Clear dependencies
- Type-safe
- No global state

**Effort:** 3-4 days (refactor multiple services)  
**Impact:** Improves testability, maintainability

---

### 6.2 **HIGH (Production Risk Mitigation)**

#### **Priority 3: Add Database Connection Pool Configuration**

```typescript
// config/database.config.ts
export const databaseConfig = {
  poolMin: parseInt(process.env.DB_POOL_MIN || '2'),
  poolMax: parseInt(process.env.DB_POOL_MAX || '10'),
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
};

// Migrate to PostgreSQL for production
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Effort:** 1-2 days (including migration testing)  
**Impact:** Prevents connection exhaustion under load

---

#### **Priority 4: Implement Rate Limiting**

**Current:** Configuration exists but not enforced

```typescript
// api/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';

export const apiRateLimiter = rateLimit({
  windowMs: apiConfig.security.rateLimitWindowMs,
  max: apiConfig.security.rateLimitMax,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// api/server.ts
app.use('/api', apiRateLimiter);
```

**Effort:** 1 day  
**Impact:** Prevents abuse, protects against DoS

---

### 6.3 **MEDIUM (Code Quality Improvements)**

#### **Priority 5: Extract Message Formatting from Business Logic**

```typescript
// bot/messages/poll-messages.ts
export class PollMessageBuilder {
  static createNotification(poll: Poll, menuItems: MenuItem[]): string {
    return `🗳️ **${poll.title}**\n\n` +
           `⏰ Время: ${poll.duration} мин\n` +
           `🍽️ Блюд: ${menuItems.length}`;
  }
}

// services/poll.service.extensions.ts
export class PollNotificationService {
  async createPollFromWebApp(params: CreatePollParams) {
    const poll = await PollService.createPoll(params);
    const message = PollMessageBuilder.createNotification(poll, params.menuItems);
    await this.bot.api.sendMessage(chatId, message);
  }
}
```

**Effort:** 2 days  
**Impact:** Improves testability, reusability

---

#### **Priority 6: Remove Global BigInt Prototype Pollution**

```typescript
// api/server.ts
// REMOVE: (BigInt.prototype as any).toJSON = function() {...}

// api/middleware/json-serializer.ts
export function jsonSerializer(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  res.json = function(data: any) {
    return originalJson(serializeBigInt(data));
  };
  next();
}

// Apply to all routes
app.use(jsonSerializer);
```

**Effort:** 1 day  
**Impact:** Eliminates global side effects

---

#### **Priority 7: Clean Up Member Count Cache**

```typescript
// services/poll.service.ts
const memberCountCache = new Map<number, {
  count: number;
  timestamp: number;
}>();

// Add periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memberCountCache.entries()) {
    if (now - value.timestamp > MEMBER_COUNT_CACHE_TTL) {
      memberCountCache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Clean every hour
```

**Or better: Move to Redis cache**

**Effort:** 1 day  
**Impact:** Prevents memory leaks

---

### 6.4 **LOW (Nice to Have)**

#### **Priority 8: Consolidate Webhook Route**

Move webhook route from `index.ts` to `api/routes/webhook.routes.ts`

**Effort:** 1 hour  
**Impact:** Consistency, testability

---

## 7. Architectural Strengths to Preserve

1. ✅ **Service layer abstraction** - Keep business logic in services
2. ✅ **Configuration management** - Environment-driven with validation
3. ✅ **Error handling patterns** - Centralized, comprehensive logging
4. ✅ **Caching strategy** - Redis-based with cache invalidation
5. ✅ **Prisma ORM usage** - Type-safe, migration-based
6. ✅ **Graceful shutdown** - Proper cleanup on SIGINT/SIGTERM
7. ✅ **Security practices** - Helmet, CORS, Telegram auth validation

---

## 8. Summary & Action Plan

### 8.1 **Current State**
- ✅ Production-ready for **single-instance deployment**
- ✅ Comprehensive feature set with good error handling
- ⚠️ **Cannot scale horizontally** without refactoring
- ⚠️ Job loss risk on restart (timers not persisted)

### 8.2 **Immediate Actions (Week 1-2)**
1. Implement job queue for poll completion (Priority 1)
2. Add database connection pool configuration (Priority 3)
3. Implement rate limiting (Priority 4)

### 8.3 **Short-Term (Month 1)**
4. Refactor bot-service coupling with DI (Priority 2)
5. Extract message formatting logic (Priority 5)
6. Remove BigInt prototype pollution (Priority 6)

### 8.4 **Long-Term (Month 2-3)**
7. Migrate to PostgreSQL for production
8. Implement multi-instance deployment with Redis
9. Add comprehensive integration tests
10. Update architecture documentation with scaling patterns

---

## 9. Conclusion

The backend demonstrates **strong engineering practices** with clear separation of concerns, comprehensive error handling, and production-ready features. However, the architecture is optimized for **single-instance deployment** and requires refactoring for horizontal scaling.

**Key Takeaway**: The codebase is ready for production launch but should prioritize job queue implementation and dependency injection refactoring before scaling beyond a single instance.

**Recommended Next Steps:**
1. Deploy to production as single instance (safe)
2. Implement Priority 1-4 recommendations
3. Test multi-instance deployment with load testing
4. Migrate to PostgreSQL and complete scaling refactor

**Estimated Refactoring Effort:** 2-3 weeks for full horizontal scaling readiness

---

**Reviewer Notes:**
- Architecture is well-documented in code comments
- Code quality is high with consistent patterns
- Some technical debt exists but is manageable
- Team clearly understands trade-offs made for MVP speed
