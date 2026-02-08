# Architecture Decision Record: Files Table Split

**Date**: 2026-02-08  
**Status**: Implemented  
**Decision**: Split monolithic `files` table into 5 focused tables following Single Responsibility Principle

## Problem
The `files` table violated the Single Responsibility Principle with **28 columns**, exceeding the maximum threshold of 25. It was mixing multiple concerns:
- File identity and metadata
- Storage technical details
- Organization and classification
- Workflow/task relationships
- Access tracking

## Solution
Split the monolithic `files` table into **5 focused tables**, each with a single responsibility:

### 1. `file_metadata` (10 columns)
**Responsibility**: Core file identity and metadata
- `id`, `user_id`, `original_name`, `display_name`, `description`
- `mime_type`, `file_extension`, `file_size`
- `created_at`, `updated_at`

### 2. `file_storage` (9 columns)
**Responsibility**: Storage location and technical details
- `id`, `file_id`, `storage_path`, `storage_bucket`, `storage_key`
- `file_path`, `checksum_md5`, `thumbnail_path`
- `created_at`

### 3. `file_organization` (10 columns)
**Responsibility**: File organization and classification
- `id`, `file_id`, `folder_path`, `tags`, `visibility`
- `is_temporary`, `expires_at`, `metadata`
- `created_at`, `updated_at`

### 4. `file_workflow_links` (7 columns)
**Responsibility**: Relationships to workflows and tasks
- `id`, `file_id`, `task_id`, `run_id`, `automation_run_id`
- `file_type`, `created_at`

### 5. `file_access_tracking` (6 columns)
**Responsibility**: Usage statistics
- `id`, `file_id`, `download_count`, `last_accessed`
- `created_at`, `updated_at`

## Benefits

### ✅ Single Responsibility Principle
Each table now has one clear responsibility and changes for one reason only.

### ✅ Better Performance
- Smaller tables are faster to query
- Better index efficiency
- Can query only what you need

### ✅ Easier Maintenance
- Changes to storage details don't affect metadata
- Can modify organization without touching tracking
- Clear separation of concerns

### ✅ Better Security
- Can apply different RLS policies per concern
- Track access separately from metadata
- Isolate sensitive storage details

### ✅ Backward Compatibility
Created a view `files` that joins all tables, maintaining compatibility with existing queries:
```sql
SELECT * FROM files; -- Still works!
```

## Implementation Details

### Schema Changes

**Migration**: `supabase/migrations/20260208_split_files_table_srp.sql`

The migration:
- Creates 5 new focused tables
- Migrates all existing data automatically
- Creates backward-compatible `files` view
- Sets up RLS policies
- Creates performance indexes

### Application Integration

The `files` view provides backward compatibility:
```sql
SELECT * FROM files; -- Still works with all existing code
```

For new code, query specific tables for better performance:
```javascript
// Old: Query everything
const file = await supabase
  .from('files')
  .select('*')
  .eq('id', fileId)
  .single();
```

Use specific tables for better performance:
```javascript
// New: Query only what you need
const metadata = await supabase
  .from('file_metadata')
  .select('*')
  .eq('id', fileId)
  .single();

// Only fetch storage if needed
if (needStorage) {
  const storage = await supabase
    .from('file_storage')
    .select('*')
    .eq('file_id', fileId)
    .single();
}
```

### 3. Join When Needed
```javascript
// Get file with storage info
const file = await supabase
  .from('file_metadata')
  .select(`
    *,
    storage:file_storage(*),
    organization:file_organization(*),
    tracking:file_access_tracking(*)
  `)
  .eq('id', fileId)
  .single();
```

## Results & Metrics

### SRP Compliance
- **Before**: 1 violation (files: 28 columns)
- **After**: 0 violations
- **New Tables**: All 5 tables pass SRP checks (6-10 columns each)

### Overall Database Health
- **Before**: 33 passed, 31 warnings, 1 violation
- **After**: 37 passed, 32 warnings, 0 violations

## Decision Rationale

1. **SRP Compliance**: Single table was doing too much (metadata + storage + organization + tracking + relationships)
2. **Performance**: Smaller, focused tables are faster to query and index
3. **Maintainability**: Changes to one concern don't affect others
4. **Security**: Granular RLS policies per concern
5. **Scalability**: Each table can scale independently

## Consequences

### Positive
- Zero SRP violations in database
- Better query performance
- Clearer data organization
- More flexible RLS policies
- Easier to maintain and evolve

### Neutral
- Need to use JOINs for complex queries (mitigated by view)
- Slightly more complex schema diagram

### Negative
- None identified - backward compatibility maintained via view

## References

- Migration: `supabase/migrations/20260208_split_files_table_srp.sql`
- SRP Rules: `.github/database-srp-rules.json`
- SRP Guide: `docs/database/DATABASE_SRP_GUIDE.md`
