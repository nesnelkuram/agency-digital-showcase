import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, DollarSign, Calendar, TrendingUp, Eye, MousePointerClick,
  ChevronDown, ChevronRight, AlertTriangle, ExternalLink, Layers, Image,
  Play, Pause, CircleDot, Clock, Archive, Ban,
} from 'lucide-react';

// --- Types ---

interface AdCreative {
  headline?: string;
  primaryText?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
}

interface Ad {
  metaAdId?: string;
  name: string;
  status: string;
  effectiveStatus?: string;
  previewShareableLink?: string;
  creative?: AdCreative;
  recommendations?: Array<{ title: string; message: string; code?: string }>;
  adReviewFeedback?: any;
  issuesInfo?: any;
}

interface AdSetBudget {
  daily?: number;
  lifetime?: number;
}

interface AdSet {
  metaAdSetId?: string;
  name: string;
  status: string;
  effectiveStatus?: string;
  budget?: AdSetBudget;
  bidStrategy?: string;
  optimizationGoal?: string;
  billingEvent?: string;
  schedule?: { startDate?: string; endDate?: string };
  learningStageInfo?: { status?: string };
  destinationType?: string;
  isDynamicCreative?: boolean;
  ads?: Ad[];
}

interface Performance {
  totalSpend?: number;
  totalImpressions?: number;
  totalClicks?: number;
  totalConversions?: number;
  averageCTR?: number;
  averageCPA?: number;
  overallROAS?: number;
  inlineLinkClicks?: number;
  platformBreakdown?: {
    meta?: {
      spend?: number;
      impressions?: number;
      clicks?: number;
      ctr?: number;
      cpc?: number;
      cpm?: number;
      reach?: number;
      frequency?: number;
    };
  };
}

interface CampaignDetailData {
  id: string;
  name: string;
  status: string;
  effectiveStatus?: string;
  configuredStatus?: string;
  objective?: string;
  buyingType?: string;
  budget?: { totalBudget?: number; dailyLimit?: number; currency?: string };
  dailyBudget?: number;
  lifetimeBudget?: number;
  budgetRemaining?: number;
  spendCap?: number;
  schedule?: { startDate?: string; endDate?: string };
  performance?: Performance | null;
  adSets?: AdSet[];
  issuesInfo?: Array<{ level: string; error_summary: string }>;
  recommendations?: Array<{ title?: string; message?: string; code?: string }>;
  platformCampaignIds?: Record<string, string>;
  metaCreatedTime?: string;
  lastSyncAt?: number | string;
}

interface CampaignDetailProps {
  campaign: CampaignDetailData;
}

// --- Constants ---

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  draft: 'bg-neutral-100 text-neutral-600',
  completed: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  issues: 'bg-orange-100 text-orange-700',
  with_issues: 'bg-orange-100 text-orange-700',
  disapproved: 'bg-red-100 text-red-700',
  pending_review: 'bg-amber-100 text-amber-700',
  archived: 'bg-neutral-100 text-neutral-500',
  deleted: 'bg-neutral-100 text-neutral-400',
  in_process: 'bg-sky-100 text-sky-700',
  campaign_paused: 'bg-yellow-100 text-yellow-700',
  adset_paused: 'bg-yellow-100 text-yellow-700',
  pending_billing: 'bg-amber-100 text-amber-700',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  paused: 'Duraklatildi',
  draft: 'Taslak',
  completed: 'Tamamlandi',
  failed: 'Basarisiz',
  issues: 'Sorunlu',
  with_issues: 'Sorunlu',
  disapproved: 'Reddedildi',
  pending_review: 'Incelemede',
  archived: 'Arsivlendi',
  deleted: 'Silindi',
  in_process: 'Isleniyor',
  campaign_paused: 'Kampanya Duraklatildi',
  adset_paused: 'Reklam Seti Duraklatildi',
  pending_billing: 'Odeme Bekleniyor',
};

const STATUS_ICONS: Record<string, React.FC<{ className?: string }>> = {
  active: Play,
  paused: Pause,
  draft: CircleDot,
  completed: Clock,
  issues: AlertTriangle,
  with_issues: AlertTriangle,
  disapproved: Ban,
  pending_review: Clock,
  archived: Archive,
  campaign_paused: Pause,
  adset_paused: Pause,
};

const OBJECTIVE_LABELS: Record<string, string> = {
  awareness: 'Farkindalik',
  traffic: 'Trafik',
  engagement: 'Etkilesim',
  leads: 'Potansiyel Musteri',
  sales: 'Satis',
  app_installs: 'Uygulama',
  video_views: 'Video Goruntulenme',
};

// --- Helpers ---

function fmt(value: number | undefined | null, type: 'number' | 'percent' | 'currency' = 'number'): string {
  if (value == null || isNaN(value)) return '-';
  switch (type) {
    case 'percent':
      return `%${value.toFixed(2)}`;
    case 'currency':
      return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
    default:
      return value.toLocaleString('tr-TR');
  }
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'bg-neutral-100 text-neutral-500';
  const label = STATUS_LABELS[status] || status;
  const Icon = STATUS_ICONS[status] || CircleDot;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-commons font-medium ${color}`}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

// --- Main Component ---

const CampaignDetail: React.FC<CampaignDetailProps> = ({ campaign }) => {
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());

  if (!campaign) return null;

  const perf = campaign.performance;
  const adSets = campaign.adSets || [];
  const hasPerformance = perf && (perf.totalSpend || perf.totalImpressions || perf.totalClicks);
  const totalAds = adSets.reduce((sum, as) => sum + (as.ads?.length || 0), 0);

  const toggleAdSet = (id: string) => {
    setExpandedAdSets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (expandedAdSets.size === adSets.length) {
      setExpandedAdSets(new Set());
    } else {
      setExpandedAdSets(new Set(adSets.map((_, i) => String(i))));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-2 rounded-xl border border-neutral-150 bg-white overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-commons font-bold text-[#171717] truncate">{campaign.name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <StatusBadge status={campaign.status} />
              {campaign.objective && (
                <span className="inline-flex items-center gap-1 text-[10px] font-commons text-neutral-500">
                  <Target className="w-2.5 h-2.5" />
                  {OBJECTIVE_LABELS[campaign.objective] || campaign.objective}
                </span>
              )}
              {campaign.buyingType && (
                <span className="text-[10px] font-commons text-neutral-400">
                  {campaign.buyingType}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Budget & Schedule */}
      <div className="grid grid-cols-2 gap-px bg-neutral-100">
        <div className="bg-white p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3 h-3 text-neutral-400" />
            <span className="text-[10px] font-commons text-neutral-400 uppercase tracking-wide">Butce</span>
          </div>
          <div className="space-y-0.5">
            {campaign.dailyBudget != null && campaign.dailyBudget > 0 && (
              <p className="text-xs font-commons text-[#171717]">
                <span className="font-medium">{fmt(campaign.dailyBudget, 'currency')}</span>
                <span className="text-neutral-400"> /gun</span>
              </p>
            )}
            {campaign.lifetimeBudget != null && campaign.lifetimeBudget > 0 && (
              <p className="text-xs font-commons text-[#171717]">
                <span className="font-medium">{fmt(campaign.lifetimeBudget, 'currency')}</span>
                <span className="text-neutral-400"> toplam</span>
              </p>
            )}
            {campaign.budgetRemaining != null && campaign.budgetRemaining > 0 && (
              <p className="text-xs font-commons text-neutral-500">
                Kalan: {fmt(campaign.budgetRemaining, 'currency')}
              </p>
            )}
            {!campaign.dailyBudget && !campaign.lifetimeBudget && campaign.budget?.totalBudget != null && (
              <p className="text-xs font-commons text-[#171717] font-medium">
                {fmt(campaign.budget.totalBudget, 'currency')}
              </p>
            )}
          </div>
        </div>
        <div className="bg-white p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="w-3 h-3 text-neutral-400" />
            <span className="text-[10px] font-commons text-neutral-400 uppercase tracking-wide">Takvim</span>
          </div>
          <div className="space-y-0.5">
            {campaign.schedule?.startDate && (
              <p className="text-xs font-commons text-[#171717]">
                {formatDate(campaign.schedule.startDate)}
              </p>
            )}
            {campaign.schedule?.endDate ? (
              <p className="text-xs font-commons text-neutral-500">
                &rarr; {formatDate(campaign.schedule.endDate)}
              </p>
            ) : (
              <p className="text-xs font-commons text-neutral-400">Bitis tarihi yok</p>
            )}
          </div>
        </div>
      </div>

      {/* Performance KPIs */}
      {hasPerformance && (
        <div className="border-t border-neutral-100">
          <div className="px-3 py-1.5 bg-neutral-50 border-b border-neutral-100">
            <span className="text-[10px] font-commons font-medium text-neutral-400 uppercase tracking-wide">
              Performans (Son 30 Gun)
            </span>
          </div>
          <div className="grid grid-cols-4 gap-px bg-neutral-100">
            <KPICell label="Harcama" value={fmt(perf!.totalSpend, 'currency')} icon={DollarSign} />
            <KPICell label="Gosterim" value={fmt(perf!.totalImpressions)} icon={Eye} />
            <KPICell label="Tiklama" value={fmt(perf!.totalClicks)} icon={MousePointerClick} />
            <KPICell label="CTR" value={fmt(perf!.averageCTR, 'percent')} icon={TrendingUp} />
          </div>
          <div className="grid grid-cols-4 gap-px bg-neutral-100">
            <KPICell label="CPA" value={fmt(perf!.averageCPA, 'currency')} />
            <KPICell label="ROAS" value={perf!.overallROAS ? `${perf!.overallROAS.toFixed(2)}x` : '-'} />
            <KPICell label="Donusum" value={fmt(perf!.totalConversions)} />
            <KPICell
              label="Erisim"
              value={fmt(perf!.platformBreakdown?.meta?.reach)}
            />
          </div>
        </div>
      )}

      {/* Ad Sets */}
      {adSets.length > 0 && (
        <div className="border-t border-neutral-100">
          <div className="px-3 py-1.5 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
            <span className="text-[10px] font-commons font-medium text-neutral-400 uppercase tracking-wide">
              Reklam Setleri ({adSets.length}) &middot; {totalAds} Reklam
            </span>
            {adSets.length > 1 && (
              <button
                onClick={expandAll}
                className="text-[10px] font-commons text-indigo-600 hover:text-indigo-800"
              >
                {expandedAdSets.size === adSets.length ? 'Daralt' : 'Tumu'}
              </button>
            )}
          </div>
          <div className="divide-y divide-neutral-100 max-h-[320px] overflow-y-auto">
            {adSets.map((adSet, idx) => {
              const key = String(idx);
              const isExpanded = expandedAdSets.has(key);
              const ads = adSet.ads || [];

              return (
                <div key={adSet.metaAdSetId || idx}>
                  <button
                    onClick={() => toggleAdSet(key)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                    )}
                    <Layers className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                    <span className="text-xs font-commons font-medium text-[#171717] truncate flex-1">
                      {adSet.name}
                    </span>
                    <StatusBadge status={adSet.effectiveStatus || adSet.status} />
                    {adSet.budget?.daily != null && adSet.budget.daily > 0 && (
                      <span className="text-[10px] font-commons text-neutral-400 flex-shrink-0">
                        {fmt(adSet.budget.daily, 'currency')}/gun
                      </span>
                    )}
                    <span className="text-[10px] font-commons text-neutral-400 flex-shrink-0">
                      {ads.length} reklam
                    </span>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        {/* AdSet details */}
                        <div className="px-8 pb-1 flex items-center gap-3 flex-wrap text-[10px] font-commons text-neutral-400">
                          {adSet.optimizationGoal && (
                            <span>Hedef: {adSet.optimizationGoal}</span>
                          )}
                          {adSet.bidStrategy && (
                            <span>Strateji: {adSet.bidStrategy}</span>
                          )}
                          {adSet.learningStageInfo?.status && (
                            <span className="text-amber-600">
                              Ogrenme: {adSet.learningStageInfo.status}
                            </span>
                          )}
                        </div>

                        {/* Ads */}
                        {ads.length > 0 ? (
                          <div className="pl-8 pr-3 pb-2 space-y-1">
                            {ads.map((ad, adIdx) => (
                              <div
                                key={ad.metaAdId || adIdx}
                                className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-neutral-50"
                              >
                                <Image className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                                <span className="text-xs font-commons text-[#171717] truncate flex-1">
                                  {ad.name}
                                </span>
                                <StatusBadge status={ad.effectiveStatus || ad.status} />
                                {ad.previewShareableLink && (
                                  <a
                                    href={ad.previewShareableLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-500 hover:text-indigo-700"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="pl-8 pr-3 pb-2 text-[10px] font-commons text-neutral-400">
                            Bu reklam setinde reklam bulunamadi
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Issues */}
      {campaign.issuesInfo && campaign.issuesInfo.length > 0 && (
        <div className="border-t border-neutral-100 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3 h-3 text-orange-500" />
            <span className="text-[10px] font-commons font-medium text-orange-600 uppercase tracking-wide">
              Sorunlar ({campaign.issuesInfo.length})
            </span>
          </div>
          <div className="space-y-1">
            {campaign.issuesInfo.map((issue, i) => (
              <p key={i} className="text-xs font-commons text-neutral-600">
                <span className="text-orange-500 font-medium">{issue.level}:</span> {issue.error_summary}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {campaign.recommendations && campaign.recommendations.length > 0 && (
        <div className="border-t border-neutral-100 px-3 py-2">
          <span className="text-[10px] font-commons font-medium text-blue-600 uppercase tracking-wide">
            Oneriler ({campaign.recommendations.length})
          </span>
          <div className="space-y-1 mt-1">
            {campaign.recommendations.slice(0, 3).map((rec, i) => (
              <p key={i} className="text-xs font-commons text-neutral-600">
                {rec.title || rec.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// --- Sub-components ---

function KPICell({ label, value, icon: Icon }: { label: string; value: string; icon?: React.FC<{ className?: string }> }) {
  return (
    <div className="bg-white p-2.5">
      <div className="flex items-center gap-1 mb-0.5">
        {Icon && <Icon className="w-2.5 h-2.5 text-neutral-400" />}
        <p className="text-[10px] font-commons text-neutral-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-sm font-commons font-bold text-[#171717]">{value}</p>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default CampaignDetail;
