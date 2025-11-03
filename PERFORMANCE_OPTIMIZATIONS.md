# Performance Optimizations - Implementation Guide

This document provides **code-ready implementations** for the optimizations recommended in PERFORMANCE_REVIEW.md.

---

## High Priority Fixes

### 1. Add Caching to `getActivePolls()` ⭐ HIGH IMPACT

**File:** `telegram-food-bot/backend/src/services/poll.service.ts`

**Current Code (line 170):**
```typescript
static async getActivePolls(): Promise<any[]> {
  try {
    logger.info('🔍 Fetching active polls...');
    
    const polls = await prisma.poll.findMany({
      where: { status: 'ACTIVE' },
      include: {
        group: true,
        votes: {
          include: {
            user: true,
            menuItem: true,
          },
        },
        _count: {
          select: {
            votes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    // ... rest of logic
  }
}
```

**Optimized Code:**
```typescript
static async getActivePolls(): Promise<any[]> {
  try {
    logger.info('🔍 Fetching active polls...');
    
    // ✅ ADD CACHING with 30s TTL
    return await cacheService.getOrSet(
      CACHE_KEYS.ACTIVE_POLLS,
      async () => {
        const polls = await prisma.poll.findMany({
          where: { status: 'ACTIVE' },
          include: {
            group: true,
            votes: {
              include: {
                user: true,
                menuItem: true,
              },
            },
            _count: {
              select: {
                votes: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        
        logger.info(`📊 Found ${polls.length} polls with ACTIVE status`);
        
        // Existing logic for expired polls
        const now = new Date();
        const activePolls = [];
        const expiredPollIds: number[] = [];
        
        for (const poll of polls) {
          const endsAt = poll.endedAt || new Date(poll.startedAt.getTime() + poll.duration * 60 * 1000);
          const isActive = endsAt > now;
          logger.info(`Poll ${poll.id}: ends=${endsAt.toISOString()}, now=${now.toISOString()}, active=${isActive}`);
          
          if (isActive) {
            activePolls.push(poll);
          } else {
            expiredPollIds.push(poll.id);
            logger.info(`⏰ Poll ${poll.id} expired, auto-closing...`);
          }
        }
        
        // Auto-close expired polls (non-blocking)
        if (expiredPollIds.length > 0) {
          prisma.poll.updateMany({
            where: { id: { in: expiredPollIds } },
            data: { 
              status: 'COMPLETED',
              endedAt: now
            }
          }).then(() => {
            logger.info(`✅ Auto-closed ${expiredPollIds.length} expired polls: ${expiredPollIds.join(', ')}`);
            // Invalidate cache after closing polls
            cacheService.del(CACHE_KEYS.ACTIVE_POLLS);
          }).catch((err) => {
            logger.error(`❌ Failed to auto-close expired polls:`, err);
          });
        }
        
        logger.info(`✅ Returning ${activePolls.length} active polls`);
        
        // Convert BigInt to string for JSON serialization
        const serializedPolls = activePolls.map(poll => ({
          ...poll,
          chatId: poll.chatId ? poll.chatId.toString() : null,
        }));
        
        return serializedPolls;
      },
      CACHE_TTL.ACTIVE_POLLS // 30 seconds
    );
  } catch (error: any) {
    logger.error('❌ Error getting active polls:', {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
```

**Expected Impact:**
- 95% reduction in DB queries
- Response time: 50-100ms → 1-2ms (cache hit)
- Better scalability for multiple users

---

### 2. Reduce API Payload Size ⭐ HIGH IMPACT

**File:** `telegram-food-bot/backend/src/services/poll.service.ts`

**Option A: Optimize includes (minimal changes)**

Replace the `votes` include with selective fields:

```typescript
static async getActivePolls(): Promise<any[]> {
  return await cacheService.getOrSet(
    CACHE_KEYS.ACTIVE_POLLS,
    async () => {
      const polls = await prisma.poll.findMany({
        where: { status: 'ACTIVE' },
        include: {
          group: {
            select: {
              id: true,
              title: true,
              telegramId: true,
            }
          },
          votes: {
            select: {
              id: true,
              userId: true,
              menuItemId: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  // Removed: lastName, username, telegramId, photoUrl, etc.
                }
              },
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  // Removed: description, imageUrl, category, etc.
                }
              }
            }
          },
          _count: {
            select: {
              votes: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      // ... rest of logic
    },
    CACHE_TTL.ACTIVE_POLLS
  );
}
```

**Option B: Separate endpoints (better approach)**

Keep `getActivePolls()` lightweight, create new endpoint for details:

```typescript
// Lightweight version - only poll metadata
static async getActivePollsSummary(): Promise<any[]> {
  return await cacheService.getOrSet(
    CACHE_KEYS.ACTIVE_POLLS,
    async () => {
      const polls = await prisma.poll.findMany({
        where: { status: 'ACTIVE' },
        include: {
          group: {
            select: { id: true, title: true }
          },
          _count: {
            select: { votes: true }
          }
        },
        orderBy: { createdAt: 'desc' },
      });
      
      return polls.map(poll => ({
        id: poll.id,
        groupId: poll.groupId,
        groupTitle: poll.group.title,
        status: poll.status,
        duration: poll.duration,
        startedAt: poll.startedAt,
        endedAt: poll.endedAt,
        votesCount: poll._count.votes,
        chatId: poll.chatId ? poll.chatId.toString() : null,
      }));
    },
    CACHE_TTL.ACTIVE_POLLS
  );
}

// Detailed version - use existing getPollById()
// Frontend fetches summary first, then details on-demand
```

**Expected Impact:**
- Payload reduction: ~10KB → ~3KB per poll (70% smaller)
- Faster network transfer
- Lower memory usage in frontend

---

### 3. Optimize VotingPage Polling ⭐ MEDIUM IMPACT

**File:** `telegram-food-bot/frontend/src/pages/VotingPage.tsx`

**Current Code (line 74-83):**
```typescript
useEffect(() => {
  if (!poll || poll.status !== 'ACTIVE') return;

  const refreshInterval = setInterval(() => {
    loadPollData(true); // Polling every 10s
  }, 10000);

  return () => clearInterval(refreshInterval);
}, [poll?.status]);
```

**Optimized Code with Page Visibility API:**
```typescript
useEffect(() => {
  if (!poll || poll.status !== 'ACTIVE') return;
  
  let intervalId: NodeJS.Timeout | null = null;
  
  const startPolling = () => {
    // Initial load
    loadPollData(true);
    
    // Start interval
    intervalId = setInterval(() => {
      loadPollData(true);
    }, 10000);
  };
  
  const stopPolling = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
  
  // Handle visibility changes
  const handleVisibilityChange = () => {
    if (document.hidden) {
      console.log('⏸️ Tab hidden - pausing poll updates');
      stopPolling();
    } else {
      console.log('▶️ Tab visible - resuming poll updates');
      startPolling();
    }
  };
  
  // Only poll when tab is visible
  if (!document.hidden) {
    startPolling();
  }
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    stopPolling();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [poll?.status]);
```

**Expected Impact:**
- 50% reduction in requests (paused when tab hidden)
- Better battery life on mobile
- Reduced server load

---

## Medium Priority Fixes

### 4. Tune React Query staleTime Per Query Type

**File:** Create new `telegram-food-bot/frontend/src/hooks/useMenuItems.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { menuService } from '../services/menu.service';

/**
 * Hook for menu items with longer cache
 * Menu items rarely change, so we can cache for 10 minutes
 */
export function useMenuItems() {
  return useQuery({
    queryKey: queryKeys.menu.items(),
    queryFn: async () => {
      const response = await menuService.getAllItems();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch menu items');
      }
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (was 30s globally)
    gcTime: 30 * 60 * 1000,    // 30 minutes cache retention
    refetchOnWindowFocus: false, // Don't refetch menu on focus
  });
}
```

**Update useActivePolls to be more aggressive:**

**File:** `telegram-food-bot/frontend/src/hooks/usePolls.ts`

```typescript
export function useActivePolls(options?: {
  refetchInterval?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.polls.active(),
    queryFn: async () => {
      const response = await pollsService.getActivePolls();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch active polls');
      }
      return response.data;
    },
    staleTime: 20 * 1000,      // 20s for active polls (was 30s)
    gcTime: 2 * 60 * 1000,     // 2 minutes cache retention
    refetchInterval: options?.refetchInterval ?? 30000, // Auto-refresh every 30s
    refetchOnWindowFocus: true,
    enabled: options?.enabled ?? true,
  });
}
```

**Expected Impact:**
- 70% reduction in unnecessary refetches
- Better perceived performance
- Lower server load

---

### 5. Split Vite Bundles Further

**File:** `telegram-food-bot/frontend/vite.config.ts`

**Update manualChunks (line 69-104):**

```typescript
rollupOptions: {
  output: {
    manualChunks(id) {
      if (id.includes('node_modules')) {
        // React and core dependencies (MUST stay together)
        if (
          id.includes('react') ||
          id.includes('react-dom') ||
          id.includes('scheduler') ||
          id.includes('react-router') ||
          id.includes('@remix-run/router')
        ) {
          return 'vendor-react';
        }
        
        // React Query (frequently used)
        if (id.includes('@tanstack/react-query')) {
          return 'vendor-query';
        }
        
        // Radix UI (admin/heavy components - lazy load)
        if (id.includes('@radix-ui')) {
          return 'vendor-radix';
        }
        
        // Charts (stats page only)
        if (id.includes('recharts')) {
          return 'vendor-charts';
        }
        
        // Framer Motion (animations)
        if (id.includes('framer-motion')) {
          return 'vendor-motion';
        }
        
        // Form & validation
        if (id.includes('react-hook-form') || id.includes('zod')) {
          return 'vendor-forms';
        }
        
        // Lucide icons
        if (id.includes('lucide-react')) {
          return 'vendor-icons';
        }
        
        // State management
        if (id.includes('zustand') || id.includes('axios')) {
          return 'vendor-state';
        }
        
        // Utilities
        if (id.includes('clsx') || id.includes('tailwind-merge')) {
          return 'vendor-utils';
        }
        
        // Telegram SDK
        if (id.includes('@twa-dev/sdk')) {
          return 'vendor-telegram';
        }
        
        // Everything else
        return 'vendor-misc';
      }
    },
    chunkFileNames: 'assets/js/[name]-[hash].js',
    entryFileNames: 'assets/js/[name]-[hash].js',
  },
},
```

**Update chunk size warning:**
```typescript
build: {
  chunkSizeWarningLimit: 300, // More strict (was 500)
  // ... rest
}
```

**Expected Impact:**
- 80-100KB smaller initial bundle
- Better code splitting
- Faster initial page load

---

### 6. Implement Global BigInt Serializer

**File:** Create `telegram-food-bot/backend/src/utils/serializer.ts`

```typescript
/**
 * Global serializer for BigInt values
 * Converts BigInt to string for JSON serialization
 */
export function serializeBigInt<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data === 'bigint') {
    return data.toString() as any;
  }
  
  if (Array.isArray(data)) {
    return data.map(serializeBigInt) as any;
  }
  
  if (typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  
  return data;
}

/**
 * Express middleware for automatic BigInt serialization
 */
export function bigIntSerializerMiddleware(req: any, res: any, next: any) {
  const originalJson = res.json.bind(res);
  
  res.json = function(data: any) {
    return originalJson(serializeBigInt(data));
  };
  
  next();
}
```

**Usage in Express:**

**File:** `telegram-food-bot/backend/src/api/server.ts`

```typescript
import { bigIntSerializerMiddleware } from '../utils/serializer';

// ... other middleware
app.use(bigIntSerializerMiddleware); // Add before routes
// ... routes
```

**Expected Impact:**
- Cleaner code (no manual conversions)
- Prevents runtime errors
- Consistent serialization across all endpoints

---

## Low Priority Fixes

### 7. Remove menuItems from Zustand Persistence

**File:** `telegram-food-bot/frontend/src/store/useAppStore.ts`

**Current (line 236-245):**
```typescript
partialize: (state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  theme: state.theme,
  menuItems: state.menuItems, // ⚠️ Remove this
  selectedCategory: state.selectedCategory,
})
```

**Optimized:**
```typescript
partialize: (state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  theme: state.theme,
  selectedCategory: state.selectedCategory,
  // Removed: menuItems (handled by React Query cache)
})
```

**Expected Impact:**
- 5-10KB less localStorage
- Faster state sync
- No duplication between Zustand and React Query

---

### 8. Add Request Deduplication

**File:** `telegram-food-bot/frontend/src/services/api.service.ts`

**Add to ApiService class:**

```typescript
private pendingRequests = new Map<string, Promise<any>>();

/**
 * Create request key for deduplication
 */
private createRequestKey(method: string, url: string, config?: AxiosRequestConfig): string {
  return `${method}:${url}:${JSON.stringify(config?.params || {})}`;
}

/**
 * GET with deduplication
 */
async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const key = this.createRequestKey('GET', url, config);
  
  // Return pending request if exists
  if (this.pendingRequests.has(key)) {
    console.log('🔄 Deduplicating request:', key);
    return this.pendingRequests.get(key);
  }

  // Create new request
  const promise = this.client
    .get<ApiResponse<T>>(url, config)
    .then((response: AxiosResponse) => {
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Request failed');
      }
      return response.data.data as T;
    })
    .finally(() => {
      // Cleanup after 1 second
      setTimeout(() => {
        this.pendingRequests.delete(key);
      }, 1000);
    });

  this.pendingRequests.set(key, promise);
  return promise;
}
```

**Expected Impact:**
- Prevents duplicate simultaneous requests
- Lower priority (React Query handles most cases)

---

### 9. Re-enable PWA with Proper Caching

**File:** `telegram-food-bot/frontend/vite.config.ts`

**Uncomment and configure PWA plugin:**

```typescript
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Telegram Food Bot',
        short_name: 'Food Bot',
        description: 'Organize food voting in Telegram groups',
        theme_color: '#ff6b6b',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            // Cache API responses (network-first)
            urlPattern: /^https?:\/\/.*\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60, // 1 minute
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache images (cache-first)
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
              },
            },
          },
          {
            // Cache fonts (cache-first)
            urlPattern: /\.(woff|woff2|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
  // ... rest of config
});
```

**Expected Impact:**
- Offline support
- Faster repeat visits
- Better mobile experience
- PWA installability

---

## Testing & Validation

### Before Optimization

Run these commands to measure baseline:

```bash
# Backend
cd telegram-food-bot/backend
npm test
npm run test:coverage

# Measure response times (add logging)
# Check DB query count in logs

# Frontend  
cd telegram-food-bot/frontend
npm run build
npm run preview

# Measure bundle size
du -sh dist/assets/js/*.js

# Lighthouse audit
npx lighthouse http://localhost:4173 --view
```

### After Optimization

Repeat the same tests and compare:

**Expected Improvements:**
- Backend response time: 40-60% faster
- DB query count: 95% reduction
- Bundle size: 15-20% smaller
- Lighthouse score: +5-10 points

---

## Implementation Order

### Day 1 (2-3 hours):
1. ✅ Add caching to `getActivePolls()` (#1)
2. ✅ Optimize VotingPage polling (#3)
3. ✅ Global BigInt serializer (#6)

### Day 2 (3-4 hours):
4. ✅ Reduce API payload size (#2)
5. ✅ Tune React Query staleTime (#4)
6. ✅ Remove menuItems from Zustand (#7)

### Day 3 (2-3 hours):
7. ✅ Split Vite bundles (#5)
8. ✅ Re-enable PWA (#9)
9. ✅ Add request deduplication (#8)

**Total Effort:** 7-10 hours

---

## Monitoring Post-Deployment

Add these metrics to track improvements:

```typescript
// backend/src/services/metrics.service.ts
// Add cache hit rate metric
private cacheHitRateGauge: Gauge;

this.cacheHitRateGauge = new Gauge({
  name: 'food_bot_cache_hit_rate',
  help: 'Percentage of cache hits',
  registers: [this.registry],
});

// Update in collectMetrics()
const cacheStats = await cacheService.getStats();
this.cacheHitRateGauge.set(parseFloat(cacheStats.hitRate));
```

**Monitor:**
- Cache hit rate (target: >90%)
- Average response time (target: <50ms)
- Bundle load time (target: <2s)
- Lighthouse score (target: >90)

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-XX  
**Status:** Ready for Implementation
