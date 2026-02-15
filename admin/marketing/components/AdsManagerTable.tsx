import React, { useState } from 'react';
import type { MarketingCampaign, AdSet, Ad } from '@/shared/types/marketing';
import { EFFECTIVE_STATUS_LABELS, EFFECTIVE_STATUS_COLORS } from '@/shared/types/marketing';
import { ChevronDown, ChevronRight, Eye, MousePointer, DollarSign, TrendingUp, Target, Users } from 'lucide-react';

// ============================================
// PROPS
// ============================================

interface AdsManagerTableProps {
  campaign: MarketingCampaign;
  onAdClick?: (ad: Ad, adSet: AdSet) => void;
}

// ============================================
// YARDIMCI FONKSIYONLAR
// ============================================

/** Sayi formatlama: 1234 -> "1.234" */
function fmtNum(n: number | undefined): string {
  if (n == null) return '-';
  return n.toLocaleString('tr-TR');
}

/** Para formatlama: 1234.5 -> "1.234,50" */
function fmtMoney(n: number | undefined): string {
  if (n == null) return '-';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Yuzde formatlama: 0.0345 -> "%3,45" */
function fmtPct(n: number | undefined): string {
  if (n == null) return '-';
  return `%${(n * 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Durum badge'i icin renk ve etiket */
function getStatusBadge(effectiveStatus?: string, status?: string): { label: string; color: string } {
  const key = effectiveStatus || status || 'paused';
  const label = EFFECTIVE_STATUS_LABELS[key] || key;
  const color = EFFECTIVE_STATUS_COLORS[key] || 'bg-neutral-100 text-neutral-600';
  return { label, color };
}

/** Kampanya genelindeki toplam metrikleri hesapla */
function computeCampaignTotals(adSets: AdSet[]) {
  let impressions = 0;
  let clicks = 0;
  let spend = 0;
  let conversions = 0;
  let budget = 0;

  for (const set of adSets) {
    budget += set.budget.daily || 0;
    if (set.performanceSummary) {
      impressions += set.performanceSummary.impressions;
      clicks += set.performanceSummary.clicks;
      spend += set.performanceSummary.spend;
      conversions += set.performanceSummary.conversions;
    }
  }

  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;

  return { impressions, clicks, spend, conversions, budget, ctr, cpa };
}

// ============================================
// KOLON HEADER
// ============================================

const COLUMNS = [
  { key: 'name', label: 'Ad / Durum', width: 'flex-1 min-w-[240px]' },
  { key: 'budget', label: 'Butce', width: 'w-24 text-right' },
  { key: 'spend', label: 'Harcama', width: 'w-28 text-right' },
  { key: 'impressions', label: 'Gosterim', width: 'w-28 text-right' },
  { key: 'clicks', label: 'Tiklanma', width: 'w-24 text-right' },
  { key: 'ctr', label: 'CTR', width: 'w-20 text-right' },
  { key: 'cpa', label: 'CPA', width: 'w-24 text-right' },
] as const;

// ============================================
// COMPONENT
// ============================================

const AdsManagerTable: React.FC<AdsManagerTableProps> = ({ campaign, onAdClick }) => {
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());

  // ---- Toggle ----
  const toggleAdSet = (adSetId: string) => {
    setExpandedAdSets((prev) => {
      const next = new Set(prev);
      if (next.has(adSetId)) {
        next.delete(adSetId);
      } else {
        next.add(adSetId);
      }
      return next;
    });
  };

  // ---- Toplam metrikler ----
  const totals = computeCampaignTotals(campaign.adSets);

  // ---- Bos durum ----
  if (!campaign.adSets || campaign.adSets.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200/50 font-commons">
        <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
          <Users className="w-10 h-10 mb-3" />
          <p className="text-sm font-medium">Reklam seti bulunamadi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200/50 font-commons overflow-hidden">
      {/* ================================================
          KOLON BASLIK SATIRI
          ================================================ */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-neutral-50 border-b border-neutral-200/60">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={`text-[11px] uppercase font-semibold text-neutral-500 tracking-wide select-none cursor-pointer hover:text-neutral-700 transition-colors ${col.width}`}
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* ================================================
          KAMPANYA OZET SATIRI
          ================================================ */}
      <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50/40 border-b border-neutral-200/40">
        {/* Ad / Durum */}
        <div className="flex-1 min-w-[240px] flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-neutral-800 truncate">{campaign.name}</span>
          {campaign.effectiveStatus && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none ${getStatusBadge(campaign.effectiveStatus, campaign.status).color}`}
            >
              {getStatusBadge(campaign.effectiveStatus, campaign.status).label}
            </span>
          )}
        </div>
        {/* Butce */}
        <div className="w-24 text-right text-sm font-semibold text-neutral-700">
          {fmtMoney(totals.budget)}
        </div>
        {/* Harcama */}
        <div className="w-28 text-right text-sm font-semibold text-neutral-700">
          {fmtMoney(totals.spend)}
        </div>
        {/* Gosterim */}
        <div className="w-28 text-right text-sm font-semibold text-neutral-700">
          {fmtNum(totals.impressions)}
        </div>
        {/* Tiklanma */}
        <div className="w-24 text-right text-sm font-semibold text-neutral-700">
          {fmtNum(totals.clicks)}
        </div>
        {/* CTR */}
        <div className="w-20 text-right text-sm font-semibold text-neutral-700">
          {fmtPct(totals.ctr)}
        </div>
        {/* CPA */}
        <div className="w-24 text-right text-sm font-semibold text-neutral-700">
          {fmtMoney(totals.cpa)}
        </div>
      </div>

      {/* ================================================
          REKLAM SETLERI
          ================================================ */}
      <div className="divide-y divide-neutral-100">
        {campaign.adSets.map((adSet) => {
          const isExpanded = expandedAdSets.has(adSet.id);
          const perf = adSet.performanceSummary;
          const badge = getStatusBadge(adSet.effectiveStatus, adSet.status);

          return (
            <React.Fragment key={adSet.id}>
              {/* ---- Ad Set Satiri ---- */}
              <div
                className="flex items-center gap-2 px-4 py-2.5 hover:bg-neutral-50 cursor-pointer transition-colors"
                onClick={() => toggleAdSet(adSet.id)}
              >
                {/* Ad / Durum */}
                <div className="flex-1 min-w-[240px] flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium text-neutral-800 truncate">{adSet.name}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                </div>
                {/* Butce */}
                <div className="w-24 text-right text-sm text-neutral-600">
                  <span className="inline-flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-neutral-400" />
                    {fmtMoney(adSet.budget.daily)}
                  </span>
                </div>
                {/* Harcama */}
                <div className="w-28 text-right text-sm text-neutral-600">
                  {fmtMoney(perf?.spend)}
                </div>
                {/* Gosterim */}
                <div className="w-28 text-right text-sm text-neutral-600">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="w-3 h-3 text-neutral-400" />
                    {fmtNum(perf?.impressions)}
                  </span>
                </div>
                {/* Tiklanma */}
                <div className="w-24 text-right text-sm text-neutral-600">
                  <span className="inline-flex items-center gap-1">
                    <MousePointer className="w-3 h-3 text-neutral-400" />
                    {fmtNum(perf?.clicks)}
                  </span>
                </div>
                {/* CTR */}
                <div className="w-20 text-right text-sm text-neutral-600">
                  {fmtPct(perf?.ctr)}
                </div>
                {/* CPA */}
                <div className="w-24 text-right text-sm text-neutral-600">
                  {fmtMoney(perf?.cpa)}
                </div>
              </div>

              {/* ---- Genisletilmis Reklamlar ---- */}
              {isExpanded &&
                adSet.ads.map((ad) => {
                  const adPerf = ad.performanceSummary;
                  const adBadge = getStatusBadge(ad.effectiveStatus, ad.status);
                  const ctr = adPerf && adPerf.impressions > 0
                    ? adPerf.clicks / adPerf.impressions
                    : undefined;
                  const cpa = adPerf && adPerf.conversions > 0
                    ? adPerf.spend / adPerf.conversions
                    : undefined;

                  return (
                    <div
                      key={ad.id}
                      className="flex items-center gap-2 pl-10 pr-4 py-2 bg-neutral-50/50 hover:bg-indigo-50/30 cursor-pointer transition-colors"
                      onClick={() => onAdClick?.(ad, adSet)}
                    >
                      {/* Ad / Durum */}
                      <div className="flex-1 min-w-[240px] flex items-center gap-2.5">
                        {/* Thumbnail */}
                        {ad.creative.thumbnailUrl || ad.creative.imageUrl ? (
                          <img
                            src={ad.creative.thumbnailUrl || ad.creative.imageUrl}
                            alt={ad.name}
                            className="w-8 h-8 rounded object-cover flex-shrink-0 border border-neutral-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-neutral-200 flex items-center justify-center flex-shrink-0">
                            <Eye className="w-3.5 h-3.5 text-neutral-400" />
                          </div>
                        )}
                        <span className="text-sm text-neutral-700 truncate">{ad.name}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none ${adBadge.color}`}
                        >
                          {adBadge.label}
                        </span>
                        {ad.variant && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-600">
                            {ad.variant}
                          </span>
                        )}
                      </div>
                      {/* Butce (bos - reklam seviyesinde butce yok) */}
                      <div className="w-24 text-right text-sm text-neutral-400">-</div>
                      {/* Harcama */}
                      <div className="w-28 text-right text-sm text-neutral-600">
                        {fmtMoney(adPerf?.spend)}
                      </div>
                      {/* Gosterim */}
                      <div className="w-28 text-right text-sm text-neutral-600">
                        {fmtNum(adPerf?.impressions)}
                      </div>
                      {/* Tiklanma */}
                      <div className="w-24 text-right text-sm text-neutral-600">
                        {fmtNum(adPerf?.clicks)}
                      </div>
                      {/* CTR */}
                      <div className="w-20 text-right text-sm text-neutral-600">
                        {fmtPct(ctr)}
                      </div>
                      {/* CPA */}
                      <div className="w-24 text-right text-sm text-neutral-600">
                        {fmtMoney(cpa)}
                      </div>
                    </div>
                  );
                })}
            </React.Fragment>
          );
        })}
      </div>

      {/* ================================================
          ALT OZET SATIRI
          ================================================ */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-neutral-50 border-t border-neutral-200/60">
        <div className="flex-1 min-w-[240px] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            Toplam ({campaign.adSets.length} reklam seti)
          </span>
        </div>
        <div className="w-24 text-right text-xs font-semibold text-neutral-600">
          {fmtMoney(totals.budget)}
        </div>
        <div className="w-28 text-right text-xs font-semibold text-neutral-600">
          {fmtMoney(totals.spend)}
        </div>
        <div className="w-28 text-right text-xs font-semibold text-neutral-600">
          {fmtNum(totals.impressions)}
        </div>
        <div className="w-24 text-right text-xs font-semibold text-neutral-600">
          {fmtNum(totals.clicks)}
        </div>
        <div className="w-20 text-right text-xs font-semibold text-neutral-600">
          {fmtPct(totals.ctr)}
        </div>
        <div className="w-24 text-right text-xs font-semibold text-neutral-600">
          {fmtMoney(totals.cpa)}
        </div>
      </div>
    </div>
  );
};

export default AdsManagerTable;
