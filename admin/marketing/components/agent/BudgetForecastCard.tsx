import React from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';

interface BudgetForecastCardProps {
  data: {
    campaignName?: string;
    projectedDepletionDate?: string;
    daysRemaining?: number;
    dailySpendRate?: number;
    weeklyTrend?: 'increasing' | 'stable' | 'decreasing';
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    confidence?: number;
    recommendations?: string[];
    error?: string;
  };
}

const RISK_BADGES: Record<string, { color: string; label: string; Icon: React.FC<{ className?: string }> }> = {
  low: { color: 'bg-emerald-100 text-emerald-700', label: 'Dusuk Risk', Icon: CheckCircle },
  medium: { color: 'bg-amber-100 text-amber-700', label: 'Orta Risk', Icon: AlertTriangle },
  high: { color: 'bg-orange-100 text-orange-700', label: 'Yuksek Risk', Icon: AlertTriangle },
  critical: { color: 'bg-red-100 text-red-700', label: 'Kritik', Icon: AlertTriangle },
};

const TREND_LABELS: Record<string, string> = {
  increasing: 'Artiyor',
  stable: 'Stabil',
  decreasing: 'Azaliyor',
};

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

const BudgetForecastCard: React.FC<BudgetForecastCardProps> = ({ data }) => {
  if (data.error) {
    return (
      <div className="my-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm font-commons text-red-700">
        {data.error}
      </div>
    );
  }

  const risk = RISK_BADGES[data.riskLevel || 'medium'] || RISK_BADGES.medium;
  const RiskIcon = risk.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-2"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <TrendingDown className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-xs font-commons font-medium text-neutral-600">
          Butce Tahmini
          {data.campaignName && <span className="text-neutral-400 ml-1">— {data.campaignName}</span>}
        </span>
      </div>

      <div className="p-3 rounded-xl border border-neutral-150 bg-white space-y-3">
        {/* Status + Risk Badge */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-commons font-medium ${risk.color}`}>
            <RiskIcon className="w-3 h-3" />
            {risk.label}
          </span>
          {data.weeklyTrend && (
            <span className="text-xs font-commons text-neutral-500">
              Haftalik trend: {TREND_LABELS[data.weeklyTrend] || data.weeklyTrend}
            </span>
          )}
          {data.confidence != null && (
            <span className="text-[10px] font-commons text-neutral-400 ml-auto">
              Guven: %{(data.confidence * 100).toFixed(0)}
            </span>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] font-commons text-neutral-400 uppercase">Gunluk Harcama</p>
            <p className="text-sm font-grotesk font-bold text-[#171717]">
              {data.dailySpendRate?.toLocaleString('tr-TR') || '-'} TL
            </p>
          </div>
          <div>
            <p className="text-[10px] font-commons text-neutral-400 uppercase">Kalan Gun</p>
            <p className="text-sm font-grotesk font-bold text-[#171717]">
              {data.daysRemaining ?? '-'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-commons text-neutral-400 uppercase">Tahmini Bitis</p>
            <p className="text-sm font-commons font-medium text-[#171717] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-neutral-400" />
              {formatDate(data.projectedDepletionDate)}
            </p>
          </div>
        </div>

        {/* Recommendations */}
        {data.recommendations && data.recommendations.length > 0 && (
          <div className="pt-2 border-t border-neutral-100">
            <p className="text-[10px] font-commons font-medium text-neutral-400 uppercase mb-1">Oneriler</p>
            <ul className="space-y-1">
              {data.recommendations.map((rec, i) => (
                <li key={i} className="text-xs font-commons text-neutral-600 flex items-start gap-1.5">
                  <span className="text-indigo-400 mt-0.5">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default BudgetForecastCard;
