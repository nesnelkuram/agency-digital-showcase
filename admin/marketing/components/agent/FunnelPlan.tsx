import React from 'react';
import { motion } from 'framer-motion';
import {
  Eye,
  MousePointerClick,
  ShoppingCart,
  CheckCircle,
  Edit3,
  Lightbulb,
  TrendingUp,
} from 'lucide-react';
import type { FunnelPlanData, FunnelStage } from '@/shared/types/marketing';

interface FunnelPlanProps {
  data: FunnelPlanData;
  onSendMessage: (text: string) => void;
}

const STAGE_COLORS: Record<FunnelStage, { bg: string; text: string; border: string; icon: string }> = {
  tofu: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', icon: 'text-indigo-500' },
  mofu: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', icon: 'text-violet-500' },
  bofu: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'text-emerald-500' },
};

const STAGE_LABELS: Record<FunnelStage, string> = {
  tofu: 'TOFU — Farkindalik',
  mofu: 'MOFU — Degerlendirme',
  bofu: 'BOFU — Donusum',
};

const STAGE_ICONS: Record<FunnelStage, React.FC<{ className?: string }>> = {
  tofu: Eye,
  mofu: MousePointerClick,
  bofu: ShoppingCart,
};

const KPI_LABELS: Record<string, string> = {
  impressions: 'Gosterim',
  clicks: 'Tiklama',
  conversions: 'Donusum',
  cpa: 'CPA',
  roas: 'ROAS',
};

const FUNNEL_WIDTHS: Record<FunnelStage, string> = {
  tofu: 'max-w-full',
  mofu: 'max-w-[95%]',
  bofu: 'max-w-[88%]',
};

function formatNumber(value: number, key: string): string {
  if (key === 'roas') {
    return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}x`;
  }
  if (key === 'cpa') {
    return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺`;
  }
  return value.toLocaleString('tr-TR');
}

const FunnelPlan: React.FC<FunnelPlanProps> = ({ data, onSendMessage }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="my-3 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-grotesk font-semibold text-[#171717]">
            {data.businessName}
          </h3>
          <p className="text-sm font-commons text-neutral-500 mt-0.5">
            Huni Plani
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 text-sm font-grotesk font-semibold text-[#171717]">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            {data.totalBudget.toLocaleString('tr-TR')} {data.currency}
          </div>
          <p className="text-xs font-commons text-neutral-400 mt-0.5">Toplam Butce</p>
        </div>
      </div>

      {/* Funnel Stages */}
      <div className="space-y-3 flex flex-col items-center">
        {data.funnel.map((stagePlan, index) => {
          const colors = STAGE_COLORS[stagePlan.stage];
          const Icon = STAGE_ICONS[stagePlan.stage];
          const widthClass = FUNNEL_WIDTHS[stagePlan.stage];
          const kpiEntries = Object.entries(stagePlan.targetKPIs).filter(
            ([, v]) => v !== undefined && v !== null
          ) as [string, number][];

          return (
            <motion.div
              key={stagePlan.stage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`w-full ${widthClass} rounded-xl border ${colors.border} ${colors.bg} border-l-4 p-4`}
            >
              {/* Stage Header */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors.bg}`}>
                  <Icon className={`w-4 h-4 ${colors.icon}`} />
                </div>
                <span className={`text-xs font-commons font-semibold uppercase tracking-wide ${colors.text}`}>
                  {STAGE_LABELS[stagePlan.stage]}
                </span>
              </div>

              {/* Objective */}
              <p className="text-sm font-commons text-[#171717] mb-2">
                {stagePlan.objective}
              </p>

              {/* Budget */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-commons font-medium text-neutral-500">Butce:</span>
                <span className={`text-sm font-grotesk font-semibold ${colors.text}`}>
                  {stagePlan.budgetAmount.toLocaleString('tr-TR')} ₺
                </span>
                <span className="text-xs font-commons text-neutral-400">
                  (%{stagePlan.budgetPercent})
                </span>
              </div>

              {/* Target KPIs */}
              {kpiEntries.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {kpiEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-white/60 rounded-lg px-2.5 py-1.5 border border-white/80"
                    >
                      <p className="text-[10px] font-commons text-neutral-400 uppercase tracking-wide">
                        {KPI_LABELS[key] || key}
                      </p>
                      <p className="text-sm font-grotesk font-semibold text-[#171717]">
                        {formatNumber(value, key)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Audience Summary */}
              <div className="mb-2">
                <span className="text-xs font-commons font-medium text-neutral-500">Hedef Kitle: </span>
                <span className="text-xs font-commons text-[#171717]">
                  {stagePlan.audienceSummary}
                </span>
              </div>

              {/* Creative Suggestion */}
              <div>
                <span className="text-xs font-commons font-medium text-neutral-500">Kreatif Onerisi: </span>
                <span className="text-xs font-commons text-[#171717]">
                  {stagePlan.creativeSuggestion}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-commons font-semibold uppercase tracking-wide text-amber-700">
              Oneriler
            </span>
          </div>
          <ul className="space-y-1.5">
            {data.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-xs font-commons text-[#171717]">
                <span className="text-amber-400 mt-0.5">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSendMessage('Huni planini onayliyorum')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-commons font-medium transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          Onayla
        </button>
        <button
          onClick={() => onSendMessage('Huni planini duzenlemek istiyorum')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-sm font-commons font-medium transition-colors"
        >
          <Edit3 className="w-4 h-4" />
          Duzenle
        </button>
      </div>
    </motion.div>
  );
};

export default FunnelPlan;
