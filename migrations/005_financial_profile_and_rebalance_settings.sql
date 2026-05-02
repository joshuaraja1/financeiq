-- Financial profile fields on user_profiles + custom rebalance settings.
-- Run in Supabase SQL editor (or your migration runner).

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS gross_annual_income NUMERIC(12,2);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS net_monthly_income NUMERIC(12,2);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS monthly_expenses NUMERIC(12,2);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS dependents INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS employment_status TEXT
  CHECK (employment_status IS NULL OR employment_status IN ('employed', 'self_employed', 'retired', 'unemployed', 'student'));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS marital_status TEXT
  CHECK (marital_status IS NULL OR marital_status IN ('single', 'married', 'partnered', 'divorced', 'widowed'));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS retirement_age_target INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS retirement_income_needed_annual NUMERIC(12,2);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS emergency_fund_months NUMERIC(4,1);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_debt NUMERIC(12,2) DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS monthly_debt_payment NUMERIC(12,2) DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS monthly_savings_target NUMERIC(12,2);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS housing_status TEXT
  CHECK (housing_status IS NULL OR housing_status IN ('own_outright', 'mortgage', 'rent', 'other'));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS investment_experience TEXT
  CHECK (investment_experience IS NULL OR investment_experience IN ('beginner', 'intermediate', 'advanced'));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_last_updated TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS savings_rate_pct NUMERIC(5,2);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS debt_to_income_ratio NUMERIC(5,2);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS years_to_retirement INTEGER;

CREATE INDEX IF NOT EXISTS idx_user_profiles_completed ON user_profiles(profile_completed_at);

CREATE TABLE IF NOT EXISTS rebalance_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy TEXT NOT NULL DEFAULT 'threshold'
    CHECK (strategy IN ('threshold', 'calendar', 'hybrid', 'cashflow')),
  drift_threshold_pct NUMERIC(4,2) NOT NULL DEFAULT 5.0
    CHECK (drift_threshold_pct >= 1 AND drift_threshold_pct <= 20),
  calendar_frequency TEXT
    CHECK (calendar_frequency IS NULL OR calendar_frequency IN ('quarterly', 'semiannually', 'annually')),
  target_us_stocks NUMERIC(5,2) NOT NULL DEFAULT 60.0,
  target_intl_stocks NUMERIC(5,2) NOT NULL DEFAULT 15.0,
  target_bonds NUMERIC(5,2) NOT NULL DEFAULT 20.0,
  target_cash NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  target_alternatives NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  use_glide_path BOOLEAN NOT NULL DEFAULT TRUE,
  prefer_tax_loss_harvest BOOLEAN NOT NULL DEFAULT TRUE,
  avoid_short_term_gains BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_drift BOOLEAN NOT NULL DEFAULT TRUE,
  notify_via_email BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rebalance_settings_alloc_sum CHECK (
    target_us_stocks + target_intl_stocks + target_bonds + target_cash + target_alternatives
    BETWEEN 99.5 AND 100.5
  )
);

ALTER TABLE rebalance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own rebalance_settings" ON rebalance_settings;
CREATE POLICY "Users manage own rebalance_settings"
  ON rebalance_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_rebalance_settings_strategy ON rebalance_settings(strategy);
