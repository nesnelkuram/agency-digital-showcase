import React from 'react';
import { X, ExternalLink, Eye, MousePointer, DollarSign, TrendingUp, Target, AlertCircle, CheckCircle, Info } from 'lucide-react';
import type { Ad, AdSet } from '@/shared/types/marketing';
import { EFFECTIVE_STATUS_LABELS, EFFECTIVE_STATUS_COLORS, QUALITY_RANKING_LABELS, QUALITY_RANKING_COLORS } from '@/shared/types/marketing';
import FeedAdMockup from './FeedAdMockup';

interface AdDetailDrawerProps {
  ad: Ad | null;
  adSet?: AdSet;
  open: boolean;
  onClose: () => void;
}

const BID_STRATEGY_LABELS: Record<string, string> = {
  lowest_cost: 'En Dusuk Maliyet',
  cost_cap: 'Maliyet Siniri',
  bid_cap: 'Teklif Siniri',
  target_cost: 'Hedef Maliyet',
};

const AdDetailDrawer: React.FC<AdDetailDrawerProps> = ({ ad, adSet, open, onClose }) => {
  if (!ad || !open) return null;

  const effectiveStatusLabel = ad.effectiveStatus
    ? EFFECTIVE_STATUS_LABELS[ad.effectiveStatus] || ad.effectiveStatus
    : null;
  const effectiveStatusColor = ad.effectiveStatus
    ? EFFECTIVE_STATUS_COLORS[ad.effectiveStatus] || 'bg-neutral-100 text-neutral-600'
    : '';

  const perf = ad.performanceSummary;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-neutral-100 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-commons font-semibold text-[#171717] truncate">
              {ad.name}
            </h2>
            {effectiveStatusLabel && (
              <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-commons font-medium ${effectiveStatusColor}`}>
                {effectiveStatusLabel}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 1. Preview Section */}
          <div>
            <h3 className="text-sm font-commons font-semibold text-neutral-500 mb-3">Reklam Onizleme</h3>
            <FeedAdMockup creative={ad.creative} />
          </div>

          {/* 2. Performance Section */}
          {perf && (
            <div>
              <h3 className="text-sm font-commons font-semibold text-neutral-500 mb-3">Performans</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Eye className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="text-xs font-commons text-neutral-500">Gosterim</span>
                  </div>
                  <p className="text-sm font-commons font-semibold text-[#171717]">
                    {perf.impressions.toLocaleString('tr-TR')}
                  </p>
                </div>

                <div className="bg-neutral-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MousePointer className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="text-xs font-commons text-neutral-500">Tiklama</span>
                  </div>
                  <p className="text-sm font-commons font-semibold text-[#171717]">
                    {perf.clicks.toLocaleString('tr-TR')}
                  </p>
                </div>

                <div className="bg-neutral-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="text-xs font-commons text-neutral-500">CTR</span>
                  </div>
                  <p className="text-sm font-commons font-semibold text-[#171717]">
                    %{perf.ctr.toFixed(2)}
                  </p>
                </div>

                <div className="bg-neutral-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="text-xs font-commons text-neutral-500">Harcama</span>
                  </div>
                  <p className="text-sm font-commons font-semibold text-[#171717]">
                    {perf.spend.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                  </p>
                </div>

                <div className="bg-neutral-50 rounded-lg p-3 col-span-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="text-xs font-commons text-neutral-500">Donusum</span>
                  </div>
                  <p className="text-sm font-commons font-semibold text-[#171717]">
                    {perf.conversions.toLocaleString('tr-TR')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. Quality Rankings Section */}
          {perf && (
            <div>
              <h3 className="text-sm font-commons font-semibold text-neutral-500 mb-3">Kalite Siralamasi</h3>
              <div className="space-y-3">
                {[
                  { label: 'Kalite', key: 'qualityRanking' },
                  { label: 'Etkilesim', key: 'engagementRateRanking' },
                  { label: 'Donusum', key: 'conversionRateRanking' },
                ].map(({ label, key }) => {
                  const value = (ad as any)[key] || (perf as any)[key];
                  const rankingLabel = value ? QUALITY_RANKING_LABELS[value] || value : 'Veri Yok';
                  const rankingColor = value ? QUALITY_RANKING_COLORS[value] || 'text-neutral-400' : 'text-neutral-400';

                  return (
                    <div key={key} className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2.5">
                      <span className="text-sm font-commons text-neutral-600">{label}</span>
                      <span className={`text-sm font-commons font-semibold ${rankingColor}`}>
                        {rankingLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Meta Recommendations */}
          {ad.recommendations && ad.recommendations.length > 0 && (
            <div>
              <h3 className="text-sm font-commons font-semibold text-neutral-500 mb-3">
                Meta Onerileri
              </h3>
              <div className="space-y-2">
                {ad.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-commons font-semibold text-amber-800">
                          {rec.title}
                        </p>
                        <p className="text-xs font-commons text-amber-700 mt-0.5">
                          {rec.message}
                        </p>
                        {rec.code && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-100 rounded text-[10px] font-commons font-mono text-amber-600">
                            {rec.code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Links Section */}
          {ad.previewShareableLink && (
            <div>
              <h3 className="text-sm font-commons font-semibold text-neutral-500 mb-3">Baglantilar</h3>
              <a
                href={ad.previewShareableLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors group"
              >
                <ExternalLink className="w-4 h-4 text-indigo-500 group-hover:text-indigo-600" />
                <span className="text-sm font-commons text-indigo-600 group-hover:text-indigo-700 font-medium">
                  Meta'da Onizle
                </span>
              </a>
            </div>
          )}

          {/* 6. Ad Set Info */}
          {adSet && (
            <div>
              <h3 className="text-sm font-commons font-semibold text-neutral-500 mb-3">Reklam Seti Bilgisi</h3>
              <div className="bg-neutral-50 rounded-lg p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-commons text-neutral-500">Ad</span>
                  <span className="text-sm font-commons font-medium text-[#171717] truncate ml-3 max-w-[200px] text-right">
                    {adSet.name}
                  </span>
                </div>

                {adSet.optimizationGoal && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-commons text-neutral-500">Optimizasyon Hedefi</span>
                    <span className="text-sm font-commons font-medium text-[#171717]">
                      {adSet.optimizationGoal}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs font-commons text-neutral-500">Teklif Stratejisi</span>
                  <span className="text-sm font-commons font-medium text-[#171717]">
                    {BID_STRATEGY_LABELS[adSet.bidStrategy] || adSet.bidStrategy}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-commons text-neutral-500">Gunluk Butce</span>
                  <span className="text-sm font-commons font-medium text-[#171717]">
                    {adSet.budget.daily.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                  </span>
                </div>

                {adSet.budget.lifetime && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-commons text-neutral-500">Toplam Butce</span>
                    <span className="text-sm font-commons font-medium text-[#171717]">
                      {adSet.budget.lifetime.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AdDetailDrawer;
