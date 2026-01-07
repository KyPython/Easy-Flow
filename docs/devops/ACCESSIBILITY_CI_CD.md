# Accessibility Checks - CI/CD Integration

## Summary

Accessibility checks are now integrated into the CI/CD pipeline for EasyFlow.

## What Was Implemented

### Dependencies Added

Added to `rpa-system/rpa-dashboard/package.json`:
- `pa11y` - Accessibility testing tool
- `pa11y-ci` - CI-friendly wrapper for pa11y
- `@axe-core/cli` - Alternative accessibility testing tool
- `serve` - Local server for testing built frontend

### CI/CD Workflow

**New Workflow**: `.github/workflows/accessibility.yml`
- Separate accessibility job that runs on pushes and PRs
- Branch-aware: Strict on `main`, permissive on `dev`
- Starts a local server and runs accessibility tests
- Uploads test results as artifacts
- Tests multiple pages (Landing, Dashboard, Integrations, Workflows, Analytics, Teams, Settings, Privacy, Terms)

**Integrated into**: `.github/workflows/qa-core.yml`
- Accessibility checks added to main branch validation
- Blocks production deployment if accessibility violations found

### Configuration

**.pa11yci.json** - Configuration file for pa11y-ci
- Standard: WCAG 2.1 Level AA
- Tests 9 key pages
- Ignores notices and warnings (focuses on errors)
- Chrome launch config for CI environment

### Testing Tools

1. **pa11y-ci**: Primary tool for automated accessibility testing
2. **@axe-core/cli**: Alternative tool for additional coverage
3. **serve**: Local server for testing production builds

### Local Testing

**Script**: `scripts/run-accessibility-tests.sh`
- Builds frontend
- Starts local server
- Runs both pa11y and axe-core tests
- Saves results to `results/` directory

**NPM Scripts** (in `rpa-system/rpa-dashboard/package.json`):
- `npm run accessibility:test` - Run pa11y tests
- `npm run accessibility:axe` - Run axe-core tests
- `npm run accessibility:all` - Run both tools

**Root Script** (in root `package.json`):
- `npm run accessibility:test` - Run full accessibility test suite

## Usage

### Local Testing

```bash
# From project root
npm run accessibility:test

# Or from dashboard directory
cd rpa-system/rpa-dashboard
npm run accessibility:test
npm run accessibility:axe
npm run accessibility:all
```

### CI/CD

Accessibility checks run automatically on:
- Pushes to `main` branch (strict - blocks on failures)
- Pushes to `dev` branch (permissive - warnings only)
- Pull requests to `main` or `dev`

### Pages Tested

1. Landing Page (`/`)
2. Dashboard (`/app/dashboard`)
3. Integrations Page (`/app/integrations`)
4. Workflows Page (`/app/workflows`)
5. Analytics Dashboard (`/app/analytics`)
6. Teams Page (`/app/teams`)
7. Settings Page (`/app/settings`)
8. Privacy Policy (`/privacy`)
9. Terms of Use (`/terms`)

## Standards

- **WCAG 2.1 Level AA** compliance required
- Tests run against production builds (not dev server)
- Both pa11y and axe-core used for comprehensive coverage

## Branch-Aware Behavior

### Main Branch (Strict)
- All accessibility checks must pass
- Failures block merge/deployment
- Ensures production accessibility compliance

### Dev Branch (Permissive)
- Accessibility checks run but are non-blocking
- Warnings logged but don't prevent commits
- Allows work-in-progress code to be saved

## Results

Test results are uploaded as artifacts:
- `accessibility-results` - Contains JSON and HTML reports
- Available for 30 days
- Can be downloaded from GitHub Actions UI

## Troubleshooting

### Local Server Won't Start
- Ensure port 3000 is not in use
- Check that build completed successfully
- Verify `serve` package is installed

### Tests Fail in CI
- Check build output for errors
- Review accessibility reports in artifacts
- Fix WCAG violations and re-run

### False Positives
- Some dynamic content may trigger false positives
- Review `.pa11yci.json` to adjust ignore rules if needed
- Consider adding specific ignore patterns for known issues

## Next Steps

1. Review initial accessibility test results
2. Fix any WCAG violations found
3. Add more pages to test as they're created
4. Consider adding visual regression testing for accessibility

