# Contributing Guide

## 🤝 Welcome

Thank you for considering contributing to Telegram Food Bot! This document will help you get started.

## 🚀 Quick Start

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/telegram-food-bot.git
   cd telegram-food-bot
   ```
3. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 🧪 Testing Requirements

### Before Submitting PR

All pull requests MUST pass the following checks:

1. **Unit Tests** (77 tests must pass)
   ```bash
   cd backend
   npm test
   ```

2. **Code Linting**
   ```bash
   npm run lint
   ```

3. **Type Check**
   ```bash
   npm run build
   ```

4. **Coverage** (maintain >80%)
   ```bash
   npm run test:coverage
   ```

### Writing Tests

- Add tests for all new features
- Update tests for modified functionality
- Follow existing test patterns:
  ```typescript
  describe('ServiceName', () => {
    describe('methodName', () => {
      it('should do something', () => {
        // Arrange
        // Act
        // Assert
      });
    });
  });
  ```

## 📝 Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes
- `perf`: Performance improvements

### Examples

```bash
feat(menu): add bulk menu item upload
fix(poll): resolve race condition in poll completion
docs(readme): update installation instructions
test(user): add tests for user authentication
```

## 🔄 Pull Request Process

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks locally**
   ```bash
   npm test
   npm run lint
   npm run build
   ```

3. **Push your changes**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create Pull Request**
   - Fill out the PR template
   - Link related issues
   - Wait for CI/CD checks to pass
   - Respond to review feedback

## 🎯 Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer interfaces over types for objects
- Use explicit return types for functions
- Use async/await over promises

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Interfaces**: `PascalCase` (no `I` prefix)

### Example

```typescript
// ✅ Good
export class MenuService {
  private readonly MAX_ITEMS = 100;
  
  async getActiveMenuItems(): Promise<MenuItem[]> {
    // Implementation
  }
}

// ❌ Bad
export class menuService {
  private max_items = 100;
  
  getActiveMenuItems() {
    // Implementation
  }
}
```

## 🐛 Reporting Bugs

### Before Submitting

- Check existing issues
- Verify it's reproducible
- Test on latest version

### Bug Report Template

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Step one
2. Step two
3. ...

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- Node.js version:
- OS:
- Telegram client:

## Additional Context
Screenshots, logs, etc.
```

## 💡 Feature Requests

### Feature Request Template

```markdown
## Feature Description
Clear description of the feature

## Use Case
Why is this feature needed?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches you've thought about

## Additional Context
Mockups, examples, etc.
```

## 📚 Documentation

### When to Update Docs

- Adding new features
- Changing existing behavior
- Adding new dependencies
- Updating configuration

### Documentation Files

- `README.md` - Main documentation
- `.github/CI_CD_GUIDE.md` - CI/CD information
- `docs/` - Detailed guides
- Inline code comments for complex logic

## ⚡ Performance Guidelines

- Optimize database queries
- Use caching where appropriate
- Avoid N+1 queries
- Use connection pooling
- Profile before optimizing

## 🔒 Security Guidelines

- Never commit secrets or keys
- Use environment variables
- Validate all user inputs
- Use parameterized queries
- Follow OWASP guidelines

## 📦 Dependencies

### Adding Dependencies

- Justify why it's needed
- Check license compatibility
- Verify no security vulnerabilities
- Update package-lock.json

### Updating Dependencies

```bash
npm audit          # Check vulnerabilities
npm outdated       # Check outdated packages
npm update         # Update packages
npm test           # Verify tests still pass
```

## 🤔 Questions?

- Check [Documentation](docs/)
- Review [CI/CD Guide](.github/CI_CD_GUIDE.md)
- Ask in Discussions
- Contact maintainers

## 🎉 Thank You!

Your contributions make this project better for everyone!
