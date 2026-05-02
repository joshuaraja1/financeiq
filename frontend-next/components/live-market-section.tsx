'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickChart,
  LineChart as LineChartIcon,
  Pause,
  Play,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { Holding } from '@/lib/api';
import {
  fmtMoney,
  fmtPct,
  assetLabel,
  assetColor,
} from '@/lib/format';
import { isMutualFund } from '@/lib/funds';
import { MarketChart } from '@/components/market-chart';
import { TickerLogo } from '@/components/ticker-logo';
import { useLivePrices } from '@/lib/live-prices';
import { useChartMode } from '@/lib/chart-mode';
import { periodStartPriceFor } from '@/lib/market-data';

type LivePeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';

const PERIOD_CONFIG: Record<LivePeriod, { bars: number; barSec: number }> = {
  '1D': { bars: 180, barSec: 60 },
  '1W': { bars: 168, barSec: 600 },
  '1M': { bars: 168, barSec: 3600 },
  '3M': { bars: 90, barSec: 86400 },
  '6M': { bars: 130, barSec: 86400 },
  '1Y': { bars: 252, barSec: 86400 },
};

const PERIOD_KEYS: LivePeriod[] = ['1D', '1W', '1M', '3M', '6M', '1Y'];

type Props = {
  holdings: Holding[];
  colorMap: Record<string, string>;
  onQuickTrade?: (holding: Holding) => void;
};

export function LiveMarketSection({
  holdings,
  colorMap,
  onQuickTrade,
}: Props) {
  const { prices } = useLivePrices();
  const { kind: chartKind, setKind: setChartKind } = useChartMode();
  const [period, setPeriod] = useState<LivePeriod>('1D');
  const [paused, setPaused] = useState(false);

  const sorted = useMemo(
    () =>
      [...holdings]
        .filter((h) => Number(h.current_value ?? 0) > 0)
        .sort(
          (a, b) =>
            Number(b.current_value ?? 0) - Number(a.current_value ?? 0),
        ),
    [holdings],
  );

  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  useEffect(() => {
    if (!sorted.length) return;
    if (
      !selectedTicker ||
      !sorted.some((h) => h.ticker === selectedTicker)
    ) {
      setSelectedTicker(sorted[0].ticker);
    }
  }, [sorted, selectedTicker]);

  const selected = useMemo(
    () => sorted.find((h) => h.ticker === selectedTicker) ?? null,
    [sorted, selectedTicker],
  );

  const anchorRef = useRef<
    Record<string, { period: LivePeriod; price: number }>
  >({});

  const livePrice = selected
    ? Math.max(
        prices[selected.ticker] ?? Number(selected.current_price ?? 0),
        0.01,
      )
    : 0.01;

  const basePrice = Math.max(
    Number(selected?.current_price ?? 0) || 0.01,
    0.01,
  );

  const isFund = selected ? isMutualFund(selected) : false;
  const isCash = selected?.asset_class === 'cash';
  const lockedToLine = !!isCash;
  const color = selected
    ? colorMap[selected.ticker] ?? assetColor(selected.asset_class ?? 'other')
    : '#6366F1';

  const getAnchor = (tickerKey: string, currentPrice: number): number => {
    const cached = anchorRef.current[tickerKey];
    if (cached?.period === period && cached.price > 0) return cached.price;
    if (currentPrice > 0) {
      anchorRef.current[tickerKey] = { period, price: currentPrice };
      return currentPrice;
    }
    return cached?.price ?? 0;
  };

  const { dollarChange, pctChange, anchor } = useMemo(() => {
    if (!selected || livePrice <= 0 || lockedToLine) {
      return {
        dollarChange: 0,
        pctChange: 0,
        anchor: lockedToLine ? livePrice : 0,
      };
    }
    const a = getAnchor(selected.ticker, livePrice);
    if (a <= 0) return { dollarChange: 0, pctChange: 0, anchor: 0 };
    const cfg = PERIOD_CONFIG[period];
    const periodStart = periodStartPriceFor(
      selected.ticker,
      a,
      cfg.bars,
      cfg.barSec,
    );
    if (periodStart <= 0) {
      return { dollarChange: 0, pctChange: 0, anchor: a };
    }
    const dollar = livePrice - periodStart;
    const pct = (dollar / periodStart) * 100;
    return { dollarChange: dollar, pctChange: pct, anchor: a };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, livePrice, period, lockedToLine]);

  const positive = dollarChange >= 0;
  const ownedShares = Number(selected?.shares ?? 0);
  const ownedCost = Number(selected?.avg_cost_basis ?? 0);
  const positionValue = ownedShares * livePrice;

  const chipPct = (h: Holding) => {
    const cv = Number(h.current_value ?? 0);
    const cost = Number(h.shares ?? 0) * Number(h.avg_cost_basis ?? 0);
    return cost > 0 ? ((cv - cost) / cost) * 100 : 0;
  };

  const chipPrice = (h: Holding) =>
    Math.max(prices[h.ticker] ?? Number(h.current_price ?? 0), 0);

  if (!sorted.length) return null;

  return (
    <div className="mt-6 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Live Market</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Simulated tick every 2s powers your live P&amp;L.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!lockedToLine && selected && !isFund && (
            <div className="inline-flex items-center bg-gray-50 border border-gray-200 rounded-full p-0.5">
              <button
                type="button"
                onClick={() => setChartKind('candle')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                  chartKind === 'candle'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500'
                }`}
                aria-pressed={chartKind === 'candle'}
              >
                <CandlestickChart className="w-3 h-3" /> Candle
              </button>
              <button
                type="button"
                onClick={() => setChartKind('line')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                  chartKind === 'line'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500'
                }`}
                aria-pressed={chartKind === 'line'}
              >
                <LineChartIcon className="w-3 h-3" /> Line
              </button>
            </div>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border border-gray-200 hover:bg-gray-50"
          >
            {paused ? (
              <>
                <Play className="w-3 h-3" /> Resume
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" /> Pause
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar -mx-1 px-1">
        {sorted.map((h) => {
          const active = h.ticker === selectedTicker;
          const px = chipPrice(h);
          const ch = chipPct(h);
          const up = ch >= 0;
          return (
            <button
              key={h.ticker}
              type="button"
              onClick={() => setSelectedTicker(h.ticker)}
              className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition min-w-[120px] ${
                active
                  ? 'border-gray-900 bg-gray-50 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <TickerLogo
                ticker={h.ticker}
                color={colorMap[h.ticker]}
                size="xs"
                rounded="lg"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold">{h.ticker}</p>
                <p className="text-[11px] tabular-nums text-gray-700">
                  {px > 0 ? fmtMoney(px) : '—'}
                </p>
                <p
                  className={`text-[10px] font-medium tabular-nums ${
                    up ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                >
                  {fmtPct(ch, { withSign: true, decimals: 2 })}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-start gap-3 flex-wrap">
            <TickerLogo
              ticker={selected.ticker}
              color={color}
              size="md"
              rounded="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900">
                  {selected.name ?? selected.ticker}
                </h3>
                {isFund && (
                  <span className="text-[9px] px-1.5 py-px rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold tracking-wider">
                    MF
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {selected.ticker} · {assetLabel(selected.asset_class ?? 'other')}
              </p>
            </div>
            {onQuickTrade && (
              <button
                type="button"
                onClick={() => onQuickTrade(selected)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800"
              >
                Trade
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold tabular-nums">
                {fmtMoney(livePrice)}
              </p>
              {lockedToLine ? (
                <p className="text-xs text-gray-500 mt-1">
                  {isFund
                    ? 'Last NAV — next update 4:00 PM ET'
                    : 'Cash · stable value'}
                </p>
              ) : (
                <p
                  className={`text-sm font-medium tabular-nums flex items-center gap-1 mt-1 ${
                    positive ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                >
                  {positive ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {positive ? '+' : ''}
                  {fmtMoney(dollarChange)} (
                  {fmtPct(pctChange, { withSign: true, decimals: 2 })}){' '}
                  <span className="text-gray-500 font-normal">
                    {period === '1D' ? 'since open' : `over ${period}`}
                  </span>
                </p>
              )}
            </div>
            {ownedShares > 0 && (
              <div className="text-right text-xs text-gray-600">
                <p>
                  You hold{' '}
                  <span className="font-semibold tabular-nums">
                    {ownedShares.toLocaleString('en-US', {
                      maximumFractionDigits: 4,
                    })}
                  </span>{' '}
                  shares
                </p>
                <p className="mt-0.5">
                  Position value{' '}
                  <span className="font-semibold tabular-nums">
                    {fmtMoney(positionValue)}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mt-4 pb-2">
            {PERIOD_KEYS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                  p === period
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-gray-100 overflow-hidden bg-white mt-1">
            <MarketChart
              key={`${selected.ticker}-${isFund ? 'nav' : 'live'}-${period}-${chartKind}-${paused}`}
              ticker={selected.ticker}
              basePrice={anchor || basePrice}
              assetClass={selected.asset_class}
              color={color}
              mode={isFund ? 'daily-nav' : 'live'}
              height={280}
              intervalMs={2000}
              historyBars={PERIOD_CONFIG[period].bars}
              barSec={PERIOD_CONFIG[period].barSec}
              paused={paused}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
            Movement is simulated from a random walk seeded by the ticker so the
            demo runs 24/7. Your live P&amp;L on this page updates from these
            ticks too.
          </p>
        </div>
      )}
    </div>
  );
}
