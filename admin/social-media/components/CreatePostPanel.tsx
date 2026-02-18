import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Save, CalendarCheck, Plus, Trash2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import type {
  SocialPlatform,
  PostType,
  MediaItem,
  CreateSocialPostData,
} from '@/shared/types/socialMedia';
import { PLATFORM_POST_TYPES } from '@/shared/types/socialMedia';
import { createSocialPost, createMultiplePosts } from '@/shared/services/socialMediaService';
import { useMediaUpload } from '@/shared/hooks/useMediaUpload';
import PlatformPills from './PlatformPills';
import MediaDropZone from './MediaDropZone';
import PostTypeDropdown from './PostTypeDropdown';
import CaptionField from './CaptionField';
import LivePreviewSidebar from './LivePreviewSidebar';

interface CreatePostPanelProps {
  open: boolean;
  onClose: () => void;
  onPostCreated: () => void;
  projectId: string;
  prefilledDate?: Date;
}

interface StoryFrame {
  id: string;
  media: MediaItem[];
  caption: string;
}

function detectPostType(media: MediaItem[], platforms: SocialPlatform[]): { type: PostType; auto: boolean } {
  if (media.length === 0) return { type: 'text', auto: true };
  if (media.length > 1) return { type: 'carousel', auto: true };

  const item = media[0];
  if (item.type === 'video') {
    const isVertical = item.height && item.width && item.height > item.width;
    if (isVertical && platforms.some((p) => ['instagram', 'tiktok'].includes(p))) {
      return { type: 'reels', auto: true };
    }
    return { type: 'video', auto: true };
  }
  return { type: 'static', auto: true };
}

function getAvailableTypes(platforms: SocialPlatform[]): PostType[] {
  if (platforms.length === 0) return ['static', 'carousel', 'reels', 'story', 'video', 'text'];
  const sets = platforms.map((p) => new Set(PLATFORM_POST_TYPES[p]));
  // Union of all platform types
  const union = new Set<PostType>();
  sets.forEach((s) => s.forEach((t) => union.add(t)));
  return Array.from(union);
}

function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTimeForInput(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

const CreatePostPanel: React.FC<CreatePostPanelProps> = ({
  open,
  onClose,
  onPostCreated,
  projectId,
  prefilledDate,
}) => {
  const { user } = useAuth();
  const tenantId = useTenantId();

  // Form state
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [postType, setPostType] = useState<PostType>('static');
  const [autoDetected, setAutoDetected] = useState(true);
  const [caption, setCaption] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('10:00');

  // Story mode
  const [storyFrames, setStoryFrames] = useState<StoryFrame[]>([
    { id: crypto.randomUUID(), media: [], caption: '' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { uploadFiles, uploading, fileProgress } = useMediaUpload();

  const isStoryMode = postType === 'story';

  // Prefill date
  useEffect(() => {
    if (prefilledDate) {
      setScheduleDate(formatDateForInput(prefilledDate));
    }
  }, [prefilledDate]);

  // Reset when panel closes
  useEffect(() => {
    if (!open) {
      setPlatforms([]);
      setMedia([]);
      setPostType('static');
      setAutoDetected(true);
      setCaption('');
      setScheduleDate('');
      setScheduleTime('10:00');
      setStoryFrames([{ id: crypto.randomUUID(), media: [], caption: '' }]);
      setError(null);
    }
  }, [open]);

  // Auto-detect post type when media changes
  useEffect(() => {
    if (autoDetected && !isStoryMode) {
      const detected = detectPostType(media, platforms);
      setPostType(detected.type);
    }
  }, [media, platforms, autoDetected, isStoryMode]);

  const availableTypes = useMemo(() => getAvailableTypes(platforms), [platforms]);

  const handlePostTypeChange = (type: PostType) => {
    setPostType(type);
    setAutoDetected(false);
    // Reset story frames when switching away from story
    if (type !== 'story') {
      setStoryFrames([{ id: crypto.randomUUID(), media: [], caption: '' }]);
    }
  };

  // Media handlers (normal mode)
  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      const uploaded = await uploadFiles(files, projectId);
      setMedia((prev) => [...prev, ...uploaded]);
    },
    [projectId, uploadFiles]
  );

  const handleRemoveMedia = useCallback((mediaId: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== mediaId));
  }, []);

  const handleReorderMedia = useCallback((fromIndex: number, toIndex: number) => {
    setMedia((prev) => {
      const updated = [...prev];
      const [item] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, item);
      return updated.map((m, i) => ({ ...m, order: i }));
    });
  }, []);

  // Story frame handlers
  const handleStoryFilesSelected = useCallback(
    async (frameId: string, files: File[]) => {
      const uploaded = await uploadFiles(files, projectId);
      setStoryFrames((prev) =>
        prev.map((f) =>
          f.id === frameId ? { ...f, media: [...f.media, ...uploaded] } : f
        )
      );
    },
    [projectId, uploadFiles]
  );

  const handleStoryRemoveMedia = useCallback((frameId: string, mediaId: string) => {
    setStoryFrames((prev) =>
      prev.map((f) =>
        f.id === frameId
          ? { ...f, media: f.media.filter((m) => m.id !== mediaId) }
          : f
      )
    );
  }, []);

  const handleAddStoryFrame = () => {
    setStoryFrames((prev) => [
      ...prev,
      { id: crypto.randomUUID(), media: [], caption: '' },
    ]);
  };

  const handleRemoveStoryFrame = (frameId: string) => {
    if (storyFrames.length <= 1) return;
    setStoryFrames((prev) => prev.filter((f) => f.id !== frameId));
  };

  const handleStoryFrameCaptionChange = (frameId: string, val: string) => {
    setStoryFrames((prev) =>
      prev.map((f) => (f.id === frameId ? { ...f, caption: val } : f))
    );
  };

  const buildScheduledAt = (): Timestamp | undefined => {
    if (!scheduleDate) return undefined;
    const [y, m, d] = scheduleDate.split('-').map(Number);
    const [h, min] = scheduleTime.split(':').map(Number);
    return Timestamp.fromDate(new Date(y, m - 1, d, h, min));
  };

  const handleSaveDraft = async () => {
    await handleSubmit('draft');
  };

  const handleSchedule = async () => {
    await handleSubmit('scheduled');
  };

  const handleSubmit = async (status: 'draft' | 'scheduled') => {
    if (!user || platforms.length === 0) {
      setError('En az bir platform secmelisiniz.');
      return;
    }

    if (status === 'scheduled' && !scheduleDate) {
      setError('Planlama tarihi secmelisiniz.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const scheduledAt = status === 'scheduled' ? buildScheduledAt() : undefined;

      if (isStoryMode && storyFrames.length > 0) {
        // Create separate post for each story frame
        const postDatas: CreateSocialPostData[] = storyFrames.map((frame) => ({
          projectId,
          caption: frame.caption || caption,
          media: frame.media.length > 0 ? frame.media : undefined,
          mediaUrls: frame.media.length > 0 ? frame.media.map((m) => m.url) : undefined,
          postType: 'story' as PostType,
          platforms,
          scheduledAt,
        }));

        await createMultiplePosts(
          tenantId,
          postDatas,
          user.uid,
          user.displayName || 'Bilinmeyen'
        );
      } else {
        const data: CreateSocialPostData = {
          projectId,
          caption: caption.trim() || undefined,
          media: media.length > 0 ? media : undefined,
          mediaUrls: media.length > 0 ? media.map((m) => m.url) : undefined,
          postType,
          platforms,
          scheduledAt,
        };

        await createSocialPost(tenantId, data, user.uid, user.displayName || 'Bilinmeyen');
      }

      onPostCreated();
      onClose();
    } catch (err) {
      console.error('[CreatePostPanel] Error creating post:', err);
      setError('Post olusturulurken bir hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  // Compute scheduledAt as Date for preview
  const previewScheduledAt = useMemo(() => {
    if (!scheduleDate) return undefined;
    const [y, m, d] = scheduleDate.split('-').map(Number);
    const [h, min] = scheduleTime.split(':').map(Number);
    return new Date(y, m - 1, d, h, min);
  }, [scheduleDate, scheduleTime]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-[850px] bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <h2 className="font-grotesk text-lg font-semibold text-[#171717]">
                Yeni Post
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left side - Form (60%) */}
              <div className="w-[60%] overflow-y-auto p-6 space-y-5 border-r border-neutral-100">
                {/* 1. Platform Pills */}
                <div>
                  <label className="block font-grotesk text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                    Platformlar
                  </label>
                  <PlatformPills selected={platforms} onChange={setPlatforms} />
                </div>

                {/* 2. Media Upload */}
                <div>
                  <label className="block font-grotesk text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                    Medya
                  </label>
                  {isStoryMode ? (
                    // Story frames
                    <div className="space-y-4">
                      {storyFrames.map((frame, index) => (
                        <div
                          key={frame.id}
                          className="bg-neutral-50 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-grotesk text-xs font-medium text-neutral-600">
                              Frame {index + 1}
                            </span>
                            {storyFrames.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveStoryFrame(frame.id)}
                                className="p-1 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <MediaDropZone
                            onFilesSelected={(files) => handleStoryFilesSelected(frame.id, files)}
                            maxFiles={1}
                            existingMedia={frame.media}
                            onRemoveMedia={(mediaId) => handleStoryRemoveMedia(frame.id, mediaId)}
                            uploading={uploading}
                            fileProgress={fileProgress}
                          />
                          <input
                            type="text"
                            value={frame.caption}
                            onChange={(e) => handleStoryFrameCaptionChange(frame.id, e.target.value)}
                            placeholder="Frame caption (opsiyonel)..."
                            className="w-full px-3 py-2 rounded-lg border border-neutral-200 font-grotesk text-xs focus:outline-none focus:ring-1 focus:ring-[#171717]/20 focus:border-[#171717]"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleAddStoryFrame}
                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 border-2 border-dashed border-neutral-300 rounded-xl font-grotesk text-sm text-neutral-500 hover:border-neutral-400 hover:text-neutral-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Frame Ekle
                      </button>
                    </div>
                  ) : (
                    <MediaDropZone
                      onFilesSelected={handleFilesSelected}
                      maxFiles={postType === 'carousel' ? 10 : 1}
                      existingMedia={media}
                      onRemoveMedia={handleRemoveMedia}
                      onReorderMedia={handleReorderMedia}
                      uploading={uploading}
                      fileProgress={fileProgress}
                    />
                  )}
                </div>

                {/* 3. Post Type indicator */}
                <div>
                  <label className="block font-grotesk text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                    Post Tipi
                  </label>
                  <PostTypeDropdown
                    value={postType}
                    onChange={handlePostTypeChange}
                    availableTypes={availableTypes}
                    autoDetected={autoDetected}
                  />
                </div>

                {/* 4. Caption */}
                <div>
                  <label className="block font-grotesk text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                    Caption
                  </label>
                  <CaptionField
                    value={caption}
                    onChange={setCaption}
                    platforms={platforms}
                    projectId={projectId}
                    mediaUrls={media.map((m) => m.url)}
                  />
                </div>

                {/* 5. Schedule */}
                <div>
                  <label className="block font-grotesk text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                    Zamanlama
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]"
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-28 px-3 py-2 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]"
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="font-grotesk text-xs text-red-700">{error}</p>
                  </div>
                )}
              </div>

              {/* Right side - Preview (40%) */}
              <div className="w-[40%] bg-neutral-50 overflow-hidden">
                <LivePreviewSidebar
                  platforms={platforms}
                  postType={postType}
                  caption={caption}
                  media={isStoryMode ? storyFrames.flatMap((f) => f.media) : media}
                  scheduledAt={previewScheduledAt}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100 bg-white">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 font-grotesk text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
              >
                Iptal
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={submitting || platforms.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Taslak Kaydet
                </button>
                <button
                  type="button"
                  onClick={handleSchedule}
                  disabled={submitting || platforms.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CalendarCheck className="w-4 h-4" />
                  )}
                  Planla
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreatePostPanel;
