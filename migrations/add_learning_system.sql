-- ============================================================================
-- Add Adaptive Learning Tables for Link Discovery
-- ============================================================================
-- These tables enable EasyFlow to learn from every link discovery run
-- and improve over time, working with any site in the world

-- Table: link_discovery_patterns
-- Stores successful patterns that worked for specific sites
CREATE TABLE IF NOT EXISTS link_discovery_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url TEXT NOT NULL,
  discovery_method TEXT NOT NULL,
  selectors_used JSONB DEFAULT '[]'::jsonb,
  link_patterns JSONB DEFAULT '[]'::jsonb,
  page_structure JSONB DEFAULT '{}'::jsonb,
  success_count INTEGER DEFAULT 1,
  last_success_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_url, discovery_method)
);

-- Index for fast lookups by site URL
CREATE INDEX IF NOT EXISTS idx_link_discovery_patterns_site_url 
  ON link_discovery_patterns(site_url);

-- Index for finding most successful patterns
CREATE INDEX IF NOT EXISTS idx_link_discovery_patterns_success 
  ON link_discovery_patterns(success_count DESC, last_success_at DESC);

-- Table: link_discovery_failures
-- Stores failure patterns to avoid repeating mistakes
CREATE TABLE IF NOT EXISTS link_discovery_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url TEXT NOT NULL,
  error_message TEXT,
  attempted_method TEXT,
  page_structure JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analyzing failure patterns
CREATE INDEX IF NOT EXISTS idx_link_discovery_failures_site_url 
  ON link_discovery_failures(site_url, occurred_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE link_discovery_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_discovery_failures ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow service role to read/write (for backend)
CREATE POLICY "Service role can manage link discovery patterns"
  ON link_discovery_patterns
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage link discovery failures"
  ON link_discovery_failures
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies: Allow authenticated users to read their own patterns
-- (Patterns are site-based, not user-based, but we can add user context later)
CREATE POLICY "Users can read link discovery patterns"
  ON link_discovery_patterns
  FOR SELECT
  USING (true); -- Public read for now (patterns are site-specific, not user-specific)

CREATE POLICY "Users can read link discovery failures"
  ON link_discovery_failures
  FOR SELECT
  USING (true); -- Public read for analytics




-- ============================================================================
-- Universal Learning System for EasyFlow
-- ============================================================================
-- Makes the entire app learn from every automation and workflow execution
-- The system gets smarter with every run

-- Table: automation_learning_patterns
-- Stores successful patterns for all automation types
CREATE TABLE IF NOT EXISTS automation_learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_type TEXT NOT NULL,
  site_url TEXT NOT NULL,
  task_type TEXT NOT NULL,
  selectors_used JSONB DEFAULT '[]'::jsonb,
  config_snapshot JSONB DEFAULT '{}'::jsonb,
  execution_time_ms INTEGER,
  result_summary JSONB DEFAULT '{}'::jsonb,
  success_count INTEGER DEFAULT 1,
  failure_count INTEGER DEFAULT 0,
  last_success_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  user_corrected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(automation_type, site_url, task_type)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_automation_learning_type_site 
  ON automation_learning_patterns(automation_type, site_url, task_type);

CREATE INDEX IF NOT EXISTS idx_automation_learning_success 
  ON automation_learning_patterns(success_count DESC, last_success_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_learning_user 
  ON automation_learning_patterns(user_id) WHERE user_id IS NOT NULL;

-- Table: automation_learning_failures
-- Stores failure patterns to learn what doesn't work
CREATE TABLE IF NOT EXISTS automation_learning_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_type TEXT NOT NULL,
  site_url TEXT NOT NULL,
  task_type TEXT NOT NULL,
  error_message TEXT,
  attempted_config JSONB DEFAULT '{}'::jsonb,
  execution_time_ms INTEGER,
  user_id UUID REFERENCES auth.users(id),
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for failure analysis
CREATE INDEX IF NOT EXISTS idx_automation_failures_lookup 
  ON automation_learning_failures(automation_type, site_url, task_type, occurred_at DESC);

-- Table: workflow_learning_patterns
-- Stores successful workflow execution patterns
CREATE TABLE IF NOT EXISTS workflow_learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  workflow_name TEXT,
  step_pattern JSONB DEFAULT '[]'::jsonb,
  input_pattern JSONB DEFAULT '{}'::jsonb,
  execution_time_ms INTEGER,
  success_count INTEGER DEFAULT 1,
  failure_count INTEGER DEFAULT 0,
  last_success_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id)
);

-- Index for workflow pattern lookups
CREATE INDEX IF NOT EXISTS idx_workflow_learning_workflow 
  ON workflow_learning_patterns(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_learning_success 
  ON workflow_learning_patterns(success_count DESC, last_success_at DESC);

-- Table: user_feedback_learning
-- Stores user corrections and feedback to improve patterns
CREATE TABLE IF NOT EXISTS user_feedback_learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_type TEXT NOT NULL,
  site_url TEXT NOT NULL,
  task_type TEXT NOT NULL,
  feedback_text TEXT,
  corrected_config JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for feedback lookups
CREATE INDEX IF NOT EXISTS idx_user_feedback_lookup 
  ON user_feedback_learning(automation_type, site_url, task_type, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE automation_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_learning_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback_learning ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Service role can manage all learning data
CREATE POLICY "Service role can manage automation learning patterns"
  ON automation_learning_patterns
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage automation learning failures"
  ON automation_learning_failures
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage workflow learning patterns"
  ON workflow_learning_patterns
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage user feedback learning"
  ON user_feedback_learning
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies: Users can read their own learning data
CREATE POLICY "Users can read their automation learning patterns"
  ON automation_learning_patterns
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can read their automation learning failures"
  ON automation_learning_failures
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can read their workflow learning patterns"
  ON workflow_learning_patterns
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can read their feedback learning"
  ON user_feedback_learning
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);




