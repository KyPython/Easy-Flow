-- Daily and Weekly Operations Tables
-- Extends the Rockefeller Operating System with detailed daily/weekly tracking

-- Daily Sequences (Morning and Evening)
CREATE TABLE IF NOT EXISTS daily_sequences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sequence_type TEXT NOT NULL CHECK (sequence_type IN ('morning', 'evening')),

  -- Morning sequence fields
  metrics_checked BOOLEAN DEFAULT false,
  competitive_intel_noted BOOLEAN DEFAULT false,
  priority_identified BOOLEAN DEFAULT false,
  priority_text TEXT,
  priority_quarterly_connection TEXT,
  priority_consequence TEXT,

  -- Evening sequence fields
  priority_completed BOOLEAN DEFAULT false,
  priority_miss_reason TEXT,
  todays_win TEXT,
  todays_lesson TEXT,
  efficiency_improvement_spotted TEXT,
  tomorrows_priority TEXT,

  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, date, sequence_type)
);

-- Weekly Plans (Monday Planning + Friday Review)
CREATE TABLE IF NOT EXISTS weekly_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_of DATE NOT NULL, -- Monday of the week

  -- Monday planning fields
  last_week_review JSONB, -- {signups, activation, mrr, status}
  efficiency_focus TEXT,
  data_focus TEXT,
  competitive_focus TEXT,
  week_priority TEXT NOT NULL,
  success_looks_like TEXT,
  quarterly_connection TEXT,
  consequence_if_missed TEXT,
  time_allocation JSONB, -- {easyflow_hours, priority_hours, marketing_hours, etc.}

  -- Friday review fields
  priority_status TEXT CHECK (priority_status IN ('hit', 'partial', 'miss')),
  priority_miss_root_cause TEXT,
  metrics_results JSONB, -- {signups, activation, mrr, active_users}
  wins JSONB, -- Array of wins
  challenges_solutions JSONB, -- Array of challenges with solutions
  key_learning TEXT,
  feedback_summary JSONB, -- {count, sentiment, top_request, top_complaint}
  next_week_preview TEXT,

  review_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, week_of)
);

-- Innovation Experiments (Weekly Innovation Hour)
CREATE TABLE IF NOT EXISTS innovation_experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experiment_name TEXT NOT NULL,
  hypothesis TEXT,
  approach_tested TEXT,
  time_invested INTEGER DEFAULT 0, -- minutes
  financial_investment DECIMAL(10,2) DEFAULT 0,

  -- Results
  result_outcome TEXT,
  result_data JSONB,
  result_learning TEXT,

  -- Decision
  decision TEXT CHECK (decision IN ('implement', 'iterate', 'shelve', 'abandon')),
  decision_reasoning TEXT,
  next_experiment TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Build vs Buy Decisions
CREATE TABLE IF NOT EXISTS build_vs_buy_decisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability_needed TEXT NOT NULL,

  -- Build option
  build_time_hours INTEGER,
  build_cost DECIMAL(10,2),
  build_competitive_advantage TEXT CHECK (build_competitive_advantage IN ('high', 'medium', 'low')),
  build_longterm_control TEXT CHECK (build_longterm_control IN ('high', 'medium', 'low')),

  -- Buy option
  buy_upfront_cost DECIMAL(10,2),
  buy_ongoing_cost DECIMAL(10,2),
  buy_dependency_risk TEXT CHECK (buy_dependency_risk IN ('high', 'medium', 'low')),
  buy_integration_complexity TEXT CHECK (buy_integration_complexity IN ('high', 'medium', 'low')),

  -- Strategic questions
  creates_moat BOOLEAN,
  vendor_price_risk BOOLEAN,
  competitors_also_buy BOOLEAN,
  could_do_10x_better BOOLEAN,

  -- Decision
  decision TEXT NOT NULL CHECK (decision IN ('build', 'buy')),
  reasoning TEXT NOT NULL,
  rockefeller_would TEXT, -- What would Rockefeller choose?

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Negotiation Prep (Principle #4)
CREATE TABLE IF NOT EXISTS sales_negotiations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prospect_name TEXT NOT NULL,
  prospect_company TEXT,
  call_date DATE,

  -- Pre-call research
  current_workflows TEXT,
  current_tools TEXT,
  pain_level INTEGER CHECK (pain_level >= 1 AND pain_level <= 10),
  decision_makers TEXT,
  budget_indicators TEXT,

  -- Rockefeller approach
  information_asymmetry TEXT, -- What you know that they don't
  competitive_pressure TEXT,
  cost_of_inaction JSONB, -- {time_waste_hours, monthly_cost, manual_errors}

  -- Offer structure
  standard_price DECIMAL(10,2),
  discount_percent INTEGER,
  discount_justification TEXT,
  offer_expiration DATE,
  sweetener TEXT,

  -- Objection handling
  expected_objection TEXT,
  objection_response TEXT,
  closing_question TEXT,

  -- Outcome (filled after call)
  call_completed BOOLEAN DEFAULT false,
  outcome TEXT CHECK (outcome IN ('closed', 'follow_up', 'lost', 'pending')),
  actual_objections TEXT,
  what_worked TEXT,
  what_needs_work TEXT,
  next_steps TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monthly Deep Dives
CREATE TABLE IF NOT EXISTS monthly_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: "2025-12"

  -- Comprehensive metrics
  revenue_metrics JSONB, -- {mrr_start, mrr_end, paying_customers, arpu}
  user_metrics JSONB, -- {total_signups, activation_rate, mau, dau_mau_ratio}
  conversion_funnel JSONB, -- {landing_signup, signup_activation, etc.}
  engagement_metrics JSONB, -- {reddit, linkedin, twitter, top_channel}

  -- Competitive intel analysis
  competitive_movements JSONB, -- {zapier, make, n8n, ifttt}
  competitive_advantages JSONB, -- Array of 3 advantages

  -- Vertical integration
  dependency_audit JSONB, -- {vercel, stripe, apis, other}
  dependency_risks TEXT,
  integration_opportunities JSONB,
  prioritized_action TEXT,

  -- Efficiency audit
  time_waste_analysis JSONB,
  product_friction_points JSONB,
  improvements_this_month JSONB,
  next_month_efficiency_target TEXT,

  -- Customer feedback deep dive
  feedback_summary JSONB, -- {total, sentiment, top_5_requests, top_5_complaints, nps}
  product_changes_planned JSONB,

  -- Next month plan
  next_month_priority TEXT,
  next_month_metrics JSONB,
  next_month_initiatives JSONB,
  next_month_resources JSONB,
  next_month_risks TEXT,

  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, month_year)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_sequences_user_date ON daily_sequences(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_user_week ON weekly_plans(user_id, week_of DESC);
CREATE INDEX IF NOT EXISTS idx_innovation_experiments_user ON innovation_experiments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_build_vs_buy_user ON build_vs_buy_decisions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_negotiations_user ON sales_negotiations(user_id, call_date DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_reviews_user ON monthly_reviews(user_id, month_year DESC);

-- Row Level Security
ALTER TABLE daily_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_sequences_policy ON daily_sequences
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY weekly_plans_policy ON weekly_plans
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE innovation_experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY innovation_experiments_policy ON innovation_experiments
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE build_vs_buy_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY build_vs_buy_policy ON build_vs_buy_decisions
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE sales_negotiations ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_negotiations_policy ON sales_negotiations
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE monthly_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY monthly_reviews_policy ON monthly_reviews
  FOR ALL USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE daily_sequences IS 'Daily morning and evening sequences - 10min morning + 5min evening ritual';
COMMENT ON TABLE weekly_plans IS 'Monday planning and Friday review - 30min each';
COMMENT ON TABLE innovation_experiments IS 'Weekly innovation hour experiments - Friday 3-4pm';
COMMENT ON TABLE build_vs_buy_decisions IS 'Strategic vertical integration decisions - Principle #2';
COMMENT ON TABLE sales_negotiations IS 'Sales negotiation prep and outcomes - Principle #4';
COMMENT ON TABLE monthly_reviews IS 'First Monday monthly deep dives - 2 hour comprehensive review';
