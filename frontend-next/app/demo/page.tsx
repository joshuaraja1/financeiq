'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CircleDollarSign,
  ExternalLink,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';

type Tab = 'overview' | 'holdings' | 'insights';
type Period = '1M' | '3M' | '1Y';

const series: Record<Period, number[]> = {
  '1M': [114, 116, 115, 119, 118, 121, 120, 124, 123, 127, 126, 129],
  '3M': [103, 108, 107, 111, 109, 114, 116, 113, 120, 121, 124, 129],
  '1Y': [86, 89, 87, 94, 97, 95, 103, 108, 106, 115, 120, 129],
};

const holdings = [
  { ticker: 'VTI', name: 'Vanguard Total Stock Market', className: 'US equities', value: 52180, allocation: 40.5, change: 8.4, color: '#6366f1' },
  { ticker: 'VXUS', name: 'Vanguard Total International', className: 'International equities', value: 28640, allocation: 22.2, change: 5.7, color: '#8b5cf6' },
  { ticker: 'BND', name: 'Vanguard Total Bond Market', className: 'Fixed income', value: 25020, allocation: 19.4, change: 2.1, color: '#06b6d4' },
  { ticker: 'SCHD', name: 'Schwab US Dividend Equity', className: 'Dividend equities', value: 15280, allocation: 11.9, change: 4.9, color: '#14b8a6' },
  { ticker: 'CASH', name: 'Available cash', className: 'Cash', value: 7840, allocation: 6.0, change: 0, color: '#cbd5e1' },
];

const insights = [
  { icon: ShieldCheck, label: 'Risk check', title: 'Your portfolio is moderately diversified', detail: 'Equity exposure spans US and international markets while fixed income helps reduce overall volatility.', tone: 'indigo' },
  { icon: TrendingUp, label: 'Allocation watch', title: 'US equities are above the target range', detail: 'A 40.5% weight is about 5 percentage points above this sample portfolio’s target. FinanceIQ would flag the drift for review.', tone: 'amber' },
  { icon: CircleDollarSign, label: 'Cash planning', title: '$7,840 is ready to allocate', detail: 'The sample cash balance could help move the portfolio toward its target mix without selling an existing holding.', tone: 'teal' },
];

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

function Chart({ period }: { period: Period }) {
  const values = series[period];
  const min = Math.min(...values) - 8;
  const max = Math.max(...values) + 6;
  const points = values.map((value, index) => `${index * (600 / (values.length - 1))},${170 - ((value - min) / (max - min)) * 145}`).join(' ');
  const fill = `M0,190 L${points.replaceAll(' ', ' L')} L600,190 Z`;
  return (
    <div className="relative h-56 w-full" role="img" aria-label={`Sample portfolio value trend over ${period}`}>
      <svg viewBox="0 0 600 190" preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs><linearGradient id="demo-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#818cf8" stopOpacity=".34" /><stop offset="100%" stopColor="#818cf8" stopOpacity="0" /></linearGradient></defs>
        {[40, 90, 140, 190].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="4 6" />)}
        <path d={fill} fill="url(#demo-chart-fill)" />
        <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx="600" cy={points.split(' ').at(-1)?.split(',')[1]} r="6" fill="#6366f1" stroke="white" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export default function DemoPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<Period>('1Y');
  const portfolioValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
  const periodGain = {
    '1M': '+$3,480 (2.8%) over the last month',
    '3M': '+$7,260 (6.0%) over the last three months',
    '1Y': '+$12,480 (10.7%) over the last year',
  }[period];

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white"><Sparkles className="h-5 w-5" /></span><span className="text-lg font-bold">FinanceIQ</span><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Sample demo</span></div>
          <Link href="/login" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:border-indigo-300 hover:text-indigo-700">Sign in <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-20 pt-8 md:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-1 text-sm font-semibold uppercase tracking-widest text-indigo-600">Explore FinanceIQ</p><h1 className="text-3xl font-bold tracking-tight md:text-4xl">A clearer view of your money</h1><p className="mt-2 max-w-2xl text-slate-500">Browse a sample portfolio and see how FinanceIQ turns holdings into useful decisions.</p></div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-2 text-xs font-medium text-indigo-700"><LockKeyhole className="h-3.5 w-3.5" /> Read-only sample data · no account needed</div>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 sm:w-fit" role="tablist" aria-label="Demo sections">
          {([['overview', 'Overview', BarChart3], ['holdings', 'Holdings', Wallet], ['insights', 'AI insights', BrainCircuit]] as const).map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${tab === id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon className="h-4 w-4" />{label}</button>)}
        </div>

        {tab === 'overview' && <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-slate-500">Total portfolio value</p><p className="mt-1 text-4xl font-bold tabular-nums tracking-tight md:text-5xl">{money(portfolioValue)}</p><p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700"><TrendingUp className="h-4 w-4" /> {periodGain}</p></div><div className="flex rounded-full bg-slate-100 p-1" aria-label="Chart time range">{(['1M', '3M', '1Y'] as const).map(item => <button key={item} onClick={() => setPeriod(item)} aria-pressed={period === item} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${period === item ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>{item}</button>)}</div></div>
              <div className="mt-8"><Chart period={period} /></div><div className="mt-2 flex justify-between text-xs text-slate-400"><span>{period === '1Y' ? '12 months ago' : period === '3M' ? '3 months ago' : '30 days ago'}</span><span>Today</span></div>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"><h2 className="text-lg font-semibold">Asset allocation</h2><p className="mt-1 text-sm text-slate-500">Balanced across five sample positions</p><div className="mx-auto my-7 flex h-44 w-44 items-center justify-center rounded-full" style={{ background: 'conic-gradient(#6366f1 0 40.5%, #8b5cf6 40.5% 62.7%, #06b6d4 62.7% 82.1%, #14b8a6 82.1% 94%, #cbd5e1 94% 100%)' }}><div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-bold">5</span><span className="text-xs text-slate-500">positions</span></div></div><div className="space-y-2.5">{holdings.map(item => <div key={item.ticker} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />{item.ticker}</span><span className="font-semibold tabular-nums">{item.allocation.toFixed(1)}%</span></div>)}</div></section>
          </div>
          <div className="grid gap-5 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Available cash</p><p className="mt-2 text-2xl font-bold tabular-nums">$7,840</p><p className="mt-1 text-xs text-slate-400">Ready for your next move</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Expected annual return</p><p className="mt-2 text-2xl font-bold tabular-nums">7.8%</p><p className="mt-1 text-xs text-slate-400">Illustrative estimate</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Portfolio risk</p><p className="mt-2 text-2xl font-bold">Moderate</p><p className="mt-1 text-xs text-slate-400">Based on sample allocation</p></div></div>
          <button onClick={() => setTab('insights')} className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-left text-white shadow-lg shadow-indigo-500/15"><span className="flex items-center gap-3"><BrainCircuit className="h-7 w-7" /><span><strong className="block text-lg">See what the AI noticed</strong><span className="text-sm text-indigo-100">Three plain-English observations about this sample portfolio</span></span></span><ArrowRight className="h-5 w-5" /></button>
        </div>}

        {tab === 'holdings' && <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6"><div><h2 className="text-xl font-semibold">Portfolio holdings</h2><p className="mt-1 text-sm text-slate-500">A realistic sample to explore the interface</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">5 positions</span></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400"><th className="px-6 py-4 font-semibold">Asset</th><th className="px-6 py-4 font-semibold">Class</th><th className="px-6 py-4 text-right font-semibold">Value</th><th className="px-6 py-4 text-right font-semibold">Allocation</th><th className="px-6 py-4 text-right font-semibold">Sample return</th></tr></thead><tbody>{holdings.map(item => <tr key={item.ticker} className="border-b border-slate-100 last:border-0"><td className="px-6 py-4"><span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ background: item.color }}>{item.ticker.slice(0, 2)}</span><span><strong className="block text-sm">{item.ticker}</strong><span className="text-xs text-slate-500">{item.name}</span></span></span></td><td className="px-6 py-4 text-sm text-slate-500">{item.className}</td><td className="px-6 py-4 text-right text-sm font-semibold tabular-nums">{money(item.value)}</td><td className="px-6 py-4 text-right text-sm tabular-nums">{item.allocation.toFixed(1)}%</td><td className="px-6 py-4 text-right text-sm font-semibold tabular-nums text-emerald-600">{item.change ? `+${item.change.toFixed(1)}%` : '—'}</td></tr>)}</tbody></table></div></section>}

        {tab === 'insights' && <div className="space-y-5"><div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 p-7 text-white md:p-9"><div className="flex items-center gap-2 text-indigo-100"><Sparkles className="h-5 w-5" /><span className="text-sm font-semibold uppercase tracking-wide">AI-powered analysis</span></div><h2 className="mt-4 max-w-xl text-3xl font-bold">Know what matters, without decoding a spreadsheet.</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-indigo-100">FinanceIQ connects positions, allocation, risk, and goals into plain-English guidance. These examples use sample data and are not financial advice.</p></div><div className="grid gap-5 md:grid-cols-3">{insights.map(({ icon: Icon, label, title, detail, tone }) => <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone === 'amber' ? 'bg-amber-50 text-amber-600' : tone === 'teal' ? 'bg-teal-50 text-teal-600' : 'bg-indigo-50 text-indigo-600'}`}><Icon className="h-5 w-5" /></span><p className="mt-5 text-xs font-bold uppercase tracking-wide text-indigo-600">{label}</p><h3 className="mt-2 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-500">{detail}</p></article>)}</div><button onClick={() => setTab('holdings')} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700">See the sample holdings <ArrowRight className="h-4 w-4" /></button></div>}

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-400"><span>FinanceIQ demo · All balances and returns are fictional sample data.</span><a href="https://github.com/joshuaraja1/financeiq" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-indigo-700">View source on GitHub <ExternalLink className="h-3.5 w-3.5" /></a></div>
      </main>
    </div>
  );
}
