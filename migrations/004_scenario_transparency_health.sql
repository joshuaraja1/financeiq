-- What-if scenario recommendations + transparency + health (idempotent)

ALTER TABLE rebalancing_recommendations
  DROP CONSTRAINT IF EXISTS rebalancing_recommendations_trigger_type_check;

ALTER TABLE rebalancing_recommendations
  ADD CONSTRAINT rebalancing_recommendations_trigger_type_check
  CHECK (trigger_type IN (
    'drift',
    'news_event',
    'goal_timeline',
    'scheduled',
    'scenario'
  ));

ALTER TABLE rebalancing_recommendations
  ADD COLUMN IF NOT EXISTS transparency_data JSONB;
