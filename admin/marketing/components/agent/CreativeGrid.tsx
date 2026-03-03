import React from 'react';
import { Palette, Image } from 'lucide-react';

interface CreativeItem {
  id: string;
  name: string;
  title?: string;
  body?: string;
  thumbnail_url?: string | null;
  status: string;
}

interface CreativeGridProps {
  data: {
    creatives: CreativeItem[];
  };
  onSendMessage: (text: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  unknown: 'bg-neutral-100 text-neutral-600',
};

const CreativeGrid: React.FC<CreativeGridProps> = ({ data, onSendMessage }) => {
  const { creatives } = data;

  if (!creatives || creatives.length === 0) {
    return (
      <div className="my-2 p-4 rounded-xl border border-neutral-200 bg-white text-center">
        <Palette className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <p className="text-sm font-commons text-neutral-500">Henuz creative bulunamadi</p>
      </div>
    );
  }

  return (
    <div className="my-2">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Palette className="w-4 h-4 text-violet-500" />
        <span className="text-sm font-commons font-bold text-[#171717]">
          Creative'ler ({creatives.length})
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {creatives.map((creative) => (
          <button
            key={creative.id}
            onClick={() => onSendMessage(`${creative.name || creative.id} creative detaylarini goster`)}
            className="text-left p-3 rounded-xl border border-neutral-200 bg-white hover:border-indigo-300 hover:shadow-sm transition-all group"
          >
            {/* Thumbnail */}
            <div className="w-full h-24 bg-neutral-100 rounded-lg overflow-hidden mb-2">
              {creative.thumbnail_url ? (
                <img src={creative.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="w-6 h-6 text-neutral-300" />
                </div>
              )}
            </div>

            {/* Info */}
            <p className="text-xs font-commons font-medium text-[#171717] truncate mb-0.5 group-hover:text-indigo-600">
              {creative.name || creative.title || 'Isimsiz'}
            </p>
            {creative.body && (
              <p className="text-[10px] font-commons text-neutral-400 truncate mb-1.5">
                {creative.body}
              </p>
            )}

            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-commons font-medium ${STATUS_COLORS[creative.status] || STATUS_COLORS.unknown}`}>
              {creative.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CreativeGrid;
