-- ============================================================================
-- Split Files Table to Follow SRP (FIXED VERSION)
-- ============================================================================
-- This migration splits the oversized 'files' table into focused tables.
-- IMPORTANT: This renames the old 'files' table to 'files_old_backup' first.
-- ============================================================================

-- STEP 1: Rename the old files table (if it's a base table, not a view)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'files' 
    AND table_type = 'BASE TABLE'
  ) THEN
    ALTER TABLE public.files RENAME TO files_old_backup;
    RAISE NOTICE 'Renamed existing files table to files_old_backup';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'files'
  ) THEN
    RAISE NOTICE 'files is already a view, skipping rename';
  ELSE
    RAISE NOTICE 'No files table found, starting fresh';
  END IF;
END $$;

-- STEP 2: Create New Focused Tables (IF NOT EXISTS for idempotency)

CREATE TABLE IF NOT EXISTS public.file_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  original_name text NOT NULL,
  display_name text,
  description text,
  mime_type text NOT NULL,
  file_extension text,
  file_size bigint NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.file_storage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL UNIQUE REFERENCES public.file_metadata(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  storage_bucket text NOT NULL DEFAULT 'artifacts',
  storage_key text,
  file_path text,
  checksum_md5 text,
  thumbnail_path text,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.file_organization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL UNIQUE REFERENCES public.file_metadata(id) ON DELETE CASCADE,
  folder_path text DEFAULT '/',
  tags text[] DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public')),
  is_temporary boolean DEFAULT false,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.file_workflow_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.file_metadata(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.automation_tasks(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  automation_run_id uuid REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  file_type text,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.file_access_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL UNIQUE REFERENCES public.file_metadata(id) ON DELETE CASCADE,
  download_count integer DEFAULT 0,
  last_accessed timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- STEP 3: Create Indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_file_metadata_user_id ON public.file_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_created_at ON public.file_metadata(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_storage_file_id ON public.file_storage(file_id);
CREATE INDEX IF NOT EXISTS idx_file_storage_path ON public.file_storage(storage_path);
CREATE INDEX IF NOT EXISTS idx_file_organization_file_id ON public.file_organization(file_id);
CREATE INDEX IF NOT EXISTS idx_file_organization_folder ON public.file_organization(folder_path);
CREATE INDEX IF NOT EXISTS idx_file_organization_visibility ON public.file_organization(visibility);
CREATE INDEX IF NOT EXISTS idx_file_organization_tags ON public.file_organization USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_file_workflow_links_file_id ON public.file_workflow_links(file_id);
CREATE INDEX IF NOT EXISTS idx_file_workflow_links_task_id ON public.file_workflow_links(task_id);
CREATE INDEX IF NOT EXISTS idx_file_workflow_links_run_id ON public.file_workflow_links(run_id);
CREATE INDEX IF NOT EXISTS idx_file_access_tracking_file_id ON public.file_access_tracking(file_id);

-- STEP 4: Migrate Data (only if old backup exists and new tables are empty)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'files_old_backup'
  ) THEN
    -- Check if new tables are empty before migrating
    IF NOT EXISTS (SELECT 1 FROM public.file_metadata LIMIT 1) THEN
      INSERT INTO public.file_metadata (id, user_id, original_name, display_name, description, mime_type, file_extension, file_size, created_at, updated_at)
      SELECT id, user_id, original_name, display_name, description, mime_type, file_extension, file_size, created_at, updated_at
      FROM public.files_old_backup;
      
      INSERT INTO public.file_storage (file_id, storage_path, storage_bucket, storage_key, file_path, checksum_md5, thumbnail_path)
      SELECT id, storage_path, storage_bucket, storage_key, file_path, checksum_md5, thumbnail_path
      FROM public.files_old_backup;
      
      INSERT INTO public.file_organization (file_id, folder_path, tags, visibility, is_temporary, expires_at, metadata, created_at, updated_at)
      SELECT id, folder_path, tags, visibility, is_temporary, expires_at, metadata, created_at, updated_at
      FROM public.files_old_backup;
      
      INSERT INTO public.file_workflow_links (file_id, task_id, run_id, automation_run_id, file_type)
      SELECT id, task_id, run_id, automation_run_id, file_type
      FROM public.files_old_backup
      WHERE task_id IS NOT NULL OR run_id IS NOT NULL OR automation_run_id IS NOT NULL;
      
      INSERT INTO public.file_access_tracking (file_id, download_count, last_accessed, created_at, updated_at)
      SELECT id, download_count, last_accessed, created_at, updated_at
      FROM public.files_old_backup;
      
      RAISE NOTICE 'Data migration completed';
    ELSE
      RAISE NOTICE 'New tables already have data, skipping migration';
    END IF;
  ELSE
    RAISE NOTICE 'No files_old_backup table found, skipping data migration';
  END IF;
END $$;

-- STEP 5: Update file_shares foreign key
ALTER TABLE public.file_shares DROP CONSTRAINT IF EXISTS file_shares_file_id_fkey;
ALTER TABLE public.file_shares ADD CONSTRAINT file_shares_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.file_metadata(id);

-- STEP 6: Create backward compatibility view (idempotent with CREATE OR REPLACE)
CREATE OR REPLACE VIEW public.files AS
SELECT 
  fm.id, fm.user_id, fm.original_name, fm.display_name, fm.description,
  fs.storage_path, fs.storage_bucket, fm.file_size, fm.mime_type, fm.file_extension,
  fs.checksum_md5, fwl.task_id, fwl.run_id, fo.visibility, fo.is_temporary,
  fo.expires_at, fo.folder_path, fo.tags, fo.metadata, fs.thumbnail_path,
  fat.download_count, fat.last_accessed, fm.created_at, fm.updated_at,
  fwl.automation_run_id, fs.file_path, fwl.file_type, fs.storage_key
FROM public.file_metadata fm
LEFT JOIN public.file_storage fs ON fm.id = fs.file_id
LEFT JOIN public.file_organization fo ON fm.id = fo.file_id
LEFT JOIN public.file_workflow_links fwl ON fm.id = fwl.file_id
LEFT JOIN public.file_access_tracking fat ON fm.id = fat.file_id;

-- STEP 7: Enable RLS
ALTER TABLE public.file_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_workflow_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_access_tracking ENABLE ROW LEVEL SECURITY;

-- STEP 8: Create RLS Policies (DROP IF EXISTS for idempotency)
DROP POLICY IF EXISTS "Users can view their own file metadata" ON public.file_metadata;
DROP POLICY IF EXISTS "Users can insert their own file metadata" ON public.file_metadata;
DROP POLICY IF EXISTS "Users can update their own file metadata" ON public.file_metadata;
DROP POLICY IF EXISTS "Users can delete their own file metadata" ON public.file_metadata;
DROP POLICY IF EXISTS "Service role can manage all file metadata" ON public.file_metadata;
DROP POLICY IF EXISTS "Users can view their file storage" ON public.file_storage;
DROP POLICY IF EXISTS "Users can manage their file storage" ON public.file_storage;
DROP POLICY IF EXISTS "Service role can manage all file storage" ON public.file_storage;
DROP POLICY IF EXISTS "Users can view their file organization" ON public.file_organization;
DROP POLICY IF EXISTS "Users can manage their file organization" ON public.file_organization;
DROP POLICY IF EXISTS "Service role can manage all file organization" ON public.file_organization;
DROP POLICY IF EXISTS "Users can view their file workflow links" ON public.file_workflow_links;
DROP POLICY IF EXISTS "Users can manage their file workflow links" ON public.file_workflow_links;
DROP POLICY IF EXISTS "Service role can manage all file workflow links" ON public.file_workflow_links;
DROP POLICY IF EXISTS "Users can view their file access tracking" ON public.file_access_tracking;
DROP POLICY IF EXISTS "Service can manage file access tracking" ON public.file_access_tracking;

CREATE POLICY "Users can view their own file metadata" ON public.file_metadata FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own file metadata" ON public.file_metadata FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own file metadata" ON public.file_metadata FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own file metadata" ON public.file_metadata FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all file metadata" ON public.file_metadata FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their file storage" ON public.file_storage FOR SELECT USING (EXISTS (SELECT 1 FROM public.file_metadata WHERE id = file_storage.file_id AND user_id = auth.uid()));
CREATE POLICY "Users can manage their file storage" ON public.file_storage FOR ALL USING (EXISTS (SELECT 1 FROM public.file_metadata WHERE id = file_storage.file_id AND user_id = auth.uid()));
CREATE POLICY "Service role can manage all file storage" ON public.file_storage FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their file organization" ON public.file_organization FOR SELECT USING (EXISTS (SELECT 1 FROM public.file_metadata WHERE id = file_organization.file_id AND user_id = auth.uid()));
CREATE POLICY "Users can manage their file organization" ON public.file_organization FOR ALL USING (EXISTS (SELECT 1 FROM public.file_metadata WHERE id = file_organization.file_id AND user_id = auth.uid()));
CREATE POLICY "Service role can manage all file organization" ON public.file_organization FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their file workflow links" ON public.file_workflow_links FOR SELECT USING (EXISTS (SELECT 1 FROM public.file_metadata WHERE id = file_workflow_links.file_id AND user_id = auth.uid()));
CREATE POLICY "Users can manage their file workflow links" ON public.file_workflow_links FOR ALL USING (EXISTS (SELECT 1 FROM public.file_metadata WHERE id = file_workflow_links.file_id AND user_id = auth.uid()));
CREATE POLICY "Service role can manage all file workflow links" ON public.file_workflow_links FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their file access tracking" ON public.file_access_tracking FOR SELECT USING (EXISTS (SELECT 1 FROM public.file_metadata WHERE id = file_access_tracking.file_id AND user_id = auth.uid()));
CREATE POLICY "Service can manage file access tracking" ON public.file_access_tracking FOR ALL USING (auth.role() = 'service_role');

-- Migration complete! Old table is kept as 'files_old_backup' for safety.
