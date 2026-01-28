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
- Run full validation locally: `./scripts/validate-all.sh` (see checklist below)

---

## Production Validation Checklist (What Must Pass for `npm run ship`)

When `npm run ship` runs, it calls `./scripts/validate-all.sh`. That script runs a set of validators; **all of them must pass** before the ship step will succeed.

At the time of the last run, these were the **main blockers** and the **specific files** involved:

- **SRP Validation (`scripts/validate-srp.sh`)**
  - **Flagged docs (too many topics/sections)**:
    - `docs/philosophy/ROCKEFELLER_IMPLEMENTATION_PLAN.md`
    - `docs/philosophy/SOFTWARE_ENTROPY_INTEGRATION_COMPLETE.md`
    - `docs/philosophy/SOFTWARE_ENTROPY_PHILOSOPHY.md`
    - `docs/philosophy/SOFTWARE_ENTROPY_INTEGRATION_PLAN.md`
    - `docs/visual-design-implementation-guide.md`
  - **Refactor plan (SRP)**:
    - Split each of the above into **smaller, focused docs**, e.g.:
      - Move implementation details into `docs/development/` (or a new implementation doc).
      - Keep high‑level philosophy in one short file per concept.
    - For **code SRP issues** (reported in the SRP validator output), follow this pattern per file:
      - Extract long functions (>100 lines) into helpers in the same folder.
      - If a file has many responsibilities (e.g. routes + business logic + config), split into:
        - `*Config.js` – constants and config.
        - `*Service.js` – pure business logic.
        - `*Routes.js` / controller – thin HTTP layer calling the service.

- **Dynamic Code Validation (`scripts/validate-dynamic-code.sh`)**
  - **Backend middleware & core app**:
    - `rpa-system/backend/app.js`
    - `rpa-system/backend/middleware/planEnforcement.js`
    - `rpa-system/backend/middleware/telemetryInit.js`
    - `rpa-system/backend/middleware/comprehensiveRateLimit.js`
  - **Backend utility/config files**:
    - `rpa-system/backend/utils/appConfig.js`
    - `rpa-system/backend/utils/consumerErrorMessages.js`
    - `rpa-system/backend/utils/ssrfProtection.js`
    - `rpa-system/backend/utils/firebaseAdmin.js`
    - `rpa-system/backend/utils/emailTemplates.js`
  - **Backend scripts (dev/test tooling)**:
    - `rpa-system/backend/seed-dev-user.js`
    - `rpa-system/backend/scripts/create_and_get_token.js`
    - `rpa-system/backend/scripts/test_event_forwarder.js`
    - `rpa-system/backend/scripts/get_test_token.js`
    - `rpa-system/backend/scripts/verify-otel-credentials.js`
    - `rpa-system/backend/scripts/seed-portal-csv-template.js`
    - `rpa-system/backend/scripts/seed_templates.js`
  - **Backend routes with hardcoded URLs/paths/magic numbers**:
    - `rpa-system/backend/routes/emailCaptureRoutes.js`
    - `rpa-system/backend/routes/polarRoutes.js`
    - `rpa-system/backend/routes/dataRetention.js`
    - `rpa-system/backend/routes/scheduleRoutes.js`
    - `rpa-system/backend/routes/adminAnalyticsRoutes.js`
    - `rpa-system/backend/routes/webhookRoutes.js`
    - `rpa-system/backend/routes/feedbackRoutes.js`
    - `rpa-system/backend/routes/teamRoutes.js`
    - `rpa-system/backend/routes/integrationRoutes.js`
    - `rpa-system/backend/routes/businessRulesRoutes.js`
    - `rpa-system/backend/routes/roiAnalytics.js`
    - `rpa-system/backend/routes/accessibleOSTasks.js`
    - `rpa-system/backend/routes/scrapingRoutes.js`
    - `rpa-system/backend/routes/trackingRoutes.js`
    - `rpa-system/backend/routes/executionRoutes.js`
    - `rpa-system/backend/routes/workflowVersioning.js`
    - `rpa-system/backend/routes/aiAgentRoutes.js`
    - `rpa-system/backend/routes/businessMetrics.js`
    - `rpa-system/backend/routes/demoRoutes.js`
    - `rpa-system/backend/routes/auditLogs.js`
    - `rpa-system/backend/routes/workflowRecoveryRoutes.js`
  - **Backend services with magic numbers / hardcoded URLs**:
    - `rpa-system/backend/services/costSavingsCalculator.js`
    - `rpa-system/backend/services/aiDataExtractor.js`
    - `rpa-system/backend/services/aiWorkflowAgent.js`
    - `rpa-system/backend/services/proxyManager.js`
    - `rpa-system/backend/services/workflowExecutor.js`
    - `rpa-system/backend/services/dataRetentionService.js`
    - `rpa-system/backend/services/linkDiscoveryService.js`
    - `rpa-system/backend/services/integrationFramework.js`
    - `rpa-system/backend/services/companyEnrichmentService.js`
    - `rpa-system/backend/services/ragClient.js`
    - `rpa-system/backend/services/antiBotService.js`
  - **Refactor plan (dynamic code)** – repeat these steps per file above:
    - **URLs & external endpoints**:
      - Replace hardcoded URLs with config/env, e.g.:
        - In config: `const OTEL_EXPORTER_URL = process.env.OTEL_EXPORTER_URL;`
        - In code: use `OTEL_EXPORTER_URL` instead of inline `"https://..."`.
    - **Credentials/secrets**:
      - Move any tokens/passwords into `.env` and reference via `process.env.*`.
      - Keep sample/example values only in docs or `.env.example`, never in code.
    - **Magic numbers**:
      - Extract repeated counts/thresholds/durations into named constants:
        - e.g. `const MAX_RETRY_ATTEMPTS = 3;`, `const SCRAPING_BATCH_SIZE = 50;`
      - Group related constants into config objects (`rateLimitConfig`, `roiBuckets`, etc.).
    - **File paths**:
      - Replace hardcoded string paths with `path.join` and/or config:
        - e.g. `path.join(__dirname, '..', 'templates', 'email')`
      - Where appropriate, make root directories configurable via env/config.

- **Other validators (Theme, Logging, Env‑Aware Messages, RAG, Learning, Duplicates, Backup, Coverage)**
  - These also run from `scripts/validate-*.sh` and were failing on the last run.
  - **How to see exact current files**:
    - Run: `./scripts/validate-all.sh`
    - Then inspect the section for each validator; every `⚠ path/to/file` line shows a flagged file.
  - **High‑level refactor themes**:
    - **Theme consistency**: dashboard components should use the shared theme (hooks or CSS variables), not hardcoded colors/inline styles.
    - **Logging integration**: use the central logger/telemetry wrapper instead of raw `console.*` in backend and dashboard hot paths.
    - **Env‑aware messages**: route user‑facing strings through the env‑aware message helper (e.g. `getEnvMessage`) instead of inline literals.
    - **RAG & learning**: keep `ragClient.js` + AI workflow knowledge up to date with the actual workflow types; ensure learning hooks are invoked on success/failure paths.
    - **Duplicate features / CI/CD / backup**: consolidate overlapping routes/components/workflows and ensure the backup verification script’s expectations (scheduled backup, bucket/location) are met.

**Workflow for you next time:**

- If `npm run ship` fails:
  - Run `./scripts/validate-all.sh`.
  - Use the lists above as your **roadmap of files to touch**.
  - After refactoring a group (e.g. a couple of routes + one service), re‑run `./scripts/validate-all.sh` until everything is green, then rerun `npm run ship`.

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

