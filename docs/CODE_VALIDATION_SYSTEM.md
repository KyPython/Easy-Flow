# Code Validation System

## Overview

EasyFlow's comprehensive code validation system ensures all code meets quality standards before shipping to production. The system validates:

1. **Single Responsibility Principle (SRP)** - Files, methods, functions, and documentation
2. **Dynamic Code** - Code is configurable and flexible
3. **Theme Consistency** - All components use ThemeContext
4. **Logging Integration** - All logs use the observability system

## Validation Scripts

### 1. Single Responsibility Principle (SRP) Validation

**Script:** `scripts/validate-srp.sh`

**What it checks:**
- Files with too many functions (> 20)
- Files with too many lines (> 1000)
- Functions with too many lines (> 100)
- Classes with too many methods (> 15)
- Documentation with too many topics (> 5)

**Why it matters:**
- Single responsibility makes code easier to understand, test, and maintain
- Large files/functions indicate multiple responsibilities
- Violations lead to technical debt and bugs

**Example violations:**
```javascript
// ❌ BAD: File with 25 functions (multiple responsibilities)
// app.js - handles routing, auth, database, business logic

// ✅ GOOD: Split into focused modules
// routes.js - only routing
// auth.js - only authentication
// database.js - only database operations
```

### 2. Dynamic Code Validation

**Script:** `scripts/validate-dynamic-code.sh`

**What it checks:**
- Hardcoded URLs (should use environment variables)
- Hardcoded API keys/tokens (security + not dynamic)
- Magic numbers (should be constants or config)
- Hardcoded file paths (should be configurable)
- Files with hardcoded values that don't use env/config

**Why it matters:**
- Dynamic code is easier to deploy across environments
- Hardcoded values create maintenance burden
- Configuration makes code flexible and testable

**Example violations:**
```javascript
// ❌ BAD: Hardcoded values
const API_URL = 'https://api.example.com';
const API_KEY = 'sk_live_1234567890';

// ✅ GOOD: Dynamic configuration
const API_URL = process.env.API_URL || 'https://api.example.com';
const API_KEY = process.env.API_KEY;
```

### 3. Theme Consistency Validation

**Script:** `scripts/validate-theme-consistency.sh`

**What it checks:**
- React components that don't use ThemeContext
- Hardcoded colors (should use theme)
- Inline styles without theme (should use CSS modules)
- CSS files without CSS variables (should use theme.css)

**Why it matters:**
- Consistent theming across the app
- Easy theme switching (light/dark)
- Maintainable styling system

**Example violations:**
```jsx
// ❌ BAD: Hardcoded colors, no theme
<div style={{ color: '#2563eb', backgroundColor: '#ffffff' }}>

// ✅ GOOD: Uses theme context
const { theme } = useTheme();
<div className={styles.container} data-theme={theme}>
```

### 4. Logging Integration Validation

**Script:** `scripts/validate-logging-integration.sh`

**What it checks:**
- Backend: `console.log` instead of `createLogger()`
- Frontend: `console.log` instead of `createLogger()`
- Python: `print()` instead of `logging` module
- Files that log but don't use structured logger

**Why it matters:**
- All logs integrated with observability system
- Structured logging enables trace correlation
- Centralized log management and analysis

**Example violations:**
```javascript
// ❌ BAD: console.log (not integrated with observability)
console.log('User logged in', userId);

// ✅ GOOD: Structured logger (integrated with observability)
const logger = createLogger('auth');
logger.info('User logged in', { userId });
```

## Integration Points

### CI/CD Pipeline

**GitHub Actions:**
- `.github/workflows/code-validation.yml` - Dedicated validation workflow
- `.github/workflows/qa-core.yml` - Includes validation in QA pipeline

**When it runs:**
- On push to `main` or `dev` branches
- On pull requests targeting `main` or `dev`
- Manual trigger via `workflow_dispatch`

**Behavior:**
- **Blocking:** All checks must pass before code can be merged
- **Fails build:** If any validation fails, CI/CD fails

### Production Deployment

**Script:** `scripts/ship-to-production.sh`

**Step 2.25:** Runs comprehensive code validation
- Blocks production deployment if validation fails
- Must pass before merging to `main`

### Pre-commit Hook

**Script:** `scripts/pre-commit.sh`

**Step 6.5:** Quick validation checks
- **Non-blocking** in pre-commit (warns only)
- **Blocking** in CI/CD and production deployment
- Provides early feedback to developers

## Usage

### Run All Validations

```bash
# Via npm
npm run validate:all

# Direct script
./scripts/validate-all.sh
```

### Run Individual Checks

```bash
# SRP validation
npm run validate:srp

# Dynamic code validation
npm run validate:dynamic

# Theme consistency validation
npm run validate:theme

# Logging integration validation
npm run validate:logging
```

## Configuration

### SRP Thresholds

Edit `scripts/validate-srp.sh` to adjust:
- `MAX_FUNCTIONS_PER_FILE=20`
- `MAX_METHODS_PER_CLASS=15`
- `MAX_LINES_PER_FUNCTION=100`
- `MAX_LINES_PER_FILE=1000`
- `MAX_TOPICS_PER_DOC=5`

### Dynamic Code Rules

Edit `scripts/validate-dynamic-code.sh` to adjust:
- Hardcoded URL detection patterns
- Magic number thresholds
- File path detection

### Theme Validation

Edit `scripts/validate-theme-consistency.sh` to adjust:
- Theme context import patterns
- CSS variable patterns
- Inline style thresholds

### Logging Validation

Edit `scripts/validate-logging-integration.sh` to adjust:
- Logger import patterns
- Anti-pattern detection (console.log, print)

## Fixing Violations

### SRP Violations

1. **Large files:** Split into smaller, focused modules
2. **Long functions:** Extract logic into smaller functions
3. **Large classes:** Break into smaller, focused classes
4. **Multi-topic docs:** Split into separate documentation files

### Dynamic Code Violations

1. **Hardcoded URLs:** Move to environment variables
2. **Hardcoded keys:** Use environment variables or secure config
3. **Magic numbers:** Extract to named constants or config
4. **Hardcoded paths:** Use `path.join()` or configuration

### Theme Consistency Violations

1. **No ThemeContext:** Import and use `useTheme()` hook
2. **Hardcoded colors:** Use theme colors or CSS variables
3. **Inline styles:** Use CSS modules with theme variables
4. **CSS without variables:** Use CSS variables from `theme.css`

### Logging Integration Violations

1. **Backend console.log:** Replace with `createLogger()` from `structuredLogging`
2. **Frontend console.log:** Replace with `createLogger()` from `utils/logger`
3. **Python print():** Replace with `logging` module

## Examples

### Fixing SRP Violation

**Before:**
```javascript
// app.js - 2000 lines, 50 functions
// Handles routing, auth, database, business logic, etc.
```

**After:**
```javascript
// routes.js - routing only
// auth.js - authentication only
// database.js - database operations only
// businessLogic.js - business logic only
```

### Fixing Dynamic Code Violation

**Before:**
```javascript
const API_URL = 'https://api.example.com';
const TIMEOUT = 5000;
```

**After:**
```javascript
const API_URL = process.env.API_URL || 'https://api.example.com';
const TIMEOUT = parseInt(process.env.API_TIMEOUT || '5000', 10);
```

### Fixing Theme Violation

**Before:**
```jsx
<div style={{ color: '#2563eb' }}>
```

**After:**
```jsx
const { theme } = useTheme();
<div className={styles.container} data-theme={theme}>
```

### Fixing Logging Violation

**Before:**
```javascript
console.log('User logged in', userId);
```

**After:**
```javascript
const logger = createLogger('auth');
logger.info('User logged in', { userId });
```

## Best Practices

1. **Run validations locally** before committing
2. **Fix violations early** to avoid blocking CI/CD
3. **Use validation scripts** in your development workflow
4. **Review validation output** to understand violations
5. **Refactor incrementally** to fix violations over time

## Troubleshooting

### Validation Fails in CI/CD

1. Run validation locally: `npm run validate:all`
2. Review violations in output
3. Fix violations in your code
4. Commit and push again

### False Positives

If a validation incorrectly flags code:
1. Review the validation script logic
2. Adjust thresholds in the script
3. Add exceptions for specific patterns if needed

### Performance

Validation scripts are designed to be fast:
- Only scan relevant file types
- Skip test files and build artifacts
- Use efficient grep/awk patterns

## Summary

The code validation system ensures:
- ✅ **SRP compliance** - Code is maintainable and focused
- ✅ **Dynamic code** - Code is flexible and configurable
- ✅ **Theme consistency** - UI is consistent and themable
- ✅ **Logging integration** - All logs are observable

All validations are **blocking** in CI/CD and production deployment, ensuring code quality before shipping.

