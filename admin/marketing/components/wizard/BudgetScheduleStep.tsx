import React, { useMemo } from 'react';
import { AdPlatform, PLATFORM_LABELS } from '@/shared/types/marketing';

interface BudgetScheduleStepProps {
  data: {
    totalBudget: number;
    dailyLimit: number;
    currency: 'TRY' | 'USD' | 'EUR';
    platformSplit: Record<string, number>;
    startDate: string;
    endDate: string;
  };
  platforms: AdPlatform[];
  onChange: (field: string, value: any) => void;
  isAIFilled?: boolean;
}

export default function BudgetScheduleStep({
  data,
  platforms,
  onChange,
  isAIFilled
}: BudgetScheduleStepProps) {
  const totalPercentage = useMemo(() => {
    return Object.values(data.platformSplit || {}).reduce((sum, val) => sum + val, 0);
  }, [data.platformSplit]);

  const handlePlatformSplitChange = (platform: string, value: number) => {
    const newSplit = { ...data.platformSplit, [platform]: value };
    onChange('platformSplit', newSplit);
  };

  const distributeBudgetEvenly = () => {
    const evenSplit = Math.floor(100 / platforms.length);
    const remainder = 100 - (evenSplit * platforms.length);
    const newSplit: Record<string, number> = {};

    platforms.forEach((platform, index) => {
      newSplit[platform] = evenSplit + (index === 0 ? remainder : 0);
    });

    onChange('platformSplit', newSplit);
  };

  return (
    <div className="space-y-6">
      {isAIFilled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-commons text-blue-800">
            AI tarafından önerilen bütçe. İhtiyaçlarınıza göre ayarlayın.
          </p>
        </div>
      )}

      {/* Total Budget */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6 space-y-4">
        <h3 className="text-base font-commons font-semibold text-[#171717] mb-4">
          Bütçe
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
              Toplam Bütçe
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={data.totalBudget || ''}
                onChange={(e) => onChange('totalBudget', parseFloat(e.target.value) || 0)}
                className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                placeholder="0"
                min="0"
                step="100"
              />
              <select
                value={data.currency}
                onChange={(e) => onChange('currency', e.target.value)}
                className="border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400 bg-white"
              >
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
              Günlük Limit
            </label>
            <input
              type="number"
              value={data.dailyLimit || ''}
              onChange={(e) => onChange('dailyLimit', parseFloat(e.target.value) || 0)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
              placeholder="0"
              min="0"
              step="10"
            />
          </div>
        </div>
      </div>

      {/* Platform Split */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-commons font-semibold text-[#171717]">
              Platform Dağılımı
            </h3>
            <p className="text-xs font-commons text-neutral-500 mt-1">
              Toplam: {totalPercentage.toFixed(0)}% {totalPercentage !== 100 && (
                <span className="text-amber-600">(100% olmalı)</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={distributeBudgetEvenly}
            className="bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 font-commons text-xs px-3 py-1.5"
          >
            Eşit Dağıt
          </button>
        </div>

        <div className="space-y-4">
          {platforms.map((platform) => {
            const percentage = data.platformSplit?.[platform] || 0;
            const amount = (data.totalBudget * percentage) / 100;

            return (
              <div key={platform} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-commons font-medium text-[#171717]">
                    {PLATFORM_LABELS[platform]}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-commons text-neutral-500">
                      {amount.toFixed(2)} {data.currency}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={percentage}
                        onChange={(e) => handlePlatformSplitChange(platform, parseFloat(e.target.value) || 0)}
                        className="w-16 border border-neutral-200 rounded px-2 py-1 font-commons text-sm text-right focus:outline-none focus:border-indigo-400"
                        min="0"
                        max="100"
                        step="1"
                      />
                      <span className="text-sm font-commons text-neutral-600">%</span>
                    </div>
                  </div>
                </div>
                <input
                  type="range"
                  value={percentage}
                  onChange={(e) => handlePlatformSplitChange(platform, parseFloat(e.target.value))}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  min="0"
                  max="100"
                  step="1"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6 space-y-4">
        <h3 className="text-base font-commons font-semibold text-[#171717] mb-4">
          Zamanlama
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={data.startDate || ''}
              onChange={(e) => onChange('startDate', e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
              Bitiş Tarihi
              <span className="text-neutral-400 font-normal ml-1">(opsiyonel)</span>
            </label>
            <input
              type="date"
              value={data.endDate || ''}
              onChange={(e) => onChange('endDate', e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
              min={data.startDate}
            />
          </div>
        </div>

        {data.startDate && !data.endDate && (
          <p className="text-xs font-commons text-neutral-500 bg-neutral-50 p-3 rounded-lg">
            Bitiş tarihi belirtilmediği için kampanya süresiz olarak çalışacaktır.
          </p>
        )}
      </div>
    </div>
  );
}
