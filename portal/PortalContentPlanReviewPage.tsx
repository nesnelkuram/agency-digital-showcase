import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { ContentPlan, SocialMediaPost } from '@/shared/types/socialMedia';
import { SOCIAL_PLATFORM_LABELS } from '@/shared/types/socialMedia';
import {
  getPortalData,
  reviewSinglePost,
  ApprovalApiError,
  type PortalProject,
} from '@/shared/services/contentApprovalApi';
import InstagramProfileView from '@/admin/social-media/components/grid/InstagramProfileView';

const PortalContentPlanReviewPage: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [project, setProject] = useState<PortalProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      setError(null);
      // Erişim ve görünürlük sunucuda uygulanır
      const data = await getPortalData(planId);
      const planData = data.plans[0];
      if (!planData) {
        setError('Plan bulunamadı');
        return;
      }
      setPlan(planData);
      setPosts(data.posts);
      setProject(data.projects.find((p) => p.id === planData.projectId) || null);
    } catch (err: any) {
      console.error('[PortalContentPlanReviewPage] load error', err);
      setError(err?.status === 404 ? 'Bu plana erişim yetkiniz yok' : err?.message || 'Yükleme hatası');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const callReviewApi = async (postId: string, action: 'approve' | 'revise' | 'undo', comment?: string) => {
    try {
      await reviewSinglePost({ postId, planId: plan?.id, action, comment, reviewRequestId: plan?.reviewRequestId });
    } catch (err) {
      // Eski inceleme turu: güncel içeriği yükle, kullanıcı tekrar baksın
      if (err instanceof ApprovalApiError && err.isStale) await loadData();
      throw err;
    }
  };

  const handleApprove = async (postId: string) => {
    await callReviewApi(postId, 'approve');
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              status: 'approved' as any,
              approvedBy: user?.uid,
              approvedByName: user?.displayName,
            }
          : p
      )
    );
  };

  const handleRequestRevision = async (postId: string, comment: string) => {
    await callReviewApi(postId, 'revise', comment);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              status: 'revision_requested' as any,
              lastRevisionComment: comment,
              revisionCount: (p.revisionCount || 0) + 1,
            }
          : p
      )
    );
  };

  const handleUndo = async (postId: string) => {
    await callReviewApi(postId, 'undo');
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              status: 'pending_approval' as any,
              approvedBy: undefined,
              approvedByName: undefined,
            }
          : p
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
        <p className="font-grotesk text-sm text-neutral-700">{error || 'Plan bulunamadı'}</p>
        <button
          onClick={() => navigate('/portal/social-media')}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-200 rounded-full font-grotesk text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Planlara dön
        </button>
      </div>
    );
  }

  const approvedCount = posts.filter((p) => p.status === 'approved').length;
  const revisionCount = posts.filter((p) => p.status === 'revision_requested').length;
  const pendingCount = posts.length - approvedCount - revisionCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/portal/social-media')}
            className="inline-flex items-center gap-1 text-neutral-500 hover:text-[#171717] mb-2 font-grotesk text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Planlarım
          </button>
          <h1 className="font-grotesk text-2xl font-bold text-[#171717]">{plan.title}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="font-grotesk text-sm text-neutral-500">
              {SOCIAL_PLATFORM_LABELS[plan.platform]}
            </span>
            {plan.weekStartDate && plan.weekEndDate && (
              <span className="font-grotesk text-sm text-neutral-500">
                {plan.weekStartDate.toDate().toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'short',
                })}{' '}
                –{' '}
                {plan.weekEndDate.toDate().toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
            <span className="font-grotesk text-sm text-neutral-500">{posts.length} gönderi</span>
          </div>
        </div>
      </div>

      {/* Review summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 font-grotesk text-xs text-green-700">
            <CheckCircle className="w-3.5 h-3.5" /> Onaylandı
          </div>
          <p className="font-grotesk text-2xl font-bold text-green-800 mt-1">{approvedCount}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 font-grotesk text-xs text-amber-700">
            <Clock className="w-3.5 h-3.5" /> Beklemede
          </div>
          <p className="font-grotesk text-2xl font-bold text-amber-800 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 font-grotesk text-xs text-red-700">
            <AlertCircle className="w-3.5 h-3.5" /> Revizyon
          </div>
          <p className="font-grotesk text-2xl font-bold text-red-800 mt-1">{revisionCount}</p>
        </div>
      </div>

      {/* Instagram profil görünümü — her posta onay/revizyon */}
      <InstagramProfileView
        posts={posts}
        brandName={project?.name || plan.title}
        onApprove={handleApprove}
        onRequestRevision={handleRequestRevision}
        onUndo={handleUndo}
      />
    </motion.div>
  );
};

export default PortalContentPlanReviewPage;
