'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Holding } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { TickerLogo } from '@/components/ticker-logo';

interface Props {
  holdings: Holding[];
  className?: string;
}

export function MarketPulseCard({ holdings, className = '' }: Props) {
  const sorted = [...holdings]
    .filter((h) => h.asset_class !== 'cash' && Number(h.current_value ?? 0) > 0)
    .sort((a, b) => Number(b.current_value ?? 0) - Number(a.current_value ?? 0))
    .slice(0, 6);

  const gainers = sorted.filter((h) => {
    const cv = Number(h.current_value ?? 0);
    const cost = Number(h.shares ?? 0) * Number(h.avg_cost_basis ?? 0);
    return cv > cost;
  });

  const losers = sorted.filter((h) => {
    const cv = Number(h.current_value ?? 0);
    const cost = Number(h.shares ?? 0) * Number(h.avg_cost_basis ?? 0);
    return cv < cost;
  });

  if (!sorted.length) {
    return (
      <div className={`bg-white border border-gray-100 rounded-2xl p-5 shadow-sm ${className}`}>
        <p className="text-sm font-semibold text-gray-700 mb-2">Market pulse</p>
        <p className="text-xs text-gray-400">Add holdings and sync prices to see movers.</p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-100 rounded-2xl p-5 shadow-sm ${className}`}>
      <p className="text-sm font-semibold text-gray-700 mb-4">Market pulse</p>

      <div className="space-y-2.5">
        {sorted.map((h) => {
          const cv = Number(h.current_value ?? 0);
          const cost = Number(h.shares ?? 0) * Number(h.avg_cost_basis ?? 0);
          const gain = cv - cost;
          const pct = cost > 0 ? (gain / cost) * 100 : 0;
          const isUp = gain > 0;
          const isFlat = Math.abs(gain) < 0.01;

          return (
            <div key={h.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <TickerLogo
                  ticker={h.ticker}
                  size="xs"
                  rounded="lg"
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{h.ticker}</p>
                  <p className="text-[10px] text-gray-400 truncate">{h.name ?? ''}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-xs font-semibold tabular-nums text-gray-900">{fmtMoney(cv)}</p>
                <div className={`flex items-center justify-end gap-0.5 text-[10px] font-medium ${
                  isFlat ? 'text-gray-400' : isUp ? 'text-emerald-600' : 'text-rose-500'
                }`}>
                  {isFlat ? (
                    <Minus className="w-2.5 h-2.5" />
                  ) : isUp ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5" />
                  )}
                  <span>{isFlat ? '—' : `${isUp ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-50 flex gap-4 text-[11px]">
        <span className="text-emerald-600 font-medium">{gainers.length} up</span>
        <span className="text-rose-500 font-medium">{losers.length} down</span>
        <span className="text-gray-400">{sorted.length - gainers.length - losers.length} flat</span>
      </div>
    </div>
  );
}
