#!/usr/bin/env bash
# Apply Postgres migrations in order (Supabase SQL editor or local psql).
# Usage:
#   export DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"
#   ./scripts/apply_migrations.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v psql >/dev/null 2>&1; then
  echo "Install psql (PostgreSQL client), then set DATABASE_URL and re-run."
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Set DATABASE_URL to your Supabase Postgres connection string, then re-run."
  echo "Supabase: Project Settings → Database → Connection string (URI)."
  exit 1
fi

for f in \
  migrations/001_chat_conversations.sql \
  migrations/002_mutual_fund_support.sql \
  migrations/003_rebalancing_remind_instructions.sql \
  migrations/004_goal_types_extended.sql \
  migrations/004_scenario_transparency_health.sql \
  migrations/005_financial_profile_and_rebalance_settings.sql \
  migrations/006_benchmark_preferences.sql
do
  echo "==> $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "Done."
