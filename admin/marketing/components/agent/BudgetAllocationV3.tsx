import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Wallet } from 'lucide-react';
import type { BudgetAllocationV3Data } from '@/shared/types/marketing';

interface BudgetAllocationV3Props {
  data: BudgetAllocationV3Data;
  onSendMessage: (text: string) => void;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: '\u20BA',
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
};

function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
}

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${getCurrencySymbol(currency)}`;
}

const BudgetAllocationV3: React.FC<BudgetAllocationV3Props> = ({ data, onSendMessage }) => {
  const { segments, totalBudget, currency, showDailyBreakdown, durationDays } = data;

  const [allocations, setAllocations] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const seg of segments) {
      initial[seg.id] = seg.suggestedPercent;
    }
    return initial;
  });

  const handleSliderChange = useCallback(
    (segmentId: string, newPercent: number) => {
      const oldPercent = allocations[segmentId];
      const diff = newPercent - oldPercent;
      const otherIds = segments.filter((s) => s.id !== segmentId).map((s) => s.id);
      const otherTotal = otherIds.reduce((sum, id) => sum + allocations[id], 0);

      const updated: Record<string, number> = { ...allocations, [segmentId]: newPercent };

      if (otherTotal > 0) {
        for (const id of otherIds) {
          const ratio = allocations[id] / otherTotal;
          const min = segments.find((s) => s.id === id)?.minPercent ?? 0;
          const max = segments.find((s) => s.id === id)?.maxPercent ?? 100;
          const raw = allocations[id] - diff * ratio;
          updated[id] = Math.min(max, Math.max(min, Math.round(raw)));
        }
      }

      // Normalize to exactly 100
      const sum = Object.values(updated).reduce((a, b) => a + b, 0);
      if (sum !== 100) {
        const correction = 100 - sum;
        // Apply correction to the largest other segment
        const sortedOthers = otherIds.sort((a, b) => updated[b] - updated[a]);
        if (sortedOthers.length > 0) {
          const targetId = sortedOthers[0];
          const min = segments.find((s) => s.id === targetId)?.minPercent ?? 0;
          const max = segments.find((s) => s.id === targetId)?.maxPercent ?? 100;
          updated[targetId] = Math.min(max, Math.max(min, updated[targetId] + correction));
        }
      }

      setAllocations(updated);
    },
    [allocations, segments]
  );

  const handleConfirm = () => {
    const parts = segments.map((s) => `${s.label} %${allocations[s.id]}`);
    const message = `Butce dagilimi: ${parts.join(', ')} (Toplam: ${totalBudget.toLocaleString('tr-TR')} ${currency})`;
    onSendMessage(message);
  };

  const total = Object.values(allocations).reduce((a, b) => a + b, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="my-3 p-4 rounded-xl border border-neutral-200 bg-white/80 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-grotesk font-semibold text-[#171717]">
          Butce Dagilimi
        </h3>
        <div className="flex items-center gap-1.5 text-sm font-grotesk font-semibold text-[#171717]">
          <Wallet className="w-4 h-4 text-indigo-500" />
          {formatCurrency(totalBudget, currency)}
        </div>
      </div>

      {/* Segmented bar */}
      <div className="h-3 rounded-full overflow-hidden flex bg-neutral-100">
        {segments.map((seg) => (
          <motion.div
            key={seg.id}
            className={`${seg.color} transition-all duration-300`}
            style={{ width: `${allocations[seg.id]}%` }}
            layout
          />
        ))}
      </div>

      {/* Segment rows */}
      <div className="space-y-4">
        {segments.map((seg, index) => {
          const percent = allocations[seg.id];
          const amount = Math.round((totalBudget * percent) / 100);
          const dailyAmount =
            showDailyBreakdown && durationDays && durationDays > 0
              ? Math.round(amount / durationDays)
              : null;

          return (
            <motion.div
              key={seg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.06 }}
              className="space-y-2"
            >
              {/* Label row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-3 h-3 rounded-full ${seg.color} flex-shrink-0`} />
                  <div className="min-w-0">
                    <span className="text-sm font-commons font-semibold text-[#171717]">
                      {seg.label}
                    </span>
                    {seg.description && (
                      <p className="text-xs font-commons text-neutral-500 truncate">
                        {seg.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="w-20 text-right text-sm font-grotesk font-semibold text-[#171717]">
                    %{percent}
                  </span>
                  <span className="w-28 text-right text-sm font-commons text-neutral-600">
                    {formatCurrency(amount, currency)}
                  </span>
                </div>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={seg.minPercent ?? 0}
                max={seg.maxPercent ?? 100}
                value={percent}
                onChange={(e) => handleSliderChange(seg.id, Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-indigo-600 bg-neutral-200"
              />

              {/* Daily breakdown */}
              {dailyAmount !== null && (
                <p className="text-xs font-commons text-neutral-400 text-right">
                  Gunluk: {formatCurrency(dailyAmount, currency)}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Total row */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
        <span className="text-sm font-commons font-medium text-neutral-500">Toplam</span>
        <div className="flex items-center gap-3">
          <span
            className={`text-sm font-grotesk font-semibold ${
              total === 100 ? 'text-emerald-600' : 'text-red-500'
            }`}
          >
            %{total}
          </span>
          <span className="w-28 text-right text-sm font-commons font-semibold text-[#171717]">
            {formatCurrency(totalBudget, currency)}
          </span>
        </div>
      </div>

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={total !== 100}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white text-sm font-commons font-medium transition-colors"
      >
        <CheckCircle className="w-4 h-4" />
        Butce Dagilimini Onayla
      </button>
    </motion.div>
  );
};

export default BudgetAllocationV3;
