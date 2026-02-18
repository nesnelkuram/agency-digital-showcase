import React, { useState } from 'react';
import { Sparkles, Loader2, Hash } from 'lucide-react';
import type { SocialPlatform, PostType } from '@/shared/types/socialMedia';
import { SOCIAL_PLATFORM_LABELS } from '@/shared/types/socialMedia';

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
  const [aiError, setAiError] = useState<string | null>(null);

  const charLimit = PLATFORM_CHAR_LIMITS[platform];
  const captionLength = caption.length;
  const isOverLimit = captionLength > charLimit;

  const handleGenerateAI = async () => {
    setGeneratingAI(true);
    setAiError(null);

    try {
      const res = await fetch('/api/social-media/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          platform,
          postType,
          mediaUrls,
          title: title || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('AI caption olusturulamadi');
      }

      const data = await res.json();

      if (data.caption) {
        onCaptionChange(data.caption);
      }
      if (data.hashtags) {
        onHashtagsChange(data.hashtags);
      }
    } catch (err) {
      console.error('[CaptionEditor] AI generation error:', err);
      setAiError('AI caption olusturulurken bir hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setGeneratingAI(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-grotesk font-semibold text-[#171717]">
          Caption & Icerik
        </h2>
        <p className="font-grotesk text-sm text-neutral-500 mt-1">
          {SOCIAL_PLATFORM_LABELS[platform]} icin caption ve hashtag yazin
        </p>
      </div>

      {/* Title */}
      <div>
        <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
          Baslik <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Post basligi (dahili kullanim)..."
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
            disabled={generatingAI}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-grotesk text-xs font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50"
          >
            {generatingAI ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Olusturuluyor...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                AI ile Olustur
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
        <div className="flex items-center justify-between mt-1">
          <p className="font-grotesk text-xs text-neutral-400">
            {platform === 'twitter' ? 'Twitter karakter limiti dusuktur' : ''}
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
          Bosluk veya virgul ile ayirarak birden fazla hashtag ekleyebilirsiniz
        </p>
      </div>
    </div>
  );
};

export default CaptionEditor;
