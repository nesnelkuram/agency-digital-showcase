import React from 'react';
import { Layers } from 'lucide-react';
import type { AdSet } from '@/shared/types/marketing';
import CreativePreviewCard from './CreativePreviewCard';

interface CreativeGalleryProps {
  adSets: AdSet[];
}

const CreativeGallery: React.FC<CreativeGalleryProps> = ({ adSets }) => {
  // If no ad sets or no ads, show empty state
  const hasAds = adSets.some(as => as.ads.length > 0);

  if (!hasAds) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
        <Layers className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
        <p className="font-commons text-neutral-500">Henuz kreatif yok</p>
        <p className="text-sm font-commons text-neutral-400 mt-1">
          Kampanyanin reklam setlerinde kreatif bulunmuyor
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {adSets.filter(as => as.ads.length > 0).map((adSet) => (
        <div key={adSet.id || adSet.metaAdSetId}>
          {/* Ad set header */}
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-neutral-400" />
            <h3 className="font-commons font-semibold text-[#171717]">{adSet.name}</h3>
            <span className={`px-1.5 py-0.5 rounded text-xs font-commons ${
              adSet.status === 'active' ? 'bg-green-100 text-green-700' :
              adSet.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {adSet.status === 'active' ? 'Aktif' : adSet.status === 'paused' ? 'Duraklatildi' : 'Silindi'}
            </span>
            <span className="text-sm font-commons text-neutral-400">
              ({adSet.ads.length} reklam)
            </span>
          </div>
          {/* Ads grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {adSet.ads.map((ad, i) => (
              <CreativePreviewCard key={ad.id || ad.metaAdId || i} ad={ad} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CreativeGallery;
