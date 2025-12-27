# EasyFlow

**RPA Automation Platform**

## Quick Start

1. Read **[docs/WORKFLOW.md](docs/WORKFLOW.md)** for daily workflow
2. Run `./start-dev.sh` - automatically installs dependencies and starts everything
3. Open http://localhost:3000

**First Time?** The app will **fail loudly** if Firebase config is missing (prevents silent polling floods).

**To fix:**
1. Create `.env.local` if missing: `touch rpa-system/rpa-dashboard/.env.local`
2. Add Firebase credentials (from Firebase Console → Project Settings → General → Your apps)
3. Restart: `./stop-dev.sh && ./start-dev.sh`

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for complete setup instructions.

## Documentation

- **[Daily Workflow](docs/WORKFLOW.md)** - Start/stop, commit, deploy workflow
- **[Vercel Deployment](docs/VERCEL_DEPLOYMENT.md)** - ⚠️ **CRITICAL:** Production branch configuration

## Commands

### Development
```bash
./start-dev.sh      # Start everything (auto-installs dependencies)
./stop-dev.sh       # Stop everything
npm run logs        # Watch logs
```

### Infrastructure as Code (Terraform)
```bash
npm run infra:init      # Initialize Terraform workspace
npm run infra:plan      # Plan infrastructure changes
npm run infra:apply     # Apply infrastructure changes
npm run infra:validate  # Validate Terraform configuration
npm run infra:destroy   # Destroy infrastructure (with confirmation)
npm run infra:fmt       # Format Terraform files
npm run infra:drift     # Detect infrastructure drift
```

### DevOps Suite Tools
```bash
npm run check-env       # Check development environment
npm run lint:test      # Run linting and tests
npm run quality:check   # Code quality scan
npm run gen:route       # Generate route boilerplate
npm run git:status      # Git workflow status
```

### Deployment
```bash
npm run vercel:check  # Verify Vercel is configured correctly (production from main only)
npm run ship          # Deploy to production (merges dev→main)
```
**⚠️ IMPORTANT:** Vercel MUST deploy production from `main` branch only. See [Vercel Deployment Guide](docs/VERCEL_DEPLOYMENT.md).

## URLs

- Frontend: http://localhost:3000
- Backend: http://localhost:3030
- Grafana: http://localhost:3001 (admin/admin123)
