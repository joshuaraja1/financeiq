'use client';

import { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MarketChart } from '@/components/market-chart';
import { TradeDialog } from '@/components/trade-dialog';
import { TickerLogo } from '@/components/ticker-logo';
import type { Holding, PortfolioSnapshot } from '@/lib/api';
import {
  fmtMoney,
  fmtPct,
  assetLabel,
  assetColor,
  tickerColor,
} from '@/lib/format';
import { isMutualFund } from '@/lib/funds';

type Props = {
  holding: Holding | null;
  totalPortfolioValue: number;
  history: PortfolioSnapshot[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional override so the modal matches the color used in the dashboard. */
  color?: string;
  /** Refresh portfolio after a successful trade. */
  onTraded?: () => void | Promise<void>;
};

/** Reconstruct a synthetic price history for the holding by allocating the
 * portfolio_snapshots in proportion to its current weight. We don't persist
 * per-ticker history yet, so this gives a reasonable shape and exact endpoints. */
function buildSeries(
  holding: Holding,
  totalPortfolioValue: number,
  snapshots: PortfolioSnapshot[],
): Array<{ date: string; value: number }> {
  if (!snapshots.length) return [];
  const weight =
    totalPortfolioValue > 0
      ? Number(holding.current_value ?? 0) / totalPortfolioValue
      : 0;
  if (weight === 0) return [];

  const sorted = [...snapshots].sort((a, b) =>
    a.snapshot_date.localeCompare(b.snapshot_date),
  );
  return sorted.map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    value: Number(s.total_value) * weight,
  }));
}

export function StockDetailDialog({
  holding,
  totalPortfolioValue,
  history,
  open,
  onOpenChange,
  color: colorOverride,
  onTraded,
}: Props) {
  const [tradeOpen, setTradeOpen] = useState(false);

  const data = useMemo(
    () => (holding ? buildSeries(holding, totalPortfolioValue, history) : []),
    [holding, totalPortfolioValue, history],
  );

  if (!holding) return null;

  const cv = Number(holding.current_value ?? 0);
  const cost = Number(holding.shares ?? 0) * Number(holding.avg_cost_basis ?? 0);
  const gain = cv - cost;
  const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
  const weight = totalPortfolioValue > 0 ? (cv / totalPortfolioValue) * 100 : 0;
  const ticker = holding.ticker;
  const color = colorOverride ?? tickerColor(ticker);
  const aClass = holding.asset_class ?? 'other';
  const basePx = Math.max(Number(holding.current_price ?? 0), 0.01);
  const fundLike =
    !!holding.is_mutual_fund || isMutualFund(ticker) || aClass === 'cash';

  // Period change derived from the synthetic series endpoints
  const periodChange =
    data.length >= 2 ? data[data.length - 1].value - data[0].value : 0;
  const periodPct =
    data.length >= 2 && data[0].value
      ? (periodChange / data[0].value) * 100
      : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <TickerLogo ticker={ticker} color={color} size="md" />
                <div className="min-w-0">
                  <DialogTitle className="text-xl">{ticker}</DialogTitle>
                  <p className="text-sm text-gray-500 truncate">
                    {holding.name ?? ticker} ·{' '}
                    <span
                      className="font-medium"
                      style={{ color: assetColor(aClass) }}
                    >
                      {assetLabel(aClass)}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTradeOpen(true)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                Trade
              </button>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] text-gray-500">Price</p>
              <p className="text-base font-semibold tabular-nums mt-0.5">
                {fmtMoney(holding.current_price ?? 0)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] text-gray-500">Shares</p>
              <p className="text-base font-semibold tabular-nums mt-0.5">
                {Number(holding.shares ?? 0).toLocaleString('en-US', {
                  maximumFractionDigits: 4,
                })}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] text-gray-500">Market value</p>
              <p className="text-base font-semibold tabular-nums mt-0.5">
                {fmtMoney(cv)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] text-gray-500">% of portfolio</p>
              <p className="text-base font-semibold tabular-nums mt-0.5">
                {weight.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div
              className={`rounded-xl p-4 ${
                gain >= 0
                  ? 'bg-emerald-50 border border-emerald-100'
                  : 'bg-rose-50 border border-rose-100'
              }`}
            >
              <p className="text-[11px] uppercase tracking-wide text-gray-600">
                Unrealized Gain / Loss
              </p>
              <div
                className={`flex items-center gap-2 mt-0.5 ${gain >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
              >
                {gain >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <p className="text-lg font-bold tabular-nums">
                  {gain >= 0 ? '+' : '−'}
                  {fmtMoney(Math.abs(gain))}
                </p>
                <span className="text-sm tabular-nums opacity-80">
                  ({fmtPct(gainPct, { withSign: true, decimals: 2 })})
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Cost basis {fmtMoney(cost)} ·{' '}
                {fmtMoney(holding.avg_cost_basis ?? 0)} per share
              </p>
            </div>

            <div className="rounded-xl p-4 bg-gray-50 border border-gray-100">
              <p className="text-[11px] uppercase tracking-wide text-gray-600">
                Period change
              </p>
              <div
                className={`flex items-center gap-2 mt-0.5 ${periodChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
              >
                {periodChange >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <p className="text-lg font-bold tabular-nums">
                  {periodChange >= 0 ? '+' : '−'}
                  {fmtMoney(Math.abs(periodChange))}
                </p>
                <span className="text-sm tabular-nums opacity-80">
                  ({fmtPct(periodPct, { withSign: true, decimals: 2 })})
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Estimated from your portfolio history (last{' '}
                {Math.max(data.length, 1)} days)
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[11px] font-medium text-gray-500 mb-2">
              Price chart
            </p>
            <div className="h-[260px] rounded-xl border border-gray-100 overflow-hidden bg-white">
              <MarketChart
                ticker={ticker}
                basePrice={basePx}
                color={color}
                assetClass={aClass}
                height={260}
                mode={fundLike ? 'daily-nav' : 'live'}
              />
            </div>
          </div>

        </DialogContent>
      </Dialog>

      <TradeDialog
        open={tradeOpen}
        onOpenChange={setTradeOpen}
        ticker={ticker}
        name={holding.name ?? ticker}
        apiPrice={Number(holding.current_price ?? 0)}
        assetClass={aClass}
        ownedShares={Number(holding.shares ?? 0)}
        color={color}
        onTraded={async () => {
          await onTraded?.();
          setTradeOpen(false);
        }}
      />
    </>
  );
}
