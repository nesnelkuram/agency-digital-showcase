import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  RotateCcw,
  MessageSquare,
  Loader2,
  Image,
  Film,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import type { ContentPlan, SocialMediaPost } from '@/shared/types/socialMedia';
import { POST_STATUS_LABELS, POST_STATUS_COLORS, POST_TYPE_LABELS } from '@/shared/types/socialMedia';
import { getContentPlan } from '@/shared/services/contentPlanService';
import { getSocialPostsForPlan } from '@/shared/services/socialMediaService';
import { authenticatedFetch } from '@/lib/firebase/apiClient';

const PortalContentPlanReviewPage: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = useTenantId();

  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState('');

  const loadData = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      const planData = await getContentPlan(tenantId, planId);
      if (planData) {
        setPlan(planData);
        const planPosts = await getSocialPostsForPlan(tenantId, planId);
        setPosts(planPosts);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, planId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allowPartial = plan?.approvalConfig?.allowPartialApproval !== false;

  const handleClientAction = async (action: 'client_approve' | 'client_reject') => {
    if (!plan) return;
    setActionLoading(true);
    try {
      const postIds = selectedPosts.size > 0 ? Array.from(selectedPosts) : undefined;
      const res = await authenticatedFetch('/api/content-approval/client-action', {
        method: 'POST',
        body: JSON.stringify({
          planId: plan.id,
          postIds,
          action,
          comment: action === 'client_reject' ? comment : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('Client action failed:', body.error);
        return;
      }

      setComment('');
      setShowCommentInput(false);
      setSelectedPosts(new Set());
      await loadData();
    } catch (err) {
      console.error('Client action error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const pendingPosts = posts.filter((p) => p.status === 'pending_approval');
  const hasAnyPending = pendingPosts.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="text-center py-16">
        <p className="font-grotesk text-neutral-500">Icerik plani bulunamadi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/portal/approvals')}
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors mt-1"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <div>
          <h1 className="text-2xl font-grotesk font-bold text-[#171717]">{plan.title}</h1>
          <p className="font-grotesk text-sm text-neutral-500 mt-1">
            {posts.length} post — {pendingPosts.length} onay bekliyor
          </p>
        </div>
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {posts.map((post, i) => {
          const isPending = post.status === 'pending_approval';
          const isSelected = selectedPosts.has(post.id);
          const statusLabel = POST_STATUS_LABELS[post.status] || post.status;
          const statusColor = POST_STATUS_COLORS[post.status] || 'bg-gray-100 text-gray-700';

          return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              onClick={() => isPending && allowPartial && togglePostSelection(post.id)}
              className={`bg-white rounded-xl border p-4 transition-all ${
                isPending && allowPartial ? 'cursor-pointer hover:shadow-sm' : ''
              } ${
                isSelected
                  ? 'border-blue-400 ring-2 ring-blue-100'
                  : 'border-neutral-100'
              }`}
            >
              {/* Media Preview */}
              {post.media && post.media.length > 0 ? (
                <div className="w-full h-40 rounded-lg overflow-hidden mb-3 bg-neutral-100">
                  {post.media[0].type === 'image' ? (
                    <img
                      src={post.media[0].url}
                      alt={post.title || 'Post'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-8 h-8 text-neutral-400" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-40 rounded-lg bg-neutral-50 flex items-center justify-center mb-3">
                  <Image className="w-8 h-8 text-neutral-300" />
                </div>
              )}

              {/* Post Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor}`}>
                    {statusLabel}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-grotesk">
                    {POST_TYPE_LABELS[post.postType]}
                  </span>
                  {post.scheduledAt && (
                    <span className="flex items-center gap-0.5 text-[10px] text-neutral-400 font-grotesk">
                      <Calendar size={10} />
                      {post.scheduledAt.toDate().toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                </div>

                {post.caption && (
                  <p className="font-grotesk text-xs text-neutral-700 line-clamp-3">
                    {post.caption}
                  </p>
                )}

                {post.hashtags && post.hashtags.length > 0 && (
                  <p className="font-grotesk text-[10px] text-blue-500 line-clamp-1">
                    {post.hashtags.map((h) => `#${h}`).join(' ')}
                  </p>
                )}

                {post.revisionCount && post.revisionCount > 0 && (
                  <p className="font-grotesk text-[10px] text-orange-500">
                    {post.revisionCount} revizyon yapildi
                  </p>
                )}
              </div>

              {/* Selection indicator */}
              {isPending && allowPartial && (
                <div className={`mt-3 flex items-center justify-center py-1.5 rounded-lg text-xs font-medium font-grotesk transition-colors ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-neutral-50 text-neutral-400'
                }`}>
                  {isSelected ? 'Secildi' : 'Sec'}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Action Bar */}
      {hasAnyPending && (
        <div className="sticky bottom-4 bg-white rounded-xl border border-neutral-200 shadow-lg p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="font-grotesk text-sm text-neutral-600">
              {selectedPosts.size > 0 ? (
                <span>{selectedPosts.size} post secildi</span>
              ) : (
                <span>{pendingPosts.length} post onay bekliyor</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!showCommentInput) {
                    setShowCommentInput(true);
                  } else {
                    handleClientAction('client_reject');
                  }
                }}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-700 rounded-full font-grotesk text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Revizyon Iste
              </button>

              <button
                onClick={() => handleClientAction('client_approve')}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {selectedPosts.size > 0 ? 'Secilenleri Onayla' : 'Tumunu Onayla'}
              </button>
            </div>
          </div>

          {showCommentInput && (
            <div className="mt-3 flex gap-2 items-end">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Revizyon notunuzu yazin..."
                className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-grotesk resize-none focus:outline-none focus:ring-1 focus:ring-neutral-300"
                rows={2}
              />
              <button
                onClick={() => handleClientAction('client_reject')}
                disabled={actionLoading || !comment.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium font-grotesk disabled:opacity-50 hover:bg-red-700 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* All approved state */}
      {!hasAnyPending && plan.status === 'approved' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <Check className="w-8 h-8 text-green-600 mx-auto" />
          <p className="font-grotesk font-semibold text-green-800 mt-2">
            Icerik Plani Onaylandi
          </p>
          {plan.approvedByName && (
            <p className="font-grotesk text-sm text-green-600 mt-1">
              {plan.approvedByName} tarafindan onaylandi
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default PortalContentPlanReviewPage;
