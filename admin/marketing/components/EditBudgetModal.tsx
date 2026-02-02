import React, { useState } from 'react';
import { X, Save, Loader2, Wallet } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface EditBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  currentBudget: {
    totalBudget: number;
    dailyLimit: number;
    currency: string;
    platformBreakdown: any[];
  };
  onSaved: () => void;
}

const CURRENCY_OPTIONS: { value: 'TRY' | 'USD' | 'EUR'; label: string }[] = [
  { value: 'TRY', label: 'TRY - Turk Lirasi' },
  { value: 'USD', label: 'USD - Amerikan Dolari' },
  { value: 'EUR', label: 'EUR - Euro' },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: 'TL',
  USD: '$',
  EUR: '\u20AC',
};

const EditBudgetModal: React.FC<EditBudgetModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  currentBudget,
  onSaved,
}) => {
  const [totalBudget, setTotalBudget] = useState<number>(currentBudget.totalBudget ?? 0);
  const [dailyLimit, setDailyLimit] = useState<number>(currentBudget.dailyLimit ?? 0);
  const [currency, setCurrency] = useState<'TRY' | 'USD' | 'EUR'>(
    (currentBudget.currency as 'TRY' | 'USD' | 'EUR') ?? 'TRY'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (totalBudget <= 0) {
      setError('Toplam butce sifirdan buyuk olmalidir.');
      return;
    }
    if (dailyLimit > totalBudget) {
      setError('Gunluk limit, toplam butceyi asamaz.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const campaignRef = doc(db!, 'campaigns', campaignId);
      await updateDoc(campaignRef, {
        'budget.totalBudget': totalBudget,
        'budget.dailyLimit': dailyLimit,
        'budget.currency': currency,
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Butce guncellenirken hata olustu:', err);
      setError('Kaydedilirken bir hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const symbol = CURRENCY_SYMBOLS[currency] || currency;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Wallet className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-lg font-commons font-bold text-[#171717]">
              Butceyi Duzenle
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-5">
          {/* Currency */}
          <div>
            <label className="block text-sm font-commons font-semibold text-neutral-700 mb-2">
              Para Birimi
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'TRY' | 'USD' | 'EUR')}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-white"
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Total Budget */}
          <div>
            <label className="block text-sm font-commons font-semibold text-neutral-700 mb-2">
              Toplam Butce
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={100}
                value={totalBudget}
                onChange={(e) => setTotalBudget(Number(e.target.value))}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 pr-12 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-commons text-neutral-400">
                {symbol}
              </span>
            </div>
          </div>

          {/* Daily Limit */}
          <div>
            <label className="block text-sm font-commons font-semibold text-neutral-700 mb-2">
              Gunluk Limit
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={50}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 pr-12 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-commons text-neutral-400">
                {symbol}
              </span>
            </div>
            <p className="text-xs font-commons text-neutral-400 mt-1">
              Gunluk harcama limitini belirleyin. 0 ise limit yok demektir.
            </p>
          </div>

          {/* Budget summary */}
          {totalBudget > 0 && dailyLimit > 0 && (
            <div className="bg-neutral-50 rounded-lg p-3">
              <p className="text-xs font-commons text-neutral-500">
                Tahmini sure: ~{Math.ceil(totalBudget / dailyLimit)} gun
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm font-commons text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-neutral-200 font-commons text-sm text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Iptal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg font-commons text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditBudgetModal;
