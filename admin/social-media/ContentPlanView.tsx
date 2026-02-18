import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Share2,
  Copy,
  Check,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Calendar,
} from 'lucide-react';
import { useTenantId } from '@/shared/hooks/useTenant';
import type {
  ContentPlan,
  SocialMediaPost,
  SocialPlatform,
  ContentPlanStatus,
} from '@/shared/types/socialMedia';
import { SOCIAL_PLATFORM_LABELS } from '@/shared/types/socialMedia';
import { getContentPlan, submitForApproval } from '@/shared/services/contentPlanService';
import { getSocialPostsForPlan } from '@/shared/services/socialMediaService';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';
import PlatformPreviewContainer from './components/previews/PlatformPreviewContainer';

const STATUS_CONFIG: Record<ContentPlanStatus, { label: string; icon: React.ReactNode; color: string }> = {
  draft: { label: 'Taslak', icon: <FileText className="w-4 h-4" />, color: 'bg-gray-100 text-gray-700' },
  pending_approval: { label: 'Onay Bekliyor', icon: <Clock className="w-4 h-4" />, color: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Onaylandi', icon: <CheckCircle className="w-4 h-4" />, color: 'bg-emerald-100 text-emerald-700' },
  revision_requested: { label: 'Revizyon Istendi', icon: <AlertCircle className="w-4 h-4" />, color: 'bg-red-100 text-red-700' },
};

const ContentPlanView: React.FC = () => {
  const { projectId, planId } = useParams<{ projectId: string; planId: string }>();
  const navigate = useNavigate();
  const tenantId = useTenantId();

  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [submittingForApproval, setSubmittingForApproval] = useState(false);

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
      console.error('[ContentPlanView] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, planId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyShareLink = () => {
    if (!plan) return;
    const shareUrl = `${window.location.origin}/icerik-plani/${plan.shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitForApproval = async () => {
    if (!plan) return;
    setSubmittingForApproval(true);
    try {
      await submitForApproval(tenantId, plan.id);
      setPlan((prev) => prev ? { ...prev, status: 'pending_approval' } : prev);
    } catch (err) {
      console.error('[ContentPlanView] Error submitting for approval:', err);
    } finally {
      setSubmittingForApproval(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
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

  const statusConfig = STATUS_CONFIG[plan.status];

  // Group posts by date for mini calendar
  const postsByDate = new Map<string, number>();
  posts.forEach((post) => {
    if (post.scheduledAt) {
      const dateKey = post.scheduledAt.toDate().toISOString().split('T')[0];
      postsByDate.set(dateKey, (postsByDate.get(dateKey) || 0) + 1);
    }
  });

  return (
    <div className="space-y-6">
      {projectId && (
        <ProjectBreadcrumb projectId={projectId} currentPage="Icerik Plani" />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate(`/admin/projects/${projectId}/social-media/plans`)}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors mt-1"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div>
            <h1 className="text-2xl font-grotesk font-bold text-[#1a1a2e]">
              {plan.title}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-grotesk text-xs font-medium ${statusConfig.color}`}>
                {statusConfig.icon}
                {statusConfig.label}
              </span>
              <span className="font-grotesk text-sm text-neutral-500">
                {SOCIAL_PLATFORM_LABELS[plan.platform]}
              </span>
              <span className="font-grotesk text-sm text-neutral-500">
                {posts.length} post
              </span>
            </div>
            {plan.description && (
              <p className="font-grotesk text-sm text-neutral-600 mt-2">
                {plan.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-11 md:ml-0">
          <button
            onClick={handleCopyShareLink}
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                Kopyalandi
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Link Kopyala
              </>
            )}
          </button>

          {plan.status === 'draft' && (
            <motion.button
              onClick={handleSubmitForApproval}
              disabled={submittingForApproval}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submittingForApproval ? 'Gonderiliyor...' : 'Musteriye Gonder'}
            </motion.button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Preview */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-neutral-100 p-6">
            <PlatformPreviewContainer
              platform={plan.platform}
              posts={posts}
              brandName="Brand"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Mini Calendar */}
          <div className="bg-white rounded-xl border border-neutral-100 p-4">
            <h3 className="font-grotesk text-sm font-semibold text-[#171717] mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Icerik Takvimi
            </h3>
            <div className="space-y-1.5">
              {Array.from(postsByDate.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, count]) => (
                  <div
                    key={date}
                    className="flex items-center justify-between px-3 py-2 bg-neutral-50 rounded-lg"
                  >
                    <span className="font-grotesk text-xs text-neutral-600">
                      {new Date(date).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        weekday: 'short',
                      })}
                    </span>
                    <span className="font-grotesk text-xs font-medium text-[#171717] bg-neutral-200 px-2 py-0.5 rounded-full">
                      {count}
                    </span>
                  </div>
                ))}
              {postsByDate.size === 0 && (
                <p className="font-grotesk text-xs text-neutral-400 text-center py-2">
                  Henuz planlanmis icerik yok
                </p>
              )}
            </div>
          </div>

          {/* Comments */}
          {plan.clientComments && plan.clientComments.length > 0 && (
            <div className="bg-white rounded-xl border border-neutral-100 p-4">
              <h3 className="font-grotesk text-sm font-semibold text-[#171717] mb-3">
                Yorumlar
              </h3>
              <div className="space-y-3">
                {plan.clientComments.map((comment) => (
                  <div key={comment.id} className="space-y-1">
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
                    <p className="font-grotesk text-xs text-neutral-600">
                      {comment.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan Info */}
          <div className="bg-white rounded-xl border border-neutral-100 p-4">
            <h3 className="font-grotesk text-sm font-semibold text-[#171717] mb-3">
              Plan Detaylari
            </h3>
            <div className="space-y-2 font-grotesk text-xs text-neutral-600">
              <div className="flex justify-between">
                <span>Olusturan:</span>
                <span className="font-medium text-[#171717]">{plan.createdByName}</span>
              </div>
              <div className="flex justify-between">
                <span>Tarih Araligi:</span>
                <span className="font-medium text-[#171717]">
                  {plan.weekStartDate?.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                  {' - '}
                  {plan.weekEndDate?.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              {plan.approvedByName && (
                <div className="flex justify-between">
                  <span>Onaylayan:</span>
                  <span className="font-medium text-emerald-700">{plan.approvedByName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentPlanView;
