-- Migration: EasyFlow Workflow Builder Schema
-- Description: Comprehensive workflow builder system for visual automation design
-- Created: January 2025
-- Integrates with existing: automation_logs, user_plans, file_shares

-- ============================================================================
-- CORE WORKFLOW TABLES
-- ============================================================================

-- 1. WORKFLOWS - Main workflow definitions
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    
    -- Visual editor metadata
    canvas_config JSONB DEFAULT '{
        "nodes": [],
        "edges": [],
        "viewport": {"x": 0, "y": 0, "zoom": 1}
    }'::jsonb,
    
    -- Workflow settings
    settings JSONB DEFAULT '{
        "max_executions": null,
        "timeout_minutes": 60,
        "retry_count": 3,
        "retry_delay": 5,
        "parallel_execution": false,
        "error_handling": "stop"
    }'::jsonb,
    
    -- Execution tracking
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    tags TEXT[],
    is_template BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. WORKFLOW STEPS - Individual automation steps
CREATE TABLE IF NOT EXISTS public.workflow_steps (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    
    -- Step identification
    step_key TEXT NOT NULL, -- Unique within workflow (e.g., "step_1", "scrape_data")
    name TEXT NOT NULL,
    description TEXT,
    step_type TEXT NOT NULL, -- 'start', 'action', 'condition', 'end', 'parallel', 'loop'
    
    -- Visual positioning
    position_x REAL NOT NULL DEFAULT 0,
    position_y REAL NOT NULL DEFAULT 0,
    
    -- Step configuration
    action_type TEXT, -- 'web_scrape', 'data_extract', 'api_call', 'file_upload', etc.
    config JSONB DEFAULT '{}'::jsonb, -- Step-specific configuration
    
    -- Flow control
    parent_step_id UUID REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
    execution_order INTEGER NOT NULL DEFAULT 0,
    
    -- Conditional logic
    conditions JSONB DEFAULT '[]'::jsonb, -- Array of condition objects
    
    -- Error handling
    on_success TEXT DEFAULT 'continue', -- 'continue', 'jump_to_step', 'end_workflow'
    on_error TEXT DEFAULT 'retry', -- 'retry', 'continue', 'jump_to_step', 'fail_workflow'
    success_step_id UUID REFERENCES public.workflow_steps(id),
    error_step_id UUID REFERENCES public.workflow_steps(id),
    
    -- Metadata
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(workflow_id, step_key)
);

-- 3. WORKFLOW CONNECTIONS - Define step relationships and flow
CREATE TABLE IF NOT EXISTS public.workflow_connections (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    
    -- Connection endpoints
    source_step_id UUID NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
    target_step_id UUID NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
    
    -- Connection type and conditions
    connection_type TEXT NOT NULL DEFAULT 'next' CHECK (connection_type IN ('next', 'success', 'error', 'condition')),
    condition JSONB DEFAULT '{}'::jsonb, -- Condition for conditional connections
    
    -- Visual styling
    visual_config JSONB DEFAULT '{
        "color": "#0066cc",
        "style": "solid",
        "animated": false
    }'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate connections
    UNIQUE(source_step_id, target_step_id, connection_type)
);

-- ============================================================================
-- WORKFLOW EXECUTION TABLES
-- ============================================================================

-- 4. WORKFLOW EXECUTIONS - Track each workflow run
CREATE TABLE IF NOT EXISTS public.workflow_executions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Execution metadata
    execution_number INTEGER NOT NULL, -- Auto-incrementing per workflow
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'timeout')),
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- Input/Output
    input_data JSONB DEFAULT '{}'::jsonb,
    output_data JSONB DEFAULT '{}'::jsonb,
    
    -- Error tracking
    error_message TEXT,
    error_step_id UUID REFERENCES public.workflow_steps(id),
    
    -- Execution context
    triggered_by TEXT DEFAULT 'manual', -- 'manual', 'schedule', 'webhook', 'api'
    trigger_data JSONB DEFAULT '{}'::jsonb,
    
    -- Resource tracking
    steps_executed INTEGER DEFAULT 0,
    steps_total INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. STEP EXECUTIONS - Track each step execution within a workflow run
CREATE TABLE IF NOT EXISTS public.step_executions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_execution_id UUID NOT NULL REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
    
    -- Execution details
    execution_order INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'skipped')),
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    
    -- Data flow
    input_data JSONB DEFAULT '{}'::jsonb,
    output_data JSONB DEFAULT '{}'::jsonb,
    
    -- Results and errors
    result JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Links to automation_logs for backward compatibility
    automation_log_id BIGINT REFERENCES public.automation_logs(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- WORKFLOW TEMPLATES AND SHARING
-- ============================================================================

-- 6. WORKFLOW TEMPLATES - Reusable workflow templates
CREATE TABLE IF NOT EXISTS public.workflow_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    
    -- Template metadata
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general', -- 'web_scraping', 'data_processing', 'api_integration', etc.
    tags TEXT[],
    
    -- Template configuration
    template_config JSONB NOT NULL, -- Serialized workflow definition
    required_inputs JSONB DEFAULT '[]'::jsonb, -- Array of required input definitions
    expected_outputs JSONB DEFAULT '[]'::jsonb, -- Array of expected output definitions
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0, -- Average rating from 0.0 to 5.0
    
    -- Publishing
    is_public BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. WORKFLOW SCHEDULES - Automated execution scheduling
CREATE TABLE IF NOT EXISTS public.workflow_schedules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Schedule configuration
    name TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('cron', 'interval', 'webhook')),
    
    -- Cron scheduling
    cron_expression TEXT, -- "0 9 * * 1-5" (9 AM weekdays)
    timezone TEXT DEFAULT 'UTC',
    
    -- Interval scheduling  
    interval_seconds INTEGER, -- For interval-based scheduling
    
    -- Webhook scheduling
    webhook_token TEXT UNIQUE, -- Secure token for webhook triggers
    webhook_secret TEXT, -- Optional webhook secret validation
    
    -- Schedule status
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    next_trigger_at TIMESTAMP WITH TIME ZONE,
    
    -- Execution limits
    max_executions INTEGER, -- Optional limit on total executions
    execution_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ACTION DEFINITIONS AND MARKETPLACE
-- ============================================================================

-- 8. ACTION_DEFINITIONS - Define available workflow actions
CREATE TABLE IF NOT EXISTS public.action_definitions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Action identification
    action_type TEXT NOT NULL UNIQUE, -- 'web_scrape', 'api_call', 'data_transform', etc.
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    
    -- Action configuration schema
    config_schema JSONB NOT NULL, -- JSON Schema for validation
    input_schema JSONB DEFAULT '{}'::jsonb,
    output_schema JSONB DEFAULT '{}'::jsonb,
    
    -- Visual representation
    icon_url TEXT,
    color TEXT DEFAULT '#0066cc',
    
    -- Requirements and limits
    required_plan TEXT DEFAULT 'free', -- 'free', 'starter', 'professional', 'enterprise'
    execution_limit INTEGER, -- Per month/day limit
    
    -- Metadata
    version TEXT NOT NULL DEFAULT '1.0.0',
    is_system BOOLEAN DEFAULT TRUE, -- System actions vs user-created
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- USER WORKFLOW DATA AND VARIABLES
-- ============================================================================

-- 9. WORKFLOW_VARIABLES - Store workflow-level variables
CREATE TABLE IF NOT EXISTS public.workflow_variables (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    
    -- Variable definition
    variable_name TEXT NOT NULL,
    variable_type TEXT NOT NULL CHECK (variable_type IN ('string', 'number', 'boolean', 'json', 'secret')),
    description TEXT,
    
    -- Value and constraints
    default_value JSONB,
    is_required BOOLEAN DEFAULT FALSE,
    is_encrypted BOOLEAN DEFAULT FALSE, -- For sensitive data
    
    -- Validation rules
    validation_rules JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(workflow_id, variable_name)
);

-- 10. USER_WORKFLOW_DATA - Store user-specific workflow data
CREATE TABLE IF NOT EXISTS public.user_workflow_data (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    
    -- Stored data
    data_key TEXT NOT NULL,
    data_value JSONB NOT NULL,
    data_type TEXT NOT NULL DEFAULT 'json',
    
    -- Metadata
    expires_at TIMESTAMP WITH TIME ZONE,
    is_encrypted BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, workflow_id, data_key)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Workflows
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON public.workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_updated_at ON public.workflows(updated_at);
CREATE INDEX IF NOT EXISTS idx_workflows_tags ON public.workflows USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_workflows_is_template ON public.workflows(is_template) WHERE is_template = TRUE;

-- Workflow Steps
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON public.workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_type ON public.workflow_steps(step_type);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_order ON public.workflow_steps(workflow_id, execution_order);

-- Workflow Connections
CREATE INDEX IF NOT EXISTS idx_workflow_connections_source ON public.workflow_connections(source_step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_connections_target ON public.workflow_connections(target_step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_connections_workflow ON public.workflow_connections(workflow_id);

-- Executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON public.workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user ON public.workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started ON public.workflow_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_number ON public.workflow_executions(workflow_id, execution_number);

-- Step Executions
CREATE INDEX IF NOT EXISTS idx_step_executions_workflow_exec ON public.step_executions(workflow_execution_id);
CREATE INDEX IF NOT EXISTS idx_step_executions_step ON public.step_executions(step_id);
CREATE INDEX IF NOT EXISTS idx_step_executions_status ON public.step_executions(status);
CREATE INDEX IF NOT EXISTS idx_step_executions_order ON public.step_executions(workflow_execution_id, execution_order);

-- Templates
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON public.workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_public ON public.workflow_templates(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflow_templates_featured ON public.workflow_templates(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflow_templates_tags ON public.workflow_templates USING GIN(tags);

-- Schedules
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_workflow ON public.workflow_schedules(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_active ON public.workflow_schedules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_next_trigger ON public.workflow_schedules(next_trigger_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_webhook_token ON public.workflow_schedules(webhook_token) WHERE webhook_token IS NOT NULL;

-- Action Definitions
CREATE INDEX IF NOT EXISTS idx_action_definitions_category ON public.action_definitions(category);
CREATE INDEX IF NOT EXISTS idx_action_definitions_plan ON public.action_definitions(required_plan);
CREATE INDEX IF NOT EXISTS idx_action_definitions_active ON public.action_definitions(is_active) WHERE is_active = TRUE;

-- Variables
CREATE INDEX IF NOT EXISTS idx_workflow_variables_workflow ON public.workflow_variables(workflow_id);
CREATE INDEX IF NOT EXISTS idx_user_workflow_data_user_workflow ON public.user_workflow_data(user_id, workflow_id);
CREATE INDEX IF NOT EXISTS idx_user_workflow_data_expires ON public.user_workflow_data(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workflow_data ENABLE ROW LEVEL SECURITY;

-- Workflows: Users can only access their own workflows or public templates
CREATE POLICY "workflows_user_access" ON public.workflows
    FOR ALL USING (
        auth.uid() = user_id OR 
        (is_public = TRUE AND is_template = TRUE)
    );

-- Workflow Steps: Access through workflow ownership
CREATE POLICY "workflow_steps_user_access" ON public.workflow_steps
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.workflows 
            WHERE id = workflow_steps.workflow_id 
            AND (user_id = auth.uid() OR (is_public = TRUE AND is_template = TRUE))
        )
    );

-- Workflow Connections: Access through workflow ownership
CREATE POLICY "workflow_connections_user_access" ON public.workflow_connections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.workflows 
            WHERE id = workflow_connections.workflow_id 
            AND (user_id = auth.uid() OR (is_public = TRUE AND is_template = TRUE))
        )
    );

-- Executions: Users can only see their own executions
CREATE POLICY "workflow_executions_user_access" ON public.workflow_executions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "step_executions_user_access" ON public.step_executions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.workflow_executions 
            WHERE id = step_executions.workflow_execution_id 
            AND user_id = auth.uid()
        )
    );

-- Templates: Anyone can read public templates, only creators can modify
CREATE POLICY "workflow_templates_read" ON public.workflow_templates
    FOR SELECT USING (is_public = TRUE OR created_by = auth.uid());

CREATE POLICY "workflow_templates_modify" ON public.workflow_templates
    FOR ALL USING (created_by = auth.uid());

-- Schedules: Users can only access their own schedules
CREATE POLICY "workflow_schedules_user_access" ON public.workflow_schedules
    FOR ALL USING (auth.uid() = user_id);

-- Action Definitions: Read-only for authenticated users, modify for service role
CREATE POLICY "action_definitions_read" ON public.action_definitions
    FOR SELECT TO authenticated USING (is_active = TRUE);

CREATE POLICY "action_definitions_service" ON public.action_definitions
    FOR ALL TO service_role USING (TRUE);

-- Variables: Access through workflow ownership
CREATE POLICY "workflow_variables_user_access" ON public.workflow_variables
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.workflows 
            WHERE id = workflow_variables.workflow_id 
            AND user_id = auth.uid()
        )
    );

-- User Data: Users can only access their own data
CREATE POLICY "user_workflow_data_user_access" ON public.user_workflow_data
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER trigger_workflows_updated_at
    BEFORE UPDATE ON public.workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_workflow_steps_updated_at
    BEFORE UPDATE ON public.workflow_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_workflow_templates_updated_at
    BEFORE UPDATE ON public.workflow_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_workflow_schedules_updated_at
    BEFORE UPDATE ON public.workflow_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_action_definitions_updated_at
    BEFORE UPDATE ON public.action_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_workflow_variables_updated_at
    BEFORE UPDATE ON public.workflow_variables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_workflow_data_updated_at
    BEFORE UPDATE ON public.user_workflow_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-increment execution numbers
CREATE OR REPLACE FUNCTION set_execution_number()
RETURNS TRIGGER AS $$
BEGIN
    SELECT COALESCE(MAX(execution_number), 0) + 1
    INTO NEW.execution_number
    FROM public.workflow_executions
    WHERE workflow_id = NEW.workflow_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_execution_number
    BEFORE INSERT ON public.workflow_executions
    FOR EACH ROW EXECUTE FUNCTION set_execution_number();

-- Function to update workflow execution stats
CREATE OR REPLACE FUNCTION update_workflow_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE public.workflows 
        SET 
            total_executions = total_executions + 1,
            successful_executions = successful_executions + 1,
            last_executed_at = NEW.completed_at
        WHERE id = NEW.workflow_id;
    ELSIF NEW.status = 'failed' AND OLD.status != 'failed' THEN
        UPDATE public.workflows 
        SET 
            total_executions = total_executions + 1,
            failed_executions = failed_executions + 1,
            last_executed_at = NEW.completed_at
        WHERE id = NEW.workflow_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workflow_stats
    AFTER UPDATE ON public.workflow_executions
    FOR EACH ROW EXECUTE FUNCTION update_workflow_stats();

-- ============================================================================
-- INITIAL DATA - SYSTEM ACTION DEFINITIONS
-- ============================================================================

-- Insert core system actions
INSERT INTO public.action_definitions (action_type, name, description, category, config_schema, input_schema, output_schema, icon_url, color) VALUES
('start', 'Start', 'Workflow entry point', 'control', 
 '{"type": "object", "properties": {}}',
 '{"type": "object", "properties": {"input": {"type": "object"}}}',
 '{"type": "object", "properties": {"output": {"type": "object"}}}',
 '/icons/start.svg', '#00C851'),

('web_scrape', 'Web Scraping', 'Extract data from web pages', 'data_extraction',
 '{"type": "object", "properties": {"url": {"type": "string", "format": "uri"}, "selectors": {"type": "array", "items": {"type": "object"}}, "wait_for": {"type": "string"}, "timeout": {"type": "integer", "default": 30}}}',
 '{"type": "object", "properties": {"url": {"type": "string"}}}',
 '{"type": "object", "properties": {"data": {"type": "array"}, "metadata": {"type": "object"}}}',
 '/icons/web-scrape.svg', '#FF4444'),

('api_call', 'API Request', 'Make HTTP requests to APIs', 'integration',
 '{"type": "object", "properties": {"method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE"]}, "url": {"type": "string", "format": "uri"}, "headers": {"type": "object"}, "body": {"type": "object"}, "timeout": {"type": "integer", "default": 30}}}',
 '{"type": "object", "properties": {"params": {"type": "object"}}}',
 '{"type": "object", "properties": {"response": {"type": "object"}, "status": {"type": "integer"}}}',
 '/icons/api.svg', '#007bff'),

('data_transform', 'Data Transform', 'Transform and manipulate data', 'data_processing',
 '{"type": "object", "properties": {"transformations": {"type": "array", "items": {"type": "object"}}, "output_format": {"type": "string", "enum": ["json", "csv", "xml"]}}}',
 '{"type": "object", "properties": {"data": {"type": "array"}}}',
 '{"type": "object", "properties": {"transformed_data": {"type": "array"}}}',
 '/icons/transform.svg', '#FFA500'),

('condition', 'Condition', 'Branch workflow based on conditions', 'control',
 '{"type": "object", "properties": {"conditions": {"type": "array", "items": {"type": "object"}}, "operator": {"type": "string", "enum": ["AND", "OR"]}}}',
 '{"type": "object", "properties": {"data": {"type": "object"}}}',
 '{"type": "object", "properties": {"result": {"type": "boolean"}, "matched_condition": {"type": "object"}}}',
 '/icons/condition.svg', '#17a2b8'),

('file_upload', 'File Upload', 'Upload files to storage', 'file_operations',
 '{"type": "object", "properties": {"destination": {"type": "string"}, "overwrite": {"type": "boolean", "default": false}, "public": {"type": "boolean", "default": false}}}',
 '{"type": "object", "properties": {"file_data": {"type": "string", "format": "byte"}}}',
 '{"type": "object", "properties": {"file_url": {"type": "string"}, "file_id": {"type": "string"}}}',
 '/icons/upload.svg', '#28a745'),

('email', 'Send Email', 'Send email notifications', 'communication',
 '{"type": "object", "properties": {"to": {"type": "array", "items": {"type": "string", "format": "email"}}, "subject": {"type": "string"}, "template": {"type": "string"}, "variables": {"type": "object"}}}',
 '{"type": "object", "properties": {"data": {"type": "object"}}}',
 '{"type": "object", "properties": {"message_id": {"type": "string"}, "status": {"type": "string"}}}',
 '/icons/email.svg', '#6610f2'),

('delay', 'Delay', 'Wait for specified time', 'utility',
 '{"type": "object", "properties": {"duration_seconds": {"type": "integer", "minimum": 1}, "duration_type": {"type": "string", "enum": ["fixed", "random"], "default": "fixed"}}}',
 '{"type": "object", "properties": {}}',
 '{"type": "object", "properties": {"waited_seconds": {"type": "integer"}}}',
 '/icons/delay.svg', '#6c757d'),

('end', 'End', 'Workflow termination point', 'control',
 '{"type": "object", "properties": {"success": {"type": "boolean", "default": true}, "message": {"type": "string"}}}',
 '{"type": "object", "properties": {"final_data": {"type": "object"}}}',
 '{"type": "object", "properties": {"result": {"type": "object"}}}',
 '/icons/end.svg', '#dc3545')

ON CONFLICT (action_type) DO NOTHING;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.workflows IS 'Main workflow definitions with visual editor data';
COMMENT ON COLUMN public.workflows.canvas_config IS 'React Flow editor state (nodes, edges, viewport)';
COMMENT ON COLUMN public.workflows.settings IS 'Workflow execution settings and limits';

COMMENT ON TABLE public.workflow_steps IS 'Individual automation steps within workflows';
COMMENT ON COLUMN public.workflow_steps.step_key IS 'Unique identifier within workflow for referencing';
COMMENT ON COLUMN public.workflow_steps.config IS 'Step-specific configuration based on action_type';
COMMENT ON COLUMN public.workflow_steps.conditions IS 'Array of conditional logic for step execution';

COMMENT ON TABLE public.workflow_connections IS 'Defines relationships and data flow between workflow steps';
COMMENT ON COLUMN public.workflow_connections.connection_type IS 'Type of connection: next, success, error, or conditional';

COMMENT ON TABLE public.workflow_executions IS 'Tracks each workflow execution instance';
COMMENT ON COLUMN public.workflow_executions.execution_number IS 'Auto-incrementing number per workflow';

COMMENT ON TABLE public.step_executions IS 'Tracks individual step executions within workflow runs';
COMMENT ON COLUMN public.step_executions.automation_log_id IS 'Links to existing automation_logs for compatibility';

COMMENT ON TABLE public.workflow_templates IS 'Reusable workflow templates and marketplace';
COMMENT ON TABLE public.workflow_schedules IS 'Automated workflow scheduling (cron, interval, webhook)';
COMMENT ON TABLE public.action_definitions IS 'Available workflow actions with configuration schemas';
COMMENT ON TABLE public.workflow_variables IS 'Workflow-level variables and constants';
COMMENT ON TABLE public.user_workflow_data IS 'User-specific workflow data and state';