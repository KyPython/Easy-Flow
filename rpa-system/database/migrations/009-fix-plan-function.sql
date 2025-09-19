-- Migration: Fix get_user_plan function to work with UUID plan IDs
-- Description: Update plan functions to properly join with plans table
-- Created: January 2025

-- ============================================================================
-- FIXED USER PLAN FUNCTION
-- ============================================================================

-- Updated function to get user's current active plan (joins with plans table)
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
  user_plan_uuid uuid;
  plan_record RECORD;
BEGIN
  -- Get plan_id from profiles table (this is now a UUID)
  SELECT plan_id INTO user_plan_uuid
  FROM profiles 
  WHERE id = user_uuid;
  
  -- If no user found or plan_id is null, return free plan
  IF user_plan_uuid IS NULL THEN
    RETURN QUERY
    SELECT 
      'free'::text,
      'Hobbyist'::text,
      'active'::text,
      NULL::timestamptz,
      false::boolean;
  ELSE
    -- Join with plans table to get actual plan details
    SELECT p.name, p.id::text INTO plan_record
    FROM plans p
    WHERE p.id = user_plan_uuid;
    
    -- If plan found in plans table, return it
    IF FOUND THEN
      RETURN QUERY
      SELECT 
        plan_record.id,
        plan_record.name,
        'active'::text,
        NULL::timestamptz, -- No expiry tracking in current schema
        false::boolean
      LIMIT 1;
    ELSE
      -- Fallback to free plan if UUID plan not found
      RETURN QUERY
      SELECT 
        'free'::text,
        'Hobbyist'::text,
        'active'::text,
        NULL::timestamptz,
        false::boolean;
    END IF;
  END IF;
END;
$$;

-- ============================================================================
-- FIXED PLAN LIMITS FUNCTION
-- ============================================================================

-- Updated function to get plan limits (works with UUID plan IDs)
CREATE OR REPLACE FUNCTION get_plan_limits(user_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_plan_uuid uuid;
  plan_name text;
  limits jsonb;
BEGIN
  -- Get plan_id from profiles table (this is now a UUID)
  SELECT plan_id INTO user_plan_uuid
  FROM profiles 
  WHERE id = user_uuid;
  
  -- If no plan found, default to free/hobbyist
  IF user_plan_uuid IS NULL THEN
    plan_name := 'Hobbyist';
  ELSE
    -- Get plan name from plans table
    SELECT name INTO plan_name
    FROM plans
    WHERE id = user_plan_uuid;
    
    -- If no plan found, default to hobbyist
    IF plan_name IS NULL THEN
      plan_name := 'Hobbyist';
    END IF;
  END IF;
  
  -- Set limits based on plan name
  CASE plan_name
    WHEN 'Starter' THEN
      limits := '{
        "workflows": 5,
        "monthly_runs": 500,
        "storage_gb": 10,
        "team_members": 1,
        "logging_retention_days": 90,
        "advanced_features": true,
        "priority_support": false
      }'::jsonb;
    WHEN 'Professional' THEN
      limits := '{
        "workflows": 25,
        "monthly_runs": 5000,
        "storage_gb": 100,
        "team_members": 5,
        "logging_retention_days": 365,
        "advanced_features": true,
        "priority_support": true
      }'::jsonb;
    WHEN 'Enterprise' THEN
      limits := '{
        "workflows": -1,
        "monthly_runs": 50000,
        "storage_gb": -1,
        "team_members": -1,
        "logging_retention_days": -1,
        "advanced_features": true,
        "priority_support": true
      }'::jsonb;
    ELSE -- 'Hobbyist' or any other plan
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
-- UPDATED FEATURE CHECK FUNCTION
-- ============================================================================

-- Updated function to check if user has feature access (works with UUID plan IDs)
CREATE OR REPLACE FUNCTION user_has_feature(user_uuid uuid, feature_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_plan_uuid uuid;
  plan_name text;
BEGIN
  -- Get plan_id from profiles table (this is now a UUID)
  SELECT plan_id INTO user_plan_uuid
  FROM profiles 
  WHERE id = user_uuid;
  
  -- If no plan found, return false for premium features
  IF user_plan_uuid IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get plan name from plans table
  SELECT name INTO plan_name
  FROM plans
  WHERE id = user_plan_uuid;
  
  -- If no plan found, return false
  IF plan_name IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check feature availability by plan name
  CASE feature_key
    WHEN 'advanced_features' THEN
      RETURN plan_name IN ('Starter', 'Professional', 'Enterprise');
    WHEN 'priority_support' THEN
      RETURN plan_name IN ('Professional', 'Enterprise');
    WHEN 'team_collaboration' THEN
      RETURN plan_name IN ('Professional', 'Enterprise');
    WHEN 'custom_integrations' THEN
      RETURN plan_name IN ('Professional', 'Enterprise');
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_user_plan IS 'Returns the current active plan for a user (fixed to work with UUID plan IDs)';
COMMENT ON FUNCTION get_plan_limits IS 'Returns plan-specific limits for a user (fixed to work with UUID plan IDs)';
COMMENT ON FUNCTION user_has_feature IS 'Checks if user has access to a specific feature (fixed to work with UUID plan IDs)';