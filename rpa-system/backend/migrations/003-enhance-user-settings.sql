-- Enhance existing user_settings table with comprehensive notification preferences
-- Run this migration to add missing preference columns

-- Add missing notification preference columns
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT true;

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS task_completion BOOLEAN DEFAULT true;

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS task_failures BOOLEAN DEFAULT true;

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS system_alerts BOOLEAN DEFAULT true;

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS marketing_emails BOOLEAN DEFAULT true;

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS security_alerts BOOLEAN DEFAULT true;

-- Add contact information columns
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Add UI preference columns
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS dashboard_layout VARCHAR(20) DEFAULT 'grid';

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY';

-- Add updated_at timestamp column if it doesn't exist
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings (user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_fcm_token ON public.user_settings (fcm_token) WHERE fcm_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_settings_phone_number ON public.user_settings (phone_number) WHERE phone_number IS NOT NULL;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_user_settings_updated_at_trigger ON public.user_settings;

-- Create the trigger
CREATE TRIGGER update_user_settings_updated_at_trigger
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

-- Comment on the enhancements
COMMENT ON COLUMN public.user_settings.push_notifications IS 'Enable/disable browser push notifications';
COMMENT ON COLUMN public.user_settings.task_completion IS 'Notify when tasks complete successfully';
COMMENT ON COLUMN public.user_settings.task_failures IS 'Notify when tasks fail or encounter errors';
COMMENT ON COLUMN public.user_settings.system_alerts IS 'Notify about system-level alerts and maintenance';
COMMENT ON COLUMN public.user_settings.marketing_emails IS 'Enable/disable marketing and promotional emails';
COMMENT ON COLUMN public.user_settings.security_alerts IS 'Critical security notifications (always recommended)';
COMMENT ON COLUMN public.user_settings.phone_number IS 'Phone number for SMS notifications';
COMMENT ON COLUMN public.user_settings.fcm_token IS 'Firebase Cloud Messaging token for push notifications';
COMMENT ON COLUMN public.user_settings.dashboard_layout IS 'Preferred dashboard layout (grid, list, compact)';
COMMENT ON COLUMN public.user_settings.date_format IS 'Preferred date format for display';
