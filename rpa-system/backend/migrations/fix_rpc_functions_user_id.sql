-- Migration: Fix RPC Functions to Use user_id Instead of owner_id
-- Date: 2025-12-20
-- Description: Updates get_monthly_usage and get_plan_limits functions to use user_id (which exists in schema)
--              instead of owner_id (which doesn't exist), fixing the "column owner_id does not exist" errors
--
-- Problem: get_monthly_usage and get_plan_limits RPC functions reference owner_id column
-- Root Cause: Schema uses user_id consistently, not owner_id
-- Solution: Create/fix functions to use user_id from automation_runs, workflows, and user_usage tables

-- ============================================================================
-- FUNCTION: get_monthly_usage
-- ============================================================================
-- Returns monthly usage statistics for a user
-- Based on schema: automation_runs.user_id, user_usage.user_id, workflows.user_id

CREATE OR REPLACE FUNCTION get_monthly_usage(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  start_of_month TIMESTAMP WITH TIME ZONE;
  monthly_runs INTEGER;
  storage_bytes BIGINT;
  workflows_count INTEGER;
BEGIN
  -- Calculate start of current month
  start_of_month := date_trunc('month', CURRENT_DATE)::TIMESTAMP WITH TIME ZONE;
  
  -- Count completed automation runs this month
  SELECT COUNT(*) INTO monthly_runs
  FROM automation_runs
  WHERE user_id = user_uuid
    AND status = 'completed'
    AND created_at >= start_of_month;
  
  -- Calculate storage from files table
  SELECT COALESCE(SUM(file_size), 0) INTO storage_bytes
  FROM files
  WHERE user_id = user_uuid;
  
  -- Count active workflows
  SELECT COUNT(*) INTO workflows_count
  FROM workflows
  WHERE user_id = user_uuid
    AND status = 'active';
  
  -- Return as JSONB
  result := jsonb_build_object(
    'automationsThisMonth', monthly_runs,
    'monthly_runs', monthly_runs,
    'storageUsed', ROUND(storage_bytes / (1024.0 * 1024.0 * 1024.0), 2),
    'storage_gb', ROUND(storage_bytes / (1024.0 * 1024.0 * 1024.0), 2),
    'workflows', workflows_count
  );
  
  RETURN result;
END;
$$;

-- ============================================================================
-- FUNCTION: get_plan_limits
-- ============================================================================
-- Returns plan limits for a user based on their plan_id from profiles table
-- Based on schema: profiles.plan_id -> plans.id, plans.limits JSONB

CREATE OR REPLACE FUNCTION get_plan_limits(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  user_plan_id TEXT;
  plan_record RECORD;
BEGIN
  -- Get user's plan_id from profiles
  SELECT plan_id INTO user_plan_id
  FROM profiles
  WHERE id = user_uuid;
  
  -- If no plan found, return default limits
  IF user_plan_id IS NULL THEN
    RETURN jsonb_build_object(
      'monthly_runs', 50,
      'storage_gb', 5,
      'workflows', 3,
      'maxAutomations', 10,
      'maxStorage', 5,
      'workflow_executions', true,
      'has_workflows', true
    );
  END IF;
  
  -- Try to find plan by UUID, slug, or name
  SELECT * INTO plan_record
  FROM plans
  WHERE id::text = user_plan_id
     OR slug = user_plan_id
     OR name = user_plan_id
  LIMIT 1;
  
  -- If plan found, use its limits (check if plan_record.id is not null to verify record was found)
  IF plan_record.id IS NOT NULL AND plan_record.limits IS NOT NULL THEN
    -- Merge plan limits with defaults
    result := jsonb_build_object(
      'monthly_runs', COALESCE((plan_record.limits->>'monthly_runs')::INTEGER, 50),
      'storage_gb', COALESCE((plan_record.limits->>'storage_gb')::INTEGER, 5),
      'workflows', COALESCE((plan_record.limits->>'workflows')::INTEGER, 3),
      'maxAutomations', COALESCE((plan_record.limits->>'monthly_runs')::INTEGER, 10),
      'maxStorage', COALESCE((plan_record.limits->>'storage_gb')::INTEGER, 5),
      'workflow_executions', COALESCE((plan_record.limits->>'workflow_executions')::BOOLEAN, true),
      'has_workflows', COALESCE((plan_record.limits->>'workflows')::INTEGER, 0) > 0
    );
  ELSE
    -- Default limits if plan not found
    result := jsonb_build_object(
      'monthly_runs', 50,
      'storage_gb', 5,
      'workflows', 3,
      'maxAutomations', 10,
      'maxStorage', 5,
      'workflow_executions', true,
      'has_workflows', true
    );
  END IF;
  
  RETURN result;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
-- Allow authenticated users to execute these functions
GRANT EXECUTE ON FUNCTION get_monthly_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_usage(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_plan_limits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_plan_limits(UUID) TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Test the functions (uncomment to test):
-- SELECT get_monthly_usage('your-user-id-here'::UUID);
-- SELECT get_plan_limits('your-user-id-here'::UUID);

