-- Migration: Update plan specifications to match requirements
-- Description: Update plan limits and add missing usage tracking tables
-- Created: January 2025

-- ============================================================================
-- UPDATE PLAN LIMITS TO MATCH REQUIREMENTS
-- ============================================================================

-- Function to get plan limits (updated with correct specifications)
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
    ELSE -- 'free'/'hobbyist' plan - Updated to match requirements
      limits := '{
        "workflows": 5,
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
-- ENHANCED USAGE TRACKING TABLES
-- ============================================================================

-- Add plan_id column to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_id TEXT DEFAULT 'free';

-- Add plan change tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add renewal/expiry tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE;

-- Create enhanced usage tracking table
CREATE TABLE IF NOT EXISTS public.usage_tracking (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Usage metrics
    monthly_runs INTEGER DEFAULT 0,
    storage_bytes BIGINT DEFAULT 0,
    workflows_count INTEGER DEFAULT 0,
    team_members_count INTEGER DEFAULT 1,
    
    -- Tracking period
    tracking_month DATE DEFAULT date_trunc('month', NOW())::date,
    
    -- Real-time usage
    current_storage_gb REAL GENERATED ALWAYS AS (storage_bytes / (1024.0 * 1024.0 * 1024.0)) STORED,
    
    -- Timestamps
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, tracking_month)
);

-- Create workflow count tracking table
CREATE TABLE IF NOT EXISTS public.user_workflow_count (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    active_workflows INTEGER DEFAULT 0,
    total_workflows INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create automation runs tracking table 
CREATE TABLE IF NOT EXISTS public.automation_runs_tracking (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
    
    -- Run details
    run_status TEXT NOT NULL CHECK (run_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Usage tracking
    tracking_month DATE DEFAULT date_trunc('month', NOW())::date,
    
    -- Metadata
    execution_time_ms INTEGER,
    steps_executed INTEGER DEFAULT 0,
    
    INDEX(user_id, tracking_month),
    INDEX(user_id, started_at)
);

-- ============================================================================
-- UPDATED USAGE CALCULATION FUNCTION
-- ============================================================================

-- Enhanced function to get monthly usage with real-time tracking
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
  
  -- Count automation runs this month
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
  
  -- Count active workflows
  SELECT COUNT(*) INTO workflows_count
  FROM workflows
  WHERE user_id = user_uuid AND status != 'archived';
  
  -- Update usage tracking table
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
-- REAL-TIME USAGE TRACKING TRIGGERS
-- ============================================================================

-- Function to increment automation runs counter
CREATE OR REPLACE FUNCTION increment_automation_runs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert new run tracking record
  INSERT INTO automation_runs_tracking (
    user_id, 
    workflow_id, 
    run_status,
    started_at,
    tracking_month
  ) VALUES (
    NEW.user_id,
    NEW.workflow_id,
    NEW.status,
    NEW.started_at,
    date_trunc('month', NEW.started_at)::date
  );
  
  RETURN NEW;
END;
$$;

-- Function to update workflow count
CREATE OR REPLACE FUNCTION update_workflow_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  active_count integer;
  total_count integer;
  target_user_id uuid;
BEGIN
  -- Determine which user_id to update
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;
  
  -- Count active and total workflows
  SELECT 
    COUNT(*) FILTER (WHERE status != 'archived'),
    COUNT(*)
  INTO active_count, total_count
  FROM workflows
  WHERE user_id = target_user_id;
  
  -- Update workflow count tracking
  INSERT INTO user_workflow_count (user_id, active_workflows, total_workflows)
  VALUES (target_user_id, active_count, total_count)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    active_workflows = EXCLUDED.active_workflows,
    total_workflows = EXCLUDED.total_workflows,
    last_updated = NOW();
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for real-time tracking
DROP TRIGGER IF EXISTS track_automation_runs ON workflow_executions;
CREATE TRIGGER track_automation_runs
  AFTER INSERT ON workflow_executions
  FOR EACH ROW
  EXECUTE FUNCTION increment_automation_runs();

DROP TRIGGER IF EXISTS track_workflow_count ON workflows;  
CREATE TRIGGER track_workflow_count
  AFTER INSERT OR UPDATE OR DELETE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_count();

-- ============================================================================
-- ENHANCED PLAN CHECKING FUNCTIONS
-- ============================================================================

-- Updated function to check if user can create workflow (matches new limits)
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
  
  -- Count current active workflows
  SELECT COUNT(*) INTO current_count
  FROM workflows
  WHERE user_id = user_uuid AND status != 'archived';
  
  -- Check if under limit (now 5 for hobbyist)
  RETURN current_count < max_workflows;
END;
$$;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_month ON usage_tracking(user_id, tracking_month);
CREATE INDEX IF NOT EXISTS idx_automation_runs_user_month ON automation_runs_tracking(user_id, tracking_month);
CREATE INDEX IF NOT EXISTS idx_automation_runs_started_at ON automation_runs_tracking(started_at);
CREATE INDEX IF NOT EXISTS idx_workflows_user_status ON workflows(user_id, status);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_id ON profiles(plan_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_workflow_count ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs_tracking ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage data
CREATE POLICY "usage_tracking_user_access" ON usage_tracking
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "workflow_count_user_access" ON user_workflow_count
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "automation_runs_user_access" ON automation_runs_tracking
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- PLAN RENEWAL DATE CALCULATION
-- ============================================================================

-- Function to calculate plan renewal date and days remaining
CREATE OR REPLACE FUNCTION get_plan_renewal_info(user_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  profile_record RECORD;
  days_remaining integer;
  renewal_date date;
  result jsonb;
BEGIN
  -- Get profile with plan info
  SELECT plan_id, plan_expires_at, plan_changed_at
  INTO profile_record
  FROM profiles
  WHERE id = user_uuid;
  
  -- Calculate renewal date (30 days from plan change or expiry date)
  IF profile_record.plan_expires_at IS NOT NULL THEN
    renewal_date := profile_record.plan_expires_at::date;
  ELSIF profile_record.plan_changed_at IS NOT NULL THEN
    renewal_date := (profile_record.plan_changed_at + INTERVAL '30 days')::date;
  ELSE
    renewal_date := (NOW() + INTERVAL '30 days')::date;
  END IF;
  
  -- Calculate days remaining
  days_remaining := (renewal_date - NOW()::date);
  
  result := json_build_object(
    'renewal_date', renewal_date,
    'days_remaining', GREATEST(0, days_remaining),
    'expires_at', profile_record.plan_expires_at,
    'plan_changed_at', profile_record.plan_changed_at
  );
  
  RETURN result;
END;
$$;

-- ============================================================================
-- COMPLETE USER PLAN DETAILS FUNCTION (UPDATED)
-- ============================================================================

-- Enhanced function for API to get complete user plan info with renewal dates
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
  renewal_info jsonb;
BEGIN
  -- Get plan, usage, limits, and renewal info
  SELECT * INTO plan_info FROM get_user_plan(user_uuid) LIMIT 1;
  usage_info := get_monthly_usage(user_uuid);
  limits_info := get_plan_limits(user_uuid);
  renewal_info := get_plan_renewal_info(user_uuid);
  
  -- Build comprehensive response
  result := json_build_object(
    'plan', json_build_object(
      'id', plan_info.plan_id,
      'name', plan_info.plan_name,
      'status', plan_info.status,
      'expires_at', plan_info.expires_at,
      'is_trial', plan_info.is_trial,
      'renewal_date', renewal_info->>'renewal_date',
      'days_remaining', renewal_info->>'days_remaining'
    ),
    'usage', usage_info,
    'limits', limits_info,
    'can_create_workflow', can_create_workflow(user_uuid),
    'can_run_automation', can_run_automation(user_uuid),
    'renewal_info', renewal_info
  );
  
  RETURN result;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE usage_tracking IS 'Real-time usage tracking per user per month';
COMMENT ON TABLE user_workflow_count IS 'Real-time workflow count tracking per user';  
COMMENT ON TABLE automation_runs_tracking IS 'Detailed automation run tracking for usage monitoring';
COMMENT ON FUNCTION get_plan_renewal_info IS 'Calculate plan renewal dates and remaining days';