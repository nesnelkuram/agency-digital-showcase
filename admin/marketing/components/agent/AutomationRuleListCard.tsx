import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Play, Pause, Archive } from 'lucide-react';

interface AutomationRule {
  id: string;
  name: string;
  status: string;
  conditionSummary: string;
  action: { type: string; value?: number; notifyEmail?: boolean };
  frequency: string;
  totalExecutions: number;
  totalTriggered: number;
  lastExecutedAt?: any;
}

interface AutomationRuleListCardProps {
  data: {
    rules: AutomationRule[];
    totalCount: number;
  };
  onSendMessage?: (text: string) => void;
}

const STATUS_BADGES: Record<string, { color: string; label: string; Icon: React.FC<{ className?: string }> }> = {
  active: { color: 'bg-emerald-100 text-emerald-700', label: 'Aktif', Icon: Play },
  paused: { color: 'bg-yellow-100 text-yellow-700', label: 'Duraklatildi', Icon: Pause },
  archived: { color: 'bg-neutral-100 text-neutral-500', label: 'Arsiv', Icon: Archive },
};

const FREQ_LABELS: Record<string, string> = {
  hourly: 'Saatlik',
  every_6h: '6 Saatte Bir',
  daily: 'Gunluk',
  weekly: 'Haftalik',
};

const ACTION_LABELS: Record<string, string> = {
  pause_adset: 'Reklam Setini Duraklat',
  pause_campaign: 'Kampanyayi Duraklat',
  increase_budget: 'Butce Artir',
  decrease_budget: 'Butce Azalt',
  send_alert: 'Uyari Gonder',
  change_bid: 'Teklif Degistir',
};

const AutomationRuleListCard: React.FC<AutomationRuleListCardProps> = ({ data, onSendMessage }) => {
  const { rules } = data;

  if (!rules || rules.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        Henuz otomasyon kurali bulunmuyor.
      </div>
    );
  }

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <Zap className="w-3.5 h-3.5 text-yellow-500" />
        <span className="text-xs font-commons font-medium text-neutral-600">
          Otomasyon Kurallari
          <span className="text-neutral-400 ml-1">({rules.length})</span>
        </span>
      </div>

      {/* Rules */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {rules.map((rule, i) => {
          const statusInfo = STATUS_BADGES[rule.status] || STATUS_BADGES.active;
          const StatusIcon = statusInfo.Icon;

          return (
            <motion.button
              key={rule.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
              onClick={() => onSendMessage?.(`${rule.name} kuralinin detaylarini ve gecmisini goster`)}
              className="w-full p-3 rounded-xl border border-neutral-150 bg-white hover:border-indigo-300 hover:shadow-sm transition-all text-left"
            >
              {/* Name + Status */}
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-commons font-semibold text-[#171717] line-clamp-1">
                  {rule.name}
                </p>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-commons font-medium flex-shrink-0 ${statusInfo.color}`}>
                  <StatusIcon className="w-2.5 h-2.5" />
                  {statusInfo.label}
                </span>
              </div>

              {/* Condition summary */}
              <p className="text-xs font-commons text-neutral-500 mb-1.5 line-clamp-1">
                Kosul: {rule.conditionSummary}
              </p>

              {/* Action + Frequency + Stats */}
              <div className="flex items-center gap-3 text-[10px] font-commons text-neutral-400">
                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                  {ACTION_LABELS[rule.action?.type] || rule.action?.type}
                </span>
                <span>{FREQ_LABELS[rule.frequency] || rule.frequency}</span>
                <span>{rule.totalTriggered}/{rule.totalExecutions} tetiklendi</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default AutomationRuleListCard;
