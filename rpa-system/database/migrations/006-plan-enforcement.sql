-- Migration: Add plan enforcement and feature gating
-- Description: Add functions and policies to enforce plan limits and feature access
-- Created: January 2025
-- Updated: Fixed to match actual Supabase schema (uses profiles.plan_id)

-- ============================================================================
-- PLAN ENFORCEMENT FUNCTIONS
-- ============================================================================

-- Function to get user's current active plan (uses profiles.plan_id)
CREATE OR REPLACE FUNCTION get_user_plan(user_uuid uuid)
RETURNS TABLE (
  plan_id text,
  plan_name text,
  status text,
  expires_at timestamptz,
  is_trial boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_plan_id text;
BEGIN
  -- Get plan_id from profiles table
  SELECT plan_id INTO user_plan_id
  FROM profiles 
  WHERE id = user_uuid;
  
  -- If no user found, return free plan
  IF user_plan_id IS NULL THEN
    RETURN QUERY
    SELECT 
      'free'::text,
      'Hobbyist'::text,
      'active'::text,
      NULL::timestamptz,
      false::boolean;
  ELSE
    -- Map plan_id to display name
    RETURN QUERY
    SELECT 
      user_plan_id,
      CASE user_plan_id
        WHEN 'free' THEN 'Hobbyist'
        WHEN 'starter' THEN 'Starter'  
        WHEN 'professional' THEN 'Professional'
        WHEN 'enterprise' THEN 'Enterprise'
        ELSE 'Hobbyist'
      END,
      'active'::text,
      NULL::timestamptz, -- No expiry tracking in current schema
      false::boolean
    LIMIT 1;
  END IF;
END;
$$;

-- Function to check if user has feature access
CREATE OR REPLACE FUNCTION user_has_feature(user_uuid uuid, feature_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_plan_id text;
BEGIN
  -- Get plan_id from profiles table
  SELECT plan_id INTO user_plan_id
  FROM profiles 
  WHERE id = user_uuid;
  
  -- If no plan found, return false for premium features
  IF user_plan_id IS NULL OR user_plan_id = 'free' THEN
    RETURN false;
  END IF;
  
  -- Check feature availability by plan
  CASE feature_key
    WHEN 'advanced_features' THEN
      RETURN user_plan_id IN ('starter', 'professional', 'enterprise');
    WHEN 'priority_support' THEN
      RETURN user_plan_id IN ('professional', 'enterprise');
    WHEN 'team_collaboration' THEN
      RETURN user_plan_id IN ('professional', 'enterprise');
    WHEN 'custom_integrations' THEN
      RETURN user_plan_id IN ('professional', 'enterprise');
    WHEN 'enterprise_features' THEN
      RETURN user_plan_id = 'enterprise';
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Function to get plan limits
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
  
  -- If no plan found, default to free
  IF user_plan_id IS NULL THEN
    user_plan_id := 'free';
  END IF;
  
  -- Set limits based on plan_id
  CASE user_plan_id
    WHEN 'starter' THEN
      limits := '{
        "workflows": 5,
        "monthly_runs": 500,
        "storage_gb": 10,
        "team_members": 1,
        "advanced_features": true,
        "priority_support": false
      }'::jsonb;
    WHEN 'professional' THEN
      limits := '{
        "workflows": 25,
        "monthly_runs": 5000,
        "storage_gb": 100,
        "team_members": 5,
        "advanced_features": true,
        "priority_support": true
      }'::jsonb;
    WHEN 'enterprise' THEN
      limits := '{
        "workflows": -1,
        "monthly_runs": 50000,
        "storage_gb": -1,
        "team_members": -1,
        "advanced_features": true,
        "priority_support": true
      }'::jsonb;
    ELSE -- 'free' plan
      limits := '{
        "workflows": 3,
        "monthly_runs": 50,
        "storage_gb": 5,
        "team_members": 1,
        "advanced_features": false,
        "priority_support": false
      }'::jsonb;
  END CASE;
  
  RETURN limits;
END;
$$;

-- Function to check if user can create workflow
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
  
  -- If unlimited workflows (-1), allow
  IF max_workflows = -1 THEN
    RETURN true;
  END IF;
  
  -- Count current workflows
  SELECT COUNT(*) INTO current_count
  FROM workflows
  WHERE user_id = user_uuid AND status != 'archived';
  
  -- Check if under limit
  RETURN current_count < max_workflows;
END;
$$;

-- Function to check monthly usage
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
BEGIN
  -- Count workflow executions this month
  SELECT COUNT(*) INTO runs_count
  FROM workflow_executions
  WHERE user_id = user_uuid 
    AND started_at >= date_trunc('month', NOW());
  
  -- Calculate storage used
  SELECT COALESCE(SUM(file_size), 0) INTO storage_used
  FROM files
  WHERE user_id = user_uuid;
  
  usage := json_build_object(
    'monthly_runs', runs_count,
    'storage_bytes', storage_used,
    'storage_gb', ROUND(storage_used / (1024.0 * 1024.0 * 1024.0), 2)
  );
  
  RETURN usage;
END;
$$;

-- Function to check if user can run automation
CREATE OR REPLACE FUNCTION can_run_automation(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  limits jsonb;
  usage jsonb;
  max_runs integer;
  current_runs integer;
BEGIN
  -- Get plan limits and current usage
  limits := get_plan_limits(user_uuid);
  usage := get_monthly_usage(user_uuid);
  
  max_runs := (limits->>'monthly_runs')::integer;
  current_runs := (usage->>'monthly_runs')::integer;
  
  -- If unlimited runs (-1), allow
  IF max_runs = -1 THEN
    RETURN true;
  END IF;
  
  -- Check if under limit
  RETURN current_runs < max_runs;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on workflows table
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own workflows
CREATE POLICY workflows_user_access ON workflows
  FOR ALL USING (user_id = auth.uid());

-- Policy: Block workflow creation if over plan limit
CREATE POLICY workflows_creation_limit ON workflows
  FOR INSERT WITH CHECK (can_create_workflow(auth.uid()));

-- Enable RLS on workflow_executions
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- Policy: Block execution if over monthly limit
CREATE POLICY workflow_executions_limit ON workflow_executions
  FOR INSERT WITH CHECK (can_run_automation(auth.uid()));

-- Policy: Users can only see their own executions
CREATE POLICY workflow_executions_user_access ON workflow_executions
  FOR ALL USING (user_id = auth.uid());

-- Enable RLS on files table
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own files
CREATE POLICY files_user_access ON files
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- USAGE TRACKING VIEWS
-- ============================================================================

-- View for admin dashboard to monitor plan usage
CREATE OR REPLACE VIEW user_plan_usage AS
SELECT 
  p.id as user_id,
  p.email,
  plan_info.plan_name,
  plan_info.status,
  plan_info.expires_at,
  plan_info.is_trial,
  usage_info.monthly_runs,
  usage_info.storage_gb,
  limits_info.limits,
  -- Calculate usage percentages
  CASE 
    WHEN (limits_info.limits->>'monthly_runs')::integer = -1 THEN 0
    ELSE ROUND((usage_info.monthly_runs::numeric / (limits_info.limits->>'monthly_runs')::numeric) * 100, 2)
  END as runs_usage_percent,
  CASE 
    WHEN (limits_info.limits->>'storage_gb')::integer = -1 THEN 0
    ELSE ROUND((usage_info.storage_gb::numeric / (limits_info.limits->>'storage_gb')::numeric) * 100, 2)
  END as storage_usage_percent
FROM profiles p
CROSS JOIN LATERAL get_user_plan(p.id) plan_info
CROSS JOIN LATERAL get_monthly_usage(p.id) usage_info
CROSS JOIN LATERAL (SELECT get_plan_limits(p.id) as limits) limits_info;

-- ============================================================================
-- TRIGGER FUNCTIONS FOR ENFORCEMENT
-- ============================================================================

-- Trigger function to enforce file upload limits
CREATE OR REPLACE FUNCTION check_file_upload_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  limits jsonb;
  current_usage bigint;
  max_storage_bytes bigint;
BEGIN
  -- Get user limits
  limits := get_plan_limits(NEW.user_id);
  
  -- Calculate max storage in bytes
  max_storage_bytes := ((limits->>'storage_gb')::numeric * 1024 * 1024 * 1024)::bigint;
  
  -- If unlimited storage (-1), allow
  IF (limits->>'storage_gb')::integer = -1 THEN
    RETURN NEW;
  END IF;
  
  -- Get current usage
  SELECT COALESCE(SUM(file_size), 0) INTO current_usage
  FROM files
  WHERE user_id = NEW.user_id;
  
  -- Check if adding this file would exceed limit
  IF (current_usage + NEW.file_size) > max_storage_bytes THEN
    RAISE EXCEPTION 'Storage limit exceeded. Current: % GB, Limit: % GB', 
      ROUND(current_usage / (1024.0 * 1024.0 * 1024.0), 2),
      (limits->>'storage_gb')::integer
    USING ERRCODE = 'check_violation';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for file upload limit
CREATE TRIGGER enforce_file_upload_limit
  BEFORE INSERT ON files
  FOR EACH ROW
  EXECUTE FUNCTION check_file_upload_limit();

-- ============================================================================
-- API HELPER FUNCTIONS
-- ============================================================================

-- Function for API to get complete user plan info
CREATE OR REPLACE FUNCTION get_user_plan_details(user_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result jsonb;
  plan_info RECORD;
  usage_info jsonb;
  limits_info jsonb;
BEGIN
  -- Get plan, usage, and limits
  SELECT * INTO plan_info FROM get_user_plan(user_uuid) LIMIT 1;
  usage_info := get_monthly_usage(user_uuid);
  limits_info := get_plan_limits(user_uuid);
  
  -- Build response
  result := json_build_object(
    'plan', json_build_object(
      'id', plan_info.plan_id,
      'name', plan_info.plan_name,
      'status', plan_info.status,
      'expires_at', plan_info.expires_at,
      'is_trial', plan_info.is_trial
    ),
    'usage', usage_info,
    'limits', limits_info,
    'can_create_workflow', can_create_workflow(user_uuid),
    'can_run_automation', can_run_automation(user_uuid)
  );
  
  RETURN result;
END;
$$;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_user_plan IS 'Returns the current active plan for a user';
COMMENT ON FUNCTION user_has_feature IS 'Checks if user has access to a specific feature';
COMMENT ON FUNCTION get_plan_limits IS 'Returns plan-specific limits for a user';
COMMENT ON FUNCTION can_create_workflow IS 'Checks if user can create a new workflow based on plan limits';
COMMENT ON FUNCTION can_run_automation IS 'Checks if user can run automation based on monthly limits';
COMMENT ON FUNCTION get_monthly_usage IS 'Returns current month usage statistics for a user';
COMMENT ON FUNCTION get_user_plan_details IS 'Returns complete plan information for API consumption';
COMMENT ON VIEW user_plan_usage IS 'Admin view for monitoring user plan usage across all users';