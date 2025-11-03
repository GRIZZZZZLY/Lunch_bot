# ✅ Audit Action Checklist - Developer Guide

**Project:** Telegram Food Bot v2.0  
**Date:** January 2025  
**Purpose:** Step-by-step remediation of audit findings  
**Reference:** `COMPREHENSIVE_AUDIT_REPORT.md`

---

## 🔴 PHASE 0: PRODUCTION BLOCKERS (8-12 hours)

**Status:** ❌ NOT STARTED  
**Priority:** P0 - MUST COMPLETE BEFORE PRODUCTION  
**Estimated Time:** 8-12 hours

### Task 1: Implement JWT Authentication (3-4 hours) 🔴

**Current Issue:** Base64 tokens can be easily forged  
**Files Affected:** `backend/src/api/middleware/telegram-auth.ts`

#### Steps:

- [ ] **1.1 Install Dependencies**
  ```bash
  cd telegram-food-bot/backend
  npm install jsonwebtoken @types/jsonwebtoken
  ```

- [ ] **1.2 Create JWT Service**
  ```bash
  # Create new file: backend/src/services/jwt.service.ts
  ```
  
  **Template:**
  ```typescript
  import jwt from 'jsonwebtoken';
  import { logger } from '../utils/logger';
  
  interface JWTPayload {
    userId: number;
    telegramId: bigint;
    isAdmin: boolean;
  }
  
  export class JWTService {
    private static readonly SECRET = process.env.JWT_SECRET!;
    private static readonly EXPIRES_IN = '7d';
    private static readonly ISSUER = 'telegram-food-bot';
  
    static sign(payload: JWTPayload): string {
      return jwt.sign(
        { ...payload, telegramId: payload.telegramId.toString() },
        this.SECRET,
        { expiresIn: this.EXPIRES_IN, issuer: this.ISSUER }
      );
    }
  
    static verify(token: string): JWTPayload {
      const decoded = jwt.verify(token, this.SECRET, {
        issuer: this.ISSUER,
      }) as any;
      
      return {
        userId: decoded.userId,
        telegramId: BigInt(decoded.telegramId),
        isAdmin: decoded.isAdmin,
      };
    }
  }
  ```

- [ ] **1.3 Update telegram-auth.ts**
  
  **Replace this:**
  ```typescript
  // Line ~45
  const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
  ```
  
  **With this:**
  ```typescript
  import { JWTService } from '../../services/jwt.service';
  
  // Line ~45
  try {
    const decoded = JWTService.verify(token);
  } catch (error) {
    logger.error('Invalid JWT token:', error);
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }
  ```

- [ ] **1.4 Update Token Generation**
  
  **File:** `backend/src/api/controllers/auth.controller.ts`
  
  **Replace:**
  ```typescript
  const token = Buffer.from(JSON.stringify({ userId }), 'base64').toString();
  ```
  
  **With:**
  ```typescript
  import { JWTService } from '../../services/jwt.service';
  
  const token = JWTService.sign({
    userId: user.id,
    telegramId: user.telegramId,
    isAdmin: user.isAdmin,
  });
  ```

- [ ] **1.5 Test JWT Implementation**
  ```bash
  npm test -- auth.routes.test.ts
  ```

- [ ] **1.6 Update Frontend (if needed)**
  ```typescript
  // frontend/src/services/api.ts
  // Token handling should remain the same (stored in localStorage)
  // Just ensure error handling for 401 responses
  ```

**Verification:**
- [ ] All auth tests pass
- [ ] Can log in via Telegram
- [ ] Token expires after 7 days
- [ ] Invalid tokens rejected with 401

---

### Task 2: Fix TypeScript Errors (2-3 hours) 🔴

**Current Issue:** 65+ TypeScript compilation errors  
**Files Affected:** Multiple frontend and backend files

#### Steps:

- [ ] **2.1 Fix User Service Test Mocks**
  
  **File:** `backend/src/__tests__/unit/services/user.service.test.ts`
  
  **Add missing fields to all mock users:**
  ```typescript
  const createMockUser = (overrides?: Partial<User>): User => ({
    id: 1,
    telegramId: BigInt(123456789),
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    photoUrl: null,        // ADD THIS
    avatarUrl: null,       // ADD THIS
    avatarUpdatedAt: null, // ADD THIS
    isAdmin: false,
    isActive: true,
    paymentCard: null,
    paymentPhone: null,
    paymentDetails: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  ```
  
  **Apply to lines:** 30, 305, 319, 333, 422, 482, 576

- [ ] **2.2 Install Missing React Window**
  ```bash
  cd telegram-food-bot/frontend
  npm install react-window @types/react-window
  ```

- [ ] **2.3 Fix usePolls Hook**
  
  **File:** `frontend/src/hooks/usePolls.ts`
  
  **Add missing export:**
  ```typescript
  export { usePolls, useNotification }; // Ensure both exported
  ```

- [ ] **2.4 Fix MenuItemCard Types**
  
  **File:** `frontend/src/components/menu/MenuItemCard.tsx`
  
  **Review and fix prop types to match MenuItem interface**

- [ ] **2.5 Remove/Fix QuickRepeatButton**
  
  **File:** `frontend/src/components/polls/QuickRepeatButton.tsx`
  
  **If useLastVote doesn't exist:**
  ```typescript
  // Option A: Create the hook
  // Option B: Remove the component if unused
  // Option C: Use alternative data source
  ```

- [ ] **2.6 Run Full Type Check**
  ```bash
  # Backend
  cd telegram-food-bot/backend
  npm run type-check || npx tsc --noEmit
  
  # Frontend
  cd telegram-food-bot/frontend
  npm run type-check
  ```

**Verification:**
- [ ] Backend: 0 TypeScript errors
- [ ] Frontend: 0 TypeScript errors
- [ ] All imports resolve
- [ ] npm run build succeeds (both)

---

### Task 3: Add Rate Limiting (1 hour) 🔴

**Current Issue:** No protection against brute-force or DDoS attacks

#### Steps:

- [ ] **3.1 Install express-rate-limit**
  ```bash
  cd telegram-food-bot/backend
  npm install express-rate-limit
  ```

- [ ] **3.2 Create Rate Limit Middleware**
  
  **File:** `backend/src/api/middleware/rate-limit.ts`
  
  ```typescript
  import rateLimit from 'express-rate-limit';
  import { logger } from '../../utils/logger';
  
  // Strict rate limit for auth endpoints
  export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded: ${req.ip} on ${req.path}`);
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: res.get('Retry-After'),
      });
    },
  });
  
  // General API rate limit
  export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'Too many requests, please slow down',
    standardHeaders: true,
    legacyHeaders: false,
  });
  ```

- [ ] **3.3 Apply Rate Limiters**
  
  **File:** `backend/src/api/server.ts` or `backend/src/index.ts`
  
  ```typescript
  import { authLimiter, apiLimiter } from './middleware/rate-limit';
  
  // Apply to specific routes
  app.use('/api/auth/', authLimiter);
  app.use('/api/', apiLimiter);
  ```

- [ ] **3.4 Test Rate Limiting**
  ```bash
  # Manual test with curl
  for i in {1..15}; do
    curl http://localhost:3001/api/auth/validate -X POST
  done
  # Should get 429 after 10 requests
  ```

**Verification:**
- [ ] Auth endpoints limited to 10 req/15min
- [ ] API endpoints limited to 60 req/min
- [ ] 429 response with Retry-After header
- [ ] Rate limit logs working

---

### Task 4: Generate Strong JWT_SECRET (5 minutes) 🔴

**Current Issue:** Weak predictable secret

#### Steps:

- [ ] **4.1 Generate Strong Secret**
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```

- [ ] **4.2 Update .env**
  
  **File:** `backend/.env`
  
  **Replace:**
  ```env
  JWT_SECRET=dev_jwt_secret_change_in_production
  ```
  
  **With:**
  ```env
  JWT_SECRET=<generated_64_character_hex_string>
  ```

- [ ] **4.3 Update .env.example**
  
  **File:** `backend/.env.example`
  
  ```env
  # JWT Secret (MUST be changed in production!)
  # Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  JWT_SECRET=your_secret_here_generate_with_command_above
  ```

- [ ] **4.4 Update Production .env**
  
  **File:** Server's `.env` file
  
  - Generate NEW secret (different from dev)
  - Update on production server
  - Restart services

**Verification:**
- [ ] Development uses new strong secret
- [ ] Production uses different strong secret
- [ ] Secrets are 128+ characters (hex)
- [ ] .env.example has clear instructions

---

### Task 5: Add Production Validation Check (30 minutes) 🔴

**Current Issue:** SKIP_TELEGRAM_VALIDATION could be enabled in production

#### Steps:

- [ ] **5.1 Add Safety Check**
  
  **File:** `backend/src/api/middleware/telegram-auth.ts`
  
  **Add at the top of validation function:**
  ```typescript
  export const validateTelegramAuth = async (req, res, next) => {
    // SAFETY CHECK: Never skip validation in production
    if (process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
      if (process.env.NODE_ENV === 'production') {
        logger.error('🚨 CRITICAL: SKIP_TELEGRAM_VALIDATION enabled in production!');
        throw new Error('Cannot run in production with validation disabled');
      }
      logger.warn('⚠️  Telegram validation is DISABLED (development only)');
      // Continue with dev bypass...
    }
    
    // Normal validation logic...
  };
  ```

- [ ] **5.2 Add Environment Validation on Startup**
  
  **File:** `backend/src/index.ts` or `backend/src/config/env.ts`
  
  ```typescript
  // Validate critical environment variables on startup
  function validateEnvironment() {
    if (process.env.NODE_ENV === 'production') {
      // Check for development flags
      if (process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
        throw new Error('Cannot start: SKIP_TELEGRAM_VALIDATION enabled in production');
      }
      
      // Check for weak secrets
      if (process.env.JWT_SECRET?.includes('dev') || 
          process.env.JWT_SECRET?.includes('change')) {
        throw new Error('Cannot start: JWT_SECRET appears to be a development value');
      }
      
      // Check for required variables
      const required = ['JWT_SECRET', 'TELEGRAM_BOT_TOKEN', 'DATABASE_URL'];
      for (const key of required) {
        if (!process.env[key]) {
          throw new Error(`Missing required environment variable: ${key}`);
        }
      }
    }
  }
  
  // Call on startup
  validateEnvironment();
  ```

- [ ] **5.3 Update Deployment Checklist**
  
  **File:** `telegram-food-bot/PRODUCTION_READINESS_CHECKLIST.md`
  
  - [ ] Add validation check to pre-deploy section
  - [ ] Document environment variables requirements

- [ ] **5.4 Add CI Check**
  
  **File:** `.github/workflows/ci.yml` (if exists)
  
  ```yaml
  - name: Validate Production Config
    run: |
      if grep -q "SKIP_TELEGRAM_VALIDATION=true" .env.production; then
        echo "ERROR: Validation disabled in production config"
        exit 1
      fi
  ```

**Verification:**
- [ ] Server crashes if validation skipped in production
- [ ] Server crashes if weak JWT_SECRET in production
- [ ] Clear error messages
- [ ] Development still works with validation skipped

---

### Task 6: Fix Failing Auth Tests (2 hours) 🔴

**Current Issue:** 5 integration tests failing

#### Steps:

- [ ] **6.1 Review Test Failures**
  ```bash
  cd telegram-food-bot/backend
  npm test -- auth.routes.test.ts --verbose
  ```

- [ ] **6.2 Fix Missing initData Validation**
  
  **File:** `backend/src/api/controllers/auth.controller.ts`
  
  **Ensure validation:**
  ```typescript
  export const validateAuth = async (req, res) => {
    const { initData } = req.body;
    
    // Should return 400 if initData missing
    if (!initData) {
      return res.status(400).json({
        success: false,
        error: 'initData is required',
      });
    }
    
    // Continue with validation...
  };
  ```

- [ ] **6.3 Fix Test Environment Setup**
  
  **File:** `backend/src/__tests__/integration/api/auth.routes.test.ts`
  
  **Ensure SKIP_TELEGRAM_VALIDATION doesn't affect validation logic:**
  ```typescript
  beforeAll(() => {
    // Ensure validation is properly mocked for tests
    process.env.SKIP_TELEGRAM_VALIDATION = 'false';
  });
  ```

- [ ] **6.4 Update Tests for JWT**
  
  **If tests expect Base64 tokens, update to expect JWT:**
  ```typescript
  // Before
  expect(response.body.token).toMatch(/^[A-Za-z0-9+/=]+$/);
  
  // After (JWT pattern)
  expect(response.body.token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
  ```

- [ ] **6.5 Run Full Test Suite**
  ```bash
  npm test
  ```

**Verification:**
- [ ] All 202 tests passing
- [ ] Auth tests verify 400 for missing initData
- [ ] Auth tests verify 401 for invalid tokens
- [ ] JWT token format validated

---

## 🎯 Phase 0 Completion Checklist

### Before Marking Complete:

- [ ] All 6 tasks above completed
- [ ] **0 TypeScript errors** (backend + frontend)
- [ ] **202/202 tests passing** (was 197/202)
- [ ] **JWT authentication** implemented and tested
- [ ] **Rate limiting** enabled and tested
- [ ] **Strong JWT_SECRET** generated and set
- [ ] **Production validation check** added
- [ ] All changes committed to git
- [ ] Updated documentation (if needed)

### Testing Checklist:

- [ ] **Manual Testing:**
  - [ ] Can log in via Telegram
  - [ ] Invalid tokens rejected
  - [ ] Rate limiting works (429 after limit)
  - [ ] Production safeguards trigger correctly

- [ ] **Automated Testing:**
  - [ ] `npm test` passes (backend)
  - [ ] `npm test` passes (frontend)
  - [ ] `npm run type-check` passes (both)
  - [ ] `npm run build` succeeds (both)

- [ ] **Security Testing:**
  - [ ] Try to use old Base64 token (should fail)
  - [ ] Try to forge JWT (should fail)
  - [ ] Try to exceed rate limits (should 429)
  - [ ] Try to start production with SKIP_TELEGRAM_VALIDATION (should crash)

### Deployment Preparation:

- [ ] Environment variables documented
- [ ] Production .env prepared (with strong secrets)
- [ ] Deployment checklist updated
- [ ] Staging environment tested
- [ ] Rollback plan ready

---

## 🟠 PHASE 1: PRE-PRODUCTION HARDENING (1-2 days)

**Status:** ⏳ PENDING (start after Phase 0)  
**Priority:** P1 - STRONGLY RECOMMENDED  
**Estimated Time:** 1-2 days

### Quick Task List:

- [ ] **Task 7:** Add Sentry (backend) - 1 hour
- [ ] **Task 8:** Add Sentry (frontend) - 1 hour
- [ ] **Task 9:** Implement CSP headers - 1 hour
- [ ] **Task 10:** Add token expiration/refresh - 3 hours
- [ ] **Task 11:** Simplify navigation (5→3 tabs) - 4 hours
- [ ] **Task 12:** Remove duplicate VotingPage - 3 hours
- [ ] **Task 13:** Add "Repeat Poll" button - 2 hours
- [ ] **Task 14:** Set up uptime monitoring - 1 hour
- [ ] **Task 15:** Test backup restore - 1 hour

**See:** `COMPREHENSIVE_AUDIT_REPORT.md` Section 9 for detailed instructions

---

## 📊 Progress Tracking

### Phase 0 Progress:

| Task | Status | Time Spent | Notes |
|------|--------|------------|-------|
| 1. JWT Auth | ❌ Not Started | 0h / 4h | |
| 2. TypeScript Errors | ❌ Not Started | 0h / 3h | |
| 3. Rate Limiting | ❌ Not Started | 0h / 1h | |
| 4. Strong Secret | ❌ Not Started | 0h / 0.1h | |
| 5. Prod Validation | ❌ Not Started | 0h / 0.5h | |
| 6. Fix Tests | ❌ Not Started | 0h / 2h | |
| **TOTAL** | **0% Complete** | **0h / 10.6h** | |

### Status Legend:
- ❌ Not Started
- 🔄 In Progress
- ⏸️  Blocked
- ✅ Complete
- ⚠️  Needs Review

---

## 🚨 Common Issues & Solutions

### Issue: "Cannot find module 'jsonwebtoken'"
**Solution:** Run `npm install jsonwebtoken @types/jsonwebtoken`

### Issue: "JWT_SECRET is not defined"
**Solution:** Add `JWT_SECRET=<your_secret>` to `.env` file

### Issue: Tests fail after JWT implementation
**Solution:** Update test mocks to use JWT format instead of Base64

### Issue: Rate limit not working
**Solution:** Check middleware order in server.ts - rate limiters should be before routes

### Issue: TypeScript errors persist
**Solution:** Run `npm install` to ensure all types are installed, then `npm run type-check`

### Issue: Production check triggers in development
**Solution:** Set `NODE_ENV=development` in your `.env` file

---

## 📞 Support

### For Questions:
- Review `COMPREHENSIVE_AUDIT_REPORT.md` for context
- Check `SECURITY_AUDIT_REPORT.md` for security details
- See `CLAUDE.md` for codebase guidance

### For Deployment:
- Follow `QUICK_VPS_DEPLOY.md`
- Check `VPS_DEPLOYMENT_GUIDE_NEW.md` for details
- Review deployment scripts in `telegram-food-bot/`

---

**Created:** January 2025  
**Last Updated:** [DATE]  
**Status:** Phase 0 Not Started  
**Next Review:** After Phase 0 completion

**Remember:** DO NOT skip Phase 0 - these are production blockers! 🚫
