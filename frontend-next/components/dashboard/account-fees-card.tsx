'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, DollarSign } from 'lucide-react';
import { fmtMoney } from '@/lib/format';

interface FeeHolding {
  ticker: string;
  name: string;
  current_value: number;
  expense_ratio: number;
  annual_fee: number;
  is_high_fee: boolean;
  low_cost_alternative?: string | null;
}

interface AccountFeesData {
  total_value: number;
  weighted_expense_ratio: number;
  annual_fee_dollars: number;
  lifetime_cost_projection_30yr: number;
  high_fee_count: number;
  holdings: FeeHolding[];
  savings_opportunity?: string | null;
}

interface Props {
  accessToken?: string | null;
}

export function AccountFeesCard({ accessToken }: Props) {
  const [data, setData] = useState<AccountFeesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) { setLoading(false); return; }
    fetch('/api/fees/account', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm animate-pulse">
        <div className="h-4 w-32 bg-gray-100 rounded mb-3" />
        <div className="h-8 w-24 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Account Fees</span>
        </div>
        <p className="text-xs text-gray-400">Sync prices to calculate your expense ratios.</p>
      </div>
    );
  }

  const feeColor = data.weighted_expense_ratio > 0.005
    ? 'text-rose-600'
    : data.weighted_expense_ratio > 0.002
      ? 'text-amber-600'
      : 'text-emerald-600';

  const barPct = Math.min(100, (data.weighted_expense_ratio / 0.01) * 100);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-indigo-500" />
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Account Fees</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500">Annual fees</p>
          <p className="text-xl font-bold tabular-nums text-gray-900">{fmtMoney(data.annual_fee_dollars)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Expense ratio</p>
          <p className={`text-xl font-bold tabular-nums ${feeColor}`}>
            {(data.weighted_expense_ratio * 100).toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Fee scale bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>Low (0.03%)</span>
          <span>High (1%+)</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${
              data.weighted_expense_ratio > 0.005 ? 'bg-rose-400' :
              data.weighted_expense_ratio > 0.002 ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      {data.high_fee_count > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            {data.high_fee_count} holding{data.high_fee_count > 1 ? 's' : ''} with above-average fees.
            {data.savings_opportunity && ` ${data.savings_opportunity}`}
          </p>
        </div>
      )}

      <div className="text-xs text-gray-400 mt-2">
        30-yr lifetime cost at current fees:{' '}
        <span className="font-semibold text-gray-600">{fmtMoney(data.lifetime_cost_projection_30yr)}</span>
      </div>
    </div>
  );
}
