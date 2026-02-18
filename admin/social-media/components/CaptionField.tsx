import React, { useState, useMemo } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { SocialPlatform } from '@/shared/types/socialMedia';
import { PLATFORM_CHAR_LIMITS, SOCIAL_PLATFORM_LABELS } from '@/shared/types/socialMedia';
import { authenticatedFetch } from '@/lib/firebase/apiClient';

interface CaptionFieldProps {
  value: string;
  onChange: (value: string) => void;
  platforms: SocialPlatform[];
  projectId: string;
  mediaUrls?: string[];
}

const CaptionField: React.FC<CaptionFieldProps> = ({
  value,
  onChange,
  platforms,
  projectId,
  mediaUrls,
}) => {
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Show the most restrictive platform's char limit
  const { charLimit, limitPlatform } = useMemo(() => {
    if (platforms.length === 0) return { charLimit: 2200, limitPlatform: '' };
    let min = Infinity;
    let minP: SocialPlatform = platforms[0];
    for (const p of platforms) {
      if (PLATFORM_CHAR_LIMITS[p] < min) {
        min = PLATFORM_CHAR_LIMITS[p];
        minP = p;
      }
    }
    return { charLimit: min, limitPlatform: SOCIAL_PLATFORM_LABELS[minP] };
  }, [platforms]);

  const isOverLimit = value.length > charLimit;

  const handleGenerateAI = async () => {
    if (platforms.length === 0) return;
    setGeneratingAI(true);
    setAiError(null);

    try {
      const res = await authenticatedFetch('/api/social-media/generate-caption', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          platform: platforms[0],
          postType: 'static',
          mediaUrls,
        }),
      });

      if (!res.ok) throw new Error('AI caption olusturulamadi');

      const data = await res.json();
      if (data.caption) {
        const hashtags = data.hashtags
          ? '\n\n' + data.hashtags
              .split(/[,\s]+/)
              .map((h: string) => (h.startsWith('#') ? h : `#${h}`))
              .join(' ')
          : '';
        onChange(data.caption + hashtags);
      }
    } catch (err) {
      console.error('[CaptionField] AI generation error:', err);
      setAiError('AI caption olusturulurken bir hata olustu.');
    } finally {
      setGeneratingAI(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Caption yazin... Hashtag'leri dogrudan buraya ekleyebilirsiniz"
          rows={5}
          className={`w-full px-4 py-3 pr-28 rounded-xl border font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 transition-all resize-none ${
            isOverLimit
              ? 'border-red-300 focus:border-red-500'
              : 'border-neutral-200 focus:border-[#171717]'
          }`}
        />
        {/* AI Button - top right of textarea */}
        <button
          type="button"
          onClick={handleGenerateAI}
          disabled={generatingAI || platforms.length === 0}
          className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-grotesk text-xs font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50"
        >
          {generatingAI ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              AI
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              AI ile Olustur
            </>
          )}
        </button>
      </div>

      {/* Char counter + platform indicator */}
      <div className="flex items-center justify-between">
        <div>
          {aiError && (
            <p className="font-grotesk text-xs text-red-500">{aiError}</p>
          )}
        </div>
        <p
          className={`font-grotesk text-xs ${
            isOverLimit ? 'text-red-500 font-medium' : 'text-neutral-400'
          }`}
        >
          {value.length} / {charLimit}
          {platforms.length > 1 && ` (${limitPlatform})`}
        </p>
      </div>
    </div>
  );
};

export default CaptionField;
