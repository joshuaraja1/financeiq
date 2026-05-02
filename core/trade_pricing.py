"""Single source of truth for execution marks on trades and sync safety."""

from __future__ import annotations

from typing import Any, Mapping


def _positive(x: object) -> float | None:
    try:
        v = float(x)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return v if v > 0 else None


def resolve_trade_price(
    *,
    client_price: float | None,
    quote_price: float | None,
    holding: Mapping[str, Any] | None,
) -> float:
    """Best per-share mark for a trade or display.

    Priority:
    1. Client-confirmed price (what the user saw when they tapped Buy/Sell).
    2. Fresh quote (e.g. Yahoo).
    3. Last stored mark on the row.
    4. Book cost basis.
    5. Implied mark from current_value / shares.

    Returns 0.0 only when nothing usable exists (caller should 400 or skip sync).
    """
    p = _positive(client_price)
    if p is not None:
        return p
    p = _positive(quote_price)
    if p is not None:
        return p
    if holding:
        p = _positive(holding.get("current_price"))
        if p is not None:
            return p
        p = _positive(holding.get("avg_cost_basis"))
        if p is not None:
            return p
        sh = float(holding.get("shares") or 0)
        cv = float(holding.get("current_value") or 0)
        if sh > 0 and cv > 0:
            p = _positive(cv / sh)
            if p is not None:
                return p
    return 0.0
