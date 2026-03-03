import React from 'react';
import { motion } from 'framer-motion';
import { Target, DollarSign, Globe, Calendar, Check, Edit3 } from 'lucide-react';
import type { StrategySummaryData, FunnelStage } from '@/shared/types/marketing';

interface StrategySummaryProps {
  data: StrategySummaryData;
  onSendMessage: (text: string) => void;
}

const FUNNEL_COLORS: Record<FunnelStage, string> = {
  tofu: 'bg-indigo-400',
  mofu: 'bg-violet-400',
  bofu: 'bg-emerald-400',
};

const FUNNEL_TEXT: Record<FunnelStage, string> = {
  tofu: 'text-indigo-700',
  mofu: 'text-violet-700',
  bofu: 'text-emerald-700',
};

const FUNNEL_LABELS: Record<FunnelStage, string> = {
  tofu: 'TOFU',
  mofu: 'MOFU',
  bofu: 'BOFU',
};

const StrategySummary: React.FC<StrategySummaryProps> = ({ data, onSendMessage }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-xl border border-neutral-200 bg-white/80 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <h3 className="font-grotesk font-bold text-[#171717]">{data.businessName}</h3>
        {data.industry && (
          <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-xs text-neutral-500 font-commons">
            {data.industry}
          </span>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-4 h-4 text-neutral-400" />
            <span className="text-xs text-neutral-500 font-commons">Birincil Hedef</span>
          </div>
          <p className="text-sm font-semibold text-[#171717] font-commons">{data.primaryGoal}</p>
        </div>

        <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-4 h-4 text-neutral-400" />
            <span className="text-xs text-neutral-500 font-commons">Toplam Butce</span>
          </div>
          <p className="text-sm font-semibold text-[#171717] font-commons">
            {data.totalBudget.toLocaleString('tr-TR')} {data.currency}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
          <div className="flex items-center gap-1.5 mb-1">
            <Globe className="w-4 h-4 text-neutral-400" />
            <span className="text-xs text-neutral-500 font-commons">Platformlar</span>
          </div>
          <p className="text-sm font-semibold text-[#171717] font-commons">
            {data.platforms?.join(', ') || '—'}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="w-4 h-4 text-neutral-400" />
            <span className="text-xs text-neutral-500 font-commons">Zaman Dilimi</span>
          </div>
          <p className="text-sm font-semibold text-[#171717] font-commons">
            {data.timeline || '—'}
          </p>
        </div>
      </div>

      {/* Funnel Summary Bar */}
      {data.funnelSummary && data.funnelSummary.length > 0 && (
        <div className="space-y-2">
          <div className="h-2.5 rounded-full overflow-hidden flex">
            {data.funnelSummary.map((segment) => (
              <div
                key={segment.stage}
                className={`${FUNNEL_COLORS[segment.stage]}`}
                style={{ width: `${segment.budgetPercent}%` }}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {data.funnelSummary.map((segment) => (
              <div key={segment.stage} className="space-y-0.5">
                <span className={`text-xs font-semibold font-commons ${FUNNEL_TEXT[segment.stage]}`}>
                  {FUNNEL_LABELS[segment.stage]} — {segment.budgetPercent}%
                </span>
                <p className="text-xs text-neutral-600 font-commons">{segment.objective}</p>
                <p className="text-xs text-neutral-400 font-commons">{segment.audienceSummary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Messages */}
      {data.keyMessages && data.keyMessages.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs text-neutral-500 font-commons">Anahtar Mesajlar</span>
          <ul className="space-y-1">
            {data.keyMessages.map((msg, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#171717] font-commons">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-neutral-300 flex-shrink-0" />
                {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => onSendMessage('Stratejiyi duzenlemek istiyorum')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 text-neutral-600 text-sm font-commons hover:bg-neutral-50 transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Duzenle
        </button>
        <button
          onClick={() => onSendMessage('Stratejiyi onayliyorum, devam edelim')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-commons hover:bg-indigo-700 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          Onayla ve Devam Et
        </button>
      </div>
    </motion.div>
  );
};

export default StrategySummary;
