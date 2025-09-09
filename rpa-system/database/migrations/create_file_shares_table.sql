-- Migration: Create file_shares table for file sharing functionality
-- Description: Creates file_shares table based on existing schema but with enhanced features
-- Created: September 2024

-- Create file_shares table matching your existing schema structure
-- Note: Foreign key constraints are commented out for initial creation
CREATE TABLE IF NOT EXISTS public.file_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL,
  shared_by uuid NOT NULL,
  shared_with uuid,
  share_token text UNIQUE,
  permissions text NOT NULL DEFAULT 'view'::text CHECK (permissions = ANY (ARRAY['view'::text, 'download'::text])),
  max_downloads integer,
  download_count integer DEFAULT 0,
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  -- Additional columns for enhanced functionality
  share_name TEXT,
  password_hash TEXT,
  require_password BOOLEAN DEFAULT FALSE,
  allow_anonymous BOOLEAN DEFAULT TRUE,
  track_access BOOLEAN DEFAULT TRUE,
  CONSTRAINT file_shares_pkey PRIMARY KEY (id)
  -- Foreign key constraints to be added later when referenced tables exist:
  -- CONSTRAINT file_shares_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE,
  -- CONSTRAINT file_shares_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES auth.users(id) ON DELETE CASCADE,
  -- CONSTRAINT file_shares_shared_with_fkey FOREIGN KEY (shared_with) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON public.file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_shared_by ON public.file_shares(shared_by);
CREATE INDEX IF NOT EXISTS idx_file_shares_token ON public.file_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_file_shares_active ON public.file_shares(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_file_shares_expires ON public.file_shares(expires_at) WHERE expires_at IS NOT NULL;

-- Optional: Create access logs table (not in original schema)
CREATE TABLE IF NOT EXISTS public.file_share_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES public.file_shares(id) ON DELETE CASCADE,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    access_type VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (access_type IN ('view', 'download', 'password_attempt')),
    success BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for access logs
CREATE INDEX IF NOT EXISTS idx_share_access_share_id ON public.file_share_access_logs(share_id);
CREATE INDEX IF NOT EXISTS idx_share_access_date ON public.file_share_access_logs(accessed_at);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_file_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: PostgreSQL doesn't support IF NOT EXISTS for triggers
DROP TRIGGER IF EXISTS trigger_update_file_shares_updated_at ON public.file_shares;
CREATE TRIGGER trigger_update_file_shares_updated_at
    BEFORE UPDATE ON public.file_shares
    FOR EACH ROW
    EXECUTE FUNCTION update_file_shares_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.file_shares IS 'Stores file sharing configurations with secure token-based access';
COMMENT ON COLUMN public.file_shares.share_token IS 'Unique secure token for accessing shared files';
COMMENT ON COLUMN public.file_shares.permissions IS 'Level of access: view (preview only) or download (can download)';
COMMENT ON COLUMN public.file_shares.password_hash IS 'Bcrypt hash of optional password protection';
COMMENT ON COLUMN public.file_shares.max_downloads IS 'Maximum number of downloads allowed (NULL = unlimited)';
COMMENT ON COLUMN public.file_shares.download_count IS 'Current number of downloads';

COMMENT ON TABLE public.file_share_access_logs IS 'Logs all access attempts to shared files for analytics and security';
COMMENT ON COLUMN public.file_share_access_logs.access_type IS 'Type of access: view, download, or password_attempt';
COMMENT ON COLUMN public.file_share_access_logs.metadata IS 'Additional context data in JSON format';
