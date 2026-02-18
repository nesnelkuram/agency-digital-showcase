import React from 'react';
import { Image, Film, Layers, Type, Play, CircleDot } from 'lucide-react';
import type { PostType, SocialPlatform } from '@/shared/types/socialMedia';
import { POST_TYPE_LABELS, PLATFORM_POST_TYPES } from '@/shared/types/socialMedia';

interface PostTypeSelectorProps {
  platform: SocialPlatform;
  selected: PostType | null;
  onSelect: (type: PostType) => void;
}

const POST_TYPE_ICONS: Record<PostType, React.ReactNode> = {
  static: <Image className="w-6 h-6" />,
  carousel: <Layers className="w-6 h-6" />,
  reels: <Play className="w-6 h-6" />,
  story: <CircleDot className="w-6 h-6" />,
  video: <Film className="w-6 h-6" />,
  text: <Type className="w-6 h-6" />,
};

const POST_TYPE_DESCRIPTIONS: Record<PostType, string> = {
  static: 'Tek gorsel paylasimi',
  carousel: 'Birden fazla gorsel kaydirmali',
  reels: 'Kisa dikey video (9:16)',
  story: '24 saat gecerli dikey icerik',
  video: 'Video paylasimi',
  text: 'Sadece metin icerigi',
};

const PostTypeSelector: React.FC<PostTypeSelectorProps> = ({
  platform,
  selected,
  onSelect,
}) => {
  const availableTypes = PLATFORM_POST_TYPES[platform] || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-grotesk font-semibold text-[#171717]">
          Post Tipi Secin
        </h2>
        <p className="font-grotesk text-sm text-neutral-500 mt-1">
          Bu platform icin icerik turunu belirleyin
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {availableTypes.map((type) => {
          const isSelected = selected === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className={`
                relative p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4
                ${
                  isSelected
                    ? 'border-[#171717] bg-neutral-50 shadow-sm'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50'
                }
              `}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isSelected
                    ? 'bg-[#171717] text-white'
                    : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {POST_TYPE_ICONS[type]}
              </div>
              <div>
                <h3 className="font-grotesk font-medium text-[#171717] text-sm">
                  {POST_TYPE_LABELS[type]}
                </h3>
                <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                  {POST_TYPE_DESCRIPTIONS[type]}
                </p>
              </div>

              {isSelected && (
                <div className="absolute top-3 right-3 w-4 h-4 bg-[#171717] rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PostTypeSelector;
