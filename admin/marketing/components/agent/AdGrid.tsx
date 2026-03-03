import React from 'react';
import { motion } from 'framer-motion';
import { Image, Play, Pause, CircleDot } from 'lucide-react';

interface AdItem {
  id: string;
  name: string;
  status: string;
  creative_thumbnail?: string | null;
  creative_title?: string;
  creative_body?: string;
  adset_id?: string;
}

interface AdGridProps {
  data: {
    ads: AdItem[];
    adsetId?: string | null;
    campaignId?: string | null;
  };
  onSendMessage: (text: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  disapproved: 'bg-red-100 text-red-700',
  pending_review: 'bg-amber-100 text-amber-700',
  with_issues: 'bg-orange-100 text-orange-700',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  paused: 'Duraklatildi',
  disapproved: 'Reddedildi',
  pending_review: 'Incelemede',
  with_issues: 'Sorunlu',
};

const STATUS_ICONS: Record<string, React.FC<{ className?: string }>> = {
  active: Play,
  paused: Pause,
};

const AdGrid: React.FC<AdGridProps> = ({ data, onSendMessage }) => {
  const { ads } = data;

  if (!ads || ads.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        Reklam bulunamadi.
      </div>
    );
  }

  const activeCount = ads.filter(a => a.status === 'active').length;

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2 px-1">
        <span className="text-xs font-commons font-medium text-neutral-500">
          <Image className="w-3.5 h-3.5 inline mr-1" />
          {ads.length} reklam
        </span>
        {activeCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-commons text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {activeCount} aktif
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
        {ads.map((ad, i) => {
          const statusColor = STATUS_COLORS[ad.status] || 'bg-neutral-100 text-neutral-600';
          const StatusIcon = STATUS_ICONS[ad.status] || CircleDot;

          return (
            <motion.button
              key={ad.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.5) }}
              onClick={() => onSendMessage(`${ad.name} reklami hakkinda bilgi ver`)}
              className="flex gap-2.5 p-3 rounded-xl border border-neutral-150 bg-white hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer text-left"
            >
              {/* Thumbnail */}
              {ad.creative_thumbnail ? (
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-100">
                  <img
                    src={ad.creative_thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg flex-shrink-0 bg-neutral-100 flex items-center justify-center">
                  <Image className="w-5 h-5 text-neutral-300" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <p className="text-xs font-commons font-semibold text-[#171717] line-clamp-1 flex-1">
                    {ad.name}
                  </p>
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-commons font-medium flex-shrink-0 ${statusColor}`}>
                    <StatusIcon className="w-2 h-2" />
                    {STATUS_LABELS[ad.status] || ad.status}
                  </span>
                </div>
                {ad.creative_title && (
                  <p className="text-[10px] font-commons text-neutral-500 line-clamp-1">
                    {ad.creative_title}
                  </p>
                )}
                {ad.creative_body && (
                  <p className="text-[10px] font-commons text-neutral-400 line-clamp-1 mt-0.5">
                    {ad.creative_body}
                  </p>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default AdGrid;
