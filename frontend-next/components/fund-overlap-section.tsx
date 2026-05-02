'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, type FundOverlapPair } from '@/lib/api';
import { fmtMoney } from '@/lib/format';

export function FundOverlapSection() {
  const [pairs, setPairs] = useState<FundOverlapPair[]>([]);
  const [fundCount, setFundCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.funds.overlap();
        if (!cancelled) {
          setPairs(res.pairs ?? []);
          setFundCount(res.fund_count ?? 0);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Could not load fund overlap',
          );
          setPairs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="mt-6 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl p-8 shadow-sm flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Analyzing fund overlap…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Fund overlap</h2>
        <p className="text-sm text-rose-600">{error}</p>
      </div>
    );
  }

  if (pairs.length === 0) {
    return (
      <div className="mt-6 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Fund overlap</h2>
        <p className="text-sm text-muted-foreground">
          {fundCount < 2
            ? 'Add at least two stock funds or ETFs with holdings data to see where they overlap.'
            : 'No meaningful overlap (10%+) found between your funds — or composition data is still loading.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-2">Fund overlap</h2>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        Most 401k investors hold 3–5 funds that own 70%+ the same stocks
        without realizing it. Here&apos;s where your funds duplicate each
        other.
      </p>
      <div className="space-y-4">
        {pairs.map((row) => {
          const pct = Math.round(row.overlap * 100);
          return (
            <div
              key={`${row.a}-${row.b}`}
              className="border border-gray-100 rounded-xl p-4"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-semibold tabular-nums">
                  {row.a}{' '}
                  <span className="text-gray-400 font-normal">×</span> {row.b}
                </span>
                <span className="text-sm font-bold text-gray-900 tabular-nums">
                  {pct}% identical
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                <p>
                  <span className="font-semibold text-gray-900">{row.a}</span>{' '}
                  <span className="text-gray-400">·</span> {row.a_name}{' '}
                  <span className="tabular-nums text-gray-500">
                    {fmtMoney(row.a_value)}
                  </span>
                </p>
                <p>
                  <span className="font-semibold text-gray-900">{row.b}</span>{' '}
                  <span className="text-gray-400">·</span> {row.b_name}{' '}
                  <span className="tabular-nums text-gray-500">
                    {fmtMoney(row.b_value)}
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
