-- User Preferences System Enhancement
-- Add preference columns to profiles table and create supporting functions

-- Add preference columns to the profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email_notifications": true,
  "weekly_reports": true,
  "sms_alerts": false,
  "push_notifications": true,
  "task_completion": true,
  "task_failures": true,
  "system_alerts": true,
  "marketing_emails": true,
  "security_alerts": true
}'::jsonb;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_preferences JSONB DEFAULT '{
  "theme": "light",
  "dashboard_layout": "grid",
  "timezone": "UTC",
  "date_format": "MM/DD/YYYY",
  "language": "en"
}'::jsonb;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_id TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_notification_prefs ON public.profiles USING GIN (notification_preferences);
CREATE INDEX IF NOT EXISTS idx_profiles_ui_prefs ON public.profiles USING GIN (ui_preferences);
CREATE INDEX IF NOT EXISTS idx_profiles_fcm_token ON public.profiles (fcm_token);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at_trigger ON public.profiles;
CREATE TRIGGER update_profiles_updated_at_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- Function to get user preferences
CREATE OR REPLACE FUNCTION get_user_preferences(user_uuid UUID)
RETURNS TABLE (
  notification_preferences JSONB,
  ui_preferences JSONB,
  fcm_token TEXT,
  phone_number TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.notification_preferences,
    p.ui_preferences,
    p.fcm_token,
    p.phone_number
  FROM public.profiles p
  WHERE p.id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user preferences
CREATE OR REPLACE FUNCTION update_user_preferences(
  user_uuid UUID,
  p_notification_preferences JSONB DEFAULT NULL,
  p_ui_preferences JSONB DEFAULT NULL,
  p_fcm_token TEXT DEFAULT NULL,
  p_phone_number TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.profiles 
  SET 
    notification_preferences = COALESCE(p_notification_preferences, notification_preferences),
    ui_preferences = COALESCE(p_ui_preferences, ui_preferences),
    fcm_token = COALESCE(p_fcm_token, fcm_token),
    phone_number = COALESCE(p_phone_number, phone_number),
    updated_at = NOW()
  WHERE id = user_uuid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific notification preference enabled
CREATE OR REPLACE FUNCTION user_has_notification_preference(
  user_uuid UUID,
  preference_key TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT COALESCE(
    (notification_preferences ->> preference_key)::boolean, 
    true  -- Default to true if preference not set
  ) INTO result
  FROM public.profiles
  WHERE id = user_uuid;
  
  RETURN COALESCE(result, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing profiles with default preferences
UPDATE public.profiles 
SET 
  notification_preferences = COALESCE(notification_preferences, '{
    "email_notifications": true,
    "weekly_reports": true,
    "sms_alerts": false,
    "push_notifications": true,
    "task_completion": true,
    "task_failures": true,
    "system_alerts": true,
    "marketing_emails": true,
    "security_alerts": true
  }'::jsonb),
  ui_preferences = COALESCE(ui_preferences, '{
    "theme": "light",
    "dashboard_layout": "grid",
    "timezone": "UTC",
    "date_format": "MM/DD/YYYY",
    "language": "en"
  }'::jsonb),
  plan_id = COALESCE(plan_id, 'free')
WHERE notification_preferences IS NULL 
   OR ui_preferences IS NULL 
   OR plan_id IS NULL;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_preferences(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_preferences(UUID, JSONB, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_notification_preference(UUID, TEXT) TO authenticated;
