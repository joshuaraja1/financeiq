'use client';

import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { fmtMoney } from '@/lib/format';

const RATE_OPTIONS = [
  { label: '6%', value: 0.06 },
  { label: '7%', value: 0.07 },
  { label: '8%', value: 0.08 },
  { label: '10%', value: 0.10 },
];

const HORIZONS = [10, 20, 30] as const;

interface Props {
  currentValue: number;
  monthlyContribution?: number;
}

function fv(pv: number, rate: number, years: number, pmt = 0): number {
  if (rate === 0) return pv + pmt * years * 12;
  const r = rate / 12;
  const n = years * 12;
  return pv * Math.pow(1 + rate, years) + pmt * ((Math.pow(1 + r, n) - 1) / r);
}

export function FutureValueCalculator({ currentValue, monthlyContribution = 0 }: Props) {
  const [selectedRate, setSelectedRate] = useState(0.06);
  const [monthly, setMonthly] = useState(monthlyContribution);

  const projections = useMemo(
    () =>
      HORIZONS.map((years) => ({
        years,
        value: fv(currentValue, selectedRate, years, monthly),
      })),
    [currentValue, selectedRate, monthly],
  );

  const maxValue = projections[projections.length - 1].value;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-indigo-500" />
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Future Value Projection
        </span>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        At <span className="font-semibold text-gray-800">{fmtMoney(currentValue)}</span> today,
        here&apos;s what compound growth could look like.
      </p>

      {/* Rate selector */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        <span className="text-xs text-gray-500 mr-1">Annual return:</span>
        {RATE_OPTIONS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setSelectedRate(r.value)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
              selectedRate === r.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Monthly contribution */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-xs text-gray-500 shrink-0">+ Monthly:</span>
        <div className="flex items-center gap-1 flex-1">
          <span className="text-sm text-gray-500">$</span>
          <input
            type="number"
            min={0}
            step={100}
            value={monthly}
            onChange={(e) => setMonthly(Math.max(0, Number(e.target.value)))}
            className="w-24 px-2 py-1 rounded-lg border border-gray-200 text-sm tabular-nums focus:border-indigo-400 focus:outline-none"
          />
          <span className="text-xs text-gray-400">/mo</span>
        </div>
      </div>

      {/* Projection bars */}
      <div className="space-y-3">
        {projections.map(({ years, value }) => {
          const barPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const gain = value - currentValue - monthly * years * 12;
          return (
            <div key={years}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">In {years} years</span>
                <div className="text-right">
                  <span className="text-sm font-bold tabular-nums text-gray-900">
                    {fmtMoney(value)}
                  </span>
                  {gain > 0 && (
                    <span className="text-xs text-emerald-600 ml-2">
                      +{fmtMoney(gain)} growth
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
        Illustrative only — assumes {(selectedRate * 100).toFixed(0)}% annual return,
        compounded monthly. Not a guarantee of future performance.
      </p>
    </div>
  );
}
