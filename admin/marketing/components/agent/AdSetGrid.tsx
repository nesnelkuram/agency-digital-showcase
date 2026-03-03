import React from 'react';
import { motion } from 'framer-motion';
import { Layers, DollarSign, Target, Play, Pause, CircleDot } from 'lucide-react';

interface AdSetItem {
  id: string;
  name: string;
  status: string;
  daily_budget: number;
  lifetime_budget?: number;
  bid_strategy: string;
  optimization_goal?: string;
  targeting_summary: string;
  start_time?: string;
  end_time?: string;
}

interface AdSetGridProps {
  data: {
    adsets: AdSetItem[];
    campaignId?: string | null;
  };
  onSendMessage: (text: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  learning: 'bg-purple-100 text-purple-700',
  with_issues: 'bg-orange-100 text-orange-700',
  disapproved: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  paused: 'Duraklatildi',
  learning: 'Ogrenme',
  with_issues: 'Sorunlu',
  disapproved: 'Reddedildi',
};

const STATUS_ICONS: Record<string, React.FC<{ className?: string }>> = {
  active: Play,
  paused: Pause,
};

const GOAL_LABELS: Record<string, string> = {
  LINK_CLICKS: 'Link Tiklama',
  IMPRESSIONS: 'Gosterim',
  REACH: 'Erisim',
  OFFSITE_CONVERSIONS: 'Donusum',
  LANDING_PAGE_VIEWS: 'Sayfa Goruntulemesi',
  LEAD_GENERATION: 'Lead',
  VALUE: 'Deger',
};

const AdSetGrid: React.FC<AdSetGridProps> = ({ data, onSendMessage }) => {
  const { adsets } = data;

  if (!adsets || adsets.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        Reklam seti bulunamadi.
      </div>
    );
  }

  const activeCount = adsets.filter(a => a.status === 'active').length;

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2 px-1">
        <span className="text-xs font-commons font-medium text-neutral-500">
          <Layers className="w-3.5 h-3.5 inline mr-1" />
          {adsets.length} reklam seti
        </span>
        {activeCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-commons text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {activeCount} aktif
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
        {adsets.map((adset, i) => {
          const statusColor = STATUS_COLORS[adset.status] || 'bg-neutral-100 text-neutral-600';
          const StatusIcon = STATUS_ICONS[adset.status] || CircleDot;

          return (
            <motion.button
              key={adset.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.5) }}
              onClick={() => onSendMessage(`${adset.name} reklam seti hakkinda bilgi ver`)}
              className="flex flex-col p-3 rounded-xl border border-neutral-150 bg-white hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-sm font-commons font-semibold text-[#171717] line-clamp-1 flex-1">
                  {adset.name}
                </p>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-commons font-medium flex-shrink-0 ${statusColor}`}>
                  <StatusIcon className="w-2.5 h-2.5" />
                  {STATUS_LABELS[adset.status] || adset.status}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs font-commons text-neutral-500">
                {adset.daily_budget > 0 && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {adset.daily_budget.toLocaleString('tr-TR')} TL/gun
                  </span>
                )}
                {adset.optimization_goal && (
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {GOAL_LABELS[adset.optimization_goal] || adset.optimization_goal}
                  </span>
                )}
              </div>

              {adset.targeting_summary && (
                <p className="text-[10px] font-commons text-neutral-400 mt-1 line-clamp-1">
                  {adset.targeting_summary}
                </p>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default AdSetGrid;
