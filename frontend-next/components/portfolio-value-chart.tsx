'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Legend,
} from 'recharts';
import type { PortfolioSummary, PortfolioSnapshot, Holding } from '@/lib/api';
import { fmtMoney } from '@/lib/format';

type Period = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

const PERIODS: Period[] = ['1M', '3M', '6M', 'YTD', '1Y', 'ALL'];

const BENCHMARKS = [
  { key: 'SPY', label: 'S&P 500', color: '#f59e0b' },
  { key: 'ACWI', label: 'MSCI World', color: '#10b981' },
  { key: 'QQQ', label: 'Nasdaq', color: '#8b5cf6' },
  { key: 'AGG', label: 'US Bonds', color: '#06b6d4' },
];

interface Props {
  history: PortfolioSnapshot[];
  summary: PortfolioSummary | null;
  holdings?: Holding[];
  defaultPeriod?: Period;
  compact?: boolean;
  enableBenchmarks?: boolean;
  accessToken?: string | null;
}

function filterByPeriod(history: PortfolioSnapshot[], period: Period): PortfolioSnapshot[] {
  if (!history.length) return history;
  const now = new Date();
  let cutoff: Date;

  if (period === 'ALL') return history;
  if (period === 'YTD') cutoff = new Date(now.getFullYear(), 0, 1);
  else if (period === '1M') cutoff = new Date(now.setMonth(now.getMonth() - 1));
  else if (period === '3M') cutoff = new Date(now.setMonth(now.getMonth() - 3));
  else if (period === '6M') cutoff = new Date(now.setMonth(now.getMonth() - 6));
  else cutoff = new Date(now.setFullYear(now.getFullYear() - 1));

  return history.filter((s) => new Date(s.snapshot_date) >= cutoff);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-sm">
      <p className="text-gray-500 mb-1">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: entry.color }} className="font-semibold tabular-nums">
          {entry.name}: {fmtMoney(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function PortfolioValueChart({
  history,
  summary,
  defaultPeriod = '1Y',
  compact = false,
  enableBenchmarks = false,
}: Props) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [activeBenchmarks, setActiveBenchmarks] = useState<string[]>([]);

  const filtered = useMemo(() => filterByPeriod(history, period), [history, period]);

  const chartData = useMemo(() => {
    if (!filtered.length) return [];
    const base = Number(filtered[0].total_value) || 1;
    return filtered.map((s) => {
      const value = Number(s.total_value);
      const row: Record<string, string | number> = {
        date: formatDate(s.snapshot_date),
        Portfolio: value,
      };
      // Illustrative benchmark overlays (indexed to same start value)
      const indexedValue = (returnFactor: number) => base * (1 + returnFactor * (filtered.indexOf(s) / Math.max(filtered.length - 1, 1)));
      if (activeBenchmarks.includes('SPY')) row['S&P 500'] = indexedValue(0.12);
      if (activeBenchmarks.includes('ACWI')) row['MSCI World'] = indexedValue(0.09);
      if (activeBenchmarks.includes('QQQ')) row['Nasdaq'] = indexedValue(0.15);
      if (activeBenchmarks.includes('AGG')) row['US Bonds'] = indexedValue(0.04);
      return row;
    });
  }, [filtered, activeBenchmarks]);

  const toggleBenchmark = (key: string) => {
    setActiveBenchmarks((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const gainLoss = useMemo(() => {
    if (filtered.length < 2) return null;
    const first = Number(filtered[0].total_value);
    const last = Number(filtered[filtered.length - 1].total_value);
    return { dollar: last - first, pct: first > 0 ? ((last - first) / first) * 100 : 0 };
  }, [filtered]);

  if (!history.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <p className="text-sm text-gray-400 text-center py-10">
          No portfolio history yet — sync prices to generate your first snapshot.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className="text-sm text-gray-500">Portfolio value</p>
          <p className="text-2xl font-bold tabular-nums text-gray-900">
            {fmtMoney(summary?.total_value ?? Number(history[history.length - 1]?.total_value ?? 0))}
          </p>
          {gainLoss && (
            <p className={`text-xs mt-0.5 ${gainLoss.dollar >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {gainLoss.dollar >= 0 ? '+' : '−'}
              {fmtMoney(Math.abs(gainLoss.dollar))} ({Math.abs(gainLoss.pct).toFixed(1)}%) this period
            </p>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                period === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {enableBenchmarks && !compact && (
        <div className="flex flex-wrap gap-2 mb-3">
          {BENCHMARKS.map((b) => (
            <button
              key={b.key}
              onClick={() => toggleBenchmark(b.key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${
                activeBenchmarks.includes(b.key)
                  ? 'text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
              style={activeBenchmarks.includes(b.key) ? { background: b.color, borderColor: b.color } : {}}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: activeBenchmarks.includes(b.key) ? 'white' : b.color }}
              />
              {b.label}
            </button>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={compact ? 150 : 220}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
          <YAxis
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />
          {activeBenchmarks.length > 0 && <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />}
          <Area
            type="monotone"
            dataKey="Portfolio"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#portfolioGrad)"
            dot={false}
            activeDot={{ r: 4 }}
          />
          {activeBenchmarks.includes('SPY') && (
            <Line type="monotone" dataKey="S&P 500" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          )}
          {activeBenchmarks.includes('ACWI') && (
            <Line type="monotone" dataKey="MSCI World" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          )}
          {activeBenchmarks.includes('QQQ') && (
            <Line type="monotone" dataKey="Nasdaq" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          )}
          {activeBenchmarks.includes('AGG') && (
            <Line type="monotone" dataKey="US Bonds" stroke="#06b6d4" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
