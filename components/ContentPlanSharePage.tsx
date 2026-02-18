import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  AlertCircle,
  MessageCircle,
  Send,
  Loader2,
  Calendar,
  Image as ImageIcon,
  Film,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type {
  ContentPlan,
  SocialMediaPost,
  ContentPlanComment,
} from '@/shared/types/socialMedia';
import {
  SOCIAL_PLATFORM_LABELS,
  POST_TYPE_LABELS,
  POST_TYPE_COLORS,
} from '@/shared/types/socialMedia';
import {
  getContentPlanByShareToken,
  approveContentPlan,
  requestRevision,
  addClientComment,
} from '@/shared/services/contentPlanService';
import { getSocialPostsForPlan } from '@/shared/services/socialMediaService';

const ContentPlanSharePage: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [clientName, setClientName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revisionComment, setRevisionComment] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  // Navigation
  const [currentPostIndex, setCurrentPostIndex] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!shareToken) return;
      try {
        setLoading(true);
        const planData = await getContentPlanByShareToken(shareToken);
        if (!planData) {
          setNotFound(true);
          return;
        }
        setPlan(planData);

        // Load posts - use tenantId from plan context (public access)
        const planPosts = await getSocialPostsForPlan('', planData.id);
        setPosts(planPosts);
      } catch (err) {
        console.error('[ContentPlanSharePage] Error loading:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [shareToken]);

  const handleApprove = async () => {
    if (!plan || !clientName.trim()) return;
    setSubmitting(true);
    try {
      await approveContentPlan(plan.id, 'client', clientName.trim());
      setPlan((prev) => prev ? { ...prev, status: 'approved', approvedByName: clientName.trim() } : prev);
    } catch (err) {
      console.error('[ContentPlanSharePage] Error approving:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!plan || !revisionComment.trim() || !clientName.trim()) return;
    setSubmitting(true);
    try {
      await requestRevision(plan.id, revisionComment.trim(), 'client', clientName.trim(), true);
      setPlan((prev) => prev ? { ...prev, status: 'revision_requested' } : prev);
      setRevisionComment('');
      setShowRevisionForm(false);
    } catch (err) {
      console.error('[ContentPlanSharePage] Error requesting revision:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async () => {
    if (!plan || !commentText.trim() || !clientName.trim()) return;
    setSubmitting(true);
    try {
      const currentPost = posts[currentPostIndex];
      await addClientComment(
        plan.id,
        commentText.trim(),
        currentPost?.id,
        'client',
        clientName.trim(),
        true
      );
      setCommentText('');
      // Reload plan to get updated comments
      const updated = await getContentPlanByShareToken(shareToken!);
      if (updated) setPlan(updated);
    } catch (err) {
      console.error('[ContentPlanSharePage] Error adding comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getPostMedia = (post: SocialMediaPost): string | null => {
    if (post.media && post.media.length > 0) return post.media[0].thumbnailUrl || post.media[0].url;
    if (post.mediaUrls && post.mediaUrls.length > 0) return post.mediaUrls[0];
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !plan) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h1 className="font-grotesk text-2xl font-bold text-neutral-400 mb-2">
            Icerik Plani Bulunamadi
          </h1>
          <p className="font-grotesk text-neutral-400">
            Bu link gecersiz veya suresi dolmus olabilir.
          </p>
        </div>
      </div>
    );
  }

  const currentPost = posts[currentPostIndex];
  const isApproved = plan.status === 'approved';
  const isRevisionRequested = plan.status === 'revision_requested';

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-grotesk text-xl font-bold text-[#171717]">
                {plan.title}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-grotesk text-sm text-neutral-500">
                  {SOCIAL_PLATFORM_LABELS[plan.platform]}
                </span>
                <span className="font-grotesk text-sm text-neutral-500">
                  {posts.length} icerik
                </span>
                <span className="font-grotesk text-sm text-neutral-500">
                  {plan.weekStartDate?.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                  {' - '}
                  {plan.weekEndDate?.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>

            {/* Status Badge */}
            {isApproved && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full font-grotesk text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Onaylandi
              </span>
            )}
            {isRevisionRequested && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-full font-grotesk text-sm font-medium">
                <AlertCircle className="w-4 h-4" />
                Revizyon Istendi
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Post Navigation */}
        {posts.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {posts.map((post, idx) => (
              <button
                key={post.id}
                onClick={() => setCurrentPostIndex(idx)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl font-grotesk text-xs font-medium transition-all border ${
                  idx === currentPostIndex
                    ? 'bg-[#171717] text-white border-[#171717]'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {idx + 1}. {post.title.slice(0, 20)}{post.title.length > 20 ? '...' : ''}
              </button>
            ))}
          </div>
        )}

        {/* Current Post Preview */}
        {currentPost && (
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            {/* Post Media */}
            {getPostMedia(currentPost) && (
              <div className="aspect-square bg-neutral-100 max-h-[500px]">
                <img
                  src={currentPost.media?.[0]?.url || currentPost.mediaUrls?.[0] || ''}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Post Content */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-lg font-grotesk text-xs font-medium ${POST_TYPE_COLORS[currentPost.postType]}`}>
                  {POST_TYPE_LABELS[currentPost.postType]}
                </span>
                {currentPost.scheduledAt && (
                  <span className="inline-flex items-center gap-1 font-grotesk text-xs text-neutral-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {currentPost.scheduledAt.toDate().toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>

              <h2 className="font-grotesk text-lg font-semibold text-[#171717]">
                {currentPost.title}
              </h2>

              {currentPost.caption && (
                <p className="font-grotesk text-sm text-neutral-700 whitespace-pre-wrap">
                  {currentPost.caption}
                </p>
              )}

              {currentPost.hashtags && currentPost.hashtags.length > 0 && (
                <p className="font-grotesk text-sm text-blue-600">
                  {currentPost.hashtags.map((h) => `#${h}`).join(' ')}
                </p>
              )}
            </div>

            {/* Post Navigation Arrows */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100">
              <button
                onClick={() => setCurrentPostIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentPostIndex === 0}
                className="inline-flex items-center gap-1 font-grotesk text-xs text-neutral-500 hover:text-neutral-700 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
                Onceki
              </button>
              <span className="font-grotesk text-xs text-neutral-400">
                {currentPostIndex + 1} / {posts.length}
              </span>
              <button
                onClick={() => setCurrentPostIndex((prev) => Math.min(posts.length - 1, prev + 1))}
                disabled={currentPostIndex === posts.length - 1}
                className="inline-flex items-center gap-1 font-grotesk text-xs text-neutral-500 hover:text-neutral-700 disabled:opacity-30"
              >
                Sonraki
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Client Name */}
        {!isApproved && (
          <div>
            <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
              Adiniz
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Adinizi girin..."
              className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all bg-white"
            />
          </div>
        )}

        {/* Comment Box */}
        {!isApproved && (
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <h3 className="font-grotesk text-sm font-semibold text-[#171717] mb-3 flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Yorum Ekle
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Bu post hakkinda yorumunuz..."
                className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10"
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || !clientName.trim() || submitting}
                className="px-4 py-2 bg-[#171717] text-white rounded-lg font-grotesk text-sm hover:bg-neutral-800 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Comments List */}
        {plan.clientComments && plan.clientComments.length > 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-3">
            <h3 className="font-grotesk text-sm font-semibold text-[#171717]">
              Yorumlar ({plan.clientComments.length})
            </h3>
            {plan.clientComments.map((comment) => (
              <div key={comment.id} className="bg-neutral-50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-grotesk text-xs font-medium text-[#171717]">
                    {comment.createdByName}
                  </span>
                  {comment.isClient && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-grotesk text-[10px]">
                      Musteri
                    </span>
                  )}
                </div>
                <p className="font-grotesk text-sm text-neutral-600">{comment.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Approval Actions */}
        {!isApproved && !isRevisionRequested && plan.status === 'pending_approval' && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
            <h3 className="font-grotesk text-lg font-semibold text-[#171717]">
              Icerik planini onaylayin
            </h3>
            <p className="font-grotesk text-sm text-neutral-500">
              Tum icerikleri inceledikten sonra onayla veya revizyon isteyin.
            </p>

            {!showRevisionForm ? (
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={handleApprove}
                  disabled={submitting || !clientName.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full font-grotesk text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Onayla
                </motion.button>
                <button
                  onClick={() => setShowRevisionForm(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 border border-red-300 text-red-700 rounded-full font-grotesk text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  <AlertCircle className="w-4 h-4" />
                  Revizyon Iste
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={revisionComment}
                  onChange={(e) => setRevisionComment(e.target.value)}
                  placeholder="Revizyon notlarinizi yazin..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 transition-all resize-none"
                />
                <div className="flex items-center gap-3">
                  <motion.button
                    onClick={handleRequestRevision}
                    disabled={submitting || !revisionComment.trim() || !clientName.trim()}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-full font-grotesk text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Revizyon Gonder
                  </motion.button>
                  <button
                    onClick={() => setShowRevisionForm(false)}
                    className="px-5 py-2.5 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50"
                  >
                    Iptal
                  </button>
                </div>
              </div>
            )}

            {!clientName.trim() && (
              <p className="font-grotesk text-xs text-amber-600">
                Islem yapmak icin lutfen adinizi girin.
              </p>
            )}
          </div>
        )}

        {/* Approved State */}
        {isApproved && (
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="font-grotesk text-lg font-semibold text-emerald-800 mb-1">
              Icerik Plani Onaylandi
            </h3>
            <p className="font-grotesk text-sm text-emerald-700">
              {plan.approvedByName} tarafindan onaylandi. Tesekkurler!
            </p>
          </div>
        )}

        {/* Revision Requested State */}
        {isRevisionRequested && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h3 className="font-grotesk text-lg font-semibold text-amber-800 mb-1">
              Revizyon Istendi
            </h3>
            <p className="font-grotesk text-sm text-amber-700">
              Ekibimiz revizyon notlarinizi inceleyecek ve guncelleme yapacak.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6">
          <p className="font-grotesk text-xs text-neutral-400">
            Powered by intiba.agency
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContentPlanSharePage;
