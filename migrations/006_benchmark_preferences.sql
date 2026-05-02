-- Dashboard chart: saved benchmark tickers + default period (Supabase SQL).

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS active_benchmarks TEXT[]
  DEFAULT ARRAY['SPY']::TEXT[];
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS default_chart_period TEXT
  DEFAULT '1Y';

COMMENT ON COLUMN user_profiles.active_benchmarks IS 'Up to 5 ETF/index tickers to overlay on portfolio chart';
COMMENT ON COLUMN user_profiles.default_chart_period IS '1M|3M|6M|YTD|1Y|ALL';
