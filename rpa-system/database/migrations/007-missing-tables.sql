-- Migration: Add missing template_versions table and workflow_templates_ranked view
-- Description: Create missing tables and views for template management
-- Created: 2025-01-13

-- ============================================================================
-- TEMPLATE VERSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.template_versions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
    
    -- Version information
    version TEXT NOT NULL,
    changelog TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    
    -- Template configuration
    template_config JSONB NOT NULL,
    dependencies JSONB DEFAULT '[]'::jsonb,
    screenshots TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(template_id, version)
);

-- ============================================================================
-- WORKFLOW TEMPLATES RANKED VIEW
-- ============================================================================

CREATE OR REPLACE VIEW workflow_templates_ranked AS
SELECT 
    wt.*,
    -- Calculate popularity score based on usage and rating
    COALESCE(
        LEAST(100, 
            (wt.usage_count * 0.7) + 
            (wt.rating * 20)
        ), 
        0
    ) AS popularity_score
FROM workflow_templates wt
WHERE wt.is_public = TRUE;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON public.template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_status ON public.template_versions(status);
CREATE INDEX IF NOT EXISTS idx_template_versions_created_at ON public.template_versions(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;

-- Template versions: Anyone can read published versions, only creators can modify
CREATE POLICY "template_versions_read" ON public.template_versions
    FOR SELECT USING (
        is_published = TRUE OR 
        EXISTS (
            SELECT 1 FROM public.workflow_templates wt 
            WHERE wt.id = template_versions.template_id 
            AND wt.created_by = auth.uid()
        )
    );

CREATE POLICY "template_versions_modify" ON public.template_versions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.workflow_templates wt 
            WHERE wt.id = template_versions.template_id 
            AND wt.created_by = auth.uid()
        )
    );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER trigger_template_versions_updated_at
    BEFORE UPDATE ON public.template_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.template_versions IS 'Template version history and management';
COMMENT ON VIEW workflow_templates_ranked IS 'Workflow templates with popularity scoring for ranking';