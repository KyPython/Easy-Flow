# Scripts Directory

**All scripts from the DevOps Productivity Suite + essential EasyFlow infrastructure**

## 🔧 Shell Games Toolkit

- **`dev-env-check.sh`** - Check development environment setup (runs automatically in start-dev.sh)
- **`simple-deploy.sh`** - Deployment simulation - use `npm run deploy-sim`

## ⚙️ Ubiquitous Automation

- **`pre-commit.sh`** - Pre-commit validation (runs automatically via git hook)
- **`test-all.sh`** - Run full test suite (runs automatically before push) - use `npm run test:all`
- **`lint-and-test.sh`** - Quick linting and tests - use `npm run lint:test`
- **`setup-git-hooks.sh`** - Setup Git hooks (one-time setup)

## 📝 Git Workflows Sample

- **`git-workflow-helper.sh`** - Git branch/commit helpers
  - Use: `npm run git:branch:create`, `npm run git:status`, `npm run git:rebase`

## 🏗️ Code Generator Tool

- **`code-generator.sh`** - Generate boilerplate code (routes, services, components, automation)
  - Use: `npm run gen:route`, `npm run gen:service`, `npm run gen:component`, `npm run gen:automation`

## 🔍 Software Entropy

- **`code-quality-check.sh`** - Run code quality scans (runs automatically in pre-commit)
- **`export-quality-metrics.sh`** - Export quality metrics to Prometheus format (runs automatically when Prometheus scrapes `/metrics/code-quality` every 5 minutes - no manual run needed)
- **`generate-quality-report.sh`** - Generate HTML quality reports - use `npm run quality:report`

## 🚀 EasyFlow Infrastructure (Essential)

- **`init-kafka-topics.sh`** - Initialize Kafka topics (runs automatically in start-dev.sh)
- **`watch-logs.sh`** - Watch all logs at once (color-coded) - use `npm run logs`

---

**For daily use, see:** [../docs/WORKFLOW.md](../docs/WORKFLOW.md)

