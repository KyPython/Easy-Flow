# Database Single Responsibility Principle (SRP) Validation

This guide explains how to ensure your database tables follow the Single Responsibility Principle and how the automated CI/CD checks work.

## What is SRP for Database Tables?

Just like application code, database tables should follow the Single Responsibility Principle. Each table should have **one clear responsibility** and should only change for one reason.

### Benefits of SRP in Database Design

1. **Easier to understand**: Tables with focused purposes are clearer
2. **Better performance**: Smaller, focused tables are faster to query and index
3. **Reduced coupling**: Changes to one concern don't affect others
4. **Improved maintainability**: Easier to modify without breaking other features
5. **Better testability**: Focused tables are easier to seed and test

## Signs Your Table Violates SRP

- ❌ Too many columns (>25)
- ❌ Too many foreign keys (>10)
- ❌ Multiple JSONB catch-all columns
- ❌ Table name contains "and", "with", "combined"
- ❌ Columns that change at different rates
- ❌ Mixed concerns (auth + data, config + runtime)

## Examples

### ❌ BAD: Violates SRP

```sql
-- This table has too many responsibilities
CREATE TABLE user_account (
  -- Authentication
  id UUID PRIMARY KEY,
  email TEXT,
  password_hash TEXT,
  
  -- Profile
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  
  -- Billing
  stripe_customer_id TEXT,
  subscription_plan TEXT,
  subscription_expires_at TIMESTAMPTZ,
  
  -- Settings
  theme TEXT,
  language TEXT,
  notifications JSONB,
  
  -- Usage tracking
  monthly_runs INTEGER,
  storage_bytes BIGINT,
  
  -- Audit
  last_login_at TIMESTAMPTZ,
  last_login_ip INET
);
```

### ✅ GOOD: Follows SRP

```sql
-- Authentication only
CREATE TABLE user_accounts (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profile data only
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_accounts(id),
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT
);

-- Billing only
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_accounts(id),
  stripe_customer_id TEXT,
  plan_id UUID REFERENCES plans(id),
  expires_at TIMESTAMPTZ
);

-- User preferences only
CREATE TABLE user_settings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_accounts(id),
  theme TEXT,
  language TEXT,
  email_notifications BOOLEAN
);

-- Usage tracking only
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_accounts(id),
  monthly_runs INTEGER,
  storage_bytes BIGINT,
  tracking_month DATE
);

-- Audit logs only
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_accounts(id),
  action TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Running the SRP Analyzer

### Locally

```bash
# Basic usage (uses default paths)
node scripts/analyze-database-srp.js

# Custom paths
node scripts/analyze-database-srp.js \
  .github/database-srp-rules.json \
  docs/database/master_schema.sql
```

### In CI/CD

The analyzer runs automatically:
- On pull requests that change SQL files
- On pushes to main/develop branches
- Can be triggered manually via workflow_dispatch

### Output Example

```
Analyzing 50 database tables for Single Responsibility Principle...

=== Database SRP Analysis Report ===

✓ Passed: 35 tables
⚠ Warnings: 10 tables
✗ Violations: 5 tables

=== VIOLATIONS (Must Fix) ===

Table: user_profiles
  ✗ Table has 28 columns (max: 25). Tables with too many columns likely have multiple responsibilities
    → Consider splitting into multiple tables based on different concerns

  ✗ Table has 8 foreign keys (warning threshold: 5). Too many foreign keys suggest a table is trying to relate to too many concerns
    Relationships: user_id -> auth.users, organization_id -> organizations, plan_id -> plans, ...
    → Consider using junction tables or splitting responsibilities

=== General Recommendations ===

When to split a table:
  • Table has columns that change at different rates
  • Table has multiple distinct groups of columns
  • Table has many nullable columns (optional features)
  • Table name contains 'and', 'with', or multiple nouns
  • Table serves multiple user stories or use cases

Split strategies:
  Vertical Split
    When: Columns belong to different concerns
    Example: Split 'users' into 'user_accounts' and 'user_profiles'
```

## Configuration

Edit `.github/database-srp-rules.json` to customize:

### Thresholds

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
    },
    "maxJsonbColumnsPerTable": {
      "warning": 2,
      "error": 4
    }
  }
}
```

### Custom Validations

```json
{
  "customValidations": {
    "workflows": {
      "concern": "Workflow definition only",
      "shouldNotContain": ["execution_data", "runtime_state"],
      "notes": "Consider separating workflow definition from execution"
    }
  }
}
```

### Excluded Tables

```json
{
  "excludedTables": [
    "schema_migrations",
    "temporary_table"
  ]
}
```

## How to Fix Violations

### 1. Vertical Split (Different Concerns)

**Problem**: Table mixes authentication, profile, and settings

**Solution**: Create separate tables

```sql
-- Before: user_accounts (auth + profile + settings)

-- After:
CREATE TABLE user_auth (id, email, password_hash);
CREATE TABLE user_profiles (id, user_id, name, avatar);
CREATE TABLE user_settings (id, user_id, theme, language);
```

### 2. Extension Tables (Optional Features)

**Problem**: Many nullable columns for optional features

**Solution**: Move optional features to separate tables

```sql
-- Before: 
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  name TEXT,
  -- Optional premium features
  slack_webhook TEXT NULL,
  custom_domain TEXT NULL,
  sso_config JSONB NULL
);

-- After:
CREATE TABLE companies (id, name);
CREATE TABLE company_premium_features (
  company_id UUID REFERENCES companies(id),
  slack_webhook TEXT,
  custom_domain TEXT,
  sso_config JSONB
);
```

### 3. Junction Tables (Too Many Foreign Keys)

**Problem**: Table has many foreign keys

**Solution**: Use junction tables

```sql
-- Before:
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  workflow_id UUID REFERENCES workflows(id),
  project_id UUID REFERENCES projects(id),
  team_id UUID REFERENCES teams(id),
  tag_id UUID REFERENCES tags(id)
);

-- After:
CREATE TABLE tasks (id, user_id, workflow_id);
CREATE TABLE task_projects (task_id, project_id);
CREATE TABLE task_teams (task_id, team_id);
CREATE TABLE task_tags (task_id, tag_id);
```

### 4. Normalize JSONB (Structured Data in JSONB)

**Problem**: Multiple JSONB columns or structured data in JSONB

**Solution**: Extract to proper tables

```sql
-- Before:
CREATE TABLE workflows (
  id UUID PRIMARY KEY,
  name TEXT,
  config JSONB,
  settings JSONB,
  metadata JSONB
);

-- After:
CREATE TABLE workflows (id, name);
CREATE TABLE workflow_configs (workflow_id, key, value);
CREATE TABLE workflow_settings (workflow_id, setting_name, setting_value);
```

## CI/CD Integration

### Workflow Triggers

The `database-srp-check.yml` workflow runs when:

1. **Pull Request**: Any SQL file changes in:
   - `migrations/**/*.sql`
   - `supabase/migrations/**/*.sql`
   - `docs/database/**/*.sql`

2. **Push to main/develop**: Same path filters

3. **Manual**: Via GitHub Actions UI

### What the Workflow Does

1. ✅ Checks out code
2. ✅ Validates SRP rules JSON
3. ✅ Analyzes schema against rules
4. ✅ Generates detailed report
5. ✅ Comments on PR with results
6. ✅ Fails if violations found (blocking)
7. ⚠️ Warns if issues found (non-blocking)

### Workflow Status

- **✅ Green**: All tables follow SRP
- **⚠️ Yellow**: Some warnings (review recommended)
- **❌ Red**: Violations found (must fix before merge)

## Best Practices

### DO ✅

- Keep tables focused on a single entity or concept
- Use clear, descriptive table names
- Normalize data appropriately
- Separate concerns (auth, data, audit, config)
- Use foreign keys to establish relationships
- Create junction tables for many-to-many relationships

### DON'T ❌

- Mix authentication and user data in one table
- Create "god tables" with 30+ columns
- Use multiple generic JSONB columns
- Name tables with "and", "with", "combined"
- Store both configuration and runtime data together
- Put audit logs in the same table as business data

## Troubleshooting

### "Schema file not found"

Ensure `docs/database/master_schema.sql` exists and is up to date.

### "Rules file invalid"

Check JSON syntax in `.github/database-srp-rules.json`

```bash
node -e "JSON.parse(require('fs').readFileSync('.github/database-srp-rules.json', 'utf8'))"
```

### False Positives

Add table to `excludedTables` or adjust thresholds in rules file.

### Too Many Warnings

Review thresholds - they may be too strict for your use case. Adjust in rules file:

```json
{
  "rules": {
    "maxColumnsPerTable": {
      "warning": 20,  // Increased from 15
      "error": 30     // Increased from 25
    }
  }
}
```

## Additional Resources

- [Database Normalization](https://en.wikipedia.org/wiki/Database_normalization)
- [SOLID Principles for Database Design](https://www.red-gate.com/simple-talk/databases/sql-server/database-administration-sql-server/solid-database-design/)
- [Single Responsibility Principle](https://en.wikipedia.org/wiki/Single-responsibility_principle)

## Support

For questions or issues with the SRP analyzer:

1. Check existing GitHub issues
2. Review this documentation
3. Create a new issue with:
   - Schema snippet causing issues
   - Expected vs actual behavior
   - Configuration being used
