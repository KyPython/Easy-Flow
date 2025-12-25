-- Performance Indexes for EasyFlow Database
-- These indexes are critical for optimal query performance, especially for the /api/runs endpoint
-- Generated based on actual schema from codebase analysis
-- Run these in your Supabase SQL editor to improve query performance

-- ============================================================================
-- AUTOMATION_RUNS TABLE INDEXES (Most Critical - /api/runs endpoint)
-- ============================================================================

-- Composite index for main /api/runs query: filter by user_id, order by started_at DESC
-- This is the PRIMARY index for the slow /api/runs endpoint
CREATE INDEX IF NOT EXISTS idx_automation_runs_user_id_started_at 
ON automation_runs(user_id, started_at DESC);

-- Index for task_id lookups (used when joining with automation_tasks)
-- Partial index (only indexes non-null values) for better performance
CREATE INDEX IF NOT EXISTS idx_automation_runs_task_id 
ON automation_runs(task_id) 
WHERE task_id IS NOT NULL;

-- Index for status filtering (used in usage tracking and analytics)
CREATE INDEX IF NOT EXISTS idx_automation_runs_user_id_status_created_at 
ON automation_runs(user_id, status, created_at DESC);

-- Index for created_at queries (used in usageTracker and adminAnalytics)
CREATE INDEX IF NOT EXISTS idx_automation_runs_user_id_created_at 
ON automation_runs(user_id, created_at DESC);

-- ============================================================================
-- AUTOMATION_TASKS TABLE INDEXES
-- ============================================================================

-- Primary key index (should already exist, but ensuring it's there)
CREATE INDEX IF NOT EXISTS idx_automation_tasks_id 
ON automation_tasks(id);

-- Index for user_id lookups (used when fetching tasks by user)
CREATE INDEX IF NOT EXISTS idx_automation_tasks_user_id_active 
ON automation_tasks(user_id, is_active) 
WHERE is_active = true;

-- ============================================================================
-- FILE SHARES TABLE INDEXES
-- ============================================================================

-- Index for fetching all shares for a user (used in /api/files/shares)
CREATE INDEX IF NOT EXISTS idx_file_shares_shared_by_created_at 
ON file_shares(shared_by, created_at DESC);

-- Index for file_id lookups (used when fetching shares for specific file)
CREATE INDEX IF NOT EXISTS idx_file_shares_file_id 
ON file_shares(file_id);

-- Index for share_token lookups (used in /api/shared/access)
CREATE INDEX IF NOT EXISTS idx_file_shares_token 
ON file_shares(share_token);

-- ============================================================================
-- FILES TABLE INDEXES
-- ============================================================================

-- Index for user's files queries (used in FilesPage)
CREATE INDEX IF NOT EXISTS idx_files_user_id_created_at 
ON files(user_id, created_at DESC);

-- ============================================================================
-- PROFILES TABLE INDEXES
-- ============================================================================

-- Index for subscription_id lookups (used in team management and subscriptions)
-- Note: Based on actual schema - uses subscription_id, not organization_id
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id 
ON profiles(subscription_id) 
WHERE subscription_id IS NOT NULL;

-- Index for plan_id lookups (used extensively in plan resolution)
CREATE INDEX IF NOT EXISTS idx_profiles_plan_id 
ON profiles(plan_id) 
WHERE plan_id IS NOT NULL;

-- ============================================================================
-- BATCH_EXECUTIONS TABLE INDEXES
-- ============================================================================

-- Index for user's batch executions (used in BulkInvoiceProcessor)
CREATE INDEX IF NOT EXISTS idx_batch_executions_user_id_type_created_at 
ON batch_executions(user_id, type, created_at DESC);

-- ============================================================================
-- VENDOR_CONFIGS TABLE INDEXES
-- ============================================================================

-- Index for active vendor configs (used in BulkInvoiceProcessor)
CREATE INDEX IF NOT EXISTS idx_vendor_configs_user_id_active 
ON vendor_configs(user_id, is_active) 
WHERE is_active = true;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify all indexes were created successfully

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'automation_runs',
    'automation_tasks',
    'file_shares',
    'files',
    'profiles',
    'batch_executions',
    'vendor_configs'
  )
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

