# Security Remediation Implementation Guide

This document provides step-by-step instructions and code examples to fix all vulnerabilities identified in the security audit.

---

## Phase 1: CRITICAL Issues (Immediate - 24 Hours)

### CRIT-001: Exposed Bot Token - IMMEDIATE ACTION REQUIRED ⚠️

**Steps:**

1. **Revoke the exposed token immediately**:
   ```bash
   # Open Telegram and message @BotFather
   # Send: /token
   # Select your bot
   # Select "Revoke current token"
   # Generate a new token
   ```

2. **Remove secrets from git history**:
   ```bash
   # Backup first!
   git clone --mirror <repo-url> backup.git
   
   # Remove .env files from history
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch backend/.env frontend/.env .env telegram-food-bot/backend/.env telegram-food-bot/frontend/.env" \
     --prune-empty --tag-name-filter cat -- --all
   
   # Force push (coordinate with team!)
   git push origin --force --all
   git push origin --force --tags
   
   # Clean local repo
   rm -rf .git/refs/original/
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```

3. **Update environment variables**:
   ```bash
   # backend/.env
   BOT_TOKEN=<NEW_TOKEN_FROM_BOTFATHER>
   TELEGRAM_SECRET_KEY=<NEW_TOKEN_FROM_BOTFATHER>
   JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
   ```

4. **Add pre-commit hook to prevent future leaks**:
   ```bash
   # Create .husky/pre-commit
   npm install husky --save-dev
   npx husky install
   npx husky add .husky/pre-commit "npm run check-secrets"
   ```

   ```json
   // package.json
   {
     "scripts": {
       "check-secrets": "npx secretlint **/*",
       "prepare": "husky install"
     }
   }
   ```

5. **Install secret scanning**:
   ```bash
   npm install -g @secretlint/secretlint
   
   # Create .secretlintrc.json
   {
     "rules": [
       {
         "@secretlint/secretlint-rule-preset-recommend": {
           "allows": []
         }
       }
     ]
   }
   ```

---

### CRIT-002: Implement Rate Limiting

**Installation:**
```bash
cd backend
npm install express-rate-limit
```

**Create rate limit middleware:**
```typescript
// backend/src/api/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';
import { logger } from '../../utils/logger';

/**
 * Aggressive rate limiting for authentication endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes',
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (req, res, next, options) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent'),
    });
    
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Standard rate limiting for general API endpoints
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    logger.warn('API rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '1 minute',
    });
  },
});

/**
 * Strict rate limiting for sensitive operations
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Per-user rate limiting (requires authentication)
 */
export const createUserRateLimiter = (max: number, windowMs: number) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => {
      const user = (req as any).user;
      return user ? `user:${user.id}` : req.ip;
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};
```

**Apply to routes:**
```typescript
// backend/src/api/server.ts
import { 
  authRateLimiter, 
  apiRateLimiter, 
  strictRateLimiter,
  createUserRateLimiter 
} from './middleware/rate-limit';

// Apply rate limiting BEFORE routes
app.use('/api/auth', authRateLimiter); // Strict for auth
app.use('/api', apiRateLimiter); // General API rate limit

// Specific route rate limits
app.use('/api/admin', strictRateLimiter); // Admin endpoints
app.use('/api/polls/create', createUserRateLimiter(5, 60 * 60 * 1000)); // 5 polls per hour
```

**Add to controllers:**
```typescript
// backend/src/api/routes/auth.routes.ts
import { authRateLimiter } from '../middleware/rate-limit';

const router = express.Router();

// Apply per-route rate limiting
router.post('/validate', authRateLimiter, validateInitDataMiddleware, authController.validate);
router.post('/refresh', authRateLimiter, refreshTokenMiddleware, authController.refresh);
```

---

### CRIT-003: Implement CSRF Protection

**Installation:**
```bash
cd backend
npm install csurf cookie-parser
npm install @types/cookie-parser --save-dev
```

**Create CSRF middleware:**
```typescript
// backend/src/api/middleware/csrf.ts
import csrf from 'csurf';
import cookieParser from 'cookie-parser';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

/**
 * CSRF Protection Configuration
 */
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000, // 1 hour
  },
  value: (req) => {
    // Support both cookie and header-based CSRF
    return req.headers['x-csrf-token'] as string || 
           req.body._csrf || 
           req.query._csrf;
  },
});

/**
 * CSRF Error Handler
 */
export function csrfErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.warn('CSRF token validation failed', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    
    res.status(403).json({
      success: false,
      error: 'Invalid CSRF token',
      code: 'CSRF_VALIDATION_FAILED',
    });
    return;
  }
  
  next(err);
}

/**
 * Middleware to send CSRF token to client
 */
export function sendCsrfToken(req: Request, res: Response): void {
  res.json({
    success: true,
    csrfToken: req.csrfToken(),
  });
}
```

**Apply to server:**
```typescript
// backend/src/api/server.ts
import cookieParser from 'cookie-parser';
import { csrfProtection, csrfErrorHandler, sendCsrfToken } from './middleware/csrf';

// Add before routes
app.use(cookieParser());

// CSRF protection for state-changing operations
// Exclude GET, HEAD, OPTIONS
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Exclude Telegram webhook (uses different validation)
  if (req.path.startsWith('/webhook')) {
    return next();
  }
  
  csrfProtection(req, res, next);
});

// CSRF token endpoint
app.get('/api/csrf-token', sendCsrfToken);

// Error handler
app.use(csrfErrorHandler);
```

**Update frontend to use CSRF tokens:**
```typescript
// frontend/src/lib/axios.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // Important for cookies
});

// Fetch CSRF token on app init
let csrfToken: string | null = null;

export async function initializeCsrf(): Promise<void> {
  try {
    const response = await api.get('/csrf-token');
    csrfToken = response.data.csrfToken;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
  }
}

// Add CSRF token to all requests
api.interceptors.request.use((config) => {
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(config.method?.toUpperCase() || '')) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// Refresh CSRF token on 403 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403 && error.response?.data?.code === 'CSRF_VALIDATION_FAILED') {
      await initializeCsrf();
      // Retry the original request
      return api.request(error.config);
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

### CRIT-004: Strong JWT Secret Configuration

**Update JWT service:**
```typescript
// backend/src/services/jwt.service.ts
import crypto from 'crypto';

/**
 * Validate JWT_SECRET strength
 */
function validateJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  
  // List of weak/default secrets
  const WEAK_SECRETS = [
    'dev_jwt_secret_change_in_production',
    'CHANGE_THIS_TO_STRONG_SECRET',
    'CHANGE_THIS_TO_STRONG_SECRET_64_PLUS_CHARACTERS',
    'secret',
    'test',
    'jwt_secret',
  ];
  
  if (!secret) {
    logger.error('🚨 FATAL: JWT_SECRET is not set!');
    throw new Error('FATAL: JWT_SECRET environment variable is required');
  }
  
  // Check for weak secrets in ALL environments
  if (WEAK_SECRETS.some(weak => secret.includes(weak))) {
    logger.error('🚨 FATAL: JWT_SECRET contains weak/default value!');
    throw new Error('FATAL: JWT_SECRET must be changed from default value');
  }
  
  // Enforce minimum length
  if (secret.length < 64) {
    logger.error(`🚨 FATAL: JWT_SECRET is too short (${secret.length} chars, minimum 64)`);
    throw new Error('FATAL: JWT_SECRET must be at least 64 characters');
  }
  
  // Check entropy (optional but recommended)
  const entropy = calculateEntropy(secret);
  if (entropy < 4.5) { // bits per character
    logger.warn('⚠️ WARNING: JWT_SECRET has low entropy, consider regenerating');
  }
  
  return secret;
}

/**
 * Calculate Shannon entropy
 */
function calculateEntropy(str: string): number {
  const len = str.length;
  const frequencies = new Map<string, number>();
  
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }
  
  let entropy = 0;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

const JWT_SECRET = validateJwtSecret();

// Rest of JWT service...
```

**Create secret generation script:**
```typescript
// backend/scripts/generate-secrets.ts
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function generateSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('hex');
}

function generateEnvFile(): void {
  const secrets = {
    JWT_SECRET: generateSecret(64),
    SESSION_SECRET: generateSecret(32),
    ENCRYPTION_KEY: generateSecret(32),
    CSRF_SECRET: generateSecret(32),
  };
  
  console.log('🔐 Generated secrets:');
  console.log('');
  console.log('Add these to your .env file:');
  console.log('');
  
  for (const [key, value] of Object.entries(secrets)) {
    console.log(`${key}=${value}`);
  }
  
  console.log('');
  console.log('⚠️ NEVER commit these secrets to git!');
  console.log('⚠️ Store them in a secure password manager');
  
  // Optionally write to .env.secrets file
  const secretsPath = path.join(__dirname, '../.env.secrets');
  const content = Object.entries(secrets)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
    
  fs.writeFileSync(secretsPath, content + '\n');
  console.log('');
  console.log(`✅ Secrets written to: ${secretsPath}`);
  console.log('📋 Copy to .env and delete .env.secrets immediately');
}

generateEnvFile();
```

**Run to generate secrets:**
```bash
cd backend
npx tsx scripts/generate-secrets.ts
```

---

## Phase 2: HIGH Severity (Within 1 Week)

### HIGH-001: Fix CORS Bypass

```typescript
// backend/src/api/middleware/cors.ts
export const telegramCorsMiddleware = cors({
  origin: (origin, callback) => {
    // Telegram WebApp может не отправлять origin
    if (!origin) {
      return callback(null, true);
    }

    const configOrigins = Array.isArray(apiConfig.corsOrigin) 
      ? apiConfig.corsOrigin 
      : [apiConfig.corsOrigin];

    // Development mode - более строгая проверка
    if (process.env.NODE_ENV === 'development') {
      const isNgrok = origin.includes('.ngrok-free.app') || origin.includes('.ngrok.io');
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
      const isTelegram = origin.includes('telegram.org');
      
      if (isNgrok || isLocalhost || isTelegram || configOrigins.includes(origin)) {
        logger.debug('Telegram CORS: development режим, origin разрешен', { origin });
        return callback(null, true);
      }
      
      logger.warn('Telegram CORS: development режим, origin ЗАБЛОКИРОВАН', { origin });
      // ✅ FIX: Reject instead of allowing
      return callback(new Error('Telegram CORS: origin not in whitelist'));
    }

    // Production - white list only
    const telegramOrigins = [
      'https://web.telegram.org',
      'https://k.web.telegram.org',
      'https://z.web.telegram.org',
      'https://a.web.telegram.org',
    ];

    const allowedOrigins = [...configOrigins, ...telegramOrigins];

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      logger.warn('Telegram CORS blocked request', { origin });
      // ✅ FIX: Reject instead of allowing
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Telegram-Bot-Api-Secret-Token',
  ],
  credentials: false, // Telegram WebApp не поддерживает credentials
  maxAge: 3600,
});
```

---

### HIGH-002: Tighten Content Security Policy

```typescript
// backend/src/api/server.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // ✅ Remove unsafe-inline and unsafe-eval
      scriptSrc: [
        "'self'",
        'https://telegram.org',
        // Use nonces for inline scripts if needed
        (req, res) => `'nonce-${res.locals.cspNonce}'`,
      ],
      scriptSrcAttr: ["'none'"], // Disallow inline event handlers
      styleSrc: [
        "'self'",
        'https://fonts.googleapis.com',
        // Use nonces for inline styles
        (req, res) => `'nonce-${res.locals.cspNonce}'`,
      ],
      styleSrcAttr: ["'none'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'https:', 'wss:'],
      frameSrc: ["'self'", 'https://telegram.org'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'", 'https://web.telegram.org', 'https://*.web.telegram.org'],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Additional security headers
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Generate CSP nonce for each request
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});
```

---

### HIGH-003: JWT Token Blacklisting

**Install Redis:**
```bash
cd backend
npm install ioredis
```

**Create token blacklist service:**
```typescript
// backend/src/services/token-blacklist.service.ts
import Redis from 'ioredis';
import { JwtService } from './jwt.service';
import { logger } from '../utils/logger';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: 'token:',
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

redis.on('connect', () => {
  logger.info('✅ Redis connected for token blacklist');
});

export class TokenBlacklist {
  /**
   * Add token to blacklist
   */
  static async addToBlacklist(token: string, reason: string = 'logout'): Promise<void> {
    try {
      const payload = JwtService.verifyToken(token);
      if (!payload) {
        throw new Error('Invalid token');
      }
      
      // Extract expiration
      const exp = payload.exp || Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      const ttl = exp - Math.floor(Date.now() / 1000);
      
      if (ttl > 0) {
        const key = `blacklist:${payload.jti || token.slice(-20)}`;
        await redis.setex(key, ttl, JSON.stringify({
          userId: payload.userId,
          reason,
          blacklistedAt: new Date().toISOString(),
        }));
        
        logger.info('Token blacklisted', {
          userId: payload.userId,
          reason,
          ttl,
        });
      }
    } catch (error) {
      logger.error('Failed to blacklist token:', error);
      throw error;
    }
  }
  
  /**
   * Check if token is blacklisted
   */
  static async isBlacklisted(token: string): Promise<boolean> {
    try {
      const payload = JwtService.decodeToken(token);
      if (!payload) {
        return false;
      }
      
      const key = `blacklist:${payload.jti || token.slice(-20)}`;
      const result = await redis.get(key);
      
      return result !== null;
    } catch (error) {
      logger.error('Failed to check token blacklist:', error);
      return false; // Fail open for availability
    }
  }
  
  /**
   * Blacklist all user tokens (e.g., password change)
   */
  static async blacklistAllUserTokens(userId: number, reason: string = 'security'): Promise<void> {
    try {
      const key = `user:${userId}:revoked`;
      await redis.set(key, Date.now().toString());
      
      logger.info('All user tokens revoked', {
        userId,
        reason,
      });
    } catch (error) {
      logger.error('Failed to revoke user tokens:', error);
      throw error;
    }
  }
  
  /**
   * Check if user tokens are revoked
   */
  static async areUserTokensRevoked(userId: number, tokenIssuedAt: number): Promise<boolean> {
    try {
      const key = `user:${userId}:revoked`;
      const revokedAt = await redis.get(key);
      
      if (!revokedAt) {
        return false;
      }
      
      return parseInt(revokedAt) > tokenIssuedAt * 1000;
    } catch (error) {
      logger.error('Failed to check user token revocation:', error);
      return false;
    }
  }
}

export default TokenBlacklist;
```

**Update JWT service to include JTI:**
```typescript
// backend/src/services/jwt.service.ts
import { v4 as uuidv4 } from 'uuid';

export interface JwtPayload {
  userId: number;
  telegramId: string;
  username?: string;
  isAdmin: boolean;
  type: 'access' | 'refresh';
  jti: string; // ✅ Add JWT ID
  iat: number; // ✅ Issued at
}

export function generateAccessToken(payload: Omit<JwtPayload, 'type' | 'jti' | 'iat'>): string {
  try {
    const tokenPayload: JwtPayload = {
      ...payload,
      type: 'access',
      jti: uuidv4(), // ✅ Unique token ID
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRATION,
      algorithm: 'HS256',
    });

    return token;
  } catch (error) {
    logger.error('Failed to generate access token', error);
    throw new Error('Token generation failed');
  }
}
```

**Update auth middleware to check blacklist:**
```typescript
// backend/src/api/middleware/telegram-auth.ts
import { TokenBlacklist } from '../../services/token-blacklist.service';

export async function telegramAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // ... existing code ...
    
    // ✅ Check token blacklist
    const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
    if (isBlacklisted) {
      res.status(401).json({
        success: false,
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
      return;
    }
    
    // ✅ Check user-level revocation
    const decoded = JwtService.verifyToken(token);
    if (decoded) {
      const areRevoked = await TokenBlacklist.areUserTokensRevoked(
        decoded.userId,
        decoded.iat
      );
      if (areRevoked) {
        res.status(401).json({
          success: false,
          error: 'All user tokens have been revoked',
          code: 'USER_TOKENS_REVOKED'
        });
        return;
      }
    }
    
    // ... rest of code ...
  } catch (error) {
    // ... error handling ...
  }
}
```

**Add logout endpoint:**
```typescript
// backend/src/api/controllers/auth.controller.ts
import { TokenBlacklist } from '../../services/token-blacklist.service';

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await TokenBlacklist.addToBlacklist(token, 'user_logout');
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to logout',
    });
  }
}
```

---

### HIGH-004: Security Audit Logging

```typescript
// backend/src/utils/security-logger.ts
import winston from 'winston';
import path from 'path';

/**
 * Dedicated security event logger
 */
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'security-audit' },
  transports: [
    // Security events go to separate file
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/security-audit.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 30,
      tailable: true,
    }),
    // Critical security events
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/security-critical.log'),
      level: 'warn',
      maxsize: 10485760,
      maxFiles: 90,
    }),
  ],
});

// Also log to console in development
if (process.env.NODE_ENV !== 'production') {
  securityLogger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export interface SecurityEvent {
  event: string;
  success: boolean;
  userId?: number;
  ip?: string;
  userAgent?: string;
  details?: any;
  severity?: 'info' | 'warn' | 'error' | 'critical';
}

export class SecurityLogger {
  /**
   * Log authentication attempt
   */
  static logAuthAttempt(
    success: boolean,
    userId: number | null,
    ip: string,
    details?: any
  ): void {
    securityLogger.info('Authentication attempt', {
      event: 'auth_attempt',
      success,
      userId,
      ip,
      details,
      timestamp: new Date().toISOString(),
    });
    
    // Track failed attempts for rate limiting
    if (!success) {
      this.trackFailedAttempt(ip);
    }
  }
  
  /**
   * Log admin action
   */
  static logAdminAction(
    action: string,
    userId: number,
    targetId: number | null,
    details: any
  ): void {
    securityLogger.warn('Admin action', {
      event: 'admin_action',
      action,
      userId,
      targetId,
      details,
      timestamp: new Date().toISOString(),
    });
  }
  
  /**
   * Log sensitive data access
   */
  static logDataAccess(
    userId: number,
    resource: string,
    resourceId: number,
    action: 'read' | 'write' | 'delete',
    ip: string
  ): void {
    securityLogger.info('Data access', {
      event: 'data_access',
      userId,
      resource,
      resourceId,
      action,
      ip,
      timestamp: new Date().toISOString(),
    });
  }
  
  /**
   * Log security violation
   */
  static logSecurityViolation(
    type: string,
    userId: number | null,
    ip: string,
    details: any
  ): void {
    securityLogger.error('Security violation', {
      event: 'security_violation',
      type,
      userId,
      ip,
      details,
      timestamp: new Date().toISOString(),
    });
  }
  
  /**
   * Log token revocation
   */
  static logTokenRevocation(
    userId: number,
    reason: string,
    revokedBy: number | null
  ): void {
    securityLogger.warn('Token revocation', {
      event: 'token_revoked',
      userId,
      reason,
      revokedBy,
      timestamp: new Date().toISOString(),
    });
  }
  
  /**
   * Track failed login attempts
   */
  private static failedAttempts = new Map<string, number[]>();
  
  private static trackFailedAttempt(ip: string): void {
    const now = Date.now();
    const attempts = this.failedAttempts.get(ip) || [];
    
    // Keep attempts from last 15 minutes
    const recentAttempts = attempts.filter(time => now - time < 15 * 60 * 1000);
    recentAttempts.push(now);
    
    this.failedAttempts.set(ip, recentAttempts);
    
    // Alert on suspicious activity
    if (recentAttempts.length >= 10) {
      this.logSecurityViolation(
        'excessive_failed_logins',
        null,
        ip,
        { attempts: recentAttempts.length }
      );
    }
  }
  
  /**
   * Get failed attempts for IP
   */
  static getFailedAttempts(ip: string): number {
    const attempts = this.failedAttempts.get(ip) || [];
    const now = Date.now();
    return attempts.filter(time => now - time < 15 * 60 * 1000).length;
  }
}

export default SecurityLogger;
```

**Apply to auth middleware:**
```typescript
// backend/src/api/middleware/telegram-auth.ts
import { SecurityLogger } from '../../utils/security-logger';

export async function telegramAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // ... existing auth logic ...
    
    if (!userData) {
      // ✅ Log failed attempt
      SecurityLogger.logAuthAttempt(false, null, req.ip, {
        reason: 'invalid_token',
        path: req.path,
      });
      
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
      return;
    }
    
    // ✅ Log successful authentication
    SecurityLogger.logAuthAttempt(true, userData.id, req.ip, {
      path: req.path,
    });
    
    (req as any).user = userData;
    next();
  } catch (error) {
    // ... error handling ...
  }
}
```

---

## Remaining Implementation Steps

Due to length constraints, the full remediation guide continues in additional sections. Key remaining items:

1. **HIGH-005**: Secure SKIP_TELEGRAM_VALIDATION flag
2. **HIGH-006**: Implement timing-safe comparisons
3. **HIGH-007**: Enhanced Prisma input validation
4. **HIGH-008**: Sanitize error messages
5. **MEDIUM**: 15 medium severity fixes
6. **LOW**: 10 low severity improvements
7. **CI/CD**: Security scanning integration
8. **Monitoring**: Security event alerting

Refer to the Security Audit Report for complete details on all vulnerabilities.

---

## Testing Security Fixes

```bash
# Test rate limiting
npm install -g autocannon
autocannon -c 100 -d 10 http://localhost:3001/api/auth/validate

# Test CSRF protection
curl -X POST http://localhost:3001/api/polls/create \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}' \
  # Should fail with 403

# Test JWT blacklist
# 1. Login and get token
# 2. Logout
# 3. Try to use same token (should fail with TOKEN_REVOKED)

# Security audit
npm audit
npm audit fix

# Check for secrets
npx secretlint **/*
```

---

## Deployment Checklist

- [ ] All CRITICAL fixes deployed
- [ ] All HIGH fixes deployed
- [ ] Rate limiting tested
- [ ] CSRF tokens working
- [ ] JWT secrets rotated
- [ ] Old bot token revoked
- [ ] Security logging active
- [ ] Monitoring dashboards configured
- [ ] Incident response plan documented
- [ ] Team trained on security procedures

---

**Implementation Timeline:** 1-2 weeks for full remediation  
**Priority:** CRITICAL issues within 24 hours, HIGH within 1 week
