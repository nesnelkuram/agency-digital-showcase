import React from 'react';
import { Image, Film, ExternalLink, Eye, MousePointer, DollarSign } from 'lucide-react';
import type { Ad } from '@/shared/types/marketing';

interface CreativePreviewCardProps {
  ad: Ad;
}

const CreativePreviewCard: React.FC<CreativePreviewCardProps> = ({ ad }) => {
  const { creative } = ad;

  return (
    <div className="bg-white rounded-xl border border-neutral-200/50 overflow-hidden hover:shadow-md transition-shadow">
      {/* Top section: Image or video thumbnail */}
      <div className="relative aspect-[4/3] bg-neutral-100">
        {creative.imageUrl ? (
          <img src={creative.imageUrl} alt={creative.headline} className="w-full h-full object-cover" />
        ) : creative.thumbnailUrl ? (
          <div className="relative w-full h-full">
            <img src={creative.thumbnailUrl} alt={creative.headline} className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Film className="w-10 h-10 text-white" />
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-12 h-12 text-neutral-300" />
          </div>
        )}
        {/* Status badge overlay */}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-commons ${
            ad.status === 'active' ? 'bg-green-500/90 text-white' :
            ad.status === 'paused' ? 'bg-yellow-500/90 text-white' :
            'bg-red-500/90 text-white'
          }`}>
            {ad.status === 'active' ? 'Aktif' : ad.status === 'paused' ? 'Duraklatildi' : 'Silindi'}
          </span>
        </div>
      </div>

      {/* Middle section: Text content */}
      <div className="p-4 space-y-2">
        <h4 className="font-commons font-semibold text-sm text-[#171717] line-clamp-1">
          {ad.name}
        </h4>
        {creative.headline && (
          <p className="font-commons text-sm text-[#171717] font-medium line-clamp-1">
            {creative.headline}
          </p>
        )}
        {creative.primaryText && (
          <p className="font-commons text-xs text-neutral-500 line-clamp-2">
            {creative.primaryText}
          </p>
        )}
        {creative.callToAction && (
          <span className="inline-block mt-1 px-3 py-1 bg-indigo-600 text-white text-xs font-commons rounded">
            {creative.callToAction}
          </span>
        )}
      </div>

      {/* Bottom section: Performance metrics (if available) */}
      {ad.performanceSummary && (
        <div className="border-t border-neutral-100 px-4 py-3 grid grid-cols-3 gap-2">
          <div className="text-center">
            <Eye className="w-3.5 h-3.5 text-neutral-400 mx-auto" />
            <p className="font-commons text-xs text-neutral-500 mt-0.5">{ad.performanceSummary.impressions.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <MousePointer className="w-3.5 h-3.5 text-neutral-400 mx-auto" />
            <p className="font-commons text-xs text-neutral-500 mt-0.5">{ad.performanceSummary.clicks.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <DollarSign className="w-3.5 h-3.5 text-neutral-400 mx-auto" />
            <p className="font-commons text-xs text-neutral-500 mt-0.5">{ad.performanceSummary.spend.toFixed(0)} TL</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreativePreviewCard;
