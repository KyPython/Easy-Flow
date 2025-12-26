# Vercel Deployment Configuration

## Critical: Production Branch Settings

**Vercel MUST be configured to deploy production from `main` branch only.**

### Current Configuration Issue

If Vercel is deploying from `dev` branch, this is **WRONG** and must be fixed immediately.

### How to Fix in Vercel Dashboard

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your EasyFlow project
3. Go to **Settings** → **Git**
4. Under **Production Branch**, ensure it's set to: **`main`**
5. Under **Preview Deployments**, you can enable previews for `dev` branch (these are safe - they're preview URLs, not production)
6. **Save** the settings

### Branch Strategy

- **`main`** = Production (auto-deploys to production domain)
- **`dev`** = Development (should only create preview deployments, NOT production)

### Verification

After fixing:
- Pushes to `main` → Deploys to production
- Pushes to `dev` → Creates preview deployment (optional, safe)

### Build Configuration

The `vercel.json` file in `rpa-system/rpa-dashboard/` contains:
- Build settings (install command, build command, output directory)
- Security headers
- Routing configuration

**Note:** Branch settings are NOT in `vercel.json` - they're in the Vercel dashboard only.

### Deployment Workflow

1. Work on `dev` branch
2. Test locally
3. Run `npm run ship` (merges `dev` → `main` with full checks)
4. Push to `main` triggers Vercel production deployment
5. Production deploys automatically

### Emergency: If Production Deployed from Dev

If production was accidentally deployed from `dev`:
1. Immediately check Vercel dashboard settings
2. Fix production branch to `main`
3. Redeploy from `main` branch
4. Verify production is on correct code

