import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Facebook,
  Globe,
  Video,
  Image,
  FileText,
  Film,
  Layers,
  CheckCircle,
} from 'lucide-react';
import type { CampaignStructureItem, FunnelStage, AdPlatform } from '@/shared/types/marketing';

interface CampaignStructureProps {
  data: { campaigns: CampaignStructureItem[] };
  onSendMessage: (text: string) => void;
}

const PLATFORM_CONFIG: Record<AdPlatform, { icon: React.FC<{ className?: string }>; color: string; borderColor: string; bgColor: string; label: string }> = {
  meta: { icon: Facebook, color: 'text-blue-600', borderColor: 'border-blue-600', bgColor: 'bg-blue-50', label: 'Meta' },
  google: { icon: Globe, color: 'text-red-500', borderColor: 'border-red-500', bgColor: 'bg-red-50', label: 'Google' },
  tiktok: { icon: Video, color: 'text-pink-500', borderColor: 'border-pink-500', bgColor: 'bg-pink-50', label: 'TikTok' },
  linkedin: { icon: Globe, color: 'text-sky-600', borderColor: 'border-sky-600', bgColor: 'bg-sky-50', label: 'LinkedIn' },
  email: { icon: FileText, color: 'text-neutral-600', borderColor: 'border-neutral-600', bgColor: 'bg-neutral-50', label: 'Email' },
};

const FUNNEL_BADGE: Record<FunnelStage, { bg: string; text: string; label: string }> = {
  tofu: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'TOFU' },
  mofu: { bg: 'bg-violet-100', text: 'text-violet-700', label: 'MOFU' },
  bofu: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'BOFU' },
};

const FORMAT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  image: Image,
  video: Film,
  carousel: Layers,
  story: Film,
  reel: Film,
};

const CampaignStructure: React.FC<CampaignStructureProps> = ({ data, onSendMessage }) => {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    if (data.campaigns.length > 0) {
      initial[0] = true;
    }
    return initial;
  });

  const [expandedAdSets, setExpandedAdSets] = useState<Record<string, boolean>>({});

  const toggleCampaign = (index: number) => {
    setExpandedCampaigns((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleAdSet = (key: string) => {
    setExpandedAdSets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="my-3 space-y-3"
    >
      <h3 className="text-sm font-grotesk font-semibold text-[#171717]">
        Kampanya Yapisi
      </h3>

      <div className="space-y-2">
        {data.campaigns.map((campaign, cIdx) => {
          const platform = PLATFORM_CONFIG[campaign.platform] || PLATFORM_CONFIG.meta;
          const funnel = FUNNEL_BADGE[campaign.funnelStage] || FUNNEL_BADGE.tofu;
          const PlatformIcon = platform.icon;
          const isCampaignExpanded = !!expandedCampaigns[cIdx];

          return (
            <div
              key={cIdx}
              className={`rounded-xl border border-neutral-200 bg-white/80 border-l-4 ${platform.borderColor} overflow-hidden`}
            >
              {/* Campaign Header */}
              <button
                onClick={() => toggleCampaign(cIdx)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-neutral-50 transition-colors"
              >
                {isCampaignExpanded ? (
                  <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                )}

                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${platform.bgColor}`}>
                  <PlatformIcon className={`w-3.5 h-3.5 ${platform.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-grotesk font-semibold text-[#171717] truncate">
                      {campaign.name}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-commons font-semibold uppercase ${platform.bgColor} ${platform.color}`}>
                      {platform.label}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-commons font-semibold ${funnel.bg} ${funnel.text}`}>
                      {funnel.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-commons text-neutral-500">
                    <span>{campaign.objective}</span>
                    <span className="text-neutral-300">|</span>
                    <span>{campaign.budgetType === 'cbo' ? 'CBO' : 'ABO'}</span>
                    <span className="text-neutral-300">|</span>
                    <span className="font-medium text-[#171717]">
                      {campaign.dailyBudget.toLocaleString('tr-TR')} TL/gun
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-commons text-neutral-400 flex-shrink-0">
                  {campaign.adSets.length} reklam seti
                </span>
              </button>

              {/* Ad Sets */}
              {isCampaignExpanded && (
                <div className="border-t border-neutral-100 bg-neutral-50/50">
                  {campaign.adSets.map((adSet, asIdx) => {
                    const adSetKey = `${cIdx}-${asIdx}`;
                    const isAdSetExpanded = !!expandedAdSets[adSetKey];

                    return (
                      <div key={asIdx} className="ml-4 border-l border-neutral-200">
                        {/* Ad Set Header */}
                        <button
                          onClick={() => toggleAdSet(adSetKey)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-neutral-100/60 transition-colors"
                        >
                          {isAdSetExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-grotesk font-semibold text-[#171717]">
                                {adSet.name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-[10px] font-commons text-neutral-600">
                                {adSet.audienceType}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] font-commons text-neutral-500">
                              <span className="truncate max-w-[200px]">{adSet.audienceDescription}</span>
                              <span className="text-neutral-300">|</span>
                              <span className="font-medium text-[#171717]">
                                {adSet.dailyBudget.toLocaleString('tr-TR')} TL/gun
                              </span>
                              <span className="text-neutral-300">|</span>
                              <span>{adSet.bidStrategy}</span>
                            </div>
                          </div>

                          <span className="text-[10px] font-commons text-neutral-400 flex-shrink-0">
                            {adSet.ads.length} reklam
                          </span>
                        </button>

                        {/* Ads */}
                        {isAdSetExpanded && (
                          <div className="ml-8 border-l border-neutral-200 pb-1">
                            {adSet.ads.map((ad, adIdx) => {
                              const formatKey = ad.format.toLowerCase().split(' ')[0];
                              const FormatIcon = FORMAT_ICONS[formatKey] || FileText;

                              return (
                                <div
                                  key={adIdx}
                                  className="flex items-start gap-2.5 px-3 py-2 hover:bg-neutral-100/40 transition-colors"
                                >
                                  <div className="w-6 h-6 rounded-md bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <FormatIcon className="w-3 h-3 text-neutral-500" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-grotesk font-medium text-[#171717]">
                                      {ad.name}
                                    </p>
                                    <p className="text-[11px] font-commons text-neutral-500 mt-0.5 line-clamp-2">
                                      {ad.creativeSummary}
                                    </p>
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-[10px] font-commons text-neutral-500 flex-shrink-0 mt-0.5">
                                    {ad.format}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Approve Button */}
      <button
        onClick={() => onSendMessage('Kampanya yapisini onayliyorum, plani olustur')}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-commons font-medium transition-colors"
      >
        <CheckCircle className="w-4 h-4" />
        Onayla ve Plan Olustur
      </button>
    </motion.div>
  );
};

export default CampaignStructure;
