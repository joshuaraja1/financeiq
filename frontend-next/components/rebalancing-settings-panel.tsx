'use client';

import { useState } from 'react';
import { Loader2, Settings } from 'lucide-react';
import type { Goal } from '@/lib/api';
import { api } from '@/lib/api';
import { assetLabel } from '@/lib/format';
import { toast } from 'sonner';

const ASSET_CLASSES = ['us_stocks', 'intl_stocks', 'bonds', 'cash', 'real_estate'] as const;
const STRATEGIES = [
  { value: 'calendar', label: 'Calendar', desc: 'Rebalance on a schedule (quarterly, annually)' },
  { value: 'threshold', label: 'Threshold', desc: 'Rebalance when drift exceeds your band' },
  { value: 'hybrid', label: 'Hybrid', desc: 'Both: schedule + drift check (recommended)' },
  { value: 'cashflow', label: 'Cash-flow', desc: 'Use new deposits to rebalance instead of selling' },
] as const;
const FREQUENCIES = ['monthly', 'quarterly', 'annually'] as const;

interface Props {
  goal: Goal;
  onSaved: () => Promise<void>;
}

export function RebalancingSettingsPanel({ goal, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialAlloc = goal.target_allocation ?? { us_stocks: 0.6, bonds: 0.3, cash: 0.1 };
  const [alloc, setAlloc] = useState<Record<string, number>>(
    Object.fromEntries(
      ASSET_CLASSES.map((ac) => [ac, Math.round((initialAlloc[ac] ?? 0) * 100)])
    )
  );
  const [strategy, setStrategy] = useState(goal.rebalancing_strategy ?? 'hybrid');
  const [threshold, setThreshold] = useState(Math.round((goal.rebalancing_threshold ?? 0.05) * 100));
  const [frequency, setFrequency] = useState(goal.rebalancing_frequency ?? 'quarterly');

  const total = Object.values(alloc).reduce((s, v) => s + v, 0);
  const isValid = total === 100;

  const handleSave = async () => {
    if (!isValid) {
      toast.error(`Allocations must sum to 100% (currently ${total}%)`);
      return;
    }
    setSaving(true);
    try {
      const target_allocation = Object.fromEntries(
        Object.entries(alloc).map(([k, v]) => [k, v / 100])
      );
      await api.goals.update(goal.id, {
        target_allocation,
        rebalancing_strategy: strategy,
        rebalancing_threshold: threshold / 100,
        rebalancing_frequency: frequency,
      });
      await onSaved();
      toast.success('Rebalancing settings saved');
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium hover:text-indigo-700 transition"
      >
        <Settings className="w-3.5 h-3.5" />
        Rebalancing settings
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Rebalancing Settings — {goal.goal_name}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Target allocation sliders */}
              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">Target allocation</p>
                  <span className={`text-xs font-semibold ${isValid ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {total}% / 100%
                  </span>
                </div>
                <div className="space-y-4">
                  {ASSET_CLASSES.map((ac) => (
                    <div key={ac}>
                      <div className="flex justify-between items-baseline mb-1">
                        <label className="text-sm text-gray-700">{assetLabel(ac)}</label>
                        <span className="text-sm font-semibold tabular-nums text-gray-900">{alloc[ac]}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={alloc[ac]}
                        onChange={(e) => setAlloc((a) => ({ ...a, [ac]: Number(e.target.value) }))}
                        className="w-full accent-indigo-600 h-2"
                      />
                    </div>
                  ))}
                </div>
                {!isValid && (
                  <p className="text-xs text-rose-500 mt-2">
                    Adjust sliders so total equals exactly 100%.
                  </p>
                )}
              </div>

              {/* Strategy */}
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Rebalancing strategy</p>
                <div className="grid grid-cols-2 gap-2">
                  {STRATEGIES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStrategy(s.value)}
                      className={`text-left p-3 rounded-xl border transition ${
                        strategy === s.value ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="text-xs font-semibold text-gray-900">{s.label}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Threshold */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-900">Drift threshold</p>
                  <span className="text-sm tabular-nums font-semibold text-gray-700">{threshold}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full accent-indigo-600 h-2"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Trigger a rebalance when any asset class drifts more than {threshold}% from target.
                </p>
              </div>

              {/* Frequency */}
              {(strategy === 'calendar' || strategy === 'hybrid') && (
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Check frequency</p>
                  <div className="flex gap-2">
                    {FREQUENCIES.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFrequency(f)}
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition capitalize ${
                          frequency === f ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !isValid}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-full text-sm font-semibold hover:bg-indigo-500 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save settings
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-5 py-2.5 bg-gray-100 rounded-full text-sm font-medium hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
