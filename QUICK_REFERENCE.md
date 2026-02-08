# EasyFlow Quick Reference

Common commands and patterns for development.

## Development Commands

### Start Development
```bash
# Start all services
./start-dev.sh

# Start with local Supabase fallback
./start-dev.sh  # Auto-detects and uses local if cloud unavailable

# Stop services
./stop-dev.sh
```

### Testing
```bash
# Run all tests
cd rpa-system/rpa-dashboard && npm test

# Run backend tests
cd rpa-system/backend && npm test

# Run with coverage
npm test -- --coverage
```

### Linting
```bash
# Lint frontend
cd rpa-system/rpa-dashboard && npm run lint

# Lint backend
cd rpa-system/backend && npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### Building
```bash
# Build frontend
cd rpa-system/rpa-dashboard && npm run build

# Build check (no output)
npm run build -- --dry-run
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feat/my-feature

# Run validations before commit
./scripts/test-all-validations.sh

# Commit (pre-commit hooks run automatically)
git commit -m "feat: add feature"

# Push (pre-push hooks run build)
git push origin feat/my-feature
```

## Environment Variables

### Required
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Optional
```
OPENAI_API_KEY=xxx           # AI features
STRIPE_SECRET_KEY=xxx        # Payments
SENDGRID_API_KEY=xxx         # Emails
ANTHROPIC_API_KEY=xxx       # (Optional) Anthropic Claude API key
DEFAULT_AI_PROVIDER=openai    # Set to 'anthropic' to prefer Claude
DEFAULT_AI_MODEL=claude-haiku-4.5  # Example model name for Claude Haiku
```

## Database Commands

```bash
# Start local Supabase
npx supabase start

# Run migrations
npx supabase db push

# Generate types
npx supabase gen types typescript
```

## Debugging

### Check Logs
```bash
# PM2 logs
pm2 logs

# Specific service
pm2 logs backend
pm2 logs dashboard
```

### Common Issues
- **Port in use**: `lsof -i :3000` then `kill -9 <PID>`
- **Node modules**: `rm -rf node_modules && npm install`
- **Build cache**: `rm -rf build .cache`

## Useful Paths

| Purpose | Path |
|---------|------|
| Backend entry | `rpa-system/backend/app.js` |
| Frontend entry | `rpa-system/rpa-dashboard/src/index.js` |
| API routes | `rpa-system/backend/routes/` |
| React pages | `rpa-system/rpa-dashboard/src/pages/` |
| Shared hooks | `rpa-system/rpa-dashboard/src/hooks/` |
| Env example | `.env.example` |
