# Code Quality Guidelines for EasyFlow

> **"Software Entropy"** - The Pragmatic Programmer

This document outlines code quality standards and tools for EasyFlow, adapted from [software-entropy](https://github.com/KyPython/software-entropy).

## 🎯 Overview

EasyFlow uses automated code quality checks to detect code smells and maintain high code quality standards. This helps prevent technical debt and keeps the codebase maintainable.

## 🔍 Code Quality Checks

### Automated Scanning

EasyFlow uses **software-entropy** to scan for:

1. **Long Functions** - Functions exceeding 50 lines (configurable)
2. **Large Files** - Files exceeding 500 lines (configurable)
3. **TODO/FIXME Density** - High concentration of TODO/FIXME comments (5 per 100 lines)

### Running Quality Checks

```bash
# Quick quality check
npm run quality:check

# Full scan with software-entropy
npm run quality:scan

# Custom thresholds
MAX_FUNCTION_LINES=30 MAX_FILE_LINES=300 npm run quality:check
```

## 📊 Quality Thresholds

### Default Thresholds

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| **Function Length** | 50 lines | Functions should be focused and testable |
| **File Length** | 500 lines | Large files are harder to maintain |
| **TODO Density** | 5 per 100 lines | High TODO density indicates incomplete work |

### EasyFlow-Specific Considerations

Some files may legitimately exceed thresholds:

- **`app.js`** (7092 lines) - Main application file (consider refactoring)
- **Generated files** - Auto-generated code may be large
- **Configuration files** - Large config objects are acceptable

## 🚨 Common Code Smells

### 1. Long Functions

**Problem:** Functions that do too much are hard to test and maintain.

**Solution:**
- Extract smaller, focused functions
- Use early returns to reduce nesting
- Break complex logic into helper functions

**Example:**
```javascript
// ❌ Bad: Long function
function processUser(user) {
  // 100+ lines of logic
}

// ✅ Good: Focused functions
function validateUser(user) { /* ... */ }
function enrichUserData(user) { /* ... */ }
function saveUser(user) { /* ... */ }
function processUser(user) {
  validateUser(user);
  enrichUserData(user);
  return saveUser(user);
}
```

### 2. Large Files

**Problem:** Large files are hard to navigate and understand.

**Solution:**
- Split into multiple modules
- Extract related functionality into separate files
- Use composition over large classes

**Example:**
```javascript
// ❌ Bad: app.js with 7000+ lines
// All routes, middleware, and logic in one file

// ✅ Good: Modular structure
// app.js - Main application setup
// routes/ - Route handlers
// services/ - Business logic
// middleware/ - Middleware functions
```

### 3. High TODO Density

**Problem:** Too many TODOs indicate incomplete work or technical debt.

**Solution:**
- Convert TODOs to GitHub issues
- Address or remove outdated TODOs
- Use TODO comments sparingly for planned work

**Example:**
```javascript
// ❌ Bad: Many TODOs
// TODO: Fix this
// TODO: Add validation
// TODO: Handle errors
// TODO: Optimize query
// TODO: Add tests

// ✅ Good: Convert to issues or implement
// Issue #123: Add input validation
// Issue #124: Optimize database queries
```

## 🛠️ Quality Check Integration

### Pre-Commit Hook

Code quality checks run automatically before commits:

```bash
# Pre-commit hook includes quality check
git commit -m "feat: add feature"
# → Runs code quality check automatically
```

### CI/CD Integration

Quality checks are integrated into:

- **Pre-commit hooks** - Quick check before commit
- **Test suite** - Full check in `test-all.sh`
- **GitHub Actions** - Automated checks in CI/CD

### Manual Checks

```bash
# Run quality check manually
npm run quality:check

# Run with custom output
./scripts/code-quality-check.sh report.json

# Run software-entropy directly
npm run quality:scan
```

## 📋 Quality Checklist

Before submitting code:

- [ ] No functions exceed 50 lines
- [ ] No files exceed 500 lines (unless justified)
- [ ] TODO/FIXME comments are minimal and tracked
- [ ] Code follows project style guidelines
- [ ] Functions are focused and testable
- [ ] Files are well-organized and modular

## 🎓 Best Practices

### Function Length

- **Target:** 20-30 lines per function
- **Maximum:** 50 lines (configurable)
- **Exception:** Complex algorithms may be longer if well-documented

### File Organization

- **Target:** 200-300 lines per file
- **Maximum:** 500 lines (configurable)
- **Exception:** Configuration or data files may be larger

### TODO Management

- **Use sparingly:** Only for planned, tracked work
- **Convert to issues:** Long-term TODOs should be GitHub issues
- **Remove outdated:** Clean up TODOs that are no longer relevant

## 🔧 Customization

### Adjusting Thresholds

Set environment variables:

```bash
# Stricter thresholds
MAX_FUNCTION_LINES=30 MAX_FILE_LINES=300 npm run quality:check

# More lenient thresholds
MAX_FUNCTION_LINES=100 MAX_FILE_LINES=1000 npm run quality:check
```

### Excluding Files

The quality check automatically excludes:
- `node_modules/`
- `dist/` and `build/`
- `__pycache__/`
- Test files (`*.test.js`, `*.spec.js`)
- Coverage reports

## 📊 Quality Metrics

### Current Status

Run quality check to see current metrics:

```bash
npm run quality:check
```

### Tracking Over Time

Save reports to track improvements:

```bash
# Generate report
./scripts/code-quality-check.sh reports/quality-$(date +%Y%m%d).json

# Compare over time
diff reports/quality-20250101.json reports/quality-20250115.json
```

## 🚀 Integration with Development Workflow

### 1. Before Committing

```bash
# Pre-commit hook runs automatically
git commit -m "feat: add feature"
# → Quality check runs automatically
```

### 2. Before PR

```bash
# Run full quality check
npm run quality:check

# Fix issues before creating PR
```

### 3. In CI/CD

Quality checks run automatically in:
- Pre-commit hooks
- Test suite (`test-all.sh`)
- GitHub Actions workflows

## 🎓 Training Materials

Comprehensive training guide available:

- **[Code Quality Training Guide](docs/CODE_QUALITY_TRAINING.md)** - Complete training materials
  - Understanding code quality principles
  - Identifying and fixing code smells
  - Refactoring techniques
  - Hands-on exercises

## 📊 Automated Reporting Dashboard

### Generate HTML Report

```bash
# Generate HTML dashboard
npm run quality:report

# Open the report
open reports/quality/latest.html
```

The dashboard shows:
- Total files scanned
- Issues by severity (high, medium, low)
- Detailed issue list with file locations
- Historical tracking

### CI/CD Integration

Quality reports are automatically:
- Generated in CI/CD pipelines
- Uploaded as artifacts
- Available for 30 days

## ⚙️ Custom Rules Configuration

EasyFlow uses `.code-quality-config.json` for custom rules:

```json
{
  "rules": {
    "longFunction": {
      "enabled": true,
      "threshold": 50,
      "severity": "medium"
    },
    "largeFile": {
      "enabled": true,
      "threshold": 500,
      "severity": "high",
      "exceptions": ["app.js"]
    }
  }
}
```

Edit this file to:
- Adjust thresholds per rule
- Enable/disable specific rules
- Add file exceptions
- Configure reporting options

## 📚 References

- [Software Entropy Tool](https://github.com/KyPython/software-entropy) - Original tool
- [Code Quality Training](docs/CODE_QUALITY_TRAINING.md) - Training guide
- [The Pragmatic Programmer](https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/) - Software Entropy chapter
- [Code Review Guidelines](.github/CODE_REVIEW_GUIDELINES.md) - Review standards

## 🎯 Goals

The goal of code quality checks is to:

1. **Prevent Technical Debt** - Catch issues early
2. **Maintain Readability** - Keep code understandable
3. **Enable Refactoring** - Make code easier to change
4. **Improve Maintainability** - Reduce long-term costs

---

**Remember**: Code quality is not about perfection—it's about maintainability. Small, focused functions and well-organized files make the codebase easier to understand, test, and modify.

