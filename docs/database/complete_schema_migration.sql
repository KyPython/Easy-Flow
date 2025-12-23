-- ============================================================================
-- EasyFlow Complete Database Schema Migration
-- Safe, non-destructive migration that checks existing schema before applying
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. BUSINESS RULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Rule metadata
  name TEXT NOT NULL,
  description TEXT NOT NULL, -- Plain English description (e.g., "VIP client = contract value > $5,000")
  category TEXT DEFAULT 'general', -- e.g., 'client', 'lead', 'user', 'revenue', 'general'
  
  -- Rule definition
  condition JSONB NOT NULL, -- Structured condition (e.g., { type: 'comparison', field: 'contract_value', operator: '>', value: 5000 })
  action TEXT, -- Optional: What happens when rule matches (e.g., "Route to Sales team")
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT business_rules_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT business_rules_description_not_empty CHECK (char_length(trim(description)) > 0)
);

-- Indexes for business_rules
CREATE INDEX IF NOT EXISTS idx_business_rules_user_id ON business_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_business_rules_category ON business_rules(category);
CREATE INDEX IF NOT EXISTS idx_business_rules_active ON business_rules(is_active) WHERE is_active = true;

-- Enable RLS for business_rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'business_rules' AND policyname = 'Users can view their own rules'
  ) THEN
    ALTER TABLE business_rules ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view their own rules"
      ON business_rules FOR SELECT
      USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can create their own rules"
      ON business_rules FOR INSERT
      WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can update their own rules"
      ON business_rules FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can delete their own rules"
      ON business_rules FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Update trigger for business_rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_business_rules_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION update_business_rules_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    CREATE TRIGGER update_business_rules_updated_at
      BEFORE UPDATE ON business_rules
      FOR EACH ROW
      EXECUTE FUNCTION update_business_rules_updated_at();
  END IF;
END $$;

-- ============================================================================
-- 2. WORKFLOW DECISION LOGS TABLE
-- ============================================================================

-- First, ensure workflow_executions and step_executions tables exist (they should, but check)
-- We'll create decision_logs with conditional foreign keys

CREATE TABLE IF NOT EXISTS workflow_decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_id UUID NOT NULL,
  step_execution_id UUID,
  
  -- Decision context
  rule_id UUID REFERENCES business_rules(id) ON DELETE SET NULL,
  rule_name TEXT, -- Denormalized for quick access
  decision_type TEXT NOT NULL, -- 'rule_match', 'routing', 'filtering', 'conditional', 'custom'
  
  -- Decision explanation
  decision_reason TEXT NOT NULL, -- Plain English explanation (e.g., "Contract value ($6,000) > VIP threshold ($5,000)")
  decision_outcome TEXT, -- What happened as a result (e.g., "Routed to Sales team")
  
  -- Context data
  input_data JSONB, -- Data that was evaluated
  matched_condition JSONB, -- The condition that matched
  output_data JSONB, -- Resulting data after decision
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT decision_logs_reason_not_empty CHECK (char_length(trim(decision_reason)) > 0)
);

-- Add foreign key constraints only if referenced tables exist
DO $$
BEGIN
  -- Check if workflow_executions exists and add FK if it does
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_executions') THEN
    -- Drop existing constraint if it exists (to avoid errors)
    ALTER TABLE workflow_decision_logs DROP CONSTRAINT IF EXISTS workflow_decision_logs_workflow_execution_id_fkey;
    -- Add new constraint
    ALTER TABLE workflow_decision_logs 
      ADD CONSTRAINT workflow_decision_logs_workflow_execution_id_fkey 
      FOREIGN KEY (workflow_execution_id) 
      REFERENCES workflow_executions(id) ON DELETE CASCADE;
  END IF;
  
  -- Check if step_executions exists and add FK if it does
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'step_executions') THEN
    ALTER TABLE workflow_decision_logs DROP CONSTRAINT IF EXISTS workflow_decision_logs_step_execution_id_fkey;
    ALTER TABLE workflow_decision_logs 
      ADD CONSTRAINT workflow_decision_logs_step_execution_id_fkey 
      FOREIGN KEY (step_execution_id) 
      REFERENCES step_executions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for workflow_decision_logs
CREATE INDEX IF NOT EXISTS idx_decision_logs_execution_id ON workflow_decision_logs(workflow_execution_id);
CREATE INDEX IF NOT EXISTS idx_decision_logs_step_id ON workflow_decision_logs(step_execution_id);
CREATE INDEX IF NOT EXISTS idx_decision_logs_rule_id ON workflow_decision_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_decision_logs_decision_type ON workflow_decision_logs(decision_type);
CREATE INDEX IF NOT EXISTS idx_decision_logs_created_at ON workflow_decision_logs(created_at DESC);

-- Enable RLS for workflow_decision_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'workflow_decision_logs' AND policyname = 'Users can view decision logs for their executions'
  ) THEN
    ALTER TABLE workflow_decision_logs ENABLE ROW LEVEL SECURITY;
    
    -- Only create policy if workflow_executions table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_executions') THEN
      CREATE POLICY "Users can view decision logs for their executions"
        ON workflow_decision_logs FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM workflow_executions we
            WHERE we.id = workflow_decision_logs.workflow_execution_id
            AND we.user_id = auth.uid()
          )
        );
    END IF;
    
    CREATE POLICY "System can insert decision logs"
      ON workflow_decision_logs FOR INSERT
      WITH CHECK (true); -- Service role bypasses RLS
  END IF;
END $$;

-- ============================================================================
-- 3. AI CONVERSATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_user BOOLEAN NOT NULL DEFAULT false,
  workflow_data JSONB DEFAULT NULL,
  suggestions JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ai_conversations
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON ai_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_time ON ai_conversations(user_id, created_at DESC);

-- Enable RLS for ai_conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_conversations' AND policyname = 'Users can view own conversations'
  ) THEN
    ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view own conversations" ON ai_conversations
      FOR SELECT USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can insert own conversations" ON ai_conversations
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can delete own conversations" ON ai_conversations
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- 4. ADD RULES COLUMN TO WORKFLOWS TABLE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflows' AND column_name = 'rules'
  ) THEN
    ALTER TABLE workflows ADD COLUMN rules UUID[];
    CREATE INDEX IF NOT EXISTS idx_workflows_rules ON workflows USING GIN(rules);
  END IF;
END $$;

-- ============================================================================
-- 5. ADD INDUSTRY COLUMN TO WORKFLOW_TEMPLATES TABLE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_templates' AND column_name = 'industry'
  ) THEN
    ALTER TABLE workflow_templates ADD COLUMN industry TEXT;
    
    CREATE INDEX IF NOT EXISTS idx_workflow_templates_industry 
      ON workflow_templates(industry) 
      WHERE industry IS NOT NULL;
    
    COMMENT ON COLUMN workflow_templates.industry IS 'Industry type for template filtering (freelancer, agency, home_services, ecommerce, saas, consulting)';
  END IF;
END $$;

-- ============================================================================
-- 6. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE business_rules IS 'Stores reusable business rules that can be applied across multiple workflows';
COMMENT ON TABLE workflow_decision_logs IS 'Stores decision logs that explain why workflow execution decisions were made, particularly when business rules are evaluated';
COMMENT ON TABLE ai_conversations IS 'Stores chat history between users and the AI assistant';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables were created
DO $$
DECLARE
  tables_created TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check business_rules
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_rules') THEN
    tables_created := array_append(tables_created, 'business_rules');
  END IF;
  
  -- Check workflow_decision_logs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_decision_logs') THEN
    tables_created := array_append(tables_created, 'workflow_decision_logs');
  END IF;
  
  -- Check ai_conversations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_conversations') THEN
    tables_created := array_append(tables_created, 'ai_conversations');
  END IF;
  
  RAISE NOTICE 'Migration complete. Tables created/verified: %', array_to_string(tables_created, ', ');
END $$;

