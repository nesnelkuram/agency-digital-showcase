import React from 'react';
import { motion } from 'framer-motion';

interface PerformanceData {
  impressions?: string | number;
  reach?: string | number;
  clicks?: string | number;
  ctr?: string | number;
  cpc?: string | number;
  cpm?: string | number;
  spend?: string | number;
  frequency?: string | number;
  conversions?: string | number;
  unique_clicks?: string | number;
}

interface PerformanceWidgetProps {
  data: PerformanceData;
  datePreset?: string;
}

const DATE_PRESET_LABELS: Record<string, string> = {
  last_7d: 'Son 7 Gun',
  last_30d: 'Son 30 Gun',
  last_90d: 'Son 90 Gun',
};

function formatMetric(value: string | number | undefined, type: 'number' | 'percent' | 'currency' = 'number'): string {
  if (value == null) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';

  switch (type) {
    case 'percent':
      return `${num.toFixed(2)}%`;
    case 'currency':
      return `${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
    default:
      return num.toLocaleString('tr-TR');
  }
}

const METRICS: Array<{ key: keyof PerformanceData; label: string; type: 'number' | 'percent' | 'currency' }> = [
  { key: 'impressions', label: 'Gosterim', type: 'number' },
  { key: 'reach', label: 'Erisim', type: 'number' },
  { key: 'clicks', label: 'Tiklama', type: 'number' },
  { key: 'ctr', label: 'CTR', type: 'percent' },
  { key: 'spend', label: 'Harcama', type: 'currency' },
  { key: 'cpc', label: 'CPC', type: 'currency' },
  { key: 'cpm', label: 'CPM', type: 'currency' },
  { key: 'frequency', label: 'Frekans', type: 'number' },
];

const PerformanceWidget: React.FC<PerformanceWidgetProps> = ({ data, datePreset }) => {
  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-2 rounded-xl border border-neutral-150 bg-white overflow-hidden"
    >
      {datePreset && (
        <div className="px-3 py-1.5 bg-neutral-50 border-b border-neutral-100">
          <span className="text-[10px] font-commons font-medium text-neutral-400 uppercase tracking-wide">
            {DATE_PRESET_LABELS[datePreset] || datePreset}
          </span>
        </div>
      )}
      <div className="grid grid-cols-4 gap-px bg-neutral-100">
        {METRICS.map((m) => (
          <div key={m.key} className="bg-white p-2.5">
            <p className="text-[10px] font-commons text-neutral-400 uppercase tracking-wide mb-0.5">
              {m.label}
            </p>
            <p className="text-sm font-commons font-bold text-[#171717]">
              {formatMetric(data[m.key], m.type)}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default PerformanceWidget;
