import React from 'react';
import { AdPlatform, PLATFORM_LABELS, PLATFORM_COLORS, OBJECTIVE_LABELS } from '@/shared/types/marketing';
import { Sparkles, Loader2 } from 'lucide-react';

interface WizardData {
  mode: 'manual' | 'ai';
  name: string;
  description: string;
  objective: string;
  platforms: string[];
  targeting: {
    ageRange?: { min: number; max: number };
    locations?: Array<{ name: string }>;
    [key: string]: any;
  };
  budget: {
    totalBudget: number;
    dailyLimit: number;
    currency: 'TRY' | 'USD' | 'EUR';
    platformSplit: Record<string, number>;
    startDate: string;
    endDate: string;
  };
  adSets: Array<{
    id: string;
    name: string;
    platform: AdPlatform;
    bidStrategy: string;
    budgetDaily: number;
    ads?: any[];
  }>;
  aiRationale?: string;
}

interface PreviewStepProps {
  wizardData: WizardData;
  onSubmit: () => void;
  onSaveDraft?: () => void;
  submitting: boolean;
}

export default function PreviewStep({
  wizardData,
  onSubmit,
  onSaveDraft,
  submitting
}: PreviewStepProps) {
  const totalAds = wizardData.adSets.reduce((sum, adSet) => sum + (adSet.ads?.length || 0), 0);

  const getBidStrategyLabel = (value: string) => {
    const strategies: Record<string, string> = {
      lowest_cost: 'En Düşük Maliyet',
      cost_cap: 'Maliyet Sınırı',
      bid_cap: 'Teklif Sınırı',
      target_cost: 'Hedef Maliyet',
    };
    return strategies[value] || value;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getTargetingPlatformSummary = (platform: string) => {
    const targeting = wizardData.targeting;
    if (!targeting) return null;

    if (platform === 'meta' && targeting.meta) {
      const meta = targeting.meta;
      const items = [];
      if (meta.interests?.length) items.push(`${meta.interests.length} ilgi alanı`);
      if (meta.behaviors?.length) items.push(`${meta.behaviors.length} davranış`);
      if (meta.customAudiences?.length) items.push(`${meta.customAudiences.length} özel kitle`);
      return items.join(', ') || 'Genel hedefleme';
    }

    if (platform === 'google' && targeting.google) {
      const google = targeting.google;
      const items = [];
      if (google.keywords?.length) items.push(`${google.keywords.length} anahtar kelime`);
      if (google.audiences?.length) items.push(`${google.audiences.length} kitle segmenti`);
      if (google.topics?.length) items.push(`${google.topics.length} konu`);
      return items.join(', ') || 'Genel hedefleme';
    }

    if (platform === 'tiktok' && targeting.tiktok) {
      const tiktok = targeting.tiktok;
      const items = [];
      if (tiktok.interests?.length) items.push(`${tiktok.interests.length} ilgi alanı`);
      if (tiktok.hashtags?.length) items.push(`${tiktok.hashtags.length} hashtag`);
      return items.join(', ') || 'Genel hedefleme';
    }

    if (platform === 'linkedin' && targeting.linkedin) {
      const linkedin = targeting.linkedin;
      const items = [];
      if (linkedin.jobTitles?.length) items.push(`${linkedin.jobTitles.length} iş unvanı`);
      if (linkedin.companies?.industries?.length) items.push(`${linkedin.companies.industries.length} sektör`);
      return items.join(', ') || 'Genel hedefleme';
    }

    return 'Platform hedeflemesi';
  };

  return (
    <div className="space-y-6">
      {wizardData.mode === 'ai' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-commons font-semibold text-indigo-900 mb-1">
              AI Destekli Kampanya
            </h4>
            <p className="text-sm font-commons text-indigo-700">
              Bu kampanya AI tarafından önerilmiş ve optimize edilmiştir.
            </p>
          </div>
        </div>
      )}

      {/* Campaign Information */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6 space-y-4">
        <h3 className="text-base font-commons font-semibold text-[#171717] border-b border-neutral-100 pb-3">
          Kampanya Bilgileri
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-commons font-medium text-neutral-500 block mb-1">
              Kampanya Adı
            </label>
            <p className="text-sm font-commons text-[#171717] font-medium">
              {wizardData.name || 'Belirlenmedi'}
            </p>
          </div>

          {wizardData.description && (
            <div>
              <label className="text-xs font-commons font-medium text-neutral-500 block mb-1">
                Açıklama
              </label>
              <p className="text-sm font-commons text-neutral-700">
                {wizardData.description}
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-commons font-medium text-neutral-500 block mb-1">
              Hedef
            </label>
            <p className="text-sm font-commons text-[#171717] font-medium">
              {OBJECTIVE_LABELS[wizardData.objective as keyof typeof OBJECTIVE_LABELS] || wizardData.objective}
            </p>
          </div>

          <div>
            <label className="text-xs font-commons font-medium text-neutral-500 block mb-1">
              Platformlar
            </label>
            <div className="flex flex-wrap gap-2">
              {wizardData.platforms.map((platform) => (
                <span
                  key={platform}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${PLATFORM_COLORS[platform as AdPlatform]}`}
                >
                  {PLATFORM_LABELS[platform as AdPlatform]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Targeting Summary */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6 space-y-4">
        <h3 className="text-base font-commons font-semibold text-[#171717] border-b border-neutral-100 pb-3">
          Hedefleme Özeti
        </h3>

        <div className="space-y-3">
          {wizardData.targeting.ageRange && (
            <div>
              <label className="text-xs font-commons font-medium text-neutral-500 block mb-1">
                Yaş Aralığı
              </label>
              <p className="text-sm font-commons text-[#171717]">
                {wizardData.targeting.ageRange.min} - {wizardData.targeting.ageRange.max} yaş
              </p>
            </div>
          )}

          {wizardData.targeting.locations && wizardData.targeting.locations.length > 0 && (
            <div>
              <label className="text-xs font-commons font-medium text-neutral-500 block mb-1">
                Konumlar
              </label>
              <p className="text-sm font-commons text-[#171717]">
                {wizardData.targeting.locations.map(loc => loc.name).join(', ')}
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-commons font-medium text-neutral-500 block mb-1">
              Platform Hedeflemesi
            </label>
            <div className="space-y-2">
              {wizardData.platforms.map((platform) => (
                <div key={platform} className="flex items-start gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLATFORM_COLORS[platform as AdPlatform]}`}>
                    {PLATFORM_LABELS[platform as AdPlatform]}
                  </span>
                  <span className="text-xs font-commons text-neutral-600">
                    {getTargetingPlatformSummary(platform)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Budget */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6 space-y-4">
        <h3 className="text-base font-commons font-semibold text-[#171717] border-b border-neutral-100 pb-3">
          Bütçe
        </h3>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-commons font-medium text-neutral-500 block mb-1">
                Toplam Bütçe
              </label>
              <p className="text-sm font-commons text-[#171717] font-semibold">
                {wizardData.budget.totalBudget.toLocaleString('tr-TR')} {wizardData.budget.currency}
              </p>
            </div>
            <div>
              <label className="text-xs font-commons font-medium text-neutral-500 block mb-1">
                Günlük Limit
              </label>
              <p className="text-sm font-commons text-[#171717] font-semibold">
                {wizardData.budget.dailyLimit.toLocaleString('tr-TR')} {wizardData.budget.currency}
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-commons font-medium text-neutral-500 block mb-2">
              Platform Dağılımı
            </label>
            <div className="space-y-2">
              {Object.entries(wizardData.budget.platformSplit || {}).map(([platform, percentage]) => {
                const amount = (wizardData.budget.totalBudget * percentage) / 100;
                return (
                  <div key={platform} className="flex items-center justify-between text-sm font-commons">
                    <span className="text-neutral-700">
                      {PLATFORM_LABELS[platform as AdPlatform]}
                    </span>
                    <span className="text-[#171717] font-medium">
                      {amount.toLocaleString('tr-TR')} {wizardData.budget.currency} ({percentage}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-commons font-medium text-neutral-500 block mb-1">
                Başlangıç
              </label>
              <p className="text-sm font-commons text-[#171717]">
                {formatDate(wizardData.budget.startDate)}
              </p>
            </div>
            <div>
              <label className="text-xs font-commons font-medium text-neutral-500 block mb-1">
                Bitiş
              </label>
              <p className="text-sm font-commons text-[#171717]">
                {wizardData.budget.endDate ? formatDate(wizardData.budget.endDate) : 'Süresiz'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Ad Sets */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6 space-y-4">
        <h3 className="text-base font-commons font-semibold text-[#171717] border-b border-neutral-100 pb-3">
          Reklam Setleri ({wizardData.adSets.length})
        </h3>

        <div className="space-y-3">
          {wizardData.adSets.map((adSet) => (
            <div key={adSet.id} className="bg-neutral-50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-commons font-semibold text-[#171717]">
                  {adSet.name}
                </h4>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLATFORM_COLORS[adSet.platform]}`}>
                  {PLATFORM_LABELS[adSet.platform]}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-commons text-neutral-600">
                <span>{getBidStrategyLabel(adSet.bidStrategy)}</span>
                <span className="text-neutral-300">•</span>
                <span className="font-medium text-[#171717]">
                  {adSet.budgetDaily} {wizardData.budget.currency}/gün
                </span>
                <span className="text-neutral-300">•</span>
                <span>{adSet.ads?.length || 0} reklam</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ads */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6 space-y-4">
        <h3 className="text-base font-commons font-semibold text-[#171717] border-b border-neutral-100 pb-3">
          Reklamlar ({totalAds})
        </h3>

        <div className="space-y-4">
          {wizardData.adSets.map((adSet) => (
            adSet.ads && adSet.ads.length > 0 && (
              <div key={adSet.id}>
                <h4 className="text-xs font-commons font-medium text-neutral-500 mb-2">
                  {adSet.name}
                </h4>
                <div className="space-y-2">
                  {adSet.ads.map((ad: any) => (
                    <div key={ad.id} className="bg-neutral-50 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-commons font-semibold text-[#171717]">
                          {ad.headline}
                        </p>
                        {ad.variant && (
                          <span className="text-xs font-commons font-medium text-neutral-500 bg-white px-2 py-0.5 rounded ml-2">
                            {ad.variant}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-commons text-neutral-600 line-clamp-2">
                        {ad.primaryText}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* AI Rationale */}
      {wizardData.mode === 'ai' && wizardData.aiRationale && (
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-6">
          <h3 className="text-base font-commons font-semibold text-indigo-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Açıklaması
          </h3>
          <p className="text-sm font-commons text-indigo-800 leading-relaxed whitespace-pre-wrap">
            {wizardData.aiRationale}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4 pt-4">
        {onSaveDraft && (
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={submitting}
            className="bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 font-commons text-sm px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Taslak Olarak Kaydet
          </button>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-commons text-base font-medium px-8 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 ml-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Oluşturuluyor...
            </>
          ) : (
            'Kampanyayı Oluştur'
          )}
        </button>
      </div>
    </div>
  );
}
