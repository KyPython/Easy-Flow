-- Migration: Fix plan specifications to match exact requirements
-- Description: Update Hobbyist plan limits and correct workflow count for Hobbyist
-- Created: January 2025

-- ============================================================================
-- UPDATE PLAN LIMITS TO MATCH EXACT REQUIREMENTS
-- ============================================================================

-- Updated function to get plan limits (corrected specifications)
CREATE OR REPLACE FUNCTION get_plan_limits(user_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_plan_id text;
  limits jsonb;
BEGIN
  -- Get plan_id from profiles table
  SELECT plan_id INTO user_plan_id
  FROM profiles 
  WHERE id = user_uuid;
  
  -- If no plan found, default to free/hobbyist
  IF user_plan_id IS NULL OR user_plan_id = 'free' THEN
    user_plan_id := 'free';
  END IF;
  
  -- Set limits based on plan_id matching requirements exactly
  CASE user_plan_id
    WHEN 'starter' THEN
      limits := '{
        "workflows": 5,
        "monthly_runs": 500,
        "storage_gb": 10,
        "team_members": 1,
        "logging_retention_days": 90,
        "advanced_features": true,
        "priority_support": false
      }'::jsonb;
    WHEN 'professional' THEN
      limits := '{
        "workflows": 25,
        "monthly_runs": 5000,
        "storage_gb": 100,
        "team_members": 5,
        "logging_retention_days": 365,
        "advanced_features": true,
        "priority_support": true
      }'::jsonb;
    WHEN 'enterprise' THEN
      limits := '{
        "workflows": -1,
        "monthly_runs": 50000,
        "storage_gb": -1,
        "team_members": -1,
        "logging_retention_days": -1,
        "advanced_features": true,
        "priority_support": true
      }'::jsonb;
    ELSE -- 'free'/'hobbyist' plan - CORRECTED: Should be unlimited workflows, NOT 3
      limits := '{
        "workflows": -1,
        "monthly_runs": 50,
        "storage_gb": 5,
        "team_members": 1,
        "logging_retention_days": 30,
        "advanced_features": false,
        "priority_support": false
      }'::jsonb;
  END CASE;
  
  RETURN limits;
END;
$$;

-- ============================================================================
-- CORRECTED WORKFLOW CREATION CHECK
-- ============================================================================

-- Updated function to check if user can create workflow (hobbyist = unlimited)
CREATE OR REPLACE FUNCTION can_create_workflow(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  limits jsonb;
  current_count integer;
  max_workflows integer;
BEGIN
  -- Get plan limits
  limits := get_plan_limits(user_uuid);
  max_workflows := (limits->>'workflows')::integer;
  
  -- If unlimited workflows (-1), allow (this includes Hobbyist plan)
  IF max_workflows = -1 THEN
    RETURN true;
  END IF;
  
  -- Count current active workflows
  SELECT COUNT(*) INTO current_count
  FROM workflows
  WHERE user_id = user_uuid AND status != 'archived';
  
  -- Check if under limit
  RETURN current_count < max_workflows;
END;
$$;

-- ============================================================================
-- ENHANCED MONTHLY USAGE WITH WORKFLOW COUNT
-- ============================================================================

-- Enhanced function to get monthly usage including active workflows
CREATE OR REPLACE FUNCTION get_monthly_usage(user_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  usage jsonb;
  runs_count integer;
  storage_used bigint;
  workflows_count integer;
  current_month date;
BEGIN
  current_month := date_trunc('month', NOW())::date;
  
  -- Count automation runs this month from automation_runs_tracking if exists
  SELECT COUNT(*) INTO runs_count
  FROM automation_runs_tracking
  WHERE user_id = user_uuid 
    AND tracking_month = current_month;
  
  -- If no tracking record, count from workflow_executions (fallback)
  IF runs_count = 0 THEN
    SELECT COUNT(*) INTO runs_count
    FROM workflow_executions
    WHERE user_id = user_uuid 
      AND started_at >= date_trunc('month', NOW());
  END IF;
  
  -- Calculate storage used from files table
  SELECT COALESCE(SUM(file_size), 0) INTO storage_used
  FROM files
  WHERE user_id = user_uuid;
  
  -- Count active workflows (non-archived)
  SELECT COUNT(*) INTO workflows_count
  FROM workflows
  WHERE user_id = user_uuid AND status != 'archived';
  
  -- Update usage tracking table if it exists
  INSERT INTO usage_tracking (user_id, monthly_runs, storage_bytes, workflows_count, tracking_month)
  VALUES (user_uuid, runs_count, storage_used, workflows_count, current_month)
  ON CONFLICT (user_id, tracking_month) 
  DO UPDATE SET 
    monthly_runs = EXCLUDED.monthly_runs,
    storage_bytes = EXCLUDED.storage_bytes,
    workflows_count = EXCLUDED.workflows_count,
    last_updated = NOW();
  
  usage := json_build_object(
    'monthly_runs', runs_count,
    'storage_bytes', storage_used,
    'storage_gb', ROUND(storage_used / (1024.0 * 1024.0 * 1024.0), 2),
    'workflows', workflows_count
  );
  
  RETURN usage;
END;
$$;

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON FUNCTION get_plan_limits IS 'Returns plan-specific limits - CORRECTED: Hobbyist plan has unlimited workflows';
COMMENT ON FUNCTION can_create_workflow IS 'CORRECTED: Hobbyist users can create unlimited workflows';