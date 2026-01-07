# Feature Shipping Guide

A repeatable process for assessing feature readiness and shipping ready features to production.

**Cross-platform compatible**: Works on macOS, Linux, and Windows (via Git Bash, WSL, or native bash).

---

## Quick Start

### 1. Assess Feature Readiness

Check which features are ready for production:

```bash
npm run assess:features
```

This will:
- Extract features from commit messages (looks for `feat:` or `feature:` prefixes)
- Check if features have tests
- Validate code quality
- Generate a readiness report in `.features/readiness-report.txt`
- Update `.features/features.json` manifest

### 2. Ship Ready Features

Ship all ready features to production:

```bash
npm run ship:features
```

This will:
- Run feature assessment
- Show ready features
- Confirm shipping (unless in CI mode)
- Merge dev -> main
- Run validation checks
- Push to main (triggers production deployment)
- Update feature manifest with shipped status

---

## How It Works

### Feature Detection

Features are automatically detected from commit messages:
- `feat: add user authentication`
- `feature: implement payment processing`
- `feat: new dashboard UI`

### Readiness Criteria

A feature is considered "ready" when:
- Has associated tests
- Passes code quality validation
- Passes code validation (SRP, theme, logging, etc.)

### Feature States

Features progress through these states:
1. **draft** - Newly detected, not yet ready
2. **ready** - Meets all readiness criteria
3. **shipped** - Deployed to production

---

## CI/CD Integration

### Automated Assessment

Feature assessment runs automatically:
- **On dev branch pushes** - Optional assessment (non-blocking)
- **Daily at 9 AM UTC** - Scheduled assessment
- **Manual trigger** - Via GitHub Actions workflow dispatch

### Workflow: `assess-features.yml`

**Triggers:**
- `workflow_dispatch` - Manual trigger with optional auto-ship
- `schedule` - Daily at 9 AM UTC
- `push` - When assessment scripts change

**Outputs:**
- Feature manifest artifact (`.features/features.json`)
- Assessment summary in GitHub Actions summary
- Ready features list

**Auto-ship Option:**
- Enable `auto_ship: true` in workflow dispatch to automatically ship ready features
- Requires proper git configuration and permissions

---

## Manual Usage

### Check Feature Status

```bash
# View current feature manifest
cat .features/features.json | jq '.'

# View only ready features
cat .features/features.json | jq '.[] | select(.status == "ready")'

# View shipped features
cat .features/features.json | jq '.[] | select(.status == "shipped")'
```

### View Reports

```bash
# Latest readiness report
cat .features/readiness-report.txt

# Shipping reports
ls -la .features/shipping-report-*.txt
```

---

## File Structure

```
.features/
+── features.json # Feature manifest (all features)
+── readiness-report.txt # Latest readiness assessment
+── shipping-report-*.txt # Shipping reports (timestamped)

scripts/
+── assess-feature-readiness.sh # Assessment script
+── ship-features.sh # Shipping script
```

---

## Feature Manifest Schema

```json
{
 "name": "Feature Name",
 "commit": "abc123",
 "status": "ready|draft|shipped",
 "has_tests": true,
 "validation_passed": true,
 "date_created": "2025-01-15T10:00:00Z",
 "date_ready": "2025-01-16T14:30:00Z",
 "date_shipped": null,
 "reasons": []
}
```

---

## Platform Compatibility

### Supported Platforms
- **macOS** - Native bash support
- **Linux** - All distributions with bash
- **Windows** - Git Bash, WSL, or native bash (Windows 10+)

### Requirements
- **bash** 3.2+ (most systems have this)
- **git** - For version control
- **jq** - JSON processor (install instructions provided if missing)
- **npm** - For npm scripts

### Installing jq (if missing)

**macOS:**
```bash
brew install jq
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt-get install jq
```

**Linux (RHEL/CentOS):**
```bash
sudo yum install jq
```

**Windows:**
```bash
# Chocolatey
choco install jq

# Scoop
scoop install jq

# Or download from: https://stedolan.github.io/jq/download/
```

## Troubleshooting

### No Features Detected

- Ensure commit messages use `feat:` or `feature:` prefix
- Check git history: `git log --oneline --grep="feat:"`
- Script searches last 30 days by default, then all commits on current branch

### Features Not Ready

- Check test coverage: Ensure tests exist for feature files
- Run validation: `npm run validate:all`
- Check readiness report: `cat .features/readiness-report.txt`

### Shipping Fails

- Ensure you're on `dev` branch
- Check for uncommitted changes: `git status`
- Verify tests pass: `npm run test:all`
- Check security scan: `npm run security:scan`

---

## Best Practices

1. **Use Conventional Commits**: Always prefix feature commits with `feat:` or `feature:`
2. **Write Tests**: Features need tests to be considered ready
3. **Regular Assessment**: Run `npm run assess:features` regularly to track progress
4. **Review Before Shipping**: Always review ready features before shipping
5. **Monitor After Shipping**: Check production after shipping to ensure features work correctly

---

## Integration with Existing Workflows

This process integrates seamlessly with:
- `npm run ship` - Full dev -> main merge (ships everything)
- `npm run ship:features` - Feature-aware shipping (ships only ready features)
- CI/CD workflows - Automatic assessment on dev branch
- GitHub Actions - Scheduled and manual assessment

---

## Examples

### Daily Workflow

```bash
# Morning: Check what's ready
npm run assess:features

# Review ready features
cat .features/features.json | jq '.[] | select(.status == "ready")'

# Ship when ready
npm run ship:features
```

### CI/CD Workflow

1. Push to `dev` branch
2. CI runs assessment (optional, non-blocking)
3. Review assessment results in GitHub Actions
4. Manually trigger `assess-features.yml` with `auto_ship: true` if ready
5. Or run locally: `npm run ship:features`

---

## Related Commands

- `npm run assess:features` - Assess feature readiness
- `npm run ship:features` - Ship ready features
- `npm run ship` - Ship entire dev branch (all changes)
- `npm run validate:all` - Run all validation checks
- `npm run test:all` - Run all tests

