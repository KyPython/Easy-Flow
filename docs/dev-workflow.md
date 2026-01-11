# Fast Development Workflow

## Quick Commit to Dev Branch

For rapid iteration on the `dev` branch, use these methods to skip slow validations:

### Method 1: Fast Commit Script (Recommended)

```bash
./scripts/fast-commit.sh "Your commit message"
git push --no-verify origin dev
```

### Method 2: Skip Validations with Environment Variable

```bash
SKIP_VALIDATION=true git commit -m "Your commit message"
git push --no-verify origin dev
```

### Method 3: Use --no-verify Flag

```bash
git commit --no-verify -m "Your commit message"
git push --no-verify origin dev
```

## When to Use Fast Commits

✅ **Use fast commits on `dev` branch when:**
- Rapid prototyping
- Quick bug fixes
- WIP commits
- Experimental features

❌ **Don't use fast commits when:**
- Committing to `main` branch
- Ready for production
- Need full validation

## Full Validation (CI/CD)

Full validations still run in CI/CD for `dev` branch on:
- Pull requests
- Scheduled daily checks
- Before merging to `main`

This ensures code quality while allowing fast local iteration.
