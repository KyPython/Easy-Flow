# Daily Workflow

> ** For complete daily workflow guide, see [DAILY_DEVELOPER_GUIDE.md](../DAILY_DEVELOPER_GUIDE.md)**

This is a quick reference. For detailed setup, troubleshooting, and all commands, see the main guide.

---

## Quick Start

### Morning: Start Development
```bash
cd /Users/ky/Easy-Flow
git checkout dev
./start-dev.sh
```

### During Development
- Make changes -> Test in browser
- Watch logs: `npm run logs`
- Commit to dev: `git commit -m "feat: description" && git push origin dev`

### Ship to Production
```bash
npm run ship # Fully automated: validates -> merges -> deploys
```

### Evening: Stop Development
```bash
./stop-dev.sh
```

---

## Branch Strategy

- **Dev Branch** (`dev`): Permissive validation, allows work-in-progress code
- **Main Branch** (`main`): Strict validation, production-ready code only

**See**: [BRANCH_AWARE_CI_CD.md](BRANCH_AWARE_CI_CD.md) for details

---

## Essential Commands

```bash
# Development
./start-dev.sh # Start all services
./stop-dev.sh # Stop all services
npm run logs # Watch logs

# Validation
npm run validate:all # All validations
npm run validate:rag # RAG knowledge validation

# Deployment
npm run ship # Ship to production
```

**See**: [DAILY_DEVELOPER_GUIDE.md](../DAILY_DEVELOPER_GUIDE.md) for complete command reference

---

## URLs

- Frontend: http://localhost:3000
- Backend: http://localhost:3030
- Grafana: http://localhost:3001 (admin/admin123)

---

## Troubleshooting

**Firebase Errors?** See [DAILY_DEVELOPER_GUIDE.md](../DAILY_DEVELOPER_GUIDE.md#troubleshooting)

**Validation Failures?** Run specific validation: `npm run validate:srp`

**Can't Push?** Check you're on dev branch: `git branch`

---

**For complete guide**: [DAILY_DEVELOPER_GUIDE.md](../DAILY_DEVELOPER_GUIDE.md)

