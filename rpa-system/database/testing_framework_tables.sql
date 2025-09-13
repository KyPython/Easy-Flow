-- ============================================================================
-- WORKFLOW TESTING FRAMEWORK TABLES
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to create the testing framework tables
-- This integrates with your existing workflow schema

-- Create workflow test scenarios table
CREATE TABLE IF NOT EXISTS public.workflow_test_scenarios (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    workflow_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    input_data jsonb DEFAULT '{}' NOT NULL,
    expected_outputs jsonb DEFAULT '{}' NOT NULL,
    test_steps jsonb DEFAULT '[]' NOT NULL,
    mock_config jsonb DEFAULT '{}' NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workflow_test_scenarios_pkey PRIMARY KEY (id),
    CONSTRAINT workflow_test_scenarios_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE,
    CONSTRAINT workflow_test_scenarios_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create workflow test results table
CREATE TABLE IF NOT EXISTS public.workflow_test_results (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    scenario_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    status text NOT NULL CHECK (status = ANY (ARRAY['passed'::text, 'failed'::text, 'running'::text, 'cancelled'::text])),
    execution_time integer NOT NULL DEFAULT 0,
    step_results jsonb DEFAULT '[]' NOT NULL,
    actual_outputs jsonb DEFAULT '{}' NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workflow_test_results_pkey PRIMARY KEY (id),
    CONSTRAINT workflow_test_results_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.workflow_test_scenarios(id) ON DELETE CASCADE,
    CONSTRAINT workflow_test_results_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_test_scenarios_workflow_id ON public.workflow_test_scenarios(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_test_scenarios_user_id ON public.workflow_test_scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_test_scenarios_created_at ON public.workflow_test_scenarios(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_test_results_scenario_id ON public.workflow_test_results(scenario_id);
CREATE INDEX IF NOT EXISTS idx_workflow_test_results_workflow_id ON public.workflow_test_results(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_test_results_status ON public.workflow_test_results(status);
CREATE INDEX IF NOT EXISTS idx_workflow_test_results_created_at ON public.workflow_test_results(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.workflow_test_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_test_results ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workflow_test_scenarios
CREATE POLICY "Users can view test scenarios for their workflows" ON public.workflow_test_scenarios
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.workflows 
            WHERE workflows.id = workflow_test_scenarios.workflow_id 
            AND workflows.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create test scenarios for their workflows" ON public.workflow_test_scenarios
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.workflows 
            WHERE workflows.id = workflow_id 
            AND workflows.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own test scenarios" ON public.workflow_test_scenarios
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own test scenarios" ON public.workflow_test_scenarios
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for workflow_test_results
CREATE POLICY "Users can view test results for their workflows" ON public.workflow_test_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.workflows 
            WHERE workflows.id = workflow_test_results.workflow_id 
            AND workflows.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create test results for their workflows" ON public.workflow_test_results
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workflows 
            WHERE workflows.id = workflow_id 
            AND workflows.user_id = auth.uid()
        )
    );

-- Create trigger function to update updated_at column (matches your schema pattern)
-- Note: Only create if it doesn't already exist from your existing schema
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at (following your existing pattern)
CREATE TRIGGER update_workflow_test_scenarios_updated_at 
    BEFORE UPDATE ON public.workflow_test_scenarios
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add some sample test scenarios for demonstration (optional)
-- Uncomment the following if you want sample data

/*
-- Insert sample test scenarios for existing workflows that match your schema
INSERT INTO public.workflow_test_scenarios (
    workflow_id,
    user_id,
    name,
    description,
    input_data,
    expected_outputs,
    test_steps,
    mock_config
) 
SELECT 
    w.id as workflow_id,
    w.user_id,
    'Basic Workflow Test',
    'Tests the basic functionality of the workflow with standard inputs and validates against your workflow_steps',
    '{"user_email": "test@example.com", "user_name": "Test User", "action_type": "welcome"}',
    '{"emails_sent": 1, "completion_status": "success", "execution_time": "< 5000ms"}',
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', ws.id,
                'stepKey', ws.step_key,
                'type', ws.step_type,
                'actionType', ws.action_type,
                'expectedOutput', 
                CASE 
                    WHEN ws.step_type = 'start' THEN '{"status": "started"}'::jsonb
                    WHEN ws.action_type = 'email' THEN '{"emailSent": true, "recipient": "test@example.com"}'::jsonb
                    WHEN ws.step_type = 'end' THEN '{"status": "completed"}'::jsonb
                    ELSE '{}'::jsonb
                END
            )
        )
        FROM public.workflow_steps ws 
        WHERE ws.workflow_id = w.id 
        ORDER BY ws.execution_order
    ),
    '{
        "emailConfig": {"simulate": true},
        "apiResponses": {},
        "stepMocks": {}
    }'
FROM public.workflows w
WHERE w.status = 'active' AND EXISTS (
    SELECT 1 FROM public.workflow_steps ws WHERE ws.workflow_id = w.id
)
LIMIT 3;
*/

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_test_scenarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_test_results TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.workflow_test_scenarios IS 'Stores test scenarios for workflow testing framework';
COMMENT ON TABLE public.workflow_test_results IS 'Stores results of test scenario executions';

COMMENT ON COLUMN public.workflow_test_scenarios.input_data IS 'JSON data to use as input for the test';
COMMENT ON COLUMN public.workflow_test_scenarios.expected_outputs IS 'Expected outputs to validate against';
COMMENT ON COLUMN public.workflow_test_scenarios.test_steps IS 'Array of test steps with expected behaviors';
COMMENT ON COLUMN public.workflow_test_scenarios.mock_config IS 'Configuration for mocking external services';

COMMENT ON COLUMN public.workflow_test_results.step_results IS 'Detailed results for each test step';
COMMENT ON COLUMN public.workflow_test_results.actual_outputs IS 'Actual outputs produced by the test run';
COMMENT ON COLUMN public.workflow_test_results.execution_time IS 'Total execution time in milliseconds';

-- Success message
SELECT 'Workflow testing framework tables created successfully!' as message;