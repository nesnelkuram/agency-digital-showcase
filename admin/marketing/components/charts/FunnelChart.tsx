import React from 'react';
import { formatCompact } from '@/shared/utils/performanceAggregator';

interface FunnelChartProps {
  impressions: number;
  clicks: number;
  conversions: number;
}

const FunnelChart: React.FC<FunnelChartProps> = ({ impressions, clicks, conversions }) => {
  const steps = [
    { label: 'Gosterim', value: impressions, color: 'bg-indigo-500', lightColor: 'bg-indigo-100' },
    { label: 'Tiklama', value: clicks, color: 'bg-violet-500', lightColor: 'bg-violet-100' },
    { label: 'Donusum', value: conversions, color: 'bg-emerald-500', lightColor: 'bg-emerald-100' },
  ];

  const maxValue = Math.max(impressions, 1);

  return (
    <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
      <h3 className="text-lg font-commons font-semibold text-[#171717] mb-4">Donusum Hunisi</h3>
      <div className="space-y-4">
        {steps.map((step, idx) => {
          const widthPercent = Math.max((step.value / maxValue) * 100, 8);
          const rate = idx > 0 ? (step.value / (steps[idx - 1].value || 1)) * 100 : 100;

          return (
            <div key={step.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-commons font-medium text-[#171717]">{step.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-commons font-bold text-[#171717]">
                    {formatCompact(step.value)}
                  </span>
                  {idx > 0 && (
                    <span className={`text-xs font-commons px-1.5 py-0.5 rounded ${
                      rate >= 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      %{rate.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              <div className={`h-8 ${step.lightColor} rounded-lg overflow-hidden`}>
                <div
                  className={`h-full ${step.color} rounded-lg transition-all duration-500`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FunnelChart;
