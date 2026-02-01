import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import type {
  PostType,
  SocialPlatform,
  CreateSocialPostData,
} from '@/shared/types/socialMedia';
import {
  POST_TYPE_LABELS,
  SOCIAL_PLATFORM_LABELS,
} from '@/shared/types/socialMedia';
import { createSocialPost } from '@/shared/services/socialMediaService';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';

const POST_TYPES: PostType[] = ['reels', 'story', 'carousel', 'static', 'video', 'text'];
const ALL_PLATFORMS: SocialPlatform[] = ['instagram', 'tiktok', 'linkedin', 'twitter', 'facebook'];

const CreatePostPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [postType, setPostType] = useState<PostType>('static');
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlatformToggle = (platform: SocialPlatform) => {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !user) return;

    if (!title.trim()) {
      setError('Baslik zorunludur.');
      return;
    }

    if (platforms.length === 0) {
      setError('En az bir platform secmelisiniz.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const hashtagList = hashtags
        .split(',')
        .map((h) => h.trim())
        .filter((h) => h.length > 0);

      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const data: CreateSocialPostData = {
        projectId,
        title: title.trim(),
        caption: caption.trim() || undefined,
        hashtags: hashtagList.length > 0 ? hashtagList : undefined,
        postType,
        platforms,
        scheduledAt: scheduledAt
          ? Timestamp.fromDate(new Date(scheduledAt))
          : undefined,
        tags: tagList.length > 0 ? tagList : undefined,
      };

      await createSocialPost(data, user.uid, user.displayName || 'Bilinmeyen');
      navigate(`/admin/projects/${projectId}/social-media`);
    } catch (err) {
      console.error('[CreatePostPage] Error creating post:', err);
      setError('Post olusturulurken bir hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      {projectId && (
        <nav className="flex items-center gap-1.5 text-sm font-grotesk text-neutral-500 mb-2">
          <ProjectBreadcrumb projectId={projectId} currentPage="Sosyal Medya" />
        </nav>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/admin/projects/${projectId}/social-media`)}
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717]">
            Yeni Post
          </h1>
          <p className="font-grotesk text-neutral-600 mt-1">
            Yeni bir sosyal medya postu olusturun
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-neutral-100 p-6 space-y-5">
          {/* Baslik */}
          <div>
            <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
              Baslik <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post basligi girin..."
              className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all"
              required
            />
          </div>

          {/* Aciklama / Caption */}
          <div>
            <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
              Aciklama / Caption
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Post aciklamasi veya caption metni..."
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all resize-none"
            />
          </div>

          {/* Hashtagler */}
          <div>
            <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
              Hashtagler
            </label>
            <input
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="hashtag1, hashtag2, hashtag3..."
              className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all"
            />
            <p className="mt-1 text-xs font-grotesk text-neutral-400">
              Virgul ile ayirarak birden fazla hashtag ekleyebilirsiniz
            </p>
          </div>

          {/* Post Tipi */}
          <div>
            <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
              Post Tipi
            </label>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value as PostType)}
              className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all bg-white"
            >
              {POST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {POST_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          {/* Platformlar */}
          <div>
            <label className="block font-grotesk text-sm font-medium text-[#171717] mb-2">
              Platformlar <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((platform) => {
                const isActive = platforms.includes(platform);
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => handlePlatformToggle(platform)}
                    className={`
                      px-4 py-2 rounded-xl font-grotesk text-sm font-medium transition-all border
                      ${
                        isActive
                          ? 'bg-[#171717] text-white border-[#171717]'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                      }
                    `}
                  >
                    {SOCIAL_PLATFORM_LABELS[platform]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Planlama Tarihi */}
          <div>
            <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
              Planlama Tarihi ve Saati
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all"
            />
            <p className="mt-1 text-xs font-grotesk text-neutral-400">
              Bos birakirsaniz post taslak olarak kaydedilir
            </p>
          </div>

          {/* Etiketler */}
          <div>
            <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
              Etiketler
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="etiket1, etiket2, etiket3..."
              className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all"
            />
            <p className="mt-1 text-xs font-grotesk text-neutral-400">
              Dahili organizasyon icin virgul ile ayrilmis etiketler
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="font-grotesk text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(`/admin/projects/${projectId}/social-media`)}
            className="px-5 py-2.5 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            Iptal
          </button>
          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={{ scale: submitting ? 1 : 1.02 }}
            whileTap={{ scale: submitting ? 1 : 0.98 }}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Post Olustur
              </>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );
};

export default CreatePostPage;
