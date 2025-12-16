-- Migration: Add Performance Indexes for Query Optimization
-- Date: 2025-12-16
-- Description: Adds database indexes to fix query timeout issues and improve performance
-- 
-- Problem: "Query timeout" errors when loading workflows
-- Root Cause: Missing indexes on frequently queried columns
-- Solution: Add indexes on user_id, status, created_at, updated_at, and common filter columns
--
-- Based on actual schema from supabase-schema.sql
-- Tables: workflows, workflow_steps, workflow_connections, workflow_executions, workflow_schedules

-- ============================================================================
-- WORKFLOWS TABLE INDEXES (Most Critical)
-- ============================================================================

-- Index on user_id (CRITICAL for RLS and user-scoped queries)
-- This is the most important index - queries filter by user_id via RLS
-- Schema: workflows.user_id uuid NOT NULL
CREATE INDEX IF NOT EXISTS idx_workflows_user_id 
ON public.workflows(user_id);

-- Index on updated_at (for ordering workflows by last updated)
-- Used in: .order('updated_at', { ascending: false })
-- Schema: workflows.updated_at timestamp with time zone DEFAULT now()
CREATE INDEX IF NOT EXISTS idx_workflows_updated_at 
ON public.workflows(updated_at DESC);

-- Index on created_at (for ordering workflows by creation date)
-- Schema: workflows.created_at timestamp with time zone DEFAULT now()
CREATE INDEX IF NOT EXISTS idx_workflows_created_at 
ON public.workflows(created_at DESC);

-- Index on status (for filtering active/draft/paused/archived workflows)
-- Used in: .neq('status', 'deleted') or .eq('status', 'active')
-- Schema: workflows.status text NOT NULL DEFAULT 'draft'::text
CREATE INDEX IF NOT EXISTS idx_workflows_status 
ON public.workflows(status);

-- Composite index for common query pattern: user_id + status + updated_at
-- Optimizes: Get user's active workflows ordered by updated_at
CREATE INDEX IF NOT EXISTS idx_workflows_user_status_updated 
ON public.workflows(user_id, status, updated_at DESC);

-- Composite index for user_id + updated_at (most common pattern)
-- This is the PRIMARY query pattern used by frontend
CREATE INDEX IF NOT EXISTS idx_workflows_user_updated 
ON public.workflows(user_id, updated_at DESC);

-- ============================================================================
-- WORKFLOW_STEPS TABLE INDEXES
-- ============================================================================

-- Index on workflow_id (for joining with workflows)
-- Used in: workflow_steps(*) join
-- Schema: workflow_steps.workflow_id uuid NOT NULL
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id 
ON public.workflow_steps(workflow_id);

-- Index on step_type (for filtering steps by type)
-- Schema: workflow_steps.step_type text NOT NULL
CREATE INDEX IF NOT EXISTS idx_workflow_steps_step_type 
ON public.workflow_steps(step_type);

-- Index on execution_order (for ordering steps)
-- Schema: workflow_steps.execution_order integer NOT NULL DEFAULT 0
CREATE INDEX IF NOT EXISTS idx_workflow_steps_execution_order 
ON public.workflow_steps(workflow_id, execution_order);

-- Composite index for workflow_id + step_type
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_type 
ON public.workflow_steps(workflow_id, step_type);

-- ============================================================================
-- WORKFLOW_CONNECTIONS TABLE INDEXES
-- ============================================================================

-- Index on workflow_id (for joining with workflows)
-- Schema: workflow_connections.workflow_id uuid NOT NULL
CREATE INDEX IF NOT EXISTS idx_workflow_connections_workflow_id 
ON public.workflow_connections(workflow_id);

-- Index on source_step_id (for graph traversal)
-- Schema: workflow_connections.source_step_id uuid NOT NULL
CREATE INDEX IF NOT EXISTS idx_workflow_connections_source 
ON public.workflow_connections(source_step_id);

-- Index on target_step_id (for graph traversal)
-- Schema: workflow_connections.target_step_id uuid NOT NULL
CREATE INDEX IF NOT EXISTS idx_workflow_connections_target 
ON public.workflow_connections(target_step_id);

-- Composite index for workflow_id + source_step_id (common traversal pattern)
CREATE INDEX IF NOT EXISTS idx_workflow_connections_workflow_source 
ON public.workflow_connections(workflow_id, source_step_id);

-- ============================================================================
-- WORKFLOW_EXECUTIONS TABLE INDEXES
-- ============================================================================

-- Index on workflow_id (for joining with workflows)
-- Schema: workflow_executions.workflow_id uuid NOT NULL
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id 
ON public.workflow_executions(workflow_id);

-- Index on user_id (for user-scoped queries)
-- Schema: workflow_executions.user_id uuid NOT NULL
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id 
ON public.workflow_executions(user_id);

-- Index on status (for filtering by execution status)
-- Schema: workflow_executions.status text NOT NULL DEFAULT 'queued'::text
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status 
ON public.workflow_executions(status);

-- Index on started_at (for ordering executions)
-- Schema: workflow_executions.started_at timestamp with time zone DEFAULT now()
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at 
ON public.workflow_executions(started_at DESC);

-- Index on created_at (for ordering by creation time)
-- Schema: workflow_executions.created_at timestamp with time zone DEFAULT now()
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at 
ON public.workflow_executions(created_at DESC);

-- Composite index for workflow_id + status + started_at
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_status_started 
ON public.workflow_executions(workflow_id, status, started_at DESC);

-- Composite index for user_id + started_at (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_started 
ON public.workflow_executions(user_id, started_at DESC);

-- Composite index for user_id + status + started_at
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_status_started 
ON public.workflow_executions(user_id, status, started_at DESC);

-- ============================================================================
-- WORKFLOW_SCHEDULES TABLE INDEXES
-- ============================================================================

-- Index on user_id (for user-scoped queries)
-- Schema: workflow_schedules.user_id uuid NOT NULL
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_user_id 
ON public.workflow_schedules(user_id);

-- Index on workflow_id (for joining with workflows)
-- Schema: workflow_schedules.workflow_id uuid NOT NULL
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_workflow_id 
ON public.workflow_schedules(workflow_id);

-- Index on is_active (for filtering active schedules)
-- Schema: workflow_schedules.is_active boolean DEFAULT true
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_is_active 
ON public.workflow_schedules(is_active);

-- Index on next_trigger_at (for scheduled execution queries)
-- Schema: workflow_schedules.next_trigger_at timestamp with time zone
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_next_trigger 
ON public.workflow_schedules(next_trigger_at) 
WHERE is_active = true;

-- Composite index for user_id + is_active
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_user_active 
ON public.workflow_schedules(user_id, is_active);

-- Composite index for user_id + created_at (for ordering)
-- Schema: workflow_schedules.created_at timestamp with time zone DEFAULT now()
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_user_created 
ON public.workflow_schedules(user_id, created_at DESC);

-- ============================================================================
-- AUTOMATION_RUNS TABLE INDEXES (for dashboard queries)
-- ============================================================================

-- Index on user_id (for user-scoped queries)
-- Schema: automation_runs.user_id uuid
CREATE INDEX IF NOT EXISTS idx_automation_runs_user_id 
ON public.automation_runs(user_id);

-- Index on status (for filtering by status)
-- Schema: automation_runs.status text NOT NULL
CREATE INDEX IF NOT EXISTS idx_automation_runs_status 
ON public.automation_runs(status);

-- Index on started_at (for ordering)
-- Schema: automation_runs.started_at timestamp with time zone DEFAULT now()
CREATE INDEX IF NOT EXISTS idx_automation_runs_started_at 
ON public.automation_runs(started_at DESC);

-- Index on created_at (for ordering)
-- Schema: automation_runs.created_at timestamp with time zone DEFAULT now()
CREATE INDEX IF NOT EXISTS idx_automation_runs_created_at 
ON public.automation_runs(created_at DESC);

-- Composite index for user_id + status + started_at
CREATE INDEX IF NOT EXISTS idx_automation_runs_user_status_started 
ON public.automation_runs(user_id, status, started_at DESC);

-- Composite index for user_id + started_at (most common dashboard query)
CREATE INDEX IF NOT EXISTS idx_automation_runs_user_started 
ON public.automation_runs(user_id, started_at DESC);

-- ============================================================================
-- AUTOMATION_TASKS TABLE INDEXES
-- ============================================================================

-- Index on user_id (for user-scoped queries)
-- Schema: automation_tasks.user_id uuid
CREATE INDEX IF NOT EXISTS idx_automation_tasks_user_id 
ON public.automation_tasks(user_id);

-- Index on is_active (for filtering active tasks)
-- Schema: automation_tasks.is_active boolean NOT NULL DEFAULT true
CREATE INDEX IF NOT EXISTS idx_automation_tasks_is_active 
ON public.automation_tasks(is_active);

-- Composite index for user_id + is_active
CREATE INDEX IF NOT EXISTS idx_automation_tasks_user_active 
ON public.automation_tasks(user_id, is_active);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- ============================================================================
-- STEP_EXECUTIONS TABLE INDEXES (for workflow execution tracking)
-- ============================================================================

-- Index on workflow_execution_id (for joining with workflow_executions)
-- Schema: step_executions.workflow_execution_id uuid NOT NULL
CREATE INDEX IF NOT EXISTS idx_step_executions_workflow_execution_id 
ON public.step_executions(workflow_execution_id);

-- Index on step_id (for joining with workflow_steps)
-- Schema: step_executions.step_id uuid NOT NULL
CREATE INDEX IF NOT EXISTS idx_step_executions_step_id 
ON public.step_executions(step_id);

-- Index on status (for filtering by step status)
-- Schema: step_executions.status text NOT NULL DEFAULT 'queued'::text
CREATE INDEX IF NOT EXISTS idx_step_executions_status 
ON public.step_executions(status);

-- Composite index for workflow_execution_id + execution_order
-- Schema: step_executions.execution_order integer NOT NULL
CREATE INDEX IF NOT EXISTS idx_step_executions_execution_order 
ON public.step_executions(workflow_execution_id, execution_order);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check created indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN (
        'workflows',
        'workflow_steps',
        'workflow_connections',
        'workflow_executions',
        'workflow_schedules',
        'automation_runs',
        'automation_tasks',
        'step_executions'
    )
ORDER BY tablename, indexname;

-- Check index sizes and usage statistics
-- Note: pg_stat_user_indexes uses relname (table) and indexrelname (index), not tablename/indexname
SELECT
    psui.schemaname,
    psui.relname AS tablename,
    psui.indexrelname AS indexname,
    pg_size_pretty(pg_relation_size(psui.indexrelid)) AS index_size,
    psui.idx_scan AS index_scans,
    psui.idx_tup_read AS tuples_read,
    psui.idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes AS psui
WHERE psui.schemaname = 'public'
    AND psui.relname IN (
        'workflows',
        'workflow_steps',
        'workflow_connections',
        'workflow_executions',
        'workflow_schedules',
        'automation_runs',
        'automation_tasks',
        'step_executions'
    )
ORDER BY pg_relation_size(psui.indexrelid) DESC;

-- Check table sizes (to understand data volume)
-- Note: Use format('%I.%I', ...)::regclass to safely convert schema.table to regclass for size functions
SELECT
    t.schemaname,
    t.tablename,
    pg_size_pretty(pg_total_relation_size(format('%I.%I', t.schemaname, t.tablename)::regclass)) AS total_size,
    pg_size_pretty(pg_relation_size(format('%I.%I', t.schemaname, t.tablename)::regclass)) AS table_size,
    pg_size_pretty(
        pg_total_relation_size(format('%I.%I', t.schemaname, t.tablename)::regclass)
        - pg_relation_size(format('%I.%I', t.schemaname, t.tablename)::regclass)
    ) AS indexes_size
FROM pg_tables AS t
WHERE t.schemaname = 'public'
    AND t.tablename IN (
        'workflows',
        'workflow_steps',
        'workflow_connections',
        'workflow_executions',
        'workflow_schedules',
        'automation_runs',
        'automation_tasks',
        'step_executions'
    )
ORDER BY pg_total_relation_size(format('%I.%I', t.schemaname, t.tablename)::regclass) DESC;

