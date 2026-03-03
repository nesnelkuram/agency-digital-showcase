import React from 'react';
import { Users, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface AudienceEstimateWidgetProps {
  data: {
    estimatedSize: { lower: number; upper: number };
    dailyOutcomes?: { reach?: number; impressions?: number };
    status: 'narrow' | 'optimal' | 'broad';
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('tr-TR');
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.FC<{ className?: string }>; label: string; hint: string }> = {
  narrow: {
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    icon: AlertTriangle,
    label: 'Dar Kitle',
    hint: 'Kitle cok dar. Hedeflemeyi genisletmeniz onerilir.',
  },
  optimal: {
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    icon: CheckCircle,
    label: 'Optimal Kitle',
    hint: 'Kitle buyuklugu hedefleriniz icin uygun.',
  },
  broad: {
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    icon: Info,
    label: 'Genis Kitle',
    hint: 'Kitle cok genis. Daha spesifik hedefleme performansi artirabilir.',
  },
};

const AudienceEstimateWidget: React.FC<AudienceEstimateWidgetProps> = ({ data }) => {
  const { estimatedSize, status } = data;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.optimal;
  const StatusIcon = config.icon;

  // Calculate gauge position (log scale)
  const midSize = (estimatedSize.lower + estimatedSize.upper) / 2;
  const logMin = Math.log10(1000); // 1K
  const logMax = Math.log10(1_000_000_000); // 1B
  const logMid = Math.log10(Math.max(midSize, 1000));
  const percentage = Math.min(100, Math.max(0, ((logMid - logMin) / (logMax - logMin)) * 100));

  return (
    <div className={`my-2 p-3 rounded-xl border ${config.bg}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Users className={`w-4 h-4 ${config.color}`} />
        <span className="text-sm font-commons font-semibold text-[#171717]">
          Tahmini Kitle Buyuklugu
        </span>
      </div>

      {/* Size range */}
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-2xl font-grotesk font-bold text-[#171717]">
          {formatNumber(estimatedSize.lower)}
        </span>
        <span className="text-sm font-commons text-neutral-400">—</span>
        <span className="text-2xl font-grotesk font-bold text-[#171717]">
          {formatNumber(estimatedSize.upper)}
        </span>
        <span className="text-xs font-commons text-neutral-500 ml-1">kisi</span>
      </div>

      {/* Gauge bar */}
      <div className="relative h-2 rounded-full bg-gradient-to-r from-red-300 via-yellow-300 via-emerald-300 to-blue-300 mb-2">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#171717] shadow-sm"
          style={{ left: `${percentage}%`, transform: `translate(-50%, -50%)` }}
        />
      </div>
      <div className="flex justify-between text-[9px] font-commons text-neutral-400 mb-3">
        <span>Dar (&lt;10K)</span>
        <span>10K-100K</span>
        <span>100K-10M</span>
        <span>Genis (&gt;10M)</span>
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <StatusIcon className={`w-3.5 h-3.5 ${config.color}`} />
        <span className={`text-xs font-commons font-medium ${config.color}`}>{config.label}</span>
        <span className="text-xs font-commons text-neutral-500 ml-1">— {config.hint}</span>
      </div>
    </div>
  );
};

export default AudienceEstimateWidget;
