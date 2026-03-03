import React from 'react';
import { ImagePlus, Hash, Maximize2 } from 'lucide-react';

interface ImageUploadResultProps {
  data: {
    hash: string;
    url?: string | null;
    width?: number | null;
    height?: number | null;
  };
  onSendMessage: (text: string) => void;
}

const ImageUploadResult: React.FC<ImageUploadResultProps> = ({ data, onSendMessage }) => {
  return (
    <div className="my-2 p-4 rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <ImagePlus className="w-4 h-4 text-emerald-500" />
        <span className="text-sm font-commons font-bold text-[#171717]">Gorsel Yuklendi</span>
      </div>

      {data.url && (
        <div className="relative w-full h-36 bg-neutral-100 rounded-lg overflow-hidden mb-3">
          <img src={data.url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs font-commons text-neutral-500 mb-3">
        <div className="flex items-center gap-1">
          <Hash className="w-3 h-3" />
          <span className="font-mono">{data.hash}</span>
        </div>
        {data.width && data.height && (
          <div className="flex items-center gap-1">
            <Maximize2 className="w-3 h-3" />
            <span>{data.width} x {data.height}</span>
          </div>
        )}
      </div>

      <button
        onClick={() => onSendMessage('Bu gorselle creative olustur')}
        className="w-full px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-commons font-medium transition-colors"
      >
        Creative Olustur
      </button>
    </div>
  );
};

export default ImageUploadResult;
