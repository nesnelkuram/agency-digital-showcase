import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Play, Pause, Archive } from 'lucide-react';

interface RuleCondition {
  metric: string;
  operator: string;
  value: number;
  value2?: number;
  timeWindow?: string;
}

interface AutomationRuleCardProps {
  data: {
    id: string;
    name: string;
    status: string;
    conditions: RuleCondition[];
    conditionLogic: string;
    action: { type: string; value?: number; notifyEmail?: boolean };
    frequency: string;
    totalExecutions: number;
    totalTriggered: number;
  };
}

const STATUS_BADGES: Record<string, { color: string; label: string; Icon: React.FC<{ className?: string }> }> = {
  active: { color: 'bg-emerald-100 text-emerald-700', label: 'Aktif', Icon: Play },
  paused: { color: 'bg-yellow-100 text-yellow-700', label: 'Duraklatildi', Icon: Pause },
  archived: { color: 'bg-neutral-100 text-neutral-500', label: 'Arsiv', Icon: Archive },
};

const METRIC_LABELS: Record<string, string> = {
  ctr: 'CTR', cpc: 'CPC', cpa: 'CPA', roas: 'ROAS',
  spend: 'Harcama', impressions: 'Gosterim',
  conversions: 'Donusum', frequency: 'Frekans', quality_score: 'Kalite Skoru',
};

const OPERATOR_LABELS: Record<string, string> = {
  greater_than: '>', less_than: '<', equals: '=', between: 'arasi',
};

const ACTION_LABELS: Record<string, string> = {
  pause_adset: 'Reklam Setini Duraklat',
  pause_campaign: 'Kampanyayi Duraklat',
  increase_budget: 'Butce Artir',
  decrease_budget: 'Butce Azalt',
  send_alert: 'Uyari Gonder',
  change_bid: 'Teklif Degistir',
};

const FREQ_LABELS: Record<string, string> = {
  hourly: 'Saatlik', every_6h: '6 Saatte Bir', daily: 'Gunluk', weekly: 'Haftalik',
};

const WINDOW_LABELS: Record<string, string> = {
  last_24h: 'Son 24 saat', last_3d: 'Son 3 gun', last_7d: 'Son 7 gun', last_30d: 'Son 30 gun',
};

const AutomationRuleCard: React.FC<AutomationRuleCardProps> = ({ data }) => {
  const statusInfo = STATUS_BADGES[data.status] || STATUS_BADGES.active;
  const StatusIcon = statusInfo.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-2 p-3 rounded-xl border border-neutral-150 bg-white"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-yellow-500" />
          <span className="text-sm font-commons font-semibold text-[#171717]">{data.name}</span>
        </div>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-commons font-medium ${statusInfo.color}`}>
          <StatusIcon className="w-2.5 h-2.5" />
          {statusInfo.label}
        </span>
      </div>

      {/* Conditions */}
      <div className="mb-2">
        <p className="text-[10px] font-commons font-medium text-neutral-400 uppercase mb-1">
          Kosullar ({data.conditionLogic === 'or' ? 'VEYA' : 'VE'})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {data.conditions.map((cond, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-50 border border-neutral-100 text-xs font-commons text-neutral-600"
            >
              {METRIC_LABELS[cond.metric] || cond.metric}{' '}
              {OPERATOR_LABELS[cond.operator] || cond.operator}{' '}
              {cond.operator === 'between' ? `${cond.value}–${cond.value2}` : cond.value}
              {cond.timeWindow && (
                <span className="text-neutral-400 ml-0.5">
                  ({WINDOW_LABELS[cond.timeWindow] || cond.timeWindow})
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Action */}
      <div className="mb-2">
        <p className="text-[10px] font-commons font-medium text-neutral-400 uppercase mb-1">Aksiyon</p>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-xs font-commons text-indigo-700 font-medium">
          {ACTION_LABELS[data.action?.type] || data.action?.type}
          {data.action?.value != null && <span>(%{data.action.value})</span>}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 pt-2 border-t border-neutral-100 text-[10px] font-commons text-neutral-400">
        <span>Frekans: {FREQ_LABELS[data.frequency] || data.frequency}</span>
        <span>{data.totalTriggered}/{data.totalExecutions} tetiklendi</span>
      </div>
    </motion.div>
  );
};

export default AutomationRuleCard;
