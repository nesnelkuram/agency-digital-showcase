import React from 'react';
import { motion } from 'framer-motion';
import { Eye, ExternalLink, Calendar } from 'lucide-react';

interface CompetitorAd {
  id?: string;
  page_name: string;
  ad_creative_body: string;
  ad_creative_title?: string;
  ad_snapshot_url?: string;
  delivery_start?: string;
  delivery_stop?: string;
  spend?: { lower_bound?: string; upper_bound?: string };
  impressions?: { lower_bound?: string; upper_bound?: string };
  publisher_platforms?: string[];
}

interface CompetitorAdsGridProps {
  data: {
    ads: CompetitorAd[];
    searchTerms: string;
    countries?: string[];
  };
}

function formatDateShort(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

const CompetitorAdsGrid: React.FC<CompetitorAdsGridProps> = ({ data }) => {
  const { ads, searchTerms } = data;

  if (!ads || ads.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        Reklam bulunamadi.
      </div>
    );
  }

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <Eye className="w-3.5 h-3.5 text-purple-500" />
        <span className="text-xs font-commons font-medium text-neutral-600">
          Reklam Arsivi
          <span className="text-neutral-400"> — "{searchTerms}"</span>
          <span className="text-neutral-400 ml-1">({ads.length} sonuc)</span>
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
        {ads.map((ad, i) => (
          <motion.div
            key={ad.id || i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.5) }}
            className="flex flex-col p-3 rounded-xl border border-neutral-150 bg-white"
          >
            {/* Page name */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-commons font-semibold text-[#171717] line-clamp-1">
                {ad.page_name}
              </span>
              {ad.publisher_platforms && (
                <div className="flex gap-1">
                  {ad.publisher_platforms.map(p => (
                    <span key={p} className="text-[9px] font-commons px-1 py-0.5 rounded bg-neutral-100 text-neutral-500">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Ad title */}
            {ad.ad_creative_title && (
              <p className="text-xs font-commons font-medium text-neutral-700 line-clamp-1 mb-0.5">
                {ad.ad_creative_title}
              </p>
            )}

            {/* Ad body snippet */}
            <p className="text-xs font-commons text-neutral-500 line-clamp-3 mb-2 flex-1">
              {ad.ad_creative_body || 'Reklam metni mevcut degil'}
            </p>

            {/* Footer: dates + spend + link */}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-neutral-100">
              <div className="flex items-center gap-2 text-[10px] font-commons text-neutral-400">
                {ad.delivery_start && (
                  <span className="flex items-center gap-0.5">
                    <Calendar className="w-2.5 h-2.5" />
                    {formatDateShort(ad.delivery_start)}
                    {ad.delivery_stop ? ` — ${formatDateShort(ad.delivery_stop)}` : ' — devam'}
                  </span>
                )}
                {ad.spend?.lower_bound && (
                  <span>
                    {ad.spend.lower_bound}–{ad.spend.upper_bound || '?'} TL
                  </span>
                )}
              </div>
              {ad.ad_snapshot_url && (
                <a
                  href={ad.ad_snapshot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-[10px] font-commons text-indigo-600 hover:text-indigo-800"
                >
                  Reklami Gor
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default CompetitorAdsGrid;
