# Terraform Integration in EasyFlow CI/CD

This document describes how Infrastructure as Code (Terraform) is integrated into EasyFlow's DevOps pipeline and processes.

## Overview

Terraform is fully integrated into EasyFlow's CI/CD pipeline, ensuring infrastructure changes are validated, planned, and reviewed before deployment.

## Integration Points

### 1. Pre-Commit Hooks

**Location:** `.husky/pre-commit` → `scripts/pre-commit.sh`

**What it does:**
- Checks if Terraform files (`.tf`) are being committed
- Runs `terraform fmt --check` to ensure formatting
- Runs `terraform validate` to check syntax and logic
- Blocks commit if validation fails

**When it runs:** Before every commit

**How to use:**
```bash
git add infrastructure/main.tf
git commit -m "Add infrastructure"  # Automatically validates
```

### 2. Pre-Push Hooks

**Location:** `.husky/pre-push`

**What it does:**
- **Main branch:** Full Terraform validation (blocks if invalid)
- **Dev branch:** Quick format check (non-blocking)

**When it runs:** Before pushing to remote

**How to use:**
```bash
git push origin main  # Full validation
git push origin dev   # Quick check
```

### 3. GitHub Actions - Terraform Validation

**Location:** `.github/workflows/terraform-validate.yml`

**What it does:**
- Runs on every push/PR that touches `infrastructure/` or Terraform scripts
- Formats check (`terraform fmt --check`)
- Initializes Terraform (`terraform init`)
- Validates configuration (`terraform validate`)
- Runs security scan (Checkov) - non-blocking

**When it runs:**
- Push to `main` or `dev` with infrastructure changes
- Pull requests with infrastructure changes

**View results:** GitHub Actions tab

### 4. GitHub Actions - Terraform Plan

**Location:** `.github/workflows/terraform-plan.yml`

**What it does:**
- Runs `terraform plan` on pull requests
- Shows what infrastructure will change
- Comments plan output on PR
- Uploads plan artifact

**When it runs:**
- Pull requests targeting `main` with infrastructure changes
- Manual workflow dispatch

**View results:** PR comments and GitHub Actions artifacts

### 5. QA Core Workflow

**Location:** `.github/workflows/qa-core.yml`

**What it does:**
- Includes Terraform validation step if infrastructure files changed
- Runs as part of comprehensive QA checks

**When it runs:**
- Push to `main`
- Pull requests to `main`

### 6. Ship to Production Script

**Location:** `scripts/ship-to-production.sh`

**What it does:**
- Validates Terraform before merging to main
- Runs Terraform plan to preview changes
- Blocks deployment if validation fails

**When it runs:**
```bash
npm run ship  # Validates Terraform before shipping
```

### 7. Security Scanning

**Location:** `scripts/security-scan.sh`

**What it does:**
- Scans Terraform files with Checkov
- Scans Terraform with Snyk IaC (if available)
- Reports security vulnerabilities

**When it runs:**
- `npm run security:scan`
- Part of CI/CD workflows
- Pre-commit (non-blocking)

### 8. Development Environment Check

**Location:** `scripts/dev-env-check.sh`

**What it does:**
- Checks if Terraform is installed
- Verifies Terraform version
- Checks if infrastructure directory exists

**When it runs:**
- `npm run check-env`
- Pre-commit checks
- CI/CD workflows

## Workflow Examples

### Making Infrastructure Changes

1. **Edit Terraform files:**
   ```bash
   cd infrastructure
   vim main.tf
   ```

2. **Format files:**
   ```bash
   npm run infra:fmt
   ```

3. **Validate locally:**
   ```bash
   npm run infra:validate
   ```

4. **Plan changes:**
   ```bash
   npm run infra:plan
   ```

5. **Commit (auto-validates):**
   ```bash
   git add infrastructure/
   git commit -m "feat: add new infrastructure"
   # Pre-commit hook validates automatically
   ```

6. **Push (auto-validates):**
   ```bash
   git push origin dev
   # Pre-push hook validates automatically
   ```

7. **Create PR:**
   - GitHub Actions runs Terraform plan
   - Plan output appears in PR comments
   - Review plan before merging

8. **Ship to production:**
   ```bash
   npm run ship
   # Validates Terraform before merging to main
   ```

### CI/CD Pipeline Flow

```
┌─────────────────┐
│  Developer      │
│  edits .tf      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Pre-Commit     │ ← Format check, validate
│  Hook           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Commit         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Pre-Push       │ ← Quick validation
│  Hook           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GitHub Actions │
│  - Validate     │ ← Full validation
│  - Plan         │ ← Generate plan
│  - Security     │ ← Checkov scan
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PR Review      │ ← Plan in comments
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  npm run ship   │ ← Final validation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Merge to main  │
└─────────────────┘
```

## Commands Reference

### Local Development

| Command | Description |
|---------|-------------|
| `npm run infra:init` | Initialize Terraform |
| `npm run infra:plan` | Plan infrastructure changes |
| `npm run infra:apply` | Apply infrastructure changes |
| `npm run infra:validate` | Validate Terraform config |
| `npm run infra:fmt` | Format Terraform files |
| `npm run infra:fmt:check` | Check formatting (CI mode) |
| `npm run infra:drift` | Detect infrastructure drift |

### CI/CD Integration

| Trigger | Action | Result |
|---------|--------|--------|
| Commit `.tf` files | Pre-commit hook | Format + validate |
| Push to `dev` | Pre-push hook | Quick format check |
| Push to `main` | Pre-push hook | Full validation |
| PR with infra changes | GitHub Actions | Plan + validate + security scan |
| `npm run ship` | Ship script | Final validation before merge |

## Security Scanning

### Checkov

Scans Terraform for security misconfigurations:

```bash
pip install checkov
checkov -d infrastructure --framework terraform
```

**Integrated in:**
- GitHub Actions (terraform-validate.yml)
- Security scan script (non-blocking)

### Snyk IaC

Scans Terraform with Snyk:

```bash
snyk iac test infrastructure
```

**Integrated in:**
- Security scan script
- CI/CD workflows

## Best Practices

### ✅ Do This

1. **Always format before committing:**
   ```bash
   npm run infra:fmt
   ```

2. **Validate locally before pushing:**
   ```bash
   npm run infra:validate
   ```

3. **Review plan in PR before merging:**
   - Check GitHub Actions plan output
   - Review PR comments

4. **Use `npm run ship` for production:**
   - Validates Terraform before merge
   - Shows plan preview

### ❌ Don't Do This

1. **Don't skip validation:**
   - Pre-commit hooks will catch issues
   - CI/CD will fail if invalid

2. **Don't commit unformatted files:**
   - Run `npm run infra:fmt` first
   - Or let pre-commit auto-format

3. **Don't apply without reviewing plan:**
   - Always review plan output
   - Check PR comments for plan

4. **Don't bypass hooks:**
   - Use `--no-verify` only in emergencies
   - Fix issues instead of bypassing

## Troubleshooting

### Pre-commit fails with formatting error

```bash
# Fix formatting
npm run infra:fmt

# Try commit again
git add infrastructure/
git commit -m "your message"
```

### Pre-push fails with validation error

```bash
# Validate locally
cd infrastructure
npm run infra:validate

# Fix issues, then push again
```

### GitHub Actions fails

1. Check Actions tab for error details
2. Run validation locally:
   ```bash
   cd infrastructure
   npm run infra:validate
   ```
3. Fix issues and push again

### Plan shows unexpected changes

1. Review plan output in PR comments
2. Check for drift:
   ```bash
   npm run infra:drift
   ```
3. Update code or apply changes as needed

## Related Documentation

- **[Infrastructure as Code Guide](INFRASTRUCTURE_AS_CODE.md)** - Complete Terraform guide
- **[DevOps Suite Requirements](DEVOPS_SUITE_REQUIREMENTS.md)** - DevOps tools documentation
- **[Daily Workflow](WORKFLOW.md)** - Development workflow

## Summary

Terraform is fully integrated into EasyFlow's CI/CD pipeline:

- ✅ **Pre-commit:** Format + validate
- ✅ **Pre-push:** Quick checks (dev) or full validation (main)
- ✅ **GitHub Actions:** Plan + validate + security scan
- ✅ **Ship script:** Final validation before production
- ✅ **Security:** Checkov + Snyk scanning
- ✅ **Environment check:** Terraform installation verification

All infrastructure changes are automatically validated, planned, and reviewed before reaching production.

