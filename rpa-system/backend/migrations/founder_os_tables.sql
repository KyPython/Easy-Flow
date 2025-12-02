-- Rockefeller Operating System Database Schema
-- Creates tables for founder metrics, daily checklists, and strategic tracking

-- Daily Founder Checklist Table
CREATE TABLE IF NOT EXISTS founder_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority_task TEXT,
  moved_closer_to_goal BOOLEAN,
  daily_learning TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Quarterly Priorities Table
CREATE TABLE IF NOT EXISTS quarterly_priorities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  year INTEGER NOT NULL,
  priority TEXT NOT NULL,
  supporting_initiatives JSONB DEFAULT '[]'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('not_set', 'active', 'completed', 'abandoned')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, quarter, year)
);

-- Competitive Intelligence Tracking
CREATE TABLE IF NOT EXISTS competitive_intelligence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'pricing', 'feature', 'marketing', 'user_feedback'
  observation TEXT NOT NULL,
  source_url TEXT,
  impact_level TEXT CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
  action_items JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'analyzing', 'action_taken', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Efficiency Improvements Tracker
CREATE TABLE IF NOT EXISTS efficiency_improvements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  area TEXT NOT NULL, -- 'conversion', 'support', 'development', 'marketing', 'operations'
  baseline_metric JSONB, -- { "metric": "signup_time", "value": 120, "unit": "seconds" }
  target_metric JSONB,
  actual_metric JSONB,
  impact_estimate TEXT, -- '5% conversion increase', '20% time reduction'
  implementation_date DATE,
  status TEXT DEFAULT 'proposed' CHECK (status IN ('proposed', 'in_progress', 'implemented', 'measuring', 'validated', 'rejected')),
  roi_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Strategic Reviews (Quarterly & Annual)
CREATE TABLE IF NOT EXISTS strategic_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_type TEXT NOT NULL CHECK (review_type IN ('quarterly', 'annual')),
  quarter INTEGER CHECK (quarter >= 1 AND quarter <= 4),
  year INTEGER NOT NULL,
  priority_achieved BOOLEAN,
  key_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  rockefeller_scores JSONB NOT NULL DEFAULT '{}'::jsonb, -- Scores for each principle/habit
  top_learnings JSONB DEFAULT '[]'::jsonb,
  double_down_on JSONB DEFAULT '[]'::jsonb,
  stop_doing JSONB DEFAULT '[]'::jsonb,
  next_priority TEXT,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Core Values & Culture Tracker
CREATE TABLE IF NOT EXISTS company_values (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value_name TEXT NOT NULL,
  description TEXT,
  examples JSONB DEFAULT '[]'::jsonb, -- Real examples of living this value
  decision_count INTEGER DEFAULT 0, -- How many times referenced in decisions
  last_referenced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Decision Log (Track major decisions against values)
CREATE TABLE IF NOT EXISTS decision_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  decision_title TEXT NOT NULL,
  decision_description TEXT,
  values_considered JSONB DEFAULT '[]'::jsonb, -- Which core values influenced this
  data_used JSONB, -- What data informed the decision
  outcome_prediction TEXT,
  actual_outcome TEXT,
  outcome_date DATE,
  lessons_learned TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_founder_checklists_user_date ON founder_checklists(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_quarterly_priorities_user ON quarterly_priorities(user_id, year DESC, quarter DESC);
CREATE INDEX IF NOT EXISTS idx_competitive_intelligence_user ON competitive_intelligence(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitive_intelligence_status ON competitive_intelligence(status, impact_level);
CREATE INDEX IF NOT EXISTS idx_efficiency_improvements_user ON efficiency_improvements(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategic_reviews_user ON strategic_reviews(user_id, year DESC, quarter DESC);
CREATE INDEX IF NOT EXISTS idx_company_values_user ON company_values(user_id);
CREATE INDEX IF NOT EXISTS idx_decision_log_user ON decision_log(user_id, created_at DESC);

-- Row Level Security (RLS) Policies
-- Users can only see their own data

ALTER TABLE founder_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY founder_checklists_policy ON founder_checklists
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE quarterly_priorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY quarterly_priorities_policy ON quarterly_priorities
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE competitive_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY competitive_intelligence_policy ON competitive_intelligence
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE efficiency_improvements ENABLE ROW LEVEL SECURITY;
CREATE POLICY efficiency_improvements_policy ON efficiency_improvements
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE strategic_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY strategic_reviews_policy ON strategic_reviews
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE company_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_values_policy ON company_values
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE decision_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY decision_log_policy ON decision_log
  FOR ALL USING (auth.uid() = user_id);

-- Insert Q4 2025 default priority for founder
-- (Run this manually for your founder account after creating tables)
/*
INSERT INTO quarterly_priorities (user_id, quarter, year, priority, supporting_initiatives, metrics)
VALUES (
  'YOUR_USER_ID_HERE',
  4,
  2025,
  'Get First 5 Paying Customers at $50-100/mo Each',
  '["Validate product-market fit", "Create testimonial base", "Generate first revenue", "Break psychological barrier"]'::jsonb,
  '{"target_customers": 5, "target_mrr_min": 250, "target_mrr_max": 500, "current_customers": 0, "current_mrr": 0}'::jsonb
)
ON CONFLICT (user_id, quarter, year) DO NOTHING;
*/

-- Create view for founder dashboard quick access
CREATE OR REPLACE VIEW founder_dashboard_quick AS
SELECT
  u.id as user_id,
  COUNT(DISTINCT CASE WHEN u.created_at::date = CURRENT_DATE THEN u.id END) as signups_today,
  COUNT(DISTINCT CASE WHEN u.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN u.id END) as signups_7d,
  COUNT(DISTINCT CASE WHEN u.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN u.id END) as signups_30d,
  COUNT(DISTINCT u.id) as total_users
FROM users u
GROUP BY u.id;

COMMENT ON TABLE founder_checklists IS 'Daily Rockefeller checklist tracking - the 8 items every founder should complete daily';
COMMENT ON TABLE quarterly_priorities IS 'Quarterly #1 Priority tracking - Rockefeller Habit #1';
COMMENT ON TABLE competitive_intelligence IS 'Competitive intelligence tracking - Rockefeller Principle #3 (Data Leverage)';
COMMENT ON TABLE efficiency_improvements IS 'Efficiency improvement tracking - Rockefeller Principle #1 (Ruthless Efficiency)';
COMMENT ON TABLE strategic_reviews IS 'Quarterly and annual strategic review data - Rockefeller Habit #8';
COMMENT ON TABLE company_values IS 'Core values tracking - Rockefeller Habit #6 (Values Alive)';
COMMENT ON TABLE decision_log IS 'Major decision tracking against data and values';
