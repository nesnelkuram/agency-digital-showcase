import React from 'react';
import { Palette, ExternalLink } from 'lucide-react';

interface CreativePreviewCardProps {
  data: {
    id: string;
    name?: string;
    title: string;
    body: string;
    description?: string;
    linkUrl?: string;
    callToAction?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    status?: string;
  };
  onSendMessage: (text: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  unknown: 'bg-neutral-100 text-neutral-600',
};

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: 'Daha Fazla',
  SHOP_NOW: 'Simdi Satin Al',
  SIGN_UP: 'Kaydol',
  DOWNLOAD: 'Indir',
  CONTACT_US: 'Iletisim',
  BOOK_NOW: 'Simdi Rezerve Et',
  APPLY_NOW: 'Simdi Basvur',
  GET_OFFER: 'Teklif Al',
  SUBSCRIBE: 'Abone Ol',
  WATCH_MORE: 'Daha Fazla Izle',
};

const CreativePreviewCard: React.FC<CreativePreviewCardProps> = ({ data, onSendMessage }) => {
  const imageSource = data.imageUrl || data.thumbnailUrl;

  return (
    <div className="my-2 p-4 rounded-xl border border-neutral-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-commons font-bold text-[#171717]">{data.name || 'Creative'}</span>
        </div>
        {data.status && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-commons font-medium ${STATUS_COLORS[data.status] || STATUS_COLORS.unknown}`}>
            {data.status}
          </span>
        )}
      </div>

      {/* Preview */}
      <div className="border border-neutral-100 rounded-lg overflow-hidden mb-3">
        {imageSource && (
          <div className="relative w-full h-40 bg-neutral-100">
            <img src={imageSource} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-3">
          {data.title && (
            <p className="text-sm font-commons font-semibold text-[#171717] mb-1">{data.title}</p>
          )}
          {data.body && (
            <p className="text-xs font-commons text-neutral-600 mb-1.5 line-clamp-3">{data.body}</p>
          )}
          {data.description && (
            <p className="text-[10px] font-commons text-neutral-400 mb-1.5">{data.description}</p>
          )}

          <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100">
            {data.linkUrl && (
              <span className="text-[10px] font-commons text-neutral-400 truncate max-w-[60%]">{data.linkUrl}</span>
            )}
            {data.callToAction && (
              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-commons font-medium">
                {CTA_LABELS[data.callToAction] || data.callToAction}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ID info */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-commons text-neutral-400">ID: {data.id}</span>
        <button
          onClick={() => onSendMessage(`${data.id} creative ile reklam olustur`)}
          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-commons font-medium transition-colors"
        >
          Bu Creative ile Reklam Olustur
        </button>
      </div>
    </div>
  );
};

export default CreativePreviewCard;
