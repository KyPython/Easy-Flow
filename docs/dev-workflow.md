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

## Comprehensive CI/CD Coverage

**All checks run automatically in CI/CD - you don't need to run them locally:**

### Code Validation (`code-validation.yml`)
**Triggers:** PRs to `dev`/`main`, daily schedule (3 AM UTC), main branch pushes

- ✅ Single Responsibility Principle (SRP) validation
- ✅ Dynamic code validation (no hardcoded values)
- ✅ Theme consistency validation
- ✅ Logging integration validation
- ✅ Environment-aware messages validation
- ✅ RAG knowledge validation
- ✅ Learning system validation
- ✅ Duplicate code detection
- ✅ Unused code detection
- ✅ Duplicate features detection
- ✅ Duplicate CI/CD workflows detection
- ✅ Code backup verification (GitHub)
- ✅ Test coverage validation
- ✅ Study guide validation

### QA Core (`qa-core.yml`)
**Triggers:** PRs to `main`, main branch pushes

- ✅ Security scan (Snyk) - CRITICAL
- ✅ Auto-fix code formatting
- ✅ Comprehensive test suite
- ✅ Code quality checks
- ✅ Comprehensive code validation
- ✅ Accessibility checks - CRITICAL
- ✅ Integration tests

### QA Dev (`qa-dev.yml`)
**Triggers:** PRs to `dev`, daily schedule (2 AM UTC)

- ✅ Security scan (non-blocking on dev)
- ✅ Auto-fix code formatting
- ✅ Comprehensive test suite (warnings only)
- ✅ Code quality checks (warnings only)
- ✅ Comprehensive code validation (warnings only)

### QA Integration (`qa-integration.yml`)
**Triggers:** PRs to `dev`/`main`, daily schedule (4 AM UTC)

- ✅ Integration test suite
- ✅ Database integration tests
- ✅ Service integration tests

### Quick Checks (`dev-quick-check.yml`)
**Triggers:** Pushes to `dev` branch (non-blocking)

- ✅ Quick syntax check
- ✅ Build verification
- ✅ Fast feedback (5-minute timeout)

**Summary:** CI/CD ensures code quality automatically. Just use normal git commands - all comprehensive checks run in CI/CD on PRs and scheduled runs.
