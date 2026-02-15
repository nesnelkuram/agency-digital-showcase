import React from 'react';
import { Image, MoreHorizontal } from 'lucide-react';
import type { AdCreative } from '@/shared/types/marketing';

interface FeedAdMockupProps {
  creative: AdCreative;
  platform?: 'facebook' | 'instagram';
  pageName?: string;
}

const FeedAdMockup: React.FC<FeedAdMockupProps> = ({
  creative,
  platform = 'facebook',
  pageName = 'Isletme Sayfasi',
}) => {
  return (
    <div className="max-w-[320px] mx-auto bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden">
      {/* Top bar: Page info */}
      {platform === 'instagram' ? (
        <div className="flex items-center justify-between p-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {pageName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-semibold text-sm text-[#171717] leading-tight">{pageName}</p>
              <p className="text-xs text-neutral-400">Sponsorlu</p>
            </div>
          </div>
          <button className="text-neutral-400 hover:text-neutral-600">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 border-b border-neutral-100">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
            <span className="text-indigo-600 text-xs font-bold">
              {pageName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[#171717] leading-tight truncate">
              {pageName}
              <span className="font-normal text-neutral-400"> &middot; </span>
              <span className="font-normal text-xs text-neutral-400">Sponsorlu</span>
            </p>
          </div>
        </div>
      )}

      {/* Primary text */}
      {creative.primaryText && (
        <div className="px-3 pt-2 text-sm font-commons text-neutral-700 line-clamp-3">
          {creative.primaryText}
          <span className="text-neutral-400 text-xs cursor-pointer"> ...daha fazla goster</span>
        </div>
      )}

      {/* Image / Video area */}
      <div className="mt-2 w-full aspect-video bg-neutral-100 relative overflow-hidden">
        {creative.imageUrl ? (
          <img
            src={creative.imageUrl}
            alt={creative.headline}
            className="w-full h-full object-cover"
          />
        ) : creative.thumbnailUrl ? (
          <img
            src={creative.thumbnailUrl}
            alt={creative.headline}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Image className="w-10 h-10 text-neutral-300" />
            <span className="text-xs text-neutral-400 font-commons">Gorsel Onizleme</span>
          </div>
        )}
      </div>

      {/* Below image: Headline, description, CTA */}
      <div className="p-3 space-y-2">
        {creative.headline && (
          <h4 className="text-sm font-semibold text-[#171717] line-clamp-1">
            {creative.headline}
          </h4>
        )}

        {(creative.description || creative.displayUrl) && (
          <p className="text-xs text-neutral-500 line-clamp-1">
            {creative.description}
            {creative.description && creative.displayUrl && (
              <span className="text-neutral-300"> &middot; </span>
            )}
            {creative.displayUrl && (
              <span className="uppercase">{creative.displayUrl}</span>
            )}
          </p>
        )}

        {creative.callToAction && (
          <div className="w-full py-2 bg-indigo-600 text-white text-sm font-commons font-semibold rounded-lg text-center">
            {creative.callToAction}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedAdMockup;
