# Database SRP Analyzer - Quick Start

## Overview

Automatically validate that your database tables follow the Single Responsibility Principle (SRP). Each table should have one clear responsibility and change for only one reason.

## Quick Usage

```bash
# Run the analyzer locally
node scripts/analyze-database-srp.js

# Output shows:
# ✓ Passed: Tables following SRP
# ⚠ Warnings: Tables that should be reviewed
# ✗ Violations: Tables that must be fixed
```

## What It Checks

### ✅ Good Practices
- Tables with focused, single responsibilities
- Reasonable column counts (≤15 ideal, ≤25 max)
- Limited foreign keys (≤5 typical, ≤10 max)
- Minimal JSONB catch-all columns (≤2)
- Clear naming without "and", "with", "combined"
- Proper separation of concerns (auth, data, audit, config)

### ❌ Bad Patterns
- **God tables**: Too many columns (>25)
- **Too many relationships**: Excessive foreign keys (>10)
- **Catch-all columns**: Multiple generic JSONB fields
- **Mixed concerns**: Auth + profile + settings in one table
- **Unclear naming**: Tables named with "and", "with"

## Examples

### ❌ Bad: Violates SRP
```sql
-- This table does too much!
CREATE TABLE user_account (
  -- Auth
  id UUID PRIMARY KEY,
  email TEXT,
  password_hash TEXT,
  
  -- Profile  
  full_name TEXT,
  avatar_url TEXT,
  
  -- Billing
  stripe_id TEXT,
  plan TEXT,
  
  -- Settings
  theme TEXT,
  language TEXT,
  
  -- Usage
  monthly_runs INTEGER,
  storage_bytes BIGINT
);
```

### ✅ Good: Follows SRP
```sql
-- Separate tables for separate concerns
CREATE TABLE user_accounts (id, email, password_hash);
CREATE TABLE user_profiles (id, user_id, full_name, avatar_url);
CREATE TABLE user_subscriptions (id, user_id, stripe_id, plan);
CREATE TABLE user_settings (id, user_id, theme, language);
CREATE TABLE usage_tracking (id, user_id, monthly_runs, storage_bytes);
```

## CI/CD Integration

The analyzer runs automatically on:
- Pull requests with SQL changes
- Pushes to main/develop
- Manual workflow triggers

**Status Meanings:**
- ✅ **Green**: All tables follow SRP
- ⚠️ **Yellow**: Warnings (review recommended, not blocking)
- ❌ **Red**: Violations (must fix before merge)

## Configuration

Edit `.github/database-srp-rules.json` to customize:

```json
{
  "rules": {
    "maxColumnsPerTable": {
      "warning": 15,
      "error": 25
    },
    "maxForeignKeysPerTable": {
      "warning": 5,
      "error": 10
    }
  }
}
```

## Common Fixes

### 1. Split by Concern
```sql
-- Before: users (auth + profile + settings)
-- After:
CREATE TABLE user_auth (...);
CREATE TABLE user_profiles (...);
CREATE TABLE user_settings (...);
```

### 2. Extension Tables
```sql
-- Before: Many nullable columns
CREATE TABLE companies (
  id UUID,
  name TEXT,
  slack_webhook TEXT NULL,
  custom_domain TEXT NULL
);

-- After: Optional features separated
CREATE TABLE companies (id, name);
CREATE TABLE company_integrations (company_id, slack_webhook);
CREATE TABLE company_branding (company_id, custom_domain);
```

### 3. Junction Tables
```sql
-- Before: Too many foreign keys
CREATE TABLE tasks (
  id UUID,
  user_id UUID,
  project_id UUID,
  tag_id UUID,
  team_id UUID
);

-- After: Many-to-many relationships
CREATE TABLE tasks (id, user_id, project_id);
CREATE TABLE task_tags (task_id, tag_id);
CREATE TABLE task_teams (task_id, team_id);
```

## Full Documentation

See [docs/database/DATABASE_SRP_GUIDE.md](./DATABASE_SRP_GUIDE.md) for:
- Detailed explanation of SRP for databases
- More examples and patterns
- Configuration options
- Troubleshooting guide
- Best practices

## Support

Questions? Check the [full guide](./DATABASE_SRP_GUIDE.md) or create an issue.
