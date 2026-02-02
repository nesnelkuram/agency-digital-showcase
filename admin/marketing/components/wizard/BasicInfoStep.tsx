import React from 'react';
import {
  CampaignObjective,
  AdPlatform,
  OBJECTIVE_LABELS,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
} from '@/shared/types/marketing';

interface BasicInfoStepProps {
  data: {
    name: string;
    description: string;
    objective: CampaignObjective | '';
    platforms: AdPlatform[];
    brief: string;
  };
  mode: 'manual' | 'ai';
  onChange: (field: string, value: any) => void;
}

export function BasicInfoStep({ data, mode, onChange }: BasicInfoStepProps) {
  const objectives: CampaignObjective[] = [
    'awareness',
    'traffic',
    'engagement',
    'leads',
    'sales',
    'app_installs',
    'video_views',
  ];

  const platforms: AdPlatform[] = ['meta', 'google', 'tiktok', 'linkedin'];

  const handlePlatformToggle = (platform: AdPlatform) => {
    const newPlatforms = data.platforms.includes(platform)
      ? data.platforms.filter((p) => p !== platform)
      : [...data.platforms, platform];
    onChange('platforms', newPlatforms);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Campaign Name */}
        <div>
          <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
            Kampanya Adı <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Örn: Yaz Sezonu Kampanyası 2026"
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
            Açıklama
          </label>
          <textarea
            value={data.description}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Kampanya hakkında kısa notlar..."
            rows={3}
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>

        {/* Objective */}
        <div>
          <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
            Hedef <span className="text-red-500">*</span>
          </label>
          <select
            value={data.objective}
            onChange={(e) =>
              onChange('objective', e.target.value as CampaignObjective)
            }
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
          >
            <option value="">Hedef seçin</option>
            {objectives.map((obj) => (
              <option key={obj} value={obj}>
                {OBJECTIVE_LABELS[obj]}
              </option>
            ))}
          </select>
        </div>

        {/* Platforms */}
        <div>
          <label className="text-sm font-commons font-medium text-[#171717] mb-2 block">
            Platformlar <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {platforms.map((platform) => {
              const isSelected = data.platforms.includes(platform);
              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => handlePlatformToggle(platform)}
                  className={`
                    flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all
                    ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }
                  `}
                >
                  <span
                    className={`
                      px-2 py-1 rounded text-xs font-commons font-medium
                      ${PLATFORM_COLORS[platform]}
                    `}
                  >
                    {PLATFORM_LABELS[platform]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Brief (AI mode only) */}
        {mode === 'ai' && (
          <div>
            <label className="text-sm font-commons font-medium text-[#171717] mb-1 block">
              Brief <span className="text-red-500">*</span>
            </label>
            <textarea
              value={data.brief}
              onChange={(e) => onChange('brief', e.target.value)}
              placeholder="Kampanyanızın amacını, hedef kitlenizi ve beklentilerinizi kısaca anlatın..."
              rows={5}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
            <p className="mt-1 text-xs font-commons text-neutral-500">
              AI bu bilgileri kullanarak kampanya detaylarını otomatik oluşturacak
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
