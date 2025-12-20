# Scripts Directory

**Quick reference for all development and deployment scripts**

## Development Scripts

- **`dev-env-check.sh`** - Check development environment setup (runs automatically in start-dev.sh)
- **`pre-commit.sh`** - Pre-commit validation (runs automatically via git hook)
- **`test-all.sh`** - Run full test suite (runs automatically before push)
- **`lint-and-test.sh`** - Quick linting and tests
- **`watch-logs.sh`** - Watch all logs at once (color-coded) - use `npm run logs`

## Code Quality

- **`code-quality-check.sh`** - Run code quality scans (runs automatically in pre-commit)
- **`export-quality-metrics.sh`** - Export quality metrics to Prometheus format
- **`generate-quality-report.sh`** - Generate HTML quality reports - use `npm run quality:report`

## Code Generation

- **`code-generator.sh`** - Generate boilerplate code (routes, services, components, automation)
  - Use: `npm run gen:route`, `npm run gen:service`, `npm run gen:component`, `npm run gen:automation`

## Git Workflow

- **`git-workflow-helper.sh`** - Git branch/commit helpers
  - Use: `npm run git:branch:create`, `npm run git:status`, `npm run git:rebase`
- **`setup-git-hooks.sh`** - Setup Git hooks (pre-commit, commit-msg)

## Deployment

- **`deploy.sh`** - Production deployment
- **`simple-deploy.sh`** - Deployment simulation

## Infrastructure

- **`init-kafka-topics.sh`** - Initialize Kafka topics

---

**For daily use, see:** [../docs/WORKFLOW.md](../docs/WORKFLOW.md)

