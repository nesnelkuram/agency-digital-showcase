import React, { useState, useMemo } from 'react';
import { Sparkles, Loader2, Minimize2, Maximize2, Smile, AtSign } from 'lucide-react';
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

type RefinementInstruction = 'daha_kisa' | 'daha_uzun' | 'emoji_ekle' | 'hashtag_oner';

const REFINEMENT_BUTTONS: {
  instruction: RefinementInstruction;
  label: string;
  icon: React.ReactNode;
  title: string;
}[] = [
  {
    instruction: 'daha_kisa',
    label: 'Daha Kısa',
    icon: <Minimize2 className="w-3 h-3" />,
    title: 'Metni daha kısa yap',
  },
  {
    instruction: 'daha_uzun',
    label: 'Daha Uzun',
    icon: <Maximize2 className="w-3 h-3" />,
    title: 'Metni daha uzun ve detaylı yap',
  },
  {
    instruction: 'emoji_ekle',
    label: 'Emoji Ekle',
    icon: <Smile className="w-3 h-3" />,
    title: 'Uygun emojiler ekle',
  },
  {
    instruction: 'hashtag_oner',
    label: 'Hashtag Öner',
    icon: <AtSign className="w-3 h-3" />,
    title: 'İlgili hashtagler öner ve mevcut değere ekle',
  },
];

const CaptionField: React.FC<CaptionFieldProps> = ({
  value,
  onChange,
  platforms,
  projectId,
  mediaUrls,
}) => {
  const [generatingAI, setGeneratingAI] = useState(false);
  const [refiningInstruction, setRefiningInstruction] = useState<RefinementInstruction | null>(null);
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
  const isAnyLoading = generatingAI || refiningInstruction !== null;

  const callAPI = async (body: Record<string, unknown>) => {
    const res = await authenticatedFetch('/api/social-media/generate-caption', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('AI caption olusturulamadi');
    return res.json();
  };

  const handleGenerateAI = async () => {
    if (platforms.length === 0) return;
    setGeneratingAI(true);
    setAiError(null);

    try {
      const data = await callAPI({
        projectId,
        platform: platforms[0],
        postType: 'static',
        mediaUrls,
      });
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

  const handleRefine = async (instruction: RefinementInstruction) => {
    if (!value.trim() || platforms.length === 0) return;
    setRefiningInstruction(instruction);
    setAiError(null);
    try {
      const data = await callAPI({
        projectId,
        platform: platforms[0],
        postType: 'static',
        existingCaption: value,
        instruction,
      });
      // For hashtag_oner, append hashtags to existing caption
      if (instruction === 'hashtag_oner' && data.hashtags) {
        const hashtagLine = '\n\n' + data.hashtags
          .split(/[,\s]+/)
          .map((h: string) => (h.startsWith('#') ? h : `#${h}`))
          .join(' ');
        onChange(value + hashtagLine);
      } else if (data.caption) {
        onChange(data.caption);
      }
    } catch (err) {
      console.error('[CaptionField] Refinement error:', err);
      setAiError('İşlem sırasında bir hata oluştu.');
    } finally {
      setRefiningInstruction(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Caption yazın... Hashtag'leri doğrudan buraya ekleyebilirsiniz"
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
          disabled={isAnyLoading || platforms.length === 0}
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
              AI ile Oluştur
            </>
          )}
        </button>
      </div>

      {/* Inline AI refinement toolbar — shows when caption has content */}
      {value.trim().length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-grotesk text-xs text-neutral-400 mr-1">AI:</span>
          {REFINEMENT_BUTTONS.map(({ instruction, label, icon, title }) => {
            const isLoading = refiningInstruction === instruction;
            return (
              <button
                key={instruction}
                type="button"
                onClick={() => handleRefine(instruction)}
                disabled={isAnyLoading}
                title={title}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-200 bg-white font-grotesk text-xs text-neutral-600 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  icon
                )}
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Char counter + error */}
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
