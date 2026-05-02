"""Keep money-market / cash sleeve rows in sync when users buy or sell equities.

Dashboard \"Available Cash\" sums holdings with asset_class == \"cash\". The
trade endpoint used to only mutate the traded ticker, so cash never moved.
"""

from __future__ import annotations

from typing import Any

DEFAULT_CASH_TICKER = "VMFXX"
DEFAULT_CASH_NAME = "Vanguard Federal Money Market Investor"


def _cash_holdings(db, user_id: str) -> list[dict[str, Any]]:
    r = (
        db.table("holdings")
        .select("*")
        .eq("user_id", user_id)
        .eq("asset_class", "cash")
        .execute()
    )
    return r.data or []


def _pick_primary_cash(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not rows:
        return None
    return max(rows, key=lambda h: float(h.get("current_value") or 0))


def _cash_unit_price(h: dict[str, Any]) -> float:
    """Shares * unit_price ~= current_value for money-market style rows."""
    sh = float(h.get("shares") or 0)
    cv = float(h.get("current_value") or 0)
    if sh > 1e-9 and cv > 0:
        return cv / sh
    cp = float(h.get("current_price") or 0)
    if cp > 0:
        return cp
    acb = float(h.get("avg_cost_basis") or 0)
    if acb > 0:
        return acb
    return 1.0


def apply_cash_ledger_for_equity_trade(
    db,
    user_id: str,
    *,
    traded_asset_class: str | None,
    notional: float,
    is_buy: bool,
    goal_id: str | None,
    now_iso: str,
) -> None:
    """Debit cash on stock buys, credit on stock sells.

    ``notional`` is dollars (shares * price), rounded the same way as /trade.
    Skips when the traded line is itself a cash sleeve.
    """
    ac = (traded_asset_class or "").strip().lower()
    if ac == "cash":
        return

    delta = -notional if is_buy else notional
    rows = _cash_holdings(db, user_id)
    primary = _pick_primary_cash(rows)

    if primary is None:
        if delta >= 0:
            # Sale with no cash row — create a default money-market sleeve.
            ins = {
                "user_id": user_id,
                "goal_id": goal_id,
                "ticker": DEFAULT_CASH_TICKER,
                "name": DEFAULT_CASH_NAME,
                "asset_class": "cash",
                "shares": round(delta, 6),
                "avg_cost_basis": 1.0,
                "current_price": 1.0,
                "current_value": round(delta, 2),
                "last_updated": now_iso,
            }
            try:
                db.table("holdings").insert(ins).execute()
            except Exception:
                for k in ("is_mutual_fund", "expense_ratio", "nav_date"):
                    ins.pop(k, None)
                db.table("holdings").insert(ins).execute()
            return
        raise ValueError(
            "Add a cash or money-market holding (e.g. VMFXX) first — "
            "there is no cash sleeve to pay for this buy."
        )

    px = _cash_unit_price(primary)
    cv = float(primary.get("current_value") or 0)
    new_cv = round(cv + delta, 2)
    if new_cv < -0.01:
        raise ValueError(
            f"Not enough cash: need {notional:,.2f} but only about {cv:,.2f} "
            "is in your cash holdings."
        )
    new_cv = max(0.0, new_cv)
    new_shares = round(new_cv / px, 6) if px > 0 else 0.0

    upd = {
        "shares": new_shares,
        "current_price": round(px, 4),
        "current_value": round(new_cv, 2),
        "last_updated": now_iso,
    }
    if new_cv <= 0.01 and new_shares <= 1e-6:
        db.table("holdings").delete().eq("id", primary["id"]).eq("user_id", user_id).execute()
    else:
        db.table("holdings").update(upd).eq("id", primary["id"]).eq("user_id", user_id).execute()
