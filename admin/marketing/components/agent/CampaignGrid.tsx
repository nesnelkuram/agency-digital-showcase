import React from 'react';
import { motion } from 'framer-motion';
import { Target, DollarSign, TrendingUp, Pause, Play, CircleDot, AlertTriangle, Archive, Clock } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  effectiveStatus?: string;
  configuredStatus?: string;
  objective?: string;
  platforms?: string[];
  budget?: { totalBudget?: number; dailyLimit?: number; currency?: string };
  dailyBudget?: number;
  lifetimeBudget?: number;
  platformCampaignIds?: Record<string, string>;
  startDate?: string;
  endDate?: string;
  issuesInfo?: Array<{ level: string; error_summary: string }>;
}

interface CampaignGridProps {
  campaigns: Campaign[];
  onSelect: (campaign: Campaign) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  draft: 'bg-neutral-100 text-neutral-600',
  completed: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  issues: 'bg-orange-100 text-orange-700',
  disapproved: 'bg-red-100 text-red-700',
  pending_review: 'bg-amber-100 text-amber-700',
  archived: 'bg-neutral-100 text-neutral-500',
  unknown: 'bg-neutral-100 text-neutral-500',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  paused: 'Duraklatildi',
  draft: 'Taslak',
  completed: 'Tamamlandi',
  failed: 'Basarisiz',
  issues: 'Sorunlu',
  disapproved: 'Reddedildi',
  pending_review: 'Incelemede',
  archived: 'Arsivlendi',
  unknown: 'Bilinmiyor',
};

const STATUS_ICONS: Record<string, React.FC<{ className?: string }>> = {
  active: Play,
  paused: Pause,
  draft: CircleDot,
  issues: AlertTriangle,
  disapproved: AlertTriangle,
  pending_review: Clock,
  archived: Archive,
  completed: Clock,
};

const OBJECTIVE_LABELS: Record<string, string> = {
  awareness: 'Farkindalik',
  traffic: 'Trafik',
  engagement: 'Etkilesim',
  leads: 'Potansiyel Musteri',
  sales: 'Satis',
  app_installs: 'Uygulama',
  video_views: 'Video',
  conversions: 'Donusum',
  reach: 'Erisim',
  brand_awareness: 'Marka Bilinirlik',
  link_clicks: 'Link Tiklama',
  // Meta objective values (uppercase/camel)
  OUTCOME_AWARENESS: 'Farkindalik',
  OUTCOME_ENGAGEMENT: 'Etkilesim',
  OUTCOME_LEADS: 'Potansiyel Musteri',
  OUTCOME_SALES: 'Satis',
  OUTCOME_TRAFFIC: 'Trafik',
  OUTCOME_APP_PROMOTION: 'Uygulama',
};

const CampaignGrid: React.FC<CampaignGridProps> = ({ campaigns, onSelect }) => {
  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        Kampanya bulunamadi.
      </div>
    );
  }

  const activeCount = campaigns.filter(c => c.status === 'active').length;
  const pausedCount = campaigns.filter(c => c.status === 'paused').length;
  const draftCount = campaigns.filter(c => c.status === 'draft').length;
  const issuesCount = campaigns.filter(c => c.status === 'issues').length;

  // Helper to get budget display
  const getBudgetDisplay = (c: Campaign) => {
    // Try dailyBudget first (from Meta, in cents → divide by 100)
    if (c.dailyBudget && c.dailyBudget > 0) {
      const val = c.dailyBudget >= 100 ? c.dailyBudget / 100 : c.dailyBudget;
      return { label: `${val.toLocaleString('tr-TR')} TL/gun`, icon: DollarSign };
    }
    if (c.lifetimeBudget && c.lifetimeBudget > 0) {
      const val = c.lifetimeBudget >= 100 ? c.lifetimeBudget / 100 : c.lifetimeBudget;
      return { label: `${val.toLocaleString('tr-TR')} TL toplam`, icon: TrendingUp };
    }
    if (c.budget?.dailyLimit && c.budget.dailyLimit > 0) {
      return { label: `${c.budget.dailyLimit.toLocaleString('tr-TR')} TL/gun`, icon: DollarSign };
    }
    if (c.budget?.totalBudget && c.budget.totalBudget > 0) {
      return { label: `${c.budget.totalBudget.toLocaleString('tr-TR')} TL`, icon: TrendingUp };
    }
    return null;
  };

  return (
    <div className="my-2">
      {/* Summary bar */}
      <div className="flex items-center gap-3 mb-2 px-1 flex-wrap">
        <span className="text-xs font-commons font-medium text-neutral-500">
          {campaigns.length} kampanya
        </span>
        {activeCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-commons text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {activeCount} aktif
          </span>
        )}
        {pausedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-commons text-yellow-600">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            {pausedCount} duraklatildi
          </span>
        )}
        {draftCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-commons text-neutral-500">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
            {draftCount} taslak
          </span>
        )}
        {issuesCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-commons text-orange-600">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            {issuesCount} sorunlu
          </span>
        )}
      </div>

      {/* Campaign cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
        {campaigns.map((campaign, i) => {
          const statusColor = STATUS_COLORS[campaign.status] || STATUS_COLORS.unknown;
          const StatusIcon = STATUS_ICONS[campaign.status] || CircleDot;
          const budgetInfo = getBudgetDisplay(campaign);

          return (
            <motion.button
              key={campaign.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.5) }}
              onClick={() => onSelect(campaign)}
              className="flex flex-col p-3 rounded-xl border border-neutral-150 bg-white hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-sm font-commons font-semibold text-[#171717] line-clamp-1 flex-1">
                  {campaign.name}
                </p>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-commons font-medium flex-shrink-0 ${statusColor}`}>
                  <StatusIcon className="w-2.5 h-2.5" />
                  {STATUS_LABELS[campaign.status] || campaign.status}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs font-commons text-neutral-500">
                {campaign.objective && (
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {OBJECTIVE_LABELS[campaign.objective] || campaign.objective}
                  </span>
                )}
                {budgetInfo && (
                  <span className="flex items-center gap-1">
                    <budgetInfo.icon className="w-3 h-3" />
                    {budgetInfo.label}
                  </span>
                )}
                {campaign.issuesInfo && campaign.issuesInfo.length > 0 && (
                  <span className="flex items-center gap-1 text-orange-600" title={campaign.issuesInfo.map(i => i.error_summary).join(', ')}>
                    <AlertTriangle className="w-3 h-3" />
                    {campaign.issuesInfo.length} sorun
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default CampaignGrid;
