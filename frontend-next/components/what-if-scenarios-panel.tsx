'use client';

import { useCallback, useMemo, useState } from 'react';
import { Loader2, Sparkles, TrendingDown, User, BarChart3, SlidersHorizontal } from 'lucide-react';
import type { Goal, Holding } from '@/lib/api';
import { api } from '@/lib/api';

type WhatIfScenarioRunResult = {
  scenario: string;
  description: string;
  duration_months: number;
  total_portfolio_before: number;
  total_portfolio_after: number;
  total_dollar_impact: number;
  total_pct_impact: number;
  holdings_breakdown: Array<{
    name: string;
    ticker: string;
    current_value: number;
    scenario_value: number;
    dollar_change: number;
    pct_change: number;
  }>;
  plain_english: string;
  what_if_key?: string;
  scenario_rebalance?: {
    recommended_trades?: Array<{
      action: string;
      amount_dollars?: number;
      asset_class?: string;
      plain_english_reason?: string;
    }>;
    plain_english_recommendation?: string;
    reassurance?: string;
  } | null;
};
import { fmtMoney } from '@/lib/format';
import { toast } from 'sonner';

type Tab = 'market' | 'personal' | 'custom';

const MARKET_CARDS = [
  { key: 'market_drop_20', icon: '📉', title: 'What if markets drop 20%?', subtitle: 'Like Q4 2018 or COVID' },
  { key: 'high_inflation', icon: '🔥', title: 'What if inflation stays high?', subtitle: 'Cash + bonds lose real value' },
  { key: 'rate_rise', icon: '📈', title: 'What if interest rates rise again?', subtitle: 'Good for cash, hard on bonds' },
  { key: 'recession', icon: '🏦', title: "What if there's a full recession?", subtitle: '2008-style: −35% equities' },
];

const PERSONAL_CARDS = [
  { key: 'withdrawal', icon: '💸', title: 'What if I need to withdraw 20%?', subtitle: 'Simulate a liquidity event' },
  { key: 'job_loss', icon: '⚡', title: 'What if I lose my job next month?', subtitle: 'Liquidity vs growth trade-off' },
];

interface CustomFactors {
  equityChangePct: number;
  bondChangePct: number;
  cashChangePct: number;
  withdrawalPct: number;
  durationMonths: number;
}

function computeCustomImpact(
  holdings: Holding[],
  factors: CustomFactors,
): WhatIfScenarioRunResult {
  const totalBefore = holdings.reduce((acc, h) => acc + Number(h.current_value || 0), 0);

  const assetReturnMap: Record<string, number> = {
    us_stocks: factors.equityChangePct / 100,
    intl_stocks: (factors.equityChangePct * 0.9) / 100,
    bonds: factors.bondChangePct / 100,
    cash: factors.cashChangePct / 100,
    real_estate: (factors.equityChangePct * 0.7) / 100,
    commodities: (factors.equityChangePct * 0.5) / 100,
    other: factors.equityChangePct / 100,
  };

  const breakdown = holdings.map((h) => {
    const cv = Number(h.current_value || 0);
    const ac = h.asset_class || 'us_stocks';
    const baseReturn = assetReturnMap[ac] ?? assetReturnMap.us_stocks;
    const withdrawalDrag = factors.withdrawalPct > 0 ? -(factors.withdrawalPct / 100) : 0;
    const totalReturn = baseReturn + withdrawalDrag;
    const dollarChange = cv * totalReturn;
    return {
      name: h.name || h.ticker,
      ticker: h.ticker,
      current_value: cv,
      scenario_value: cv + dollarChange,
      dollar_change: dollarChange,
      pct_change: totalReturn * 100,
    };
  });

  const totalImpact = breakdown.reduce((acc, b) => acc + b.dollar_change, 0);
  const pctImpact = totalBefore > 0 ? (totalImpact / totalBefore) * 100 : 0;

  return {
    scenario: 'Custom scenario',
    description: `Custom parameters: equities ${factors.equityChangePct > 0 ? '+' : ''}${factors.equityChangePct}%, bonds ${factors.bondChangePct > 0 ? '+' : ''}${factors.bondChangePct}%, cash ${factors.cashChangePct > 0 ? '+' : ''}${factors.cashChangePct}%`,
    duration_months: factors.durationMonths,
    total_portfolio_before: totalBefore,
    total_portfolio_after: totalBefore + totalImpact,
    total_dollar_impact: totalImpact,
    total_pct_impact: pctImpact,
    holdings_breakdown: breakdown,
    plain_english: `In your custom scenario, your portfolio would ${totalImpact >= 0 ? 'gain' : 'lose'} approximately ${fmtMoney(Math.abs(totalImpact))} (${Math.abs(pctImpact).toFixed(1)}%). These numbers are illustrative, not a prediction.`,
    what_if_key: 'custom',
  };
}

function FactorSlider({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className={`text-sm font-semibold tabular-nums ${value < 0 ? 'text-rose-600' : value > 0 ? 'text-emerald-600' : 'text-gray-600'}`}>
          {value > 0 ? '+' : ''}{value}{suffix ?? '%'}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600 h-2"
      />
    </div>
  );
}

function holdingPlainNote(
  row: WhatIfScenarioRunResult['holdings_breakdown'][number],
  largestTicker: string | undefined,
  scenarioKey: string,
): string {
  const nm = (row.name || '').toLowerCase();
  if (nm.includes('bond') || nm.includes('fixed income')) {
    if (row.dollar_change > 25) return 'often helps cushion when stocks fall';
    if (row.dollar_change < -25) return 'can still move down in stressful markets';
    return 'part of your steadier sleeve';
  }
  if (nm.includes('money market') || nm.includes('cash')) return 'stays steadier when stocks swing';
  if (row.ticker && row.ticker === largestTicker) return 'one of the larger dollar moves in this scenario';
  if (scenarioKey === 'withdrawal') return 'this slice would shrink by your withdrawal amount';
  if (scenarioKey === 'job_loss') return 'liquidity planning matters more than price guesses here';
  return 'moves with the type of investments you hold here';
}

export function WhatIfScenariosPanel({
  goals,
  holdings = [],
  refresh,
}: {
  goals: Goal[];
  holdings?: Holding[];
  refresh: () => Promise<void>;
}) {
  const goalId = goals[0]?.id;
  const [activeTab, setActiveTab] = useState<Tab>('market');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingWithdraw, setPendingWithdraw] = useState(false);
  const [withdrawPct, setWithdrawPct] = useState(20);
  const [result, setResult] = useState<WhatIfScenarioRunResult | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [persisting, setPersisting] = useState(false);

  const [customFactors, setCustomFactors] = useState<CustomFactors>({
    equityChangePct: -20,
    bondChangePct: 5,
    cashChangePct: 0,
    withdrawalPct: 0,
    durationMonths: 6,
  });

  const runScenario = useCallback(
    async (key: string, withdrawalFraction?: number) => {
      setBusyKey(key);
      try {
        const r = await api.scenarios.run(key, goalId) as WhatIfScenarioRunResult;
        setResult(r);
        setActiveKey(key);
        setPendingWithdraw(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not run scenario');
      } finally {
        setBusyKey(null);
      }
    },
    [goalId],
  );

  const runCustomScenario = () => {
    if (holdings.length === 0) {
      toast.message('Add holdings first', { description: 'We need your portfolio to simulate this.' });
      return;
    }
    const computed = computeCustomImpact(holdings, customFactors);
    setResult(computed);
    setActiveKey('custom');
    setPendingWithdraw(false);
  };

  const largestTicker = useMemo(() => {
    if (!result?.holdings_breakdown?.length) return undefined;
    const sorted = [...result.holdings_breakdown].sort(
      (a, b) => Math.abs(b.dollar_change) - Math.abs(a.dollar_change),
    );
    return sorted[0]?.ticker;
  }, [result]);

  const onCardClick = (key: string) => {
    if (!goalId && key !== 'custom') {
      toast.message('Add a goal first', { description: 'We need a goal to line up targets with this check.' });
      return;
    }
    if (key === 'withdrawal') {
      setActiveKey(key);
      setPendingWithdraw(true);
      setResult(null);
      return;
    }
    void runScenario(key);
  };

  const onApplyStrategy = async () => {
    if (!result || !activeKey || !result.scenario_rebalance) {
      toast.error('Nothing to save yet — run a scenario first.');
      return;
    }
    if (!goalId) return;
    setPersisting(true);
    try {
      await api.rebalancing.trigger();
      await refresh();
      toast.success('Saved to your open recommendations');
      const el = document.getElementById('open-recommendations');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setPersisting(false);
    }
  };

  const sr = result?.scenario_rebalance;
  const trades = sr?.recommended_trades ?? [];

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'market', label: 'Market & macro', icon: <TrendingDown className="w-3.5 h-3.5" /> },
    { id: 'personal', label: 'Personal events', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'custom', label: 'Custom builder', icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="font-semibold text-lg">What-if scenarios</h2>
        <span className="text-xs text-gray-400">Stress-test your real holdings</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        See how your money would respond to market shocks, life events, or custom
        scenarios — and get a concrete next step.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-100">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={[
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition',
              activeTab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200',
            ].join(' ')}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Market & Macro cards */}
      {activeTab === 'market' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {MARKET_CARDS.map((c) => (
            <button
              key={c.key}
              type="button"
              disabled={busyKey !== null}
              onClick={() => onCardClick(c.key)}
              className={[
                'text-left rounded-2xl border p-5 transition disabled:opacity-60 hover:shadow-md',
                activeKey === c.key && result
                  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-gray-100 bg-white shadow-sm hover:border-indigo-100',
              ].join(' ')}
            >
              <div className="text-2xl mb-2">{c.icon}</div>
              <p className="font-semibold text-gray-900 leading-snug text-sm">{c.title}</p>
              <p className="text-xs text-gray-500 mt-1">{c.subtitle}</p>
              <p className="text-xs text-indigo-600 font-medium mt-3">
                {busyKey === c.key ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Running…
                  </span>
                ) : 'Simulate →'}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Personal Events cards */}
      {activeTab === 'personal' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PERSONAL_CARDS.map((c) => (
            <button
              key={c.key}
              type="button"
              disabled={busyKey !== null}
              onClick={() => onCardClick(c.key)}
              className={[
                'text-left rounded-2xl border p-5 transition disabled:opacity-60 hover:shadow-md',
                activeKey === c.key && result
                  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-gray-100 bg-white shadow-sm hover:border-indigo-100',
              ].join(' ')}
            >
              <div className="text-2xl mb-2">{c.icon}</div>
              <p className="font-semibold text-gray-900 leading-snug">{c.title}</p>
              <p className="text-xs text-gray-500 mt-1">{c.subtitle}</p>
              <p className="text-xs text-indigo-600 font-medium mt-3">
                {busyKey === c.key ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Running…
                  </span>
                ) : 'Simulate →'}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Custom Builder */}
      {activeTab === 'custom' && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <p className="font-semibold text-gray-900">Build your own scenario</p>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Drag the sliders to define your scenario. We&apos;ll show the dollar impact
            on your real holdings instantly.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <FactorSlider
              label="Equity markets change"
              value={customFactors.equityChangePct}
              onChange={(v) => setCustomFactors((f) => ({ ...f, equityChangePct: v }))}
              min={-60}
              max={30}
            />
            <FactorSlider
              label="Bond markets change"
              value={customFactors.bondChangePct}
              onChange={(v) => setCustomFactors((f) => ({ ...f, bondChangePct: v }))}
              min={-25}
              max={20}
            />
            <FactorSlider
              label="Cash purchasing power change"
              value={customFactors.cashChangePct}
              onChange={(v) => setCustomFactors((f) => ({ ...f, cashChangePct: v }))}
              min={-15}
              max={5}
            />
            <FactorSlider
              label="Portfolio withdrawal needed"
              value={customFactors.withdrawalPct}
              onChange={(v) => setCustomFactors((f) => ({ ...f, withdrawalPct: v }))}
              min={0}
              max={60}
            />
            <FactorSlider
              label="Scenario duration"
              value={customFactors.durationMonths}
              onChange={(v) => setCustomFactors((f) => ({ ...f, durationMonths: v }))}
              min={1}
              max={36}
              suffix=" mo"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={runCustomScenario}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-full text-sm font-semibold hover:bg-indigo-500 transition"
            >
              Run my scenario
            </button>
            <button
              type="button"
              onClick={() =>
                setCustomFactors({
                  equityChangePct: -20,
                  bondChangePct: 5,
                  cashChangePct: 0,
                  withdrawalPct: 0,
                  durationMonths: 6,
                })
              }
              className="px-5 py-2.5 bg-gray-100 rounded-full text-sm font-medium hover:bg-gray-200 transition"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Withdrawal amount selector */}
      {pendingWithdraw && activeKey === 'withdrawal' && (
        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="font-semibold text-gray-900 mb-2">How much would you need to withdraw?</p>
          <p className="text-sm text-gray-500 mb-4">
            Pick a rough share of your portfolio — we&apos;ll spread it across holdings.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <input
              type="range"
              min={5}
              max={50}
              step={1}
              value={withdrawPct}
              onChange={(e) => setWithdrawPct(Number(e.target.value))}
              className="flex-1 accent-indigo-600"
            />
            <span className="text-sm font-semibold tabular-nums text-gray-800 shrink-0">
              {withdrawPct}% of portfolio
            </span>
            <button
              type="button"
              disabled={busyKey !== null}
              onClick={() => runScenario('withdrawal', withdrawPct / 100)}
              className="px-4 py-2 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {busyKey === 'withdrawal' ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Run this scenario'}
            </button>
          </div>
        </div>
      )}

      {busyKey && !pendingWithdraw && (
        <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Running your numbers…
        </div>
      )}

      {/* Results panel */}
      {result && !pendingWithdraw && (
        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{result.scenario}</p>
              <p className="text-sm text-gray-600 mt-1">{result.description}</p>
            </div>
            {result.total_dollar_impact !== 0 && (
              <div className={`text-right px-4 py-2 rounded-xl ${result.total_dollar_impact < 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                <p className={`text-2xl font-bold tabular-nums ${result.total_dollar_impact < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {result.total_dollar_impact >= 0 ? '+' : '−'}
                  {fmtMoney(Math.abs(result.total_dollar_impact))}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {Math.abs(result.total_pct_impact).toFixed(1)}% of portfolio
                </p>
              </div>
            )}
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Portfolio today</p>
              <p className="font-semibold tabular-nums text-gray-900">{fmtMoney(result.total_portfolio_before)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">After this scenario</p>
              <p className={`font-semibold tabular-nums ${result.total_portfolio_after < result.total_portfolio_before ? 'text-rose-600' : 'text-emerald-700'}`}>
                {fmtMoney(result.total_portfolio_after)}
              </p>
            </div>
          </div>

          {/* Holdings breakdown */}
          <div>
            <p className="font-semibold text-gray-900 mb-2">How each holding would be affected</p>
            <div className="border-t border-b border-gray-100 divide-y divide-gray-50">
              {result.holdings_breakdown.map((row) => (
                <div
                  key={row.ticker || row.name}
                  className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1"
                >
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{row.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {holdingPlainNote(row, largestTicker, activeKey ?? '')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-semibold tabular-nums text-sm ${row.dollar_change >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {row.dollar_change >= 0 ? '+' : '−'}
                      {fmtMoney(Math.abs(row.dollar_change))}
                    </p>
                    <p className="text-[11px] text-gray-400">was {fmtMoney(row.current_value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed">{result.plain_english}</p>

          {/* AI recommendation from backend */}
          {sr && activeKey !== 'custom' && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5 space-y-4">
              <div className="flex items-center gap-2 text-indigo-900 font-semibold">
                <Sparkles className="w-5 h-5" />
                What we recommend if this happens
              </div>
              <p className="text-sm text-gray-800 leading-relaxed">{sr.plain_english_recommendation}</p>
              {trades.length > 0 && (
                <ul className="space-y-2 text-sm">
                  {trades.map((t, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-gray-800">
                      <span className="font-bold uppercase text-xs text-indigo-700">{t.action}</span>
                      <span className="font-semibold tabular-nums">{fmtMoney(t.amount_dollars ?? 0)}</span>
                      <span className="text-gray-600">{t.asset_class?.replace(/_/g, ' ') ?? '—'}</span>
                      {t.plain_english_reason ? (
                        <span className="text-gray-500 text-xs w-full sm:w-auto">— {t.plain_english_reason}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {sr.reassurance ? (
                <p className="text-xs text-gray-600 italic border-t border-indigo-100 pt-3">{sr.reassurance}</p>
              ) : null}
              <button
                type="button"
                disabled={persisting || !goalId}
                onClick={() => void onApplyStrategy()}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {persisting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Apply this rebalancing strategy →
              </button>
            </div>
          )}

          {/* Custom scenario tip */}
          {activeKey === 'custom' && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
              <span className="font-semibold text-gray-800">Custom scenario note: </span>
              This is a simplified estimate based on your asset class mix. For a full AI
              rebalancing recommendation, use one of the preset scenarios above — those run
              through our full analysis engine.
            </div>
          )}

          <button
            type="button"
            className="text-sm text-gray-500 underline"
            onClick={() => { setResult(null); setActiveKey(null); setPendingWithdraw(false); }}
          >
            Clear results
          </button>
        </div>
      )}
    </div>
  );
}
