import React from 'react';
import { motion } from 'framer-motion';
import { Table } from 'lucide-react';

interface BreakdownRow {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
}

interface PerformanceBreakdownCardProps {
  data: {
    breakdownType: string;
    rows: BreakdownRow[];
    dateRange?: { startDate: string; endDate: string };
  };
}

const TYPE_LABELS: Record<string, string> = {
  platform: 'Platform Kirilimi',
  campaign: 'Kampanya Kirilimi',
  daily: 'Gunluk Kirilim',
};

const PerformanceBreakdownCard: React.FC<PerformanceBreakdownCardProps> = ({ data }) => {
  const { breakdownType, rows, dateRange } = data;

  if (!rows || rows.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        Kirilim verisi bulunamadi.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-2"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <Table className="w-3.5 h-3.5 text-violet-500" />
        <span className="text-xs font-commons font-medium text-neutral-600">
          {TYPE_LABELS[breakdownType] || 'Kirilim'}
          {dateRange && (
            <span className="text-neutral-400 ml-1">
              ({dateRange.startDate} — {dateRange.endDate})
            </span>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-150 bg-white">
        <table className="w-full text-xs font-commons">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-150">
              <th className="px-3 py-2 text-left text-neutral-500 font-medium">{breakdownType === 'daily' ? 'Tarih' : breakdownType === 'platform' ? 'Platform' : 'Kampanya'}</th>
              <th className="px-3 py-2 text-right text-neutral-500 font-medium">Harcama</th>
              <th className="px-3 py-2 text-right text-neutral-500 font-medium">Gosterim</th>
              <th className="px-3 py-2 text-right text-neutral-500 font-medium">Tiklama</th>
              <th className="px-3 py-2 text-right text-neutral-500 font-medium">Donusum</th>
              <th className="px-3 py-2 text-right text-neutral-500 font-medium">CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/50">
                <td className="px-3 py-2 text-[#171717] font-medium truncate max-w-[140px]">{row.label}</td>
                <td className="px-3 py-2 text-right text-neutral-600">{row.spend.toLocaleString('tr-TR')} TL</td>
                <td className="px-3 py-2 text-right text-neutral-600">{row.impressions.toLocaleString('tr-TR')}</td>
                <td className="px-3 py-2 text-right text-neutral-600">{row.clicks.toLocaleString('tr-TR')}</td>
                <td className="px-3 py-2 text-right text-neutral-600">{row.conversions.toLocaleString('tr-TR')}</td>
                <td className="px-3 py-2 text-right text-neutral-600">%{row.ctr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default PerformanceBreakdownCard;
