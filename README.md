# EasyFlow

**RPA Automation Platform**

## Quick Start

1. Read **[docs/WORKFLOW.md](docs/WORKFLOW.md)** for daily workflow
2. Run `./start-dev.sh` - automatically installs dependencies and starts everything
3. Open http://localhost:3000

## Documentation

- **[Daily Workflow](docs/WORKFLOW.md)** - Start/stop, commit, deploy workflow
- **[Vercel Deployment](docs/VERCEL_DEPLOYMENT.md)** - ⚠️ **CRITICAL:** Production branch configuration
- **[Infrastructure as Code](docs/INFRASTRUCTURE_AS_CODE.md)** - Terraform guide for managing infrastructure
- **[DevOps Suite Requirements](docs/DEVOPS_SUITE_REQUIREMENTS.md)** - DevOps tools documentation

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
