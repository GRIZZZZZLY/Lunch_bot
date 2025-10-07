# 🚀 GitHub Setup Guide

Quick guide to set up GitHub repository with CI/CD.

## 📋 Prerequisites

- GitHub account
- Git installed locally
- Project files ready

## 🎯 Step-by-Step Setup

### 1. Create GitHub Repository

1. Go to [GitHub](https://github.com/new)
2. Enter repository name: `telegram-food-bot`
3. Choose visibility: **Private** or **Public**
4. ❌ **DO NOT** initialize with README, .gitignore, or license (we have them)
5. Click **Create repository**

### 2. Connect Local Repository

```bash
# Navigate to project
cd E:\BOT_V2\Lunch_bot\telegram-food-bot

# Check git status
git status

# Add all files
git add .

# Create first commit
git commit -m "feat: initial commit with CI/CD pipeline

- Add 77 unit tests (UserService, MenuService, PollService)
- Configure GitHub Actions for automated testing
- Add code quality checks and security audit
- Include coverage reporting and PR automation

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/telegram-food-bot.git

# Rename branch to main
git branch -M main

# Push to GitHub
git push -u origin main
```

### 3. Verify CI/CD Pipeline

1. Go to your repository on GitHub
2. Click **Actions** tab
3. You should see "CI/CD Pipeline" workflow running
4. Wait for all checks to complete (~ 2-3 minutes)
5. ✅ All checks should pass!

### 4. Update README Badges

In `README.md`, replace `YOUR_USERNAME`:

```markdown
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/YOUR_USERNAME/telegram-food-bot/actions)
```

### 5. Branch Protection (Optional but Recommended)

1. Go to repository **Settings**
2. Click **Branches** in sidebar
3. Add rule for `main` branch:
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date
   - Select: `Backend Tests`, `Code Quality`
   - ✅ Require linear history
4. Save changes

## 🎨 Optional: Enable Codecov

For detailed coverage reports:

1. Go to [Codecov](https://codecov.io/)
2. Sign in with GitHub
3. Add your repository
4. Copy `CODECOV_TOKEN`
5. Add to GitHub repository:
   - Settings → Secrets → Actions
   - New repository secret: `CODECOV_TOKEN`

## 🔐 Add Secrets (For Production)

Add these secrets for production deployment:

1. Go to repository **Settings**
2. Click **Secrets and variables** → **Actions**
3. Add:
   - `DATABASE_URL` - Production database connection
   - `JWT_SECRET` - JWT signing key
   - `TELEGRAM_BOT_TOKEN` - Production bot token

## ✅ Verification Checklist

- [ ] Repository created on GitHub
- [ ] Local code pushed to remote
- [ ] CI/CD pipeline running
- [ ] All tests passing (77/77)
- [ ] Badges updated in README
- [ ] Branch protection enabled (optional)
- [ ] Secrets added (if needed)

## 🎯 What Happens Now?

Every time you:

### Push to main/develop
1. ✅ Backend tests run (77 tests)
2. ✅ Frontend builds
3. ✅ Code quality checks
4. ✅ Security audit
5. ✅ Coverage report generated

### Create Pull Request
1. ✅ All checks run automatically
2. ✅ PR comment with test results
3. ✅ Coverage comparison
4. ❌ PR blocked if tests fail (with branch protection)

## 📊 Viewing Results

### GitHub Actions
- **URL**: `https://github.com/YOUR_USERNAME/telegram-food-bot/actions`
- View: Workflow runs, logs, artifacts

### Test Results
- **Location**: Actions → Workflow → Artifacts
- **Retention**: 30 days

### Coverage Reports  
- **Local**: `backend/coverage/lcov-report/index.html`
- **Codecov**: `https://codecov.io/gh/YOUR_USERNAME/telegram-food-bot`

## 🐛 Troubleshooting

### "remote: Repository not found"
- Check repository name matches
- Verify you have access
- Check remote URL: `git remote -v`

### "failed to push some refs"
- Pull first: `git pull origin main`
- Or force push (⚠️ careful): `git push -f origin main`

### Tests fail in CI but pass locally
```bash
# Run tests with CI flag
cd backend
npm test -- --ci --maxWorkers=2
```

### Permission denied (publickey)
- Add SSH key to GitHub
- Or use HTTPS with personal access token

## 🔄 Daily Workflow

```bash
# Start work
git checkout -b feature/my-feature

# Make changes, add tests

# Check locally
npm test
npm run lint

# Commit
git add .
git commit -m "feat: add awesome feature"

# Push
git push origin feature/my-feature

# Create PR on GitHub
# Wait for CI/CD checks
# Merge after approval
```

## 📚 More Information

- [CI/CD Guide](.github/CI_CD_GUIDE.md) - Detailed documentation
- [Contributing Guide](.github/CONTRIBUTING.md) - How to contribute
- [GitHub Actions Docs](https://docs.github.com/en/actions) - Official docs

## 🎉 Done!

Your project now has:
- ✅ Automated testing
- ✅ Code quality checks
- ✅ Security monitoring
- ✅ Professional workflow

**Next steps:**
1. Read [CI/CD Guide](.github/CI_CD_GUIDE.md)
2. Set up monitoring (PHASE 0.3)
3. Configure deployment pipeline
