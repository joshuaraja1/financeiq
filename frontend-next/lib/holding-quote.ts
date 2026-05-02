import type { Holding } from '@/lib/api';

/** Dispatched after a successful trade so Investment live UI can focus that ticker. */
export const LIVE_FOCUS_TICKER_EVENT = 'financeiq:live-focus-ticker';

/** Coerce API / PostgREST numeric fields (number | string | null) to a finite number. */
export function toMoneyNumber(x: unknown): number {
  if (x == null || x === '') return 0;
  if (typeof x === 'number') return Number.isFinite(x) ? x : 0;
  if (typeof x === 'string') {
    const t = x.trim().replace(/,/g, '');
    if (!t) return 0;
    const v = parseFloat(t);
    return Number.isFinite(v) ? v : 0;
  }
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Best-effort mark for charts / strips when `current_price` is stale or zero
 * but the row still has value or cost (common right after a trade if a
 * downstream sync lags).
 */
export function effectiveHoldingPrice(h: Holding): number {
  const cp = toMoneyNumber(h.current_price);
  if (cp > 0) return cp;
  const sh = toMoneyNumber(h.shares);
  if (sh > 0) {
    const v = toMoneyNumber(h.current_value);
    if (v > 0) {
      const implied = v / sh;
      if (implied > 0) return implied;
    }
  }
  const b = toMoneyNumber(h.avg_cost_basis);
  return b > 0 ? b : 0;
}

export function effectiveHoldingValue(h: Holding): number {
  const sh = toMoneyNumber(h.shares);
  const px = effectiveHoldingPrice(h);
  if (sh > 0 && px > 0) return sh * px;
  return toMoneyNumber(h.current_value);
}
