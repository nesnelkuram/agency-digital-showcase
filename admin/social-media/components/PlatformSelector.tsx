import React from 'react';
import { Instagram, Linkedin, Facebook } from 'lucide-react';
import type { SocialPlatform } from '@/shared/types/socialMedia';
import { SOCIAL_PLATFORM_LABELS, PLATFORM_POST_TYPES, POST_TYPE_LABELS } from '@/shared/types/socialMedia';

interface PlatformSelectorProps {
  selected: SocialPlatform | null;
  onSelect: (platform: SocialPlatform) => void;
}

const PLATFORM_ICONS: Record<SocialPlatform, React.ReactNode> = {
  instagram: <Instagram className="w-7 h-7" />,
  tiktok: (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.89 2.89 2.89 0 012.88-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.81a8.23 8.23 0 004.76 1.5V6.86a4.84 4.84 0 01-1-.17z" />
    </svg>
  ),
  linkedin: <Linkedin className="w-7 h-7" />,
  twitter: (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  facebook: <Facebook className="w-7 h-7" />,
};

const PLATFORM_GRADIENTS: Record<SocialPlatform, string> = {
  instagram: 'from-pink-500 to-purple-500',
  tiktok: 'from-gray-800 to-gray-900',
  linkedin: 'from-sky-500 to-sky-600',
  twitter: 'from-blue-400 to-blue-500',
  facebook: 'from-indigo-500 to-indigo-600',
};

const ALL_PLATFORMS: SocialPlatform[] = ['instagram', 'tiktok', 'linkedin', 'twitter', 'facebook'];

const PlatformSelector: React.FC<PlatformSelectorProps> = ({ selected, onSelect }) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-grotesk font-semibold text-[#171717]">
          Platform Secin
        </h2>
        <p className="font-grotesk text-sm text-neutral-500 mt-1">
          Icerik olusturmak istediginiz platformu secin
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ALL_PLATFORMS.map((platform) => {
          const isSelected = selected === platform;
          const types = PLATFORM_POST_TYPES[platform];

          return (
            <button
              key={platform}
              type="button"
              onClick={() => onSelect(platform)}
              className={`
                relative p-5 rounded-xl border-2 text-left transition-all
                ${
                  isSelected
                    ? 'border-[#171717] bg-neutral-50 shadow-sm'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50'
                }
              `}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${PLATFORM_GRADIENTS[platform]} text-white flex items-center justify-center flex-shrink-0`}
                >
                  {PLATFORM_ICONS[platform]}
                </div>
                <div className="min-w-0">
                  <h3 className="font-grotesk font-semibold text-[#171717]">
                    {SOCIAL_PLATFORM_LABELS[platform]}
                  </h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {types.map((type) => (
                      <span
                        key={type}
                        className="px-2 py-0.5 bg-neutral-100 rounded font-grotesk text-[10px] text-neutral-600"
                      >
                        {POST_TYPE_LABELS[type]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-[#171717] rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
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

export default PlatformSelector;
