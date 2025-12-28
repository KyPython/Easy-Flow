# CI/CD Pipeline - Simple Overview

**Efficient, automatic, and easy to understand**

---

## 🎯 How It Works (Simple)

### Dev Branch → Push
1. **You push code to `dev`**
2. **Pipeline runs automatically** (`qa-dev.yml`)
3. **All checks are warnings only** (non-blocking)
4. **Code is saved** (no work lost)

### Dev → Main → Production
1. **You run `npm run ship`**
2. **Script validates on dev** (blocks if critical issues)
3. **Script merges dev → main** (automatic)
4. **Pipeline runs on main** (`qa-core.yml`) - strict validation
5. **If all pass → deploys to production** (automatic)

---

## 📋 What Runs When

### Dev Branch (Permissive)
**Workflow**: `qa-dev.yml`
- ✅ Runs automatically on push/PR to `dev`
- ⚠️ All checks are warnings (non-blocking)
- ✅ Code can be pushed even if checks fail
- ✅ Prevents work loss
- 🔧 Auto-fixes formatting issues before tests

**Checks**:
- Auto-fix formatting (ESLint, Terraform, Shell)
- Security scan (warning)
- Tests (warning)
- Code quality (warning)
- Code validation (warning)
- RAG knowledge (warning)

### Main Branch (Strict)
**Workflow**: `qa-core.yml`
- ✅ Runs automatically on push/PR to `main`
- ❌ Critical checks are blocking
- ❌ Must pass before merge/deploy
- ✅ Ensures production quality
- 🔧 Auto-fixes formatting issues before tests

**Checks**:
- Auto-fix formatting (ESLint, Terraform, Shell)
- Security scan (blocks on high+ vulnerabilities)
- Tests (blocks on failures)
- Code validation (blocks on failures)
- RAG knowledge (blocks on failures)
- Terraform (blocks on failures)

---

## ⚡ Efficiency Features

### Automatic Caching
- **npm dependencies cached** (faster installs)
- **Only runs when needed** (Terraform only on infrastructure changes)
- **Parallel execution** where possible

### Smart Execution
- **Dev branch**: Fast feedback, non-blocking
- **Main branch**: Thorough validation, blocking
- **Conditional checks**: Terraform only runs if infrastructure files changed
- **Auto-fix**: Automatically fixes formatting issues (ESLint, Terraform, Shell)

---

## 🔄 Complete Flow

```
Developer Workflow:
┌─────────────────────────────────────────┐
│ 1. Work on dev branch                  │
│    git checkout dev                    │
│    ... make changes ...                │
│    git commit -m "feat: x"             │
│    git push origin dev                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 2. qa-dev.yml runs automatically       │
│    ✓ Security scan (warning)           │
│    ✓ Tests (warning)                   │
│    ✓ Validation (warning)              │
│    → Always passes (warnings logged)   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 3. Ready for production?                │
│    npm run ship                         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 4. Ship script validates on dev         │
│    ✓ Tests must pass                    │
│    ✓ Security must pass                 │
│    ✓ Validation must pass               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 5. Ship script merges dev → main        │
│    (automatic)                          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 6. qa-core.yml runs automatically       │
│    ✓ Security scan (blocks)             │
│    ✓ Tests (blocks)                     │
│    ✓ Validation (blocks)                │
│    ✓ RAG knowledge (blocks)              │
│    → Must all pass                      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 7. Production deployment                │
│    (automatic if all checks pass)       │
└─────────────────────────────────────────┘
```

---

## ✅ Automation Checklist

- ✅ **No manual steps** - Everything runs automatically
- ✅ **Branch-aware** - Different rules for dev vs main
- ✅ **Efficient** - Caching, conditional execution
- ✅ **Simple** - Clear workflow names, obvious behavior
- ✅ **Fast feedback** - Dev branch gives quick warnings
- ✅ **Production safety** - Main branch enforces quality

---

## 🚀 Usage

### Daily Development
```bash
# Just push to dev - pipeline runs automatically
git push origin dev
```

### Ship to Production
```bash
# One command - everything automated
npm run ship
```

---

## 📊 Pipeline Summary

| Branch | Workflow | Blocking | Purpose |
|--------|----------|----------|---------|
| `dev` | `qa-dev.yml` | ❌ No | Allow WIP code |
| `main` | `qa-core.yml` | ✅ Yes | Ensure quality |

**Result**: Simple, efficient, automatic ✅

---

**Last Updated**: 2025-01-XX
**Status**: ✅ Fully Automated & Optimized

