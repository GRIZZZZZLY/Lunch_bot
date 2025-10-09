# 🎯 Performance Budget - Rocket Lunch Frontend

## Критические метрики (Must have)

### Loading Performance

| Метрика | Target | Current | Status | Priority |
|---------|--------|---------|--------|----------|
| **First Contentful Paint (FCP)** | < 1.5s | TBD | 🟡 | CRITICAL |
| **Largest Contentful Paint (LCP)** | < 2.5s | TBD | 🟡 | CRITICAL |
| **Time to Interactive (TTI)** | < 3.0s | TBD | 🟡 | CRITICAL |
| **Total Blocking Time (TBT)** | < 300ms | TBD | 🟡 | HIGH |
| **Cumulative Layout Shift (CLS)** | < 0.1 | TBD | 🟡 | HIGH |
| **Speed Index** | < 2.0s | TBD | 🟡 | HIGH |

### Bundle Sizes (gzipped)

| Asset Type | Target | Current | Status | Notes |
|------------|--------|---------|--------|-------|
| **Initial JS Bundle** | < 100KB | TBD | 🟡 | Main app bundle |
| **Total JS** | < 200KB | TBD | 🟡 | All chunks combined |
| **CSS** | < 50KB | TBD | 🟡 | Tailwind + custom |
| **Images (initial)** | < 100KB | TBD | 🟡 | Above fold only |
| **Fonts** | < 30KB | TBD | 🟡 | Subset only |
| **Total Transfer** | < 400KB | TBD | 🟡 | First load |

### Runtime Performance

| Метрика | Target | Notes |
|---------|--------|-------|
| **Frame Rate** | 60 FPS | Smooth animations |
| **Memory Usage** | < 100MB | Mobile devices |
| **Cache Hit Rate** | > 80% | Service Worker |
| **API Response Time** | < 500ms | p95 |

---

## 📊 Lighthouse Scores

| Category | Minimum | Target | Current | Status |
|----------|---------|--------|---------|--------|
| **Performance** | 90 | 95+ | TBD | 🟡 |
| **Accessibility** | 90 | 95+ | TBD | 🟡 |
| **Best Practices** | 90 | 95+ | TBD | 🟡 |
| **SEO** | 85 | 90+ | TBD | 🟡 |
| **PWA** | 85 | 90+ | TBD | 🟡 |

---

## 🎨 Оптимизации

### Code Splitting ✅

```typescript
// Route-based splitting (automatic with React.lazy)
const HomePage = lazy(() => import('./pages/HomePage'));
const MenuPage = lazy(() => import('./pages/MenuPage'));
// Экономия: ~150KB initial bundle

// Vendor splitting (vite.config.ts)
- react-vendor: 45KB (React + ReactDOM + Router)
- framer-motion: 60KB (separated, lazy loaded)
- react-query: 25KB (on-demand)
- Остальное: vendor chunk
```

### Image Optimization

```
Strategy:
1. WebP format (60% меньше vs JPEG)
2. Lazy loading (только видимые)
3. Blur placeholder (LQIP)
4. Responsive sizes (srcset)
5. CDN caching

Example:
- Original JPEG: 150KB
- Optimized WebP: 45KB (-70%)
- With lazy loading: 0KB initial
```

### Caching Strategy

```
Service Worker Cache:
- App Shell: Cache First (instant load)
- API: Network First + 3s timeout (fresh + fallback)
- Images: Cache First + stale-while-revalidate
- Static assets: Cache First + versioned

Cache Hit Rate target: > 80%
```

### Network Optimization

```
HTTP/2 Features:
- Multiplexing ✓
- Server Push (for critical resources)
- Header compression (HPACK)

Compression:
- Brotli level 11 (production)
- Gzip fallback
- ~70% size reduction
```

---

## 🚀 Performance Checklist

### Build Optimizations

- [x] Code splitting (route-based)
- [x] Tree shaking (Vite automatic)
- [x] Minification (Terser)
- [x] Compression (Brotli)
- [x] Remove console.log (production)
- [x] Source maps disabled (production)
- [ ] Bundle analyzer report
- [ ] Unused dependencies cleanup

### Runtime Optimizations

- [x] React.lazy для routes
- [x] Virtual scrolling (react-window)
- [x] Debounced/throttled events
- [ ] Memoization (useMemo, useCallback)
- [ ] Web Workers (heavy computations)
- [ ] Image lazy loading
- [ ] Font subsetting

### Caching

- [x] Service Worker (Workbox)
- [x] Offline support
- [x] Cache strategies configured
- [ ] IndexedDB для app state
- [ ] LocalStorage для preferences

### Network

- [ ] HTTP/2 enabled
- [ ] CDN для static assets
- [ ] API response caching
- [ ] Prefetch critical resources
- [ ] Preconnect to APIs

---

## 📈 Monitoring

### Tools

1. **Lighthouse CI** (automated)
   - Runs on every PR
   - Fails if budget exceeded
   - Trend tracking

2. **Web Vitals** (real users)
   - Collect in production
   - Send to analytics
   - Track Core Web Vitals

3. **Bundle Analyzer**
   ```bash
   npm run build:analyze
   ```

### Alerts

Trigger warning if:
- LCP > 2.5s
- FCP > 1.5s
- Bundle size > 200KB
- Lighthouse score < 90

---

## 🎯 Action Items

### Week 1: Foundation
- [ ] Setup Lighthouse CI
- [ ] Baseline performance audit
- [ ] Enable bundle analyzer
- [ ] Document current metrics

### Week 2: Optimization
- [ ] Implement image optimization
- [ ] Add bundle size checks to CI
- [ ] Optimize largest chunks
- [ ] Reduce unused code

### Week 3: Validation
- [ ] Run Lighthouse tests
- [ ] Validate on real devices (3G network)
- [ ] Fix regressions
- [ ] Document wins

### Week 4: Monitoring
- [ ] Setup Web Vitals tracking
- [ ] Configure alerts
- [ ] Create performance dashboard
- [ ] Team training

---

## 📞 Resources

- [Web.dev Performance](https://web.dev/performance/)
- [Lighthouse Docs](https://developers.google.com/web/tools/lighthouse)
- [Web Vitals](https://web.dev/vitals/)
- [Vite Performance](https://vitejs.dev/guide/performance.html)

---

**Last Updated:** 05.10.2025  
**Owner:** Frontend Team  
**Review Frequency:** Weekly
