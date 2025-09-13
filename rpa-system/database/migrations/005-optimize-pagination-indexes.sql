-- Migration: Optimize pagination and add keyset pagination indexes
-- Description: Add composite indexes to support efficient cursor-based pagination and hot path queries
-- Created: January 2025
-- Updated: Fixed to match actual Supabase schema columns (usage_count, rating vs popularity_score)

-- ============================================================================
-- KEYSET PAGINATION INDEXES FOR TEMPLATES
-- ============================================================================

-- Composite index for popularity-based pagination with consistent ordering
-- Supports: ORDER BY usage_count DESC, rating DESC, updated_at DESC, id ASC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_templates_popularity_pagination 
ON public.workflow_templates (usage_count DESC, rating DESC, updated_at DESC, id ASC)
WHERE is_public = TRUE;

-- Composite index for recent-based pagination
-- Supports: ORDER BY updated_at DESC, id ASC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_templates_recent_pagination
ON public.workflow_templates (updated_at DESC, id ASC)
WHERE is_public = TRUE;

-- Composite index for name-based pagination (alphabetical)
-- Supports: ORDER BY name ASC, id ASC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_templates_name_pagination
ON public.workflow_templates (name ASC, id ASC)
WHERE is_public = TRUE;

-- Category-specific pagination indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_templates
_category_popularity
ON public.workflow_templates (category, usage_count DESC, rating DESC, updated_at DESC, id ASC)
WHERE is_public = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_templates_category_recent
ON public.workflow_templates (category, updated_at DESC, id ASC)
WHERE is_public = TRUE;

-- ============================================================================
-- HOT PATH EXECUTION INDEXES
-- ============================================================================

-- Optimize execution lookups by user and recent activity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_user_recent
ON public.workflow_executions (user_id, started_at DESC, id DESC);

-- Optimize step execution lookups within workflow executions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_step_executions_workflow_exec_order
ON public.step_executions (workflow_execution_id, execution_order, started_at DESC);

-- Optimize failed execution queries for monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_failed_recent
ON public.workflow_executions (status, started_at DESC, id DESC)
WHERE status = 'failed';

-- Optimize active/running execution monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_active_monitoring
ON public.workflow_executions (status, started_at ASC, id ASC)
WHERE status IN ('queued', 'running');

-- Step execution status monitoring for active workflows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_step_executions_active_monitoring
ON public.step_executions (status, started_at ASC)
WHERE status IN ('queued', 'running');

-- ============================================================================
-- WORKFLOW PERFORMANCE INDEXES
-- ============================================================================

-- Optimize workflow listing by user with performance metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_user_performance
ON public.workflows (user_id, updated_at DESC, total_executions DESC, id DESC);

-- Optimize public workflow templates by usage
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_public_by_usage
ON public.workflows (is_public, is_template, total_executions DESC, updated_at DESC)
WHERE is_public = TRUE AND is_template = TRUE;

-- ============================================================================
-- SEARCH AND FILTERING INDEXES
-- ============================================================================

-- Full-text search index for template names and descriptions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_templates_search_text
ON public.workflow_templates USING GIN (
  to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, ''))
)
WHERE is_public = TRUE;

-- GIN index for tag-based filtering with popularity ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_templates_tags_popularity
ON public.workflow_templates USING GIN (tags)
WHERE is_public = TRUE;

-- ============================================================================
-- CACHING AND AGGREGATION SUPPORT INDEXES
-- ============================================================================

-- Monthly usage aggregation index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_monthly_stats
ON public.workflow_executions (
  DATE_TRUNC('month', started_at),
  workflow_id,
  status
) WHERE started_at >= NOW() - INTERVAL '12 months';

-- Template popularity calculation support
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_templates_popularity_calc
ON public.workflow_templates (usage_count DESC, rating DESC, updated_at DESC)
WHERE is_public = TRUE;

-- ============================================================================
-- MATERIALIZED VIEW FOR RANKED TEMPLATES (optional)
-- ============================================================================

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS public.workflow_templates_ranked;

-- Create materialized view with pre-calculated popularity scores
CREATE MATERIALIZED VIEW public.workflow_templates_ranked AS
SELECT 
  wt.*,
  -- Calculate popularity score based on usage, rating, and recency
  GREATEST(0, LEAST(100, 
    COALESCE(wt.usage_count, 0) * 0.4 +
    COALESCE(wt.rating, 0) * 20 +
    -- Recency boost (newer templates get slight preference)
    CASE 
      WHEN wt.created_at > NOW() - INTERVAL '30 days' THEN 10
      WHEN wt.created_at > NOW() - INTERVAL '90 days' THEN 5
      ELSE 0
    END +
    -- Featured boost
    CASE WHEN wt.is_featured THEN 15 ELSE 0 END
  )) as popularity_score,
  
  -- Pre-calculate search text for performance
  to_tsvector('english', COALESCE(wt.name, '') || ' ' || COALESCE(wt.description, '')) as search_text
  
FROM public.workflow_templates wt
WHERE wt.is_public = TRUE;

-- Create indexes on the materialized view
CREATE INDEX idx_workflow_templates_ranked_popularity 
ON public.workflow_templates_ranked (popularity_score DESC, updated_at DESC, id ASC);

CREATE INDEX idx_workflow_templates_ranked_category
ON public.workflow_templates_ranked (category, popularity_score DESC, updated_at DESC, id ASC);

CREATE INDEX idx_workflow_templates_ranked_search
ON public.workflow_templates_ranked USING GIN (search_text);

CREATE INDEX idx_workflow_templates_ranked_tags
ON public.workflow_templates_ranked USING GIN (tags);

-- ============================================================================
-- REFRESH FUNCTION FOR MATERIALIZED VIEW
-- ============================================================================

-- Function to refresh the ranked templates view
CREATE OR REPLACE FUNCTION refresh_workflow_templates_ranked()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.workflow_templates_ranked;
END;
$$;

-- Schedule periodic refresh (if pg_cron is available)
-- SELECT cron.schedule('refresh-template-rankings', '*/15 * * * *', 'SELECT refresh_workflow_templates_ranked();');

-- ============================================================================
-- PERFORMANCE MONITORING FUNCTIONS
-- ============================================================================

-- Function to get popular templates with caching support
CREATE OR REPLACE FUNCTION get_popular_templates(
  p_category text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  category text,
  popularity_score numeric,
  usage_count integer,
  rating numeric,
  created_at timestamptz,
  updated_at timestamptz,
  tags text[],
  is_featured boolean
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wtr.id,
    wtr.name,
    wtr.description,
    wtr.category,
    wtr.popularity_score,
    wtr.usage_count,
    wtr.rating,
    wtr.created_at,
    wtr.updated_at,
    wtr.tags,
    wtr.is_featured
  FROM public.workflow_templates_ranked wtr
  WHERE (p_category IS NULL OR wtr.category = p_category)
  ORDER BY wtr.popularity_score DESC, wtr.updated_at DESC, wtr.id ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Function to get template usage statistics (for caching)
CREATE OR REPLACE FUNCTION get_template_usage_stats(p_period text DEFAULT 'month')
RETURNS TABLE (
  template_id uuid,
  template_name text,
  usage_count bigint,
  success_rate numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  period_interval interval;
BEGIN
  -- Convert period to interval
  period_interval := CASE p_period
    WHEN 'day' THEN '1 day'::interval
    WHEN 'week' THEN '1 week'::interval
    WHEN 'month' THEN '1 month'::interval
    WHEN 'year' THEN '1 year'::interval
    ELSE '1 month'::interval
  END;

  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    COUNT(we.id) as usage_count,
    ROUND(
      CASE 
        WHEN COUNT(we.id) = 0 THEN 0
        ELSE (COUNT(CASE WHEN we.status = 'completed' THEN 1 END)::numeric / COUNT(we.id)::numeric) * 100
      END, 
      2
    ) as success_rate
  FROM public.workflows w
  LEFT JOIN public.workflow_executions we ON w.id = we.workflow_id 
    AND we.started_at >= NOW() - period_interval
  WHERE w.is_template = TRUE AND w.is_public = TRUE
  GROUP BY w.id, w.name
  ORDER BY usage_count DESC, success_rate DESC;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_workflow_templates_popularity_pagination IS 'Supports efficient keyset pagination by popularity with consistent ordering';
COMMENT ON INDEX idx_workflow_executions_user_recent IS 'Optimizes user execution history queries';
COMMENT ON INDEX idx_step_executions_workflow_exec_order IS 'Optimizes step execution lookups within workflow runs';
COMMENT ON MATERIALIZED VIEW workflow_templates_ranked IS 'Pre-calculated template rankings for improved query performance';
COMMENT ON FUNCTION get_popular_templates IS 'Cached function for retrieving popular templates with optional category filtering';