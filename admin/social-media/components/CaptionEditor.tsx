import React, { useState } from 'react';
import { Sparkles, Loader2, Hash, Minimize2, Maximize2, Smile, AtSign } from 'lucide-react';
import type { SocialPlatform, PostType } from '@/shared/types/socialMedia';
import { SOCIAL_PLATFORM_LABELS } from '@/shared/types/socialMedia';
import { authenticatedFetch } from '@/lib/firebase/apiClient';

interface CaptionEditorProps {
  caption: string;
  onCaptionChange: (caption: string) => void;
  hashtags: string;
  onHashtagsChange: (hashtags: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  platform: SocialPlatform;
  postType: PostType;
  projectId: string;
  mediaUrls?: string[];
}

const PLATFORM_CHAR_LIMITS: Record<SocialPlatform, number> = {
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  twitter: 280,
  facebook: 63206,
};

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
    title: 'İlgili hashtagler öner',
  },
];

const CaptionEditor: React.FC<CaptionEditorProps> = ({
  caption,
  onCaptionChange,
  hashtags,
  onHashtagsChange,
  title,
  onTitleChange,
  platform,
  postType,
  projectId,
  mediaUrls,
}) => {
  const [generatingAI, setGeneratingAI] = useState(false);
  const [refiningInstruction, setRefiningInstruction] = useState<RefinementInstruction | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const charLimit = PLATFORM_CHAR_LIMITS[platform];
  const captionLength = caption.length;
  const isOverLimit = captionLength > charLimit;

  const callCaptionAPI = async (body: Record<string, unknown>) => {
    const res = await authenticatedFetch('/api/social-media/generate-caption', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('AI caption olusturulamadi');
    return res.json();
  };

  const handleGenerateAI = async () => {
    setGeneratingAI(true);
    setAiError(null);
    try {
      const data = await callCaptionAPI({
        projectId,
        platform,
        postType,
        mediaUrls,
        title: title || undefined,
      });
      if (data.caption) onCaptionChange(data.caption);
      if (data.hashtags) onHashtagsChange(data.hashtags);
    } catch (err) {
      console.error('[CaptionEditor] AI generation error:', err);
      setAiError('AI caption olusturulurken bir hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleRefine = async (instruction: RefinementInstruction) => {
    if (!caption.trim()) return;
    setRefiningInstruction(instruction);
    setAiError(null);
    try {
      const data = await callCaptionAPI({
        projectId,
        platform,
        postType,
        existingCaption: caption,
        instruction,
      });
      if (data.caption) onCaptionChange(data.caption);
      if (data.hashtags) onHashtagsChange(data.hashtags);
    } catch (err) {
      console.error('[CaptionEditor] Refinement error:', err);
      setAiError('İşlem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setRefiningInstruction(null);
    }
  };

  const isAnyLoading = generatingAI || refiningInstruction !== null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-grotesk font-semibold text-[#171717]">
          Caption & İçerik
        </h2>
        <p className="font-grotesk text-sm text-neutral-500 mt-1">
          {SOCIAL_PLATFORM_LABELS[platform]} için caption ve hashtag yazın
        </p>
      </div>

      {/* Title */}
      <div>
        <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
          Başlık <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Post başlığı (dahili kullanım)..."
          className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all"
        />
      </div>

      {/* Caption */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block font-grotesk text-sm font-medium text-[#171717]">
            Caption
          </label>
          <button
            type="button"
            onClick={handleGenerateAI}
            disabled={isAnyLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-grotesk text-xs font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50"
          >
            {generatingAI ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                AI ile Oluştur
              </>
            )}
          </button>
        </div>
        <textarea
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="Post caption metni..."
          rows={6}
          className={`w-full px-4 py-2.5 rounded-xl border font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 transition-all resize-none ${
            isOverLimit
              ? 'border-red-300 focus:border-red-500'
              : 'border-neutral-200 focus:border-[#171717]'
          }`}
        />

        {/* Inline AI refinement toolbar */}
        {caption.trim().length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="font-grotesk text-xs text-neutral-400 mr-1">AI:</span>
            {REFINEMENT_BUTTONS.map(({ instruction, label, icon, title: btnTitle }) => {
              const isLoading = refiningInstruction === instruction;
              return (
                <button
                  key={instruction}
                  type="button"
                  onClick={() => handleRefine(instruction)}
                  disabled={isAnyLoading}
                  title={btnTitle}
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

        <div className="flex items-center justify-between mt-1">
          <p className="font-grotesk text-xs text-neutral-400">
            {platform === 'twitter' ? 'Twitter karakter limiti düşüktür' : ''}
          </p>
          <p
            className={`font-grotesk text-xs ${
              isOverLimit ? 'text-red-500 font-medium' : 'text-neutral-400'
            }`}
          >
            {captionLength} / {charLimit}
          </p>
        </div>
      </div>

      {/* AI Error */}
      {aiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="font-grotesk text-xs text-red-700">{aiError}</p>
        </div>
      )}

      {/* Hashtags */}
      <div>
        <label className="flex items-center gap-1.5 font-grotesk text-sm font-medium text-[#171717] mb-1.5">
          <Hash className="w-4 h-4" />
          Hashtagler
        </label>
        <input
          type="text"
          value={hashtags}
          onChange={(e) => onHashtagsChange(e.target.value)}
          placeholder="#hashtag1 #hashtag2 #hashtag3..."
          className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all"
        />
        <p className="mt-1 font-grotesk text-xs text-neutral-400">
          Boşluk veya virgül ile ayırarak birden fazla hashtag ekleyebilirsiniz
        </p>
      </div>
    </div>
  );
};

export default CaptionEditor;
