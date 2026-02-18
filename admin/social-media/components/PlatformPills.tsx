import React from 'react';
import { Instagram, Music2, Linkedin, Twitter, Facebook } from 'lucide-react';
import type { SocialPlatform } from '@/shared/types/socialMedia';
import { SOCIAL_PLATFORM_LABELS } from '@/shared/types/socialMedia';

interface PlatformPillsProps {
  selected: SocialPlatform[];
  onChange: (platforms: SocialPlatform[]) => void;
}

const PLATFORM_ICONS: Record<SocialPlatform, React.ElementType> = {
  instagram: Instagram,
  tiktok: Music2,
  linkedin: Linkedin,
  twitter: Twitter,
  facebook: Facebook,
};

const ALL_PLATFORMS: SocialPlatform[] = ['instagram', 'tiktok', 'linkedin', 'twitter', 'facebook'];

const PlatformPills: React.FC<PlatformPillsProps> = ({ selected, onChange }) => {
  const toggle = (platform: SocialPlatform) => {
    if (selected.includes(platform)) {
      onChange(selected.filter((p) => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {ALL_PLATFORMS.map((platform) => {
        const Icon = PLATFORM_ICONS[platform];
        const isSelected = selected.includes(platform);
        return (
          <button
            key={platform}
            type="button"
            onClick={() => toggle(platform)}
            className={`
              inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full font-grotesk text-sm font-medium transition-all
              ${
                isSelected
                  ? 'bg-[#171717] text-white'
                  : 'border border-neutral-300 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            {SOCIAL_PLATFORM_LABELS[platform]}
          </button>
        );
      })}
    </div>
  );
};

export default PlatformPills;
