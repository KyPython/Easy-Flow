# Branch-Aware CI/CD Pipeline

## Overview

EasyFlow uses a **branch-aware CI/CD pipeline** that enforces different validation levels based on the branch:

- **Dev Branch**: Permissive (warnings only, non-blocking)
- **Main Branch**: Strict (all checks must pass, blocking)

This ensures:
- ✅ **No code loss**: Dev branch allows commits even if checks fail
- ✅ **Production quality**: Main branch enforces strict validation
- ✅ **Fully automated**: No manual verification needed

---

## Branch Strategy

### Dev Branch (`dev`)
**Purpose**: Daily development work, experimentation, work-in-progress

**Validation Level**: **Permissive**
- All checks run but are **non-blocking**
- Warnings are logged but don't prevent commits/pushes
- Allows code to be saved even if incomplete
- Prevents loss of work-in-progress code

**When to use**:
- Daily development
- Feature development
- Experimentation
- Bug fixes in progress

### Main Branch (`main`)
**Purpose**: Production-ready code that users will see

**Validation Level**: **Strict**
- All checks are **blocking**
- Failures prevent commits/pushes
- Must pass all validations before merging
- Ensures production quality

**When to use**:
- Production deployments
- Stable releases
- Code ready for users

---

## CI/CD Workflows

### 1. QA Dev Workflow (`qa-dev.yml`)
**Triggers**: Pushes/PRs to `dev` branch

**Checks** (all non-blocking):
- ✅ Development environment check
- ⚠️ Security scan (Snyk) - warning only
- ⚠️ Test suite - warning only
- ⚠️ Code quality - warning only
- ⚠️ Code validation (SRP, Dynamic, Theme, Logging) - warning only
- ⚠️ RAG knowledge validation - warning only

**Result**: Always passes (warnings logged)

### 2. QA Core Workflow (`qa-core.yml`)
**Triggers**: Pushes/PRs to `main` branch only

**Checks** (all blocking):
- ✅ Development environment check
- ❌ Security scan (Snyk) - **BLOCKS on high+ vulnerabilities**
- ❌ Test suite - **BLOCKS on failures**
- ⚠️ Code quality - warning only
- ❌ Code validation (SRP, Dynamic, Theme, Logging) - **BLOCKS on failures**
- ❌ RAG knowledge validation - **BLOCKS on failures**
- ❌ Terraform validation - **BLOCKS on failures**
- ❌ Full test suite with services - **BLOCKS on failures**

**Result**: Fails if any blocking check fails

### 3. Code Validation Workflow (`code-validation.yml`)
**Triggers**: Pushes/PRs to both `main` and `dev` branches

**Behavior**: **Branch-aware**
- **Dev branch**: Non-blocking (warnings only)
- **Main branch**: Blocking (failures prevent merge)

**Checks**:
- SRP validation
- Dynamic code validation
- Theme consistency validation
- Logging integration validation
- RAG knowledge validation

---

## Pre-Commit Hook

**Location**: `scripts/pre-commit.sh`

**Behavior**: **Branch-aware**

### Dev Branch
- All checks run but are **non-blocking**
- Warnings are shown but don't prevent commit
- Allows saving work-in-progress code

### Main Branch
- All checks are **blocking**
- Failures prevent commit
- Must fix issues before committing

**Checks**:
- Frontend linting
- Backend linting
- Test suite (non-blocking on dev)
- Build verification
- Environment check
- Code quality check
- Quick validation checks (SRP, Theme)
- Terraform validation (if infrastructure files changed)

---

## Ship to Production Script

**Location**: `scripts/ship-to-production.sh`

**Purpose**: Fully automated merge from `dev` to `main`

**Process** (fully automated, no manual steps):

1. **Validate on Dev Branch**:
   - Run full test suite
   - Run security scan
   - Run comprehensive code validation
   - Validate RAG knowledge
   - Validate Terraform (if applicable)

2. **Push Dev Branch**:
   - Ensure dev is pushed to remote

3. **Switch to Main Branch**:
   - Checkout main
   - Pull latest main

4. **Merge Dev into Main**:
   - Merge dev into main (no-ff)
   - Handle conflicts (if any)

5. **Final Validation on Main**:
   - Run full test suite on main
   - Verify everything works

6. **Push to Main**:
   - Push to main (triggers production deployment)

**All steps are automated** - no manual verification needed!

---

## Validation Levels

### Permissive (Dev Branch)

| Check | Dev Branch Behavior |
|-------|-------------------|
| Security Scan | ⚠️ Warning only |
| Tests | ⚠️ Warning only |
| Code Quality | ⚠️ Warning only |
| SRP Validation | ⚠️ Warning only |
| Dynamic Code | ⚠️ Warning only |
| Theme Consistency | ⚠️ Warning only |
| Logging Integration | ⚠️ Warning only |
| RAG Knowledge | ⚠️ Warning only |
| Terraform | ⚠️ Warning only |

### Strict (Main Branch)

| Check | Main Branch Behavior |
|-------|-------------------|
| Security Scan | ❌ **BLOCKS** on high+ vulnerabilities |
| Tests | ❌ **BLOCKS** on failures |
| Code Quality | ⚠️ Warning only |
| SRP Validation | ❌ **BLOCKS** on failures |
| Dynamic Code | ❌ **BLOCKS** on failures |
| Theme Consistency | ❌ **BLOCKS** on failures |
| Logging Integration | ❌ **BLOCKS** on failures |
| RAG Knowledge | ❌ **BLOCKS** on failures |
| Terraform | ❌ **BLOCKS** on failures |

---

## Workflow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Workflow                       │
└─────────────────────────────────────────────────────────────┘

1. Work on Dev Branch
   ├─ Commit code (pre-commit: non-blocking)
   ├─ Push to dev (qa-dev.yml: warnings only)
   └─ Continue development

2. Ready for Production
   ├─ Run: npm run ship
   ├─ Script validates on dev
   ├─ Script merges dev → main
   ├─ Script validates on main
   └─ Script pushes to main (triggers deployment)

3. Main Branch
   ├─ qa-core.yml runs (strict validation)
   ├─ All checks must pass
   └─ Production deployment triggered
```

---

## Automation Checklist

✅ **Fully Automated**:
- Pre-commit hooks (branch-aware)
- Dev branch validation (non-blocking)
- Main branch validation (blocking)
- Ship to production script (fully automated)
- All CI/CD workflows (no manual steps)

✅ **No Manual Verification Needed**:
- All checks run automatically
- Results are logged and visible
- Failures are clearly reported
- Fixes are guided by error messages

✅ **Branch-Aware**:
- Dev branch: Permissive (warnings only)
- Main branch: Strict (blocking)
- Workflows know which branch they're on
- Appropriate validation level applied

---

## Usage

### Daily Development (Dev Branch)

```bash
# Work on dev branch
git checkout dev

# Make changes
# ... edit files ...

# Commit (pre-commit runs, non-blocking)
git commit -m "WIP: new feature"

# Push (qa-dev.yml runs, warnings only)
git push origin dev
```

### Shipping to Production

```bash
# From dev branch
npm run ship

# Script automatically:
# 1. Validates on dev
# 2. Merges to main
# 3. Validates on main
# 4. Pushes to main
# 5. Triggers deployment
```

### Manual Validation

```bash
# Run all validations locally
npm run validate:all

# Run specific validation
npm run validate:srp
npm run validate:rag
npm run validate:theme

# Run tests
npm run test:all
```

---

## Troubleshooting

### Dev Branch Checks Failing

**Issue**: Checks are failing but you want to commit

**Solution**: This is expected! Dev branch is permissive - warnings don't block commits. Fix issues before merging to main.

### Main Branch Checks Failing

**Issue**: Can't push to main because checks are failing

**Solution**: 
1. Fix the issues reported in the workflow
2. Run `npm run validate:all` locally to verify
3. Push again when all checks pass

### Ship Script Failing

**Issue**: `npm run ship` fails during validation

**Solution**:
1. Check which step failed
2. Fix the reported issues
3. Run the validation locally: `npm run validate:all`
4. Try shipping again

### Pre-Commit Blocking on Dev

**Issue**: Pre-commit is blocking commits on dev branch

**Solution**: 
1. Check you're on dev branch: `git branch`
2. Verify pre-commit hook is up to date
3. If still blocking, check for critical errors (build failures)

---

## Best Practices

1. **Work on Dev Branch**: Always develop on `dev` branch
2. **Commit Often**: Dev branch allows frequent commits
3. **Fix Warnings Before Merging**: Address warnings before shipping to main
4. **Use Ship Script**: Always use `npm run ship` to merge to main
5. **Verify Locally**: Run `npm run validate:all` before shipping
6. **Monitor CI/CD**: Check workflow results in GitHub Actions

---

## Related Documentation

- [Code Validation System](./CODE_VALIDATION_SYSTEM.md)
- [RAG Knowledge Validation](./RAG_KNOWLEDGE_VALIDATION.md)
- [Ship to Production Guide](./SHIP_TO_PRODUCTION.md)

---

**Last Updated**: 2025-01-XX
**Status**: ✅ Fully Automated & Branch-Aware

