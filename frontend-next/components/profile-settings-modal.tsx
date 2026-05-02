'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, User } from 'lucide-react';
import { api } from '@/lib/api';
import type { UserProfile } from '@/lib/api';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  email: string;
}

const RISK_TOLERANCE_OPTIONS = [
  { value: 'conservative', label: 'Conservative', desc: 'Prefer stability, okay with lower returns' },
  { value: 'moderate', label: 'Moderate', desc: 'Balanced approach, some ups and downs are fine' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Maximise growth, comfortable with volatility' },
] as const;

const RISK_CAPACITY_OPTIONS = [
  { value: 'low', label: 'Low', desc: 'Short timeline or unstable income' },
  { value: 'medium', label: 'Medium', desc: 'Stable income, some emergency savings' },
  { value: 'high', label: 'High', desc: 'Long horizon, stable income, solid safety net' },
] as const;

export function ProfileSettingsModal({ open, onClose, email }: Props) {
  const [profile, setProfile] = useState<UserProfile>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.user.profile()
      .then((p) => setProfile(p))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.user.updateProfile({
        full_name: profile.full_name ?? undefined,
        risk_tolerance: profile.risk_tolerance ?? undefined,
        risk_capacity: profile.risk_capacity ?? undefined,
      });
      toast.success('Profile saved');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Profile & Settings</h2>
              <p className="text-xs text-gray-500">{email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Name */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Full name</label>
              <input
                type="text"
                value={profile.full_name ?? ''}
                onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="Your name"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>

            {/* Risk tolerance */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Risk tolerance
                <span className="ml-1 text-xs text-gray-400 font-normal">— how you feel about losing money</span>
              </label>
              <div className="space-y-2">
                {RISK_TOLERANCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, risk_tolerance: opt.value }))}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      profile.risk_tolerance === opt.value
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Risk capacity */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Risk capacity
                <span className="ml-1 text-xs text-gray-400 font-normal">— financial ability to handle losses</span>
              </label>
              <div className="space-y-2">
                {RISK_CAPACITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, risk_capacity: opt.value }))}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      profile.risk_capacity === opt.value
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              This information is used to personalise your rebalancing recommendations and AI advisor responses. It is never shared externally.
            </p>
          </div>
        )}

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-full text-sm font-semibold hover:bg-indigo-500 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save changes
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-100 rounded-full text-sm font-medium hover:bg-gray-200 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
