# Development Workflow

## Normal Git Commands Work (No Special Commands Needed)

The pre-commit hook is **automatically optimized** for the `dev` branch:

```bash
# Just use normal git commands - they're fast on dev branch!
git add .
git commit -m "Your commit message"
git push origin dev
```

The hook automatically:
- ✅ Skips slow operations on `dev` branch (linting, builds, validation)
- ✅ Runs full checks on `main` branch (production safety)
- ✅ Completes in <0.1 seconds on `dev` (vs ~1.5 minutes before)

## Full Validation (CI/CD)

**All comprehensive checks run automatically in CI/CD:**

- ✅ Linting (frontend + backend)
- ✅ Build verification
- ✅ Test suites
- ✅ Code quality checks
- ✅ Security scans
- ✅ Validation checks (SRP, theme, etc.)
- ✅ Duplicate code detection
- ✅ Unused code detection
- ✅ Test coverage validation

CI/CD runs on:
- Pull requests to `dev` or `main`
- Scheduled daily checks
- Before merging to `main`

This ensures code quality while keeping local development fast and friction-free.
