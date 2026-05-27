import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Check,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  Bookmark,
  Heart,
  Send,
  MessageSquare,
  Loader2,
  Pause,
  Play,
} from 'lucide-react';
import type { SocialMediaPost } from '@/shared/types/socialMedia';

interface InstagramProfileViewProps {
  posts: SocialMediaPost[];
  brandName: string;
  brandAvatarUrl?: string;
  brandBio?: string;
  onApprove?: (postId: string) => Promise<void> | void;
  onRequestRevision?: (postId: string, comment: string) => Promise<void> | void;
  onUndo?: (postId: string) => Promise<void> | void;
  readOnly?: boolean;
}

function isStory(p: SocialMediaPost): boolean {
  return p.postType === 'story';
}

function sortByScheduledDesc(a: SocialMediaPost, b: SocialMediaPost): number {
  const at = (a.scheduledAt as any)?.toDate?.()?.getTime?.() || 0;
  const bt = (b.scheduledAt as any)?.toDate?.()?.getTime?.() || 0;
  return bt - at;
}

function sortByScheduledAsc(a: SocialMediaPost, b: SocialMediaPost): number {
  const at = (a.scheduledAt as any)?.toDate?.()?.getTime?.() || 0;
  const bt = (b.scheduledAt as any)?.toDate?.()?.getTime?.() || 0;
  return at - bt;
}

function dateKeyForStory(p: SocialMediaPost): string {
  const d = (p.scheduledAt as any)?.toDate?.();
  if (!d) return 'zamansiz';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(key: string): string {
  if (key === 'zamansiz') return 'Zamansız';
  const [, m, d] = key.split('-');
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]}`;
}

interface StoryGroup {
  dateKey: string;
  label: string;
  stories: SocialMediaPost[];
}

function groupStoriesByDay(stories: SocialMediaPost[]): StoryGroup[] {
  const map = new Map<string, SocialMediaPost[]>();
  for (const s of stories) {
    const key = dateKeyForStory(s);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  // Her grup içinde saate göre sırala; gruplar arası ise gün desc
  const groups: StoryGroup[] = [];
  for (const [key, items] of map.entries()) {
    groups.push({
      dateKey: key,
      label: dayLabel(key),
      stories: items.slice().sort(sortByScheduledAsc),
    });
  }
  // Güne göre desc (en yeni gün ilk)
  groups.sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0));
  return groups;
}

const InstagramProfileView: React.FC<InstagramProfileViewProps> = ({
  posts,
  brandName,
  brandAvatarUrl,
  brandBio,
  onApprove,
  onRequestRevision,
  onUndo,
  readOnly = false,
}) => {
  const stories = useMemo(() => posts.filter(isStory), [posts]);
  const storyGroups = useMemo(() => groupStoriesByDay(stories), [stories]);
  const feedPosts = useMemo(
    () =>
      posts
        .filter((p) => !isStory(p) && p.postType !== 'text')
        .sort(sortByScheduledDesc),
    [posts]
  );

  const [storyGroupIndex, setStoryGroupIndex] = useState<number | null>(null);
  const [postIndex, setPostIndex] = useState<number | null>(null);

  const openPost = (idx: number) => setPostIndex(idx);
  const closePost = () => setPostIndex(null);
  const openStoryGroup = (idx: number) => setStoryGroupIndex(idx);
  const closeStoryGroup = () => setStoryGroupIndex(null);

  const currentPost = postIndex !== null ? feedPosts[postIndex] : null;
  const currentStoryGroup = storyGroupIndex !== null ? storyGroups[storyGroupIndex] : null;

  const handlePostNext = () => {
    if (postIndex !== null && postIndex < feedPosts.length - 1) setPostIndex(postIndex + 1);
  };
  const handlePostPrev = () => {
    if (postIndex !== null && postIndex > 0) setPostIndex(postIndex - 1);
  };

  useEffect(() => {
    if (postIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePost();
      if (e.key === 'ArrowRight') handlePostNext();
      if (e.key === 'ArrowLeft') handlePostPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [postIndex, feedPosts.length]);

  const avatarInitial = (brandName || 'M').charAt(0).toUpperCase();

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      {/* Profile Header */}
      <div className="px-6 py-5 border-b border-neutral-100">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-pink-500 via-fuchsia-500 to-orange-400 p-0.5 flex-shrink-0">
            <div className="w-full h-full rounded-full bg-white p-0.5">
              {brandAvatarUrl ? (
                <img
                  src={brandAvatarUrl}
                  alt={brandName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-neutral-100 flex items-center justify-center">
                  <span className="font-grotesk text-2xl font-bold text-neutral-500">
                    {avatarInitial}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-grotesk text-lg font-semibold text-[#171717]">
                {brandName.toLowerCase().replace(/\s+/g, '_')}
              </h2>
              <span className="font-grotesk text-[11px] text-neutral-500 border border-neutral-200 rounded-md px-1.5 py-0.5">
                Önizleme
              </span>
            </div>
            <div className="flex items-center gap-5 mt-2 text-sm font-grotesk text-neutral-700">
              <span>
                <span className="font-semibold text-[#171717]">
                  {feedPosts.length + stories.length}
                </span>{' '}
                gönderi
              </span>
              <span>
                <span className="font-semibold text-[#171717]">—</span> takipçi
              </span>
              <span>
                <span className="font-semibold text-[#171717]">—</span> takip
              </span>
            </div>
            <p className="font-grotesk text-sm text-neutral-700 mt-2 whitespace-pre-wrap">
              <span className="font-semibold">{brandName}</span>
              {brandBio ? `\n${brandBio}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Story Highlights — günlere göre gruplanmış */}
      {storyGroups.length > 0 && (
        <div className="px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-4 overflow-x-auto">
            {storyGroups.map((g, idx) => {
              const firstThumb = g.stories[0]?.media?.[0];
              const allApproved = g.stories.every((s) => s.status === 'approved');
              const anyRevision = g.stories.some(
                (s) => s.status === 'revision_requested' || s.status === 'revision_requested_internal'
              );
              return (
                <button
                  key={g.dateKey}
                  type="button"
                  onClick={() => openStoryGroup(idx)}
                  className="flex flex-col items-center gap-1 flex-shrink-0 group"
                >
                  <div
                    className={`relative w-16 h-16 rounded-full p-0.5 ${
                      anyRevision
                        ? 'bg-red-500'
                        : allApproved
                        ? 'bg-green-500'
                        : 'bg-gradient-to-br from-pink-500 via-fuchsia-500 to-orange-400'
                    }`}
                  >
                    <div className="w-full h-full rounded-full bg-white p-0.5">
                      <div className="w-full h-full rounded-full bg-neutral-100 overflow-hidden group-hover:scale-105 transition-transform">
                        {firstThumb?.thumbnailUrl || firstThumb?.url ? (
                          <img
                            src={firstThumb.thumbnailUrl || firstThumb.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="font-grotesk text-[10px] text-neutral-400">—</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Birden fazla story varsa sayı rozeti */}
                    {g.stories.length > 1 && (
                      <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-[#171717] text-white rounded-full text-[10px] font-grotesk font-bold flex items-center justify-center">
                        {g.stories.length}
                      </div>
                    )}
                  </div>
                  <span className="font-grotesk text-[10px] text-neutral-600 max-w-[70px] truncate">
                    {g.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Feed tab indicator */}
      <div className="flex items-center justify-center border-t border-neutral-100">
        <div className="inline-flex items-center gap-2 py-2 border-t-2 border-[#171717]">
          <Grid3x3 className="w-4 h-4 text-[#171717]" />
          <span className="font-grotesk text-[11px] font-semibold uppercase tracking-wider text-[#171717]">
            Gönderiler
          </span>
        </div>
      </div>

      {/* Feed Grid */}
      {feedPosts.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <Grid3x3 className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
          <p className="font-grotesk text-sm text-neutral-500">Henüz gönderi yok</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-px bg-neutral-100">
          {feedPosts.map((p, idx) => {
            const thumb = p.media?.[0];
            const isVideo = thumb?.type === 'video';
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => openPost(idx)}
                className="relative aspect-square bg-neutral-100 group overflow-hidden"
              >
                {thumb?.url || thumb?.thumbnailUrl ? (
                  <img
                    src={thumb.thumbnailUrl || thumb.url}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-50">
                    <Bookmark className="w-6 h-6 text-neutral-300" />
                  </div>
                )}
                {/* Status işaretleri: sol üst */}
                {p.status === 'approved' && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-green-600 text-white rounded-full text-[9px] font-grotesk font-semibold flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                )}
                {(p.status === 'revision_requested' ||
                  p.status === 'revision_requested_internal') && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[9px] font-grotesk font-semibold flex items-center">
                    <MessageCircle className="w-2.5 h-2.5" />
                  </div>
                )}
                {/* Type icon: sağ üst */}
                {(p.postType === 'carousel' || p.postType === 'reels' || isVideo) && (
                  <div className="absolute top-2 right-2 text-white drop-shadow">
                    {p.postType === 'carousel' ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 5v9h2V5c0-1.1-.9-2-2-2h-9v2h9zM15 7H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-4 text-white opacity-0 group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1 font-grotesk text-sm font-semibold">
                    <Heart className="w-4 h-4 fill-white" /> —
                  </span>
                  <span className="inline-flex items-center gap-1 font-grotesk text-sm font-semibold">
                    <MessageSquare className="w-4 h-4 fill-white" /> —
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Post Lightbox */}
      <PostLightboxDialog
        open={currentPost !== null}
        onClose={closePost}
        post={currentPost}
        onPrev={postIndex !== null && postIndex > 0 ? handlePostPrev : undefined}
        onNext={postIndex !== null && postIndex < feedPosts.length - 1 ? handlePostNext : undefined}
        brandName={brandName}
        brandAvatarUrl={brandAvatarUrl}
        readOnly={readOnly}
        onApprove={onApprove}
        onRequestRevision={onRequestRevision}
        onUndo={onUndo}
      />

      {/* Story Viewer (Instagram-style) */}
      <StoryViewerDialog
        open={currentStoryGroup !== null}
        onClose={closeStoryGroup}
        group={currentStoryGroup}
        onPrevGroup={
          storyGroupIndex !== null && storyGroupIndex < storyGroups.length - 1
            ? () => setStoryGroupIndex(storyGroupIndex + 1)
            : undefined
        }
        onNextGroup={
          storyGroupIndex !== null && storyGroupIndex > 0
            ? () => setStoryGroupIndex(storyGroupIndex - 1)
            : undefined
        }
        brandName={brandName}
        brandAvatarUrl={brandAvatarUrl}
        readOnly={readOnly}
        onApprove={onApprove}
        onRequestRevision={onRequestRevision}
        onUndo={onUndo}
      />
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Post Lightbox (carousel/reels/static)
// ═════════════════════════════════════════════════════════════════════════════

interface PostLightboxProps {
  open: boolean;
  onClose: () => void;
  post: SocialMediaPost | null;
  onPrev?: () => void;
  onNext?: () => void;
  brandName: string;
  brandAvatarUrl?: string;
  readOnly?: boolean;
  onApprove?: (postId: string) => Promise<void> | void;
  onRequestRevision?: (postId: string, comment: string) => Promise<void> | void;
  onUndo?: (postId: string) => Promise<void> | void;
}

const PostLightboxDialog: React.FC<PostLightboxProps> = ({
  open,
  onClose,
  post,
  onPrev,
  onNext,
  brandName,
  brandAvatarUrl,
  readOnly,
  onApprove,
  onRequestRevision,
  onUndo,
}) => {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState<null | 'approve' | 'reject'>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setFeedback('');
    setFeedbackOpen(false);
    setMessage(null);
  }, [post?.id]);

  if (!open || !post) return null;

  const thumb = post.media?.[0];
  const canReview = !readOnly && (onApprove || onRequestRevision);
  const isApproved = post.status === 'approved';
  const isRevision =
    post.status === 'revision_requested' || post.status === 'revision_requested_internal';

  const handleApprove = async () => {
    if (!onApprove) return;
    setSubmitting('approve');
    try {
      await onApprove(post.id);
      setMessage('Onaylandı ✓');
    } catch (e: any) {
      setMessage(e?.message || 'Hata oluştu');
    } finally {
      setSubmitting(null);
    }
  };

  const handleRevision = async () => {
    if (!onRequestRevision || !feedback.trim()) return;
    setSubmitting('reject');
    try {
      await onRequestRevision(post.id, feedback.trim());
      setMessage('Geri bildirim gönderildi');
      setFeedbackOpen(false);
      setFeedback('');
    } catch (e: any) {
      setMessage(e?.message || 'Hata oluştu');
    } finally {
      setSubmitting(null);
    }
  };

  const handleUndo = async () => {
    if (!onUndo) return;
    setSubmitting('approve');
    try {
      await onUndo(post.id);
      setMessage('Onay kaldırıldı');
    } catch (e: any) {
      setMessage(e?.message || 'Hata oluştu');
    } finally {
      setSubmitting(null);
    }
  };

  const aspect =
    thumb?.width && thumb?.height
      ? `${thumb.width} / ${thumb.height}`
      : post.postType === 'reels' || thumb?.type === 'video'
      ? '9 / 16'
      : '1 / 1';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg text-white"
        >
          <X className="w-6 h-6" />
        </button>

        {onPrev && (
          <button
            type="button"
            onClick={onPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          key={post.id}
          className="relative bg-white rounded-2xl overflow-hidden max-h-[92vh] flex md:flex-row flex-col max-w-4xl w-full"
        >
          <div
            className="bg-black flex items-center justify-center flex-shrink-0 md:flex-1"
            style={{ aspectRatio: aspect }}
          >
            {thumb?.type === 'video' ? (
              <video
                src={thumb.url}
                poster={thumb.thumbnailUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            ) : thumb ? (
              <img src={thumb.url} alt="" className="w-full h-full object-contain" />
            ) : (
              <div className="text-white/50 font-grotesk text-sm">Medya yok</div>
            )}
          </div>

          <div className="flex flex-col md:w-80 bg-white">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100">
              <BrandAvatar brandName={brandName} brandAvatarUrl={brandAvatarUrl} />
              <div className="flex-1 min-w-0">
                <p className="font-grotesk text-sm font-semibold text-[#171717] truncate">
                  {brandName.toLowerCase().replace(/\s+/g, '_')}
                </p>
                {post.scheduledAt && (
                  <p className="font-grotesk text-[10px] text-neutral-500">
                    {(post.scheduledAt as any)
                      .toDate?.()
                      ?.toLocaleDateString?.('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      }) || ''}
                  </p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {post.title && (
                <h3 className="font-grotesk text-sm font-semibold text-[#171717]">{post.title}</h3>
              )}
              {post.caption && (
                <p className="font-grotesk text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed">
                  {post.caption}
                </p>
              )}
              {post.hashtags && post.hashtags.length > 0 && (
                <p className="font-grotesk text-sm text-blue-600">
                  {post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
                </p>
              )}
              {!post.caption && !post.title && (
                <p className="font-grotesk text-xs text-neutral-400 italic">Caption yok</p>
              )}
            </div>

            <div className="flex items-center gap-4 px-4 py-2 border-t border-neutral-100 text-neutral-700">
              <Heart className="w-6 h-6" />
              <MessageSquare className="w-6 h-6" />
              <Send className="w-6 h-6" />
              <Bookmark className="w-6 h-6 ml-auto" />
            </div>

            <ApprovalPanel
              canReview={!!canReview}
              isApproved={isApproved}
              isRevision={isRevision}
              lastRevisionComment={post.lastRevisionComment}
              message={message}
              feedbackOpen={feedbackOpen}
              feedback={feedback}
              submitting={submitting}
              onApprove={onApprove ? handleApprove : undefined}
              onUndo={onUndo ? handleUndo : undefined}
              onOpenFeedback={() => setFeedbackOpen(true)}
              onChangeFeedback={setFeedback}
              onCancelFeedback={() => {
                setFeedbackOpen(false);
                setFeedback('');
              }}
              onSubmitFeedback={handleRevision}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Story Viewer — Instagram-style fullscreen with progress bars
// ═════════════════════════════════════════════════════════════════════════════

const STORY_DURATION_MS = 6000; // her story 6 saniye

interface StoryViewerProps {
  open: boolean;
  onClose: () => void;
  group: StoryGroup | null;
  onPrevGroup?: () => void;
  onNextGroup?: () => void;
  brandName: string;
  brandAvatarUrl?: string;
  readOnly?: boolean;
  onApprove?: (postId: string) => Promise<void> | void;
  onRequestRevision?: (postId: string, comment: string) => Promise<void> | void;
  onUndo?: (postId: string) => Promise<void> | void;
}

const StoryViewerDialog: React.FC<StoryViewerProps> = ({
  open,
  onClose,
  group,
  onPrevGroup,
  onNextGroup,
  brandName,
  brandAvatarUrl,
  readOnly,
  onApprove,
  onRequestRevision,
  onUndo,
}) => {
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1
  const [paused, setPaused] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState<null | 'approve' | 'reject'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number>(0);
  const elapsedBeforePauseRef = useRef<number>(0);

  // Grup değişince sıfırla
  useEffect(() => {
    if (!open || !group) return;
    setStoryIdx(0);
    setProgress(0);
    setFeedbackOpen(false);
    setFeedback('');
    setMessage(null);
    setPaused(false);
    elapsedBeforePauseRef.current = 0;
  }, [group?.dateKey, open]);

  // Auto-advance progress
  useEffect(() => {
    if (!open || !group || paused || feedbackOpen) return;
    startTsRef.current = performance.now();
    const tick = () => {
      if (!open) return;
      const now = performance.now();
      const elapsed = elapsedBeforePauseRef.current + (now - startTsRef.current);
      const pct = Math.min(1, elapsed / STORY_DURATION_MS);
      setProgress(pct);
      if (pct >= 1) {
        elapsedBeforePauseRef.current = 0;
        // Sonraki story'e geç
        if (group && storyIdx < group.stories.length - 1) {
          setStoryIdx((i) => i + 1);
          setProgress(0);
        } else {
          // Grup bitti — bir sonraki güne veya kapat
          if (onNextGroup) onNextGroup();
          else onClose();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Pause anında elapsed'i sakla
      const now = performance.now();
      elapsedBeforePauseRef.current += now - startTsRef.current;
    };
  }, [open, group?.dateKey, storyIdx, paused, feedbackOpen]);

  // Story index değişince elapsed'i sıfırla
  useEffect(() => {
    elapsedBeforePauseRef.current = 0;
    setProgress(0);
    setFeedbackOpen(false);
    setFeedback('');
    setMessage(null);
  }, [storyIdx]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, storyIdx, group?.stories.length]);

  if (!open || !group) return null;

  const story = group.stories[storyIdx];
  // Güvenlik: storyIdx sınır dışıysa (auto-advance vs.) render etmeyelim
  if (!story) return null;
  const thumb = story.media?.[0];
  const isApproved = story.status === 'approved';
  const isRevision =
    story?.status === 'revision_requested' || story?.status === 'revision_requested_internal';
  const canReview = !readOnly && (onApprove || onRequestRevision);

  const goPrev = () => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
    } else if (onPrevGroup) {
      onPrevGroup();
    }
  };

  const goNext = () => {
    if (group && storyIdx < group.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (onNextGroup) {
      onNextGroup();
    } else {
      onClose();
    }
  };

  const handleApprove = async () => {
    if (!onApprove || !story) return;
    setPaused(true);
    setSubmitting('approve');
    try {
      await onApprove(story.id);
      setMessage('Onaylandı');
      setTimeout(() => {
        setMessage(null);
        setPaused(false);
      }, 1200);
    } catch (e: any) {
      setMessage(e?.message || 'Hata');
    } finally {
      setSubmitting(null);
    }
  };

  const handleRevision = async () => {
    if (!onRequestRevision || !story || !feedback.trim()) return;
    setSubmitting('reject');
    try {
      await onRequestRevision(story.id, feedback.trim());
      setMessage('Geri bildirim gönderildi');
      setFeedbackOpen(false);
      setFeedback('');
      setTimeout(() => {
        setMessage(null);
        setPaused(false);
      }, 1400);
    } catch (e: any) {
      setMessage(e?.message || 'Hata');
    } finally {
      setSubmitting(null);
    }
  };

  const handleUndo = async () => {
    if (!onUndo || !story) return;
    setPaused(true);
    setSubmitting('approve');
    try {
      await onUndo(story.id);
      setMessage('Onay kaldırıldı');
      setTimeout(() => {
        setMessage(null);
        setPaused(false);
      }, 1200);
    } catch (e: any) {
      setMessage(e?.message || 'Hata');
    } finally {
      setSubmitting(null);
    }
  };

  const aspect =
    thumb?.width && thumb?.height ? `${thumb.width} / ${thumb.height}` : '9 / 16';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      >
        <div className="relative w-full h-full flex items-center justify-center p-2 md:p-4">
          {/* Story container */}
          <div
            className="relative bg-black rounded-xl overflow-hidden flex flex-col"
            style={{ aspectRatio: aspect, maxHeight: '95vh', maxWidth: '100vw' }}
          >
            {/* Progress bars */}
            <div className="absolute top-0 left-0 right-0 z-10 px-2 pt-2 pb-1 flex gap-1 pointer-events-none bg-gradient-to-b from-black/60 to-transparent">
              {group.stories.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-white transition-[width] ease-linear"
                    style={{
                      width:
                        i < storyIdx
                          ? '100%'
                          : i === storyIdx
                          ? `${Math.round(progress * 100)}%`
                          : '0%',
                      transitionDuration: i === storyIdx && !paused ? '80ms' : '0ms',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Top bar: brand + date + close */}
            <div className="absolute top-3 left-0 right-0 z-10 px-3 pt-3 flex items-center justify-between text-white pointer-events-none">
              <div className="flex items-center gap-2">
                <BrandAvatar brandName={brandName} brandAvatarUrl={brandAvatarUrl} small inverted />
                <div>
                  <p className="font-grotesk text-sm font-semibold">
                    {brandName.toLowerCase().replace(/\s+/g, '_')}
                  </p>
                  <p className="font-grotesk text-[10px] opacity-80">
                    {group.label} · {storyIdx + 1}/{group.stories.length}
                    {(story.scheduledAt as any)?.toDate
                      ? ` · ${(story.scheduledAt as any).toDate().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tap zones (prev/next) */}
            {!feedbackOpen && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-0 top-16 bottom-24 w-1/3 z-5"
                  aria-label="Önceki"
                />
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-0 top-16 bottom-24 w-1/3 z-5"
                  aria-label="Sonraki"
                />
              </>
            )}

            {/* Media */}
            {thumb?.type === 'video' ? (
              <video
                src={thumb.url}
                poster={thumb.thumbnailUrl}
                autoPlay
                muted={false}
                playsInline
                className="w-full h-full object-contain"
                onLoadedData={() => setProgress(0)}
              />
            ) : thumb ? (
              <img src={thumb.url} alt="" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50 font-grotesk text-sm">
                Medya yok
              </div>
            )}

            {/* Caption overlay (alt, küçük) */}
            {story.caption && !feedbackOpen && (
              <div className="absolute bottom-20 left-0 right-0 px-4 z-10">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white">
                  <p className="font-grotesk text-xs line-clamp-3">{story.caption}</p>
                </div>
              </div>
            )}

            {/* Approval panel (alt sabit) */}
            {canReview && (
              <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8 z-20 bg-gradient-to-t from-black to-transparent">
                {message && (
                  <div className="mb-2 px-3 py-2 bg-green-600/90 text-white rounded-lg font-grotesk text-xs text-center">
                    {message}
                  </div>
                )}
                {isApproved ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-full text-xs font-grotesk">
                      <Check className="w-4 h-4" />
                      Onaylandı
                    </div>
                    {onUndo && (
                      <button
                        type="button"
                        onClick={handleUndo}
                        disabled={submitting !== null}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-full text-xs font-grotesk disabled:opacity-50"
                      >
                        {submitting === 'approve' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : null}
                        Onayı Kaldır
                      </button>
                    )}
                  </div>
                ) : feedbackOpen ? (
                  <div className="space-y-2">
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Geri bildiriminizi yazın..."
                      rows={3}
                      autoFocus
                      className="w-full px-3 py-2 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/50 rounded-lg font-grotesk text-sm resize-none focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRevision}
                        disabled={!feedback.trim() || submitting !== null}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium disabled:opacity-50"
                      >
                        {submitting === 'reject' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Gönder
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackOpen(false);
                          setFeedback('');
                          setPaused(false);
                        }}
                        className="px-3 py-2 text-white/70 font-grotesk text-sm"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {onApprove && (
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={submitting !== null}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-full font-grotesk text-sm font-medium disabled:opacity-50"
                      >
                        {submitting === 'approve' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Onayla
                      </button>
                    )}
                    {onRequestRevision && (
                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackOpen(true);
                          setPaused(true);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2.5 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-full font-grotesk text-sm font-medium"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Geri bildirim
                      </button>
                    )}
                  </div>
                )}
                {isRevision && story.lastRevisionComment && (
                  <div className="mt-2 px-3 py-2 bg-amber-600/80 backdrop-blur-sm rounded-lg text-white text-xs font-grotesk">
                    Önceki revizyon: {story.lastRevisionComment}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Küçük yardımcılar
// ═════════════════════════════════════════════════════════════════════════════

const BrandAvatar: React.FC<{
  brandName: string;
  brandAvatarUrl?: string;
  small?: boolean;
  inverted?: boolean;
}> = ({ brandName, brandAvatarUrl, small, inverted }) => {
  const size = small ? 'w-8 h-8' : 'w-10 h-10';
  return (
    <div
      className={`${size} rounded-full bg-gradient-to-br from-pink-500 to-orange-400 p-0.5 flex-shrink-0`}
    >
      <div className={`w-full h-full rounded-full ${inverted ? 'bg-black' : 'bg-white'} p-0.5`}>
        {brandAvatarUrl ? (
          <img src={brandAvatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          <div
            className={`w-full h-full rounded-full flex items-center justify-center ${
              inverted ? 'bg-neutral-800' : 'bg-neutral-100'
            }`}
          >
            <span
              className={`font-grotesk ${small ? 'text-[10px]' : 'text-xs'} font-bold ${
                inverted ? 'text-white' : 'text-[#171717]'
              }`}
            >
              {(brandName || 'M').charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

interface ApprovalPanelProps {
  canReview: boolean;
  isApproved: boolean;
  isRevision: boolean;
  lastRevisionComment?: string;
  message: string | null;
  feedbackOpen: boolean;
  feedback: string;
  submitting: null | 'approve' | 'reject';
  onApprove?: () => void;
  onUndo?: () => void;
  onOpenFeedback: () => void;
  onChangeFeedback: (v: string) => void;
  onCancelFeedback: () => void;
  onSubmitFeedback: () => void;
}

const ApprovalPanel: React.FC<ApprovalPanelProps> = ({
  canReview,
  isApproved,
  isRevision,
  lastRevisionComment,
  message,
  feedbackOpen,
  feedback,
  submitting,
  onApprove,
  onUndo,
  onOpenFeedback,
  onChangeFeedback,
  onCancelFeedback,
  onSubmitFeedback,
}) => {
  if (!canReview) {
    if (isApproved) {
      return (
        <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50 text-green-700 text-sm font-grotesk flex items-center gap-1">
          <Check className="w-4 h-4" /> Onaylandı
        </div>
      );
    }
    if (isRevision) {
      return (
        <div className="px-4 py-3 border-t border-neutral-100 bg-amber-50 text-amber-800 text-xs font-grotesk">
          Revizyon istendi {lastRevisionComment ? `: ${lastRevisionComment}` : ''}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50">
      {message && <p className="font-grotesk text-xs text-green-700 mb-2">{message}</p>}
      {isApproved ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-green-700 text-sm font-grotesk">
            <Check className="w-4 h-4" />
            Onaylandı
          </div>
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              disabled={submitting !== null}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-grotesk text-[11px] text-neutral-600 hover:bg-white disabled:opacity-50"
            >
              {submitting === 'approve' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : null}
              Onayı Kaldır
            </button>
          )}
        </div>
      ) : !feedbackOpen ? (
        <div className="flex items-center gap-2">
          {onApprove && (
            <button
              type="button"
              onClick={onApprove}
              disabled={submitting !== null}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg font-grotesk text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {submitting === 'approve' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Onayla
            </button>
          )}
          <button
            type="button"
            onClick={onOpenFeedback}
            disabled={submitting !== null}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-neutral-300 text-neutral-700 rounded-lg font-grotesk text-sm font-medium hover:bg-white disabled:opacity-50"
          >
            <MessageCircle className="w-4 h-4" />
            Geri bildirim
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={feedback}
            onChange={(e) => onChangeFeedback(e.target.value)}
            placeholder="Ne değişmesini istersiniz?"
            rows={3}
            autoFocus
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm focus:outline-none focus:border-neutral-400 resize-none bg-white"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSubmitFeedback}
              disabled={!feedback.trim() || submitting !== null}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#171717] text-white rounded-lg font-grotesk text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
            >
              {submitting === 'reject' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Gönder
            </button>
            <button
              type="button"
              onClick={onCancelFeedback}
              className="px-3 py-2 font-grotesk text-sm text-neutral-500"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
      {isRevision && lastRevisionComment && (
        <p className="mt-2 p-2 bg-amber-50 rounded-lg font-grotesk text-xs text-amber-800">
          Önceki revizyon: {lastRevisionComment}
        </p>
      )}
    </div>
  );
};

export default InstagramProfileView;
