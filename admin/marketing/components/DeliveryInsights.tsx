import React from 'react';
import { Activity, BarChart2, Zap, TrendingUp } from 'lucide-react';
import {
  EFFECTIVE_STATUS_LABELS,
  EFFECTIVE_STATUS_COLORS,
  QUALITY_RANKING_LABELS,
  QUALITY_RANKING_COLORS,
} from '@/shared/types/marketing';

interface DeliveryInsightsProps {
  effectiveStatus?: string;
  qualityRanking?: string;
  engagementRateRanking?: string;
  conversionRateRanking?: string;
  spend?: number;
  dailyBudget?: number;
  lifetimeBudget?: number;
  frequency?: number;
  reach?: number;
  impressions?: number;
  compact?: boolean;
}

// Ranking -> progress bar genisligi (%)
const RANKING_BAR_WIDTH: Record<string, number> = {
  BELOW_AVERAGE_10: 10,
  BELOW_AVERAGE_20: 30,
  BELOW_AVERAGE_35: 50,
  AVERAGE: 70,
  ABOVE_AVERAGE: 100,
};

// Ranking -> progress bar rengi
const RANKING_BAR_COLOR: Record<string, string> = {
  BELOW_AVERAGE_10: 'bg-red-500',
  BELOW_AVERAGE_20: 'bg-red-400',
  BELOW_AVERAGE_35: 'bg-orange-400',
  AVERAGE: 'bg-yellow-400',
  ABOVE_AVERAGE: 'bg-green-500',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('tr-TR');
}

function formatCurrency(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Butce hesaplama: dailyBudget veya lifetimeBudget
function getBudget(dailyBudget?: number, lifetimeBudget?: number): number | undefined {
  if (lifetimeBudget && lifetimeBudget > 0) return lifetimeBudget;
  if (dailyBudget && dailyBudget > 0) return dailyBudget;
  return undefined;
}

function getBudgetPacingColor(percentage: number): string {
  if (percentage > 95) return 'bg-red-500';
  if (percentage >= 80) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getBudgetPacingTextColor(percentage: number): string {
  if (percentage > 95) return 'text-red-600';
  if (percentage >= 80) return 'text-yellow-600';
  return 'text-green-600';
}

const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'lg' }> = ({ status, size = 'lg' }) => {
  const label = EFFECTIVE_STATUS_LABELS[status] || status;
  const colors = EFFECTIVE_STATUS_COLORS[status] || 'bg-neutral-100 text-neutral-600';
  const sizeClass = size === 'lg'
    ? 'px-3 py-1 text-sm font-medium'
    : 'px-2 py-0.5 text-xs font-medium';

  return (
    <span className={`inline-flex items-center rounded-full font-commons ${colors} ${sizeClass}`}>
      {label}
    </span>
  );
};

const QualityBar: React.FC<{ label: string; ranking?: string }> = ({ label, ranking }) => {
  if (!ranking) return null;

  const width = RANKING_BAR_WIDTH[ranking] ?? 50;
  const barColor = RANKING_BAR_COLOR[ranking] ?? 'bg-neutral-300';
  const textColor = QUALITY_RANKING_COLORS[ranking] ?? 'text-neutral-500';
  const rankLabel = QUALITY_RANKING_LABELS[ranking] ?? ranking;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-commons text-neutral-600">{label}</span>
        <span className={`text-xs font-commons font-medium ${textColor}`}>{rankLabel}</span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
};

const DeliveryInsights: React.FC<DeliveryInsightsProps> = ({
  effectiveStatus,
  qualityRanking,
  engagementRateRanking,
  conversionRateRanking,
  spend,
  dailyBudget,
  lifetimeBudget,
  frequency,
  reach,
  impressions,
  compact = false,
}) => {
  // Hicbir veri yoksa bos mesaj goster
  const hasAnyData =
    effectiveStatus !== undefined ||
    qualityRanking !== undefined ||
    engagementRateRanking !== undefined ||
    conversionRateRanking !== undefined ||
    spend !== undefined ||
    dailyBudget !== undefined ||
    lifetimeBudget !== undefined ||
    frequency !== undefined ||
    reach !== undefined ||
    impressions !== undefined;

  if (!hasAnyData) {
    return (
      <p className="text-xs font-commons text-neutral-400 italic">
        Teslimat bilgisi henuz mevcut degil
      </p>
    );
  }

  const budget = getBudget(dailyBudget, lifetimeBudget);
  const spendPercentage = budget && spend != null ? Math.min((spend / budget) * 100, 100) : undefined;
  const hasQualityData = qualityRanking || engagementRateRanking || conversionRateRanking;

  // ---- Compact mod: tek satir ozet ----
  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {effectiveStatus && <StatusBadge status={effectiveStatus} size="sm" />}

        {spend != null && budget && (
          <span className="text-xs font-commons text-neutral-600">
            {formatCurrency(spend)} / {formatCurrency(budget)} TL
          </span>
        )}

        {frequency != null && (
          <span className="text-xs font-commons text-neutral-500">
            {frequency.toFixed(1)}x frekans
          </span>
        )}
      </div>
    );
  }

  // ---- Full mod ----
  return (
    <div className="bg-white rounded-xl border border-neutral-200/50 p-4 space-y-4">
      {/* Effective Status Badge */}
      {effectiveStatus && (
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-neutral-400" />
          <StatusBadge status={effectiveStatus} size="lg" />
        </div>
      )}

      {/* Quality Rankings */}
      {hasQualityData && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-neutral-400" />
            <span className="text-xs font-commons font-semibold text-neutral-700">
              Kalite Siralamasi
            </span>
          </div>
          <div className="space-y-2">
            <QualityBar label="Kalite Puani" ranking={qualityRanking} />
            <QualityBar label="Etkilesim Puani" ranking={engagementRateRanking} />
            <QualityBar label="Donusum Puani" ranking={conversionRateRanking} />
          </div>
        </div>
      )}

      {/* Budget Pacing */}
      {spend != null && budget && spendPercentage != null && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-neutral-400" />
            <span className="text-xs font-commons font-semibold text-neutral-700">
              Butce Kullanimi
            </span>
          </div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBudgetPacingColor(spendPercentage)}`}
              style={{ width: `${spendPercentage}%` }}
            />
          </div>
          <p className={`text-xs font-commons ${getBudgetPacingTextColor(spendPercentage)}`}>
            {formatCurrency(spend)} / {formatCurrency(budget)} TL harcandi (%{spendPercentage.toFixed(1)})
          </p>
        </div>
      )}

      {/* Frequency & Reach */}
      {(frequency != null || reach != null) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-neutral-400" />
            <span className="text-xs font-commons font-semibold text-neutral-700">
              Erisim & Frekans
            </span>
          </div>
          <div className="space-y-1">
            {frequency != null && (
              <p className="text-xs font-commons text-neutral-600">
                Kisi basina ort. <span className="font-medium text-neutral-800">{frequency.toFixed(2)}</span> kez gosterildi
              </p>
            )}
            {reach != null && (
              <p className="text-xs font-commons text-neutral-600">
                Toplam <span className="font-medium text-neutral-800">{formatNumber(reach)}</span> kisiye ulasildi
              </p>
            )}
            {impressions != null && (
              <p className="text-xs font-commons text-neutral-600">
                Toplam <span className="font-medium text-neutral-800">{formatNumber(impressions)}</span> gosterim
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryInsights;
