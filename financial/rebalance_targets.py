"""Effective rebalance targets: goal defaults, glide path, or user custom settings."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from financial.glide_path import get_target_allocation
from financial.rebalancing_math import calculate_current_allocation, check_threshold_rebalancing


def _years_to_retirement(profile: dict) -> float | None:
    age = profile.get("age")
    ret = profile.get("retirement_age_target")
    if age is None or ret is None:
        return None
    try:
        return max(float(ret) - float(age), 0.0)
    except (TypeError, ValueError):
        return None


def _years_to_goal(goal: dict) -> float:
    td = goal.get("target_date")
    if not td:
        return 10.0
    try:
        end = datetime.strptime(str(td)[:10], "%Y-%m-%d").date()
        return max((end - date.today()).days / 365.25, 0.0)
    except Exception:
        return 10.0


def fetch_rebalance_settings_row(db, user_id: str) -> dict[str, Any] | None:
    try:
        r = (
            db.table("rebalance_settings")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception:
        return None
    rows = r.data or []
    return rows[0] if rows else None


def custom_targets_from_row(row: dict[str, Any]) -> dict[str, float]:
    """Percent columns (0–100) → allocation fractions for drift math."""
    return {
        "us_stocks": float(row["target_us_stocks"]) / 100.0,
        "intl_stocks": float(row["target_intl_stocks"]) / 100.0,
        "bonds": float(row["target_bonds"]) / 100.0,
        "cash": float(row["target_cash"]) / 100.0,
        "other": float(row.get("target_alternatives") or 0) / 100.0,
    }


def compute_effective_target_and_threshold(
    user_id: str,
    goal: dict,
    profile: dict,
    db,
    settings_row: dict[str, Any] | None = None,
) -> tuple[dict[str, float], float, dict[str, Any]]:
    """Return (target_allocation fractions, threshold 0–1, settings_row or {}).

    If ``settings_row`` is provided, it is used instead of loading from the DB
    (for preview requests).
    """
    row = settings_row if settings_row is not None else fetch_rebalance_settings_row(db, user_id)
    threshold = float(goal.get("rebalancing_threshold", 0.05))
    if row:
        threshold = float(row.get("drift_threshold_pct", 5)) / 100.0

    use_glide = True
    if row and row.get("use_glide_path") is False:
        use_glide = False

    if not use_glide and row:
        target = custom_targets_from_row(row)
        return target, threshold, row

    y_ret = _years_to_retirement(profile)
    years = y_ret if y_ret is not None else _years_to_goal(goal)
    goal_type = goal.get("goal_type") or "other"
    target = goal.get("target_allocation") or get_target_allocation(goal_type, years)
    return target, threshold, row or {}


def check_goal_drift_bundle(
    user_id: str, goal: dict, holdings: list[dict], profile: dict, db
) -> dict[str, Any]:
    """Used by RebalancingAgent — same drift logic as API summary."""
    target, threshold, _ = compute_effective_target_and_threshold(
        user_id, goal, profile, db
    )
    current = calculate_current_allocation(holdings)
    result = check_threshold_rebalancing(current, target, threshold)
    return {
        "current_allocation": current,
        "target_allocation": target,
        "drift": result["drift"],
        "needs_rebalancing": result["needs_rebalancing"],
        "threshold": threshold,
    }
