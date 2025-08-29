-- EasyFlow User Plans and Subscriptions Schema
-- Run this in your Supabase SQL editor

-- Create user_plans table
CREATE TABLE IF NOT EXISTS user_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('free', 'starter', 'professional', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'cancelled', 'expired')),
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint on user_id (one plan per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_plans_user_id ON user_plans(user_id);

-- Create index on plan_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_plans_plan_id ON user_plans(plan_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_user_plans_status ON user_plans(status);

-- Create index on trial_end for trial management
CREATE INDEX IF NOT EXISTS idx_user_plans_trial_end ON user_plans(trial_end);

-- Enable Row Level Security (RLS)
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own plan
CREATE POLICY "Users can view own plan" ON user_plans
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own plan
CREATE POLICY "Users can insert own plan" ON user_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own plan
CREATE POLICY "Users can update own plan" ON user_plans
  FOR UPDATE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_plans_updated_at
  BEFORE UPDATE ON user_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to check if user has active plan
CREATE OR REPLACE FUNCTION has_active_plan(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_plans 
    WHERE user_id = user_uuid 
    AND status IN ('active', 'trial')
    AND (trial_end IS NULL OR trial_end > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's current plan
CREATE OR REPLACE FUNCTION get_user_plan(user_uuid UUID)
RETURNS TABLE (
  plan_id TEXT,
  status TEXT,
  trial_end TIMESTAMP WITH TIME ZONE,
  days_left INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.plan_id,
    up.status,
    up.trial_end,
    CASE 
      WHEN up.status = 'trial' AND up.trial_end IS NOT NULL 
      THEN GREATEST(0, EXTRACT(DAY FROM (up.trial_end - NOW())))
      ELSE NULL
    END as days_left
  FROM user_plans up
  WHERE up.user_id = user_uuid
  AND up.status IN ('active', 'trial');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default free plan for existing users (optional)
-- This will give all existing users access to the free tier
INSERT INTO user_plans (user_id, plan_id, status, current_period_start, current_period_end)
SELECT 
  id,
  'free',
  'active',
  NOW(),
  NOW() + INTERVAL '100 years'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_plans);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON user_plans TO authenticated;
GRANT EXECUTE ON FUNCTION has_active_plan(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_plan(UUID) TO authenticated;
