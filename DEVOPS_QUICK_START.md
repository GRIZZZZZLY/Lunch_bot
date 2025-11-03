# DevOps Quick Start Guide

**Implement Critical Security Fixes in 1 Day**

This guide provides step-by-step instructions for implementing the most critical P0 recommendations from the DevOps audit.

---

## Prerequisites

- [ ] Admin access to GitHub repository
- [ ] SSH access to production VPS
- [ ] Access to Telegram Bot (via BotFather)
- [ ] Docker installed locally (for testing)

---

## Phase 1: Secrets Management (2-3 hours)

### Step 1: Update .gitignore (5 minutes)

✅ **DONE** - `.gitignore` has been created in the repository root.

**Verify:**
```bash
cd /home/engine/project
cat .gitignore | grep "\.env"
```

### Step 2: Remove Secrets from Git History (30 minutes)

⚠️ **WARNING:** This rewrites Git history. Coordinate with your team!

```bash
# Install git-filter-repo
pip3 install git-filter-repo

# Navigate to project
cd /home/engine/project

# Backup your repository first!
cd ..
cp -r project project-backup

# Go back to project
cd project

# Remove .env files from history
git filter-repo --path telegram-food-bot/backend/.env --invert-paths
git filter-repo --path telegram-food-bot/backend/.env.production --invert-paths
git filter-repo --path telegram-food-bot/backend/.env.development --invert-paths
git filter-repo --path telegram-food-bot/frontend/.env --invert-paths
git filter-repo --path telegram-food-bot/frontend/.env.production --invert-paths

# Force push (after team coordination!)
git push origin --force --all
git push origin --force --tags
```

### Step 3: Generate New Secrets (10 minutes)

```bash
# Generate new JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Save this output - you'll need it!
```

**For Bot Token:**
1. Open Telegram and find @BotFather
2. Send `/mybots`
3. Select your bot → API Token
4. Click "Regenerate Token"
5. Save the new token securely

### Step 4: Setup GitHub Secrets (15 minutes)

1. Go to GitHub → Your Repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add the following secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `BOT_TOKEN` | Your new bot token | From BotFather |
| `JWT_SECRET` | Generated 64-char string | For authentication |
| `POSTGRES_PASSWORD` | Strong password | Database password |
| `VPS_SSH_KEY` | Your private SSH key | For deployment |
| `VPS_HOST` | Your VPS IP/hostname | e.g., rocket-lunch.duckdns.org |
| `VPS_USER` | SSH username | e.g., root or igor |
| `VPS_PROJECT_PATH` | Project path on VPS | e.g., /root/telegram-food-bot |
| `VITE_API_URL` | Production API URL | e.g., https://rocket-lunch.duckdns.org/api |
| `VITE_BOT_USERNAME` | Bot username | e.g., rocket_lunch_bot |
| `SLACK_WEBHOOK` | (Optional) Slack webhook | For notifications |

### Step 5: Update Production Environment (20 minutes)

```bash
# SSH to your VPS
ssh user@your-vps-host

# Navigate to project
cd /root/telegram-food-bot  # Or your project path

# Backup current .env files
cp backend/.env backend/.env.old
cp frontend/.env frontend/.env.old

# Update backend/.env
nano backend/.env

# Replace these values:
BOT_TOKEN=your_new_bot_token_here
JWT_SECRET=your_new_64_char_jwt_secret_here
TELEGRAM_SECRET_KEY=your_new_bot_token_here
POSTGRES_PASSWORD=your_new_db_password_here

# Update frontend/.env
nano frontend/.env

# Save and exit (Ctrl+X, Y, Enter)

# Restart services
pm2 restart rocket-lunch-bot

# Verify
pm2 logs rocket-lunch-bot --lines 50
curl http://localhost:3001/health
```

### Step 6: Verify Git Doesn't Track .env Files

```bash
# On your local machine
cd /home/engine/project

# Check git status
git status

# If any .env files appear, add them to .gitignore
echo "telegram-food-bot/backend/.env" >> .gitignore
echo "telegram-food-bot/frontend/.env" >> .gitignore

# Commit the .gitignore
git add .gitignore
git commit -m "chore: prevent .env files from being committed"
git push
```

---

## Phase 2: CI/CD Pipeline Setup (1-2 hours)

### Step 1: Enable GitHub Actions (5 minutes)

✅ **DONE** - Workflow files have been created:
- `.github/workflows/ci.yml` - Continuous Integration
- `.github/workflows/build-images.yml` - Docker image builds
- `.github/workflows/deploy-production.yml` - Automated deployment
- `.github/dependabot.yml` - Dependency updates

**Commit and push these files:**

```bash
cd /home/engine/project

# Add workflow files
git add .github/

# Commit
git commit -m "ci: add GitHub Actions workflows and Dependabot config"

# Push to trigger first CI run
git push origin feature/new_version
```

### Step 2: Configure Branch Protection (10 minutes)

1. Go to GitHub → Settings → Branches
2. Click "Add rule" for `main` and `feature/new_version`
3. Configure:
   - [x] Require a pull request before merging
   - [x] Require status checks to pass before merging
   - [x] Require branches to be up to date before merging
   - Select status checks:
     - Backend Tests
     - Frontend Tests
     - Security Scan
     - Docker Build Test
     - Code Quality
   - [x] Do not allow bypassing the above settings

### Step 3: Enable Dependabot (5 minutes)

✅ Already configured via `.github/dependabot.yml`

1. Go to GitHub → Settings → Code security and analysis
2. Enable:
   - [x] Dependency graph
   - [x] Dependabot alerts
   - [x] Dependabot security updates
   - [x] Dependabot version updates

### Step 4: Enable CodeQL (5 minutes)

1. Go to GitHub → Settings → Code security and analysis
2. Click "Set up" for CodeQL analysis
3. Select "Default" configuration
4. Enable for JavaScript/TypeScript

### Step 5: Test CI Pipeline (30 minutes)

```bash
# Create a test branch
git checkout -b test/ci-pipeline

# Make a small change
echo "# CI Test" >> README.md

# Commit and push
git add README.md
git commit -m "test: verify CI pipeline"
git push origin test/ci-pipeline

# Go to GitHub → Actions tab
# Watch the CI pipeline run
# All jobs should pass (green checkmarks)
```

**Expected Jobs:**
- ✅ Backend Tests (Node 18.x, 20.x)
- ✅ Frontend Tests
- ✅ Security Scan
- ✅ Docker Build Test
- ✅ Code Quality

**If jobs fail:** Check the logs in GitHub Actions for error messages.

---

## Phase 3: Security Hardening (1 hour)

### Step 1: Remove SKIP_TELEGRAM_VALIDATION in Production (10 minutes)

```bash
# SSH to VPS
ssh user@your-vps-host

# Edit backend/.env
nano /root/telegram-food-bot/backend/.env

# Find this line:
SKIP_TELEGRAM_VALIDATION=true

# Change to:
SKIP_TELEGRAM_VALIDATION=false

# Save and restart
pm2 restart rocket-lunch-bot
```

**Better: Hardcode it in the code**

Edit `telegram-food-bot/backend/src/api/middleware/telegram-auth.ts`:

```typescript
export function validateTelegramAuth(req: Request, res: Response, next: NextFunction) {
  // SECURITY: Never skip validation in production!
  if (process.env.NODE_ENV === 'production') {
    // Always validate, ignore SKIP_TELEGRAM_VALIDATION flag
    const isValid = verifyTelegramSignature(req.headers['authorization']);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } else if (process.env.SKIP_TELEGRAM_VALIDATION !== 'true') {
    // Only allow skipping in development if explicitly set
    const isValid = verifyTelegramSignature(req.headers['authorization']);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  next();
}
```

### Step 2: Add Rate Limiting (20 minutes)

```bash
# Install express-rate-limit
cd /home/engine/project/telegram-food-bot/backend
npm install express-rate-limit
```

Create `src/api/middleware/rate-limit.middleware.ts`:

```typescript
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Telegram sends ~30 updates/minute max
  message: 'Webhook rate limit exceeded',
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});
```

Update `src/api/server.ts`:

```typescript
import { apiLimiter, webhookLimiter } from './middleware/rate-limit.middleware';

// Apply rate limiting
app.use('/api', apiLimiter);
app.use('/webhook', webhookLimiter);
```

### Step 3: Update Nginx Security Headers (15 minutes)

```bash
# SSH to VPS
ssh user@your-vps-host

# Backup current config
cp /etc/nginx/sites-available/rocket-lunch /etc/nginx/sites-available/rocket-lunch.bak

# Edit config
nano /etc/nginx/sites-available/rocket-lunch
```

Add these headers in the `server` block:

```nginx
# Enhanced security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://rocket-lunch.duckdns.org;" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=30r/m;

# In location blocks:
location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    # ... existing config
}

location /webhook {
    limit_req zone=webhook_limit burst=5 nodelay;
    # ... existing config
}
```

Test and reload Nginx:

```bash
# Test configuration
nginx -t

# If OK, reload
systemctl reload nginx
```

### Step 4: Pin Docker Base Images (15 minutes)

Update `telegram-food-bot/backend/Dockerfile.production`:

```dockerfile
# Get current digest
# docker pull node:20-alpine
# docker inspect node:20-alpine | grep -A 5 RepoDigests

# Stage 1: Builder
FROM node:20-alpine@sha256:bf77dc26e48ea95fca9d1aceb5acfa69d2e546b765ec2abfb502975f1a2d4def AS builder

# ... rest of file
```

Do the same for `telegram-food-bot/docker/backend.Dockerfile` and frontend Dockerfiles.

---

## Phase 4: Monitoring Setup (Optional - 2 hours)

### Step 1: Enable Sentry (15 minutes)

1. Sign up at https://sentry.io (free tier available)
2. Create a new project for Node.js
3. Copy the DSN

Add to GitHub Secrets:
- `SENTRY_DSN_BACKEND`: Your Sentry DSN

Update `backend/.env.production`:
```bash
SENTRY_DSN_BACKEND=https://your-dsn@sentry.io/project-id
```

The backend code already has Sentry installed, just needs the DSN configured!

### Step 2: Test Monitoring (10 minutes)

```bash
# Trigger a test error
curl -X POST https://rocket-lunch.duckdns.org/api/test-error

# Check Sentry dashboard for the error
```

---

## Verification Checklist

Run through this checklist to verify everything is working:

### Security
- [ ] No `.env` files in git history (check with `git log --all --full-history -- "**/.env"`)
- [ ] `.gitignore` includes `.env` files
- [ ] All secrets rotated (new bot token, JWT secret, DB password)
- [ ] GitHub Secrets configured
- [ ] Production environment updated with new secrets
- [ ] `SKIP_TELEGRAM_VALIDATION=false` in production
- [ ] Rate limiting active (test with: `for i in {1..150}; do curl https://rocket-lunch.duckdns.org/api/health; done`)

### CI/CD
- [ ] CI workflow runs on push (`git push` and check GitHub Actions)
- [ ] All CI jobs pass (green checkmarks)
- [ ] Branch protection enabled (try pushing to `main` without PR)
- [ ] Dependabot PRs appearing (check Pull Requests tab)
- [ ] CodeQL scanning enabled (check Security → Code scanning)

### Infrastructure
- [ ] Application running (visit https://rocket-lunch.duckdns.org)
- [ ] Health check passing (`curl https://rocket-lunch.duckdns.org/health`)
- [ ] Nginx security headers present:
  ```bash
  curl -I https://rocket-lunch.duckdns.org | grep -i "x-frame\|hsts\|content-security"
  ```
- [ ] Logs accessible (`pm2 logs rocket-lunch-bot`)
- [ ] Database backup working (`./backup-db.sh`)

### Monitoring (if configured)
- [ ] Sentry receiving errors (test with error endpoint)
- [ ] Error notifications working

---

## Rollback Procedures

If something goes wrong, here's how to rollback:

### Rollback Secrets
```bash
# SSH to VPS
ssh user@your-vps-host

# Restore old .env files
cp backend/.env.old backend/.env
cp frontend/.env.old frontend/.env

# Restart
pm2 restart rocket-lunch-bot
```

### Rollback Code
```bash
# SSH to VPS
ssh user@your-vps-host

# Navigate to project
cd /root/telegram-food-bot

# Find last working tag
git tag

# Checkout previous tag
git checkout v1.0.0  # Replace with actual tag

# Redeploy
./deploy-vps.sh
```

### Rollback Git History Changes
```bash
# If you backed up before filter-repo:
cd ..
rm -rf project
mv project-backup project
cd project
git push origin --force --all
```

---

## Next Steps

After completing this quick start:

1. **Week 2:** Implement full monitoring (Prometheus + Grafana)
2. **Week 3:** Add graceful shutdown and circuit breakers
3. **Week 4:** Implement blue-green deployment
4. **Month 2:** Infrastructure as Code (Terraform/Ansible)

Refer to the full `DEVOPS_AUDIT_REPORT.md` for detailed implementation guides.

---

## Troubleshooting

### CI Pipeline Fails

**Problem:** Tests fail with "Database connection failed"

**Solution:** Check that `DATABASE_URL` is set in the workflow:
```yaml
env:
  DATABASE_URL: file:./test.db
```

### Deployment Fails

**Problem:** SSH connection refused

**Solution:** Verify SSH key is correct:
```bash
# Test SSH connection
ssh -i ~/.ssh/id_rsa user@your-vps-host

# If fails, check VPS_SSH_KEY secret in GitHub
```

### Rate Limiting Too Aggressive

**Problem:** Legitimate users getting blocked

**Solution:** Adjust rate limits in middleware:
```typescript
max: 200,  // Increase from 100
windowMs: 15 * 60 * 1000,  // Keep at 15 minutes
```

### Nginx Config Error

**Problem:** `nginx -t` fails

**Solution:**
```bash
# Check syntax
nginx -t

# View error log
tail -f /var/log/nginx/error.log

# Restore backup
cp /etc/nginx/sites-available/rocket-lunch.bak /etc/nginx/sites-available/rocket-lunch
```

---

## Support

If you encounter issues:

1. Check logs:
   - Application: `pm2 logs rocket-lunch-bot`
   - Nginx: `tail -f /var/log/nginx/error.log`
   - GitHub Actions: Check workflow logs in Actions tab

2. Review documentation:
   - `DEVOPS_AUDIT_REPORT.md` - Full audit report
   - `CLAUDE.md` - Project documentation

3. Common commands:
   ```bash
   # Check service status
   pm2 status
   systemctl status nginx
   
   # Restart services
   pm2 restart rocket-lunch-bot
   systemctl restart nginx
   
   # Check disk space
   df -h
   
   # Check memory
   free -m
   ```

---

**Estimated Total Time:** 4-6 hours

**Impact:** Critical security issues resolved, CI/CD automated, production hardened

**Last Updated:** 2025-01-03
