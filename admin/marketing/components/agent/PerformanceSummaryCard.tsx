import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

interface KPI {
  label: string;
  value: number;
  change?: number;
  unit: string;
}

interface PerformanceSummaryCardProps {
  data: {
    kpis: KPI[];
    dateRange?: { startDate: string; endDate: string };
    campaignCount?: number;
  };
}

function formatValue(value: number, unit: string): string {
  if (unit === '%') return `%${value.toLocaleString('tr-TR')}`;
  if (unit === 'TL') return `${value.toLocaleString('tr-TR')} TL`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('tr-TR');
}

const PerformanceSummaryCard: React.FC<PerformanceSummaryCardProps> = ({ data }) => {
  const { kpis, dateRange, campaignCount } = data;

  if (!kpis || kpis.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        Performans verisi bulunamadi.
      </div>
    );
  }

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-xs font-commons font-medium text-neutral-600">
          Performans Ozeti
          {dateRange && (
            <span className="text-neutral-400 ml-1">
              ({dateRange.startDate} — {dateRange.endDate})
            </span>
          )}
          {campaignCount != null && (
            <span className="text-neutral-400 ml-1">
              · {campaignCount} kampanya
            </span>
          )}
        </span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.05, 0.3) }}
            className="p-3 rounded-xl border border-neutral-150 bg-white"
          >
            <p className="text-[10px] font-commons font-medium text-neutral-400 uppercase tracking-wide mb-1">
              {kpi.label}
            </p>
            <p className="text-lg font-grotesk font-bold text-[#171717]">
              {formatValue(kpi.value, kpi.unit)}
            </p>
            {kpi.change != null && (
              <div className={`flex items-center gap-1 mt-0.5 ${kpi.change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {kpi.change >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span className="text-xs font-commons font-medium">
                  {kpi.change >= 0 ? '+' : ''}{kpi.change.toFixed(1)}%
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PerformanceSummaryCard;
