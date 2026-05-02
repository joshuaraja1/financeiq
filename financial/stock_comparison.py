"""Stock comparison and buy-context tools — numbers from yfinance only."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

import numpy as np
import yfinance as yf

from data.curated_tickers import lookup_by_ticker


def _safe_float(x: Any) -> float | None:
    try:
        if x is None:
            return None
        v = float(x)
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    except (TypeError, ValueError):
        return None


def compare_stocks_sync(tickers: list[str], lookback_days: int = 365) -> dict[str, Any]:
    """Compare 2–5 tickers; returns structured facts for the LLM."""
    clean = [t.strip().upper() for t in tickers if t and str(t).strip()]
    if len(clean) < 2 or len(clean) > 5:
        return {"error": "Compare between 2 and 5 tickers"}

    results: dict[str, Any] = {}
    for ticker in clean:
        try:
            stock = yf.Ticker(ticker)
            info = stock.info or {}
            hist = stock.history(period=f"{max(30, lookback_days)}d")
            if hist is None or hist.empty:
                results[ticker] = {"error": f"No price history for {ticker}"}
                continue

            closes = hist["Close"].astype(float)
            current_price = float(closes.iloc[-1])
            start_price = float(closes.iloc[0])
            total_return = (
                ((current_price - start_price) / start_price) * 100 if start_price else 0.0
            )

            daily_returns = closes.pct_change().dropna()
            vol = float(daily_returns.std() * np.sqrt(252) * 100) if len(daily_returns) > 1 else 0.0

            cumulative = (1 + daily_returns).cumprod()
            running_max = cumulative.cummax()
            drawdown = float(((cumulative - running_max) / running_max).min() * 100)

            results[ticker] = {
                "name": info.get("longName") or info.get("shortName") or ticker,
                "sector": info.get("sector") or "Unknown",
                "industry": info.get("industry") or "Unknown",
                "current_price": round(current_price, 2),
                "market_cap": info.get("marketCap"),
                "pe_ratio": _safe_float(info.get("trailingPE")),
                "forward_pe": _safe_float(info.get("forwardPE")),
                "pb_ratio": _safe_float(info.get("priceToBook")),
                "dividend_yield": _safe_float(info.get("dividendYield")),
                "beta": _safe_float(info.get("beta")),
                "52w_high": _safe_float(info.get("fiftyTwoWeekHigh")),
                "52w_low": _safe_float(info.get("fiftyTwoWeekLow")),
                "return_pct": round(total_return, 2),
                "volatility_pct": round(vol, 2),
                "max_drawdown_pct": round(drawdown, 2),
                "lookback_days": lookback_days,
                "analyst_rating": info.get("recommendationKey"),
                "analyst_target": _safe_float(info.get("targetMeanPrice")),
                "earnings_growth": _safe_float(
                    info.get("earningsGrowth") or info.get("earningsQuarterlyGrowth")
                ),
                "revenue_growth": _safe_float(info.get("revenueGrowth")),
                "profit_margin": _safe_float(info.get("profitMargins")),
            }
        except Exception as e:
            results[ticker] = {"error": str(e)[:200]}

    return {
        "comparison": results,
        "lookback_days": lookback_days,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _sector_weights_from_holdings(holdings: list[dict]) -> dict[str, float]:
    total = sum(float(h.get("current_value") or 0) for h in holdings)
    if total <= 0:
        return {}
    by: dict[str, float] = {}
    for h in holdings:
        t = (h.get("ticker") or "").upper().strip()
        row = lookup_by_ticker(t) if t else None
        sector = (row[4] if row and len(row) > 4 else None) or "Unknown"
        v = float(h.get("current_value") or 0)
        by[sector] = by.get(sector, 0.0) + v / total
    return by


def get_buy_signals_sync(
    ticker: str,
    *,
    holdings: list[dict],
    risk_tolerance: str,
    total_value: float,
) -> dict[str, Any]:
    """Structured buy-context for one ticker; LLM synthesizes advice."""
    sym = (ticker or "").upper().strip()
    if not sym:
        return {"error": "Missing ticker"}

    owned = {((h.get("ticker") or "").upper().strip()) for h in holdings}
    sector_weights = _sector_weights_from_holdings(holdings)

    try:
        stock = yf.Ticker(sym)
        info = stock.info or {}
        hist = stock.history(period="365d")
        if hist is None or hist.empty:
            return {"error": f"No data for {sym}"}
        current_price = float(hist["Close"].iloc[-1])
    except Exception as e:
        return {"error": f"Couldn't fetch live data right now — try again in a moment. ({e})"}

    sector = info.get("sector") or "Unknown"
    current_sector_pct = float(sector_weights.get(sector, 0.0) * 100)
    beta = _safe_float(info.get("beta")) or 1.0
    rt = (risk_tolerance or "moderate").lower()
    ceilings = {"conservative": 0.8, "moderate": 1.2, "aggressive": 2.0}
    ceiling = ceilings.get(rt, 1.2)
    pe = _safe_float(info.get("trailingPE"))
    industry_avg_pe = 22.0

    target_mean = _safe_float(info.get("targetMeanPrice"))
    upside = None
    if target_mean and current_price > 0:
        upside = round((target_mean - current_price) / current_price * 100, 2)

    return {
        "ticker": sym,
        "name": info.get("longName") or sym,
        "current_price": round(current_price, 2),
        "sector": sector,
        "industry": info.get("industry"),
        "valuation": {
            "pe_ratio": pe,
            "industry_avg_pe": industry_avg_pe,
            "is_overvalued_vs_industry": bool(pe and pe > industry_avg_pe * 1.3),
            "forward_pe": _safe_float(info.get("forwardPE")),
            "analyst_target_price": target_mean,
            "upside_to_target_pct": upside,
        },
        "user_fit": {
            "current_sector_allocation_pct": round(current_sector_pct, 2),
            "would_increase_sector_concentration": current_sector_pct > 25,
            "beta": beta,
            "fits_risk_tolerance": beta <= ceiling,
            "user_risk_tolerance": rt,
            "already_owns": sym in owned,
        },
        "fundamentals": {
            "earnings_growth": _safe_float(
                info.get("earningsGrowth") or info.get("earningsQuarterlyGrowth")
            ),
            "revenue_growth": _safe_float(info.get("revenueGrowth")),
            "profit_margin": _safe_float(info.get("profitMargins")),
            "debt_to_equity": _safe_float(info.get("debtToEquity")),
            "free_cashflow": info.get("freeCashflow"),
        },
        "analyst_consensus": {
            "rating": info.get("recommendationKey"),
            "num_analysts": info.get("numberOfAnalystOpinions"),
            "mean_target": target_mean,
            "high_target": _safe_float(info.get("targetHighPrice")),
            "low_target": _safe_float(info.get("targetLowPrice")),
        },
    }


SECTOR_ALTERNATIVES: dict[str, list[str]] = {
    "Technology": ["MSFT", "GOOGL", "AAPL", "META", "ORCL", "ADBE", "CRM"],
    "Healthcare": ["UNH", "JNJ", "LLY", "PFE", "ABBV", "TMO", "ABT"],
    "Financial Services": ["JPM", "V", "MA", "BAC", "WFC", "GS", "BLK"],
    "Consumer Cyclical": ["AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "TGT"],
    "Communication Services": ["GOOGL", "META", "DIS", "VZ", "T", "NFLX", "CMCSA"],
    "Industrials": ["GE", "CAT", "BA", "HON", "UPS", "RTX", "DE"],
    "Energy": ["XOM", "CVX", "COP", "SLB", "EOG", "PSX", "MPC"],
    "Consumer Defensive": ["WMT", "PG", "KO", "PEP", "COST", "PM", "MO"],
    "Real Estate": ["AMT", "PLD", "CCI", "EQIX", "PSA", "O", "WELL"],
    "Utilities": ["NEE", "SO", "DUK", "AEP", "SRE", "D", "EXC"],
    "Basic Materials": ["LIN", "SHW", "APD", "ECL", "FCX", "NEM", "DOW"],
}

ETF_ALTERNATIVES: dict[str, list[str]] = {
    "Technology": ["VGT", "XLK", "QQQ"],
    "Healthcare": ["VHT", "XLV", "IHF"],
    "Financial Services": ["VFH", "XLF", "KBE"],
    "default": ["VTI", "VOO", "SCHB"],
}


def find_alternatives_sync(
    ticker: str,
    *,
    owned_tickers: set[str],
    max_results: int = 3,
) -> dict[str, Any]:
    sym = (ticker or "").upper().strip()
    if not sym:
        return {"error": "Missing ticker"}
    try:
        info = (yf.Ticker(sym).info) or {}
    except Exception:
        return {"error": "Couldn't fetch live data right now — try again in a moment."}

    sector = info.get("sector") or "Unknown"
    candidates = [c for c in SECTOR_ALTERNATIVES.get(sector, []) if c != sym][
        : max_results + 2
    ]
    etf_options = ETF_ALTERNATIVES.get(sector, ETF_ALTERNATIVES["default"])

    alternatives: list[dict[str, Any]] = []
    for alt_ticker in candidates[:max_results]:
        try:
            alt_stock = yf.Ticker(alt_ticker)
            alt_info = alt_stock.info or {}
            alt_hist = alt_stock.history(period="365d")
            if alt_hist is None or alt_hist.empty:
                continue
            alt_return = (
                (float(alt_hist["Close"].iloc[-1]) - float(alt_hist["Close"].iloc[0]))
                / float(alt_hist["Close"].iloc[0])
                * 100
            )
            alternatives.append(
                {
                    "ticker": alt_ticker,
                    "name": alt_info.get("longName"),
                    "current_price": float(alt_hist["Close"].iloc[-1]),
                    "pe_ratio": _safe_float(alt_info.get("trailingPE")),
                    "beta": _safe_float(alt_info.get("beta")),
                    "1y_return_pct": round(alt_return, 2),
                    "analyst_rating": alt_info.get("recommendationKey"),
                    "analyst_target": _safe_float(alt_info.get("targetMeanPrice")),
                    "user_already_owns": alt_ticker in owned_tickers,
                }
            )
        except Exception:
            continue

    return {
        "for_ticker": sym,
        "sector": sector,
        "stock_alternatives": alternatives,
        "etf_alternatives": etf_options,
        "diversification_note": (
            "ETFs spread risk across many names in a sector — often steadier than one stock."
        ),
    }


def assess_position_size_sync(
    proposed_dollar_amount: float,
    *,
    total_value: float,
    risk_tolerance: str,
) -> dict[str, Any]:
    if total_value <= 0:
        return {"error": "Portfolio value unknown"}
    proposed_pct = (proposed_dollar_amount / total_value) * 100
    single_position_ceiling = {"conservative": 5.0, "moderate": 10.0, "aggressive": 20.0}
    risk = (risk_tolerance or "moderate").lower()
    ceiling = single_position_ceiling.get(risk, 10.0)
    return {
        "proposed_amount": round(proposed_dollar_amount, 2),
        "proposed_pct_of_portfolio": round(proposed_pct, 2),
        "single_position_ceiling_pct": ceiling,
        "exceeds_ceiling": proposed_pct > ceiling,
        "recommended_max_amount": round(total_value * ceiling / 100, 2),
        "user_risk_tolerance": risk,
        "rationale": (
            f"For {risk} investors we suggest keeping any single name near or below "
            f"{ceiling:.0f}% of the portfolio to limit concentration risk."
        ),
    }
