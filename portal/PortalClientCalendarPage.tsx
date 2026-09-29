import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { ContentPlan, SocialMediaPost } from '@/shared/types/socialMedia';
import { getPortalData, reviewSinglePost, ApprovalApiError } from '@/shared/services/contentApprovalApi';
import CalendarView from '@/admin/social-media/components/calendar/CalendarView';
import InstagramProfileView from '@/admin/social-media/components/grid/InstagramProfileView';

type ViewMode = 'calendar' | 'grid';

const PortalClientCalendarPage: React.FC = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandName, setBrandName] = useState<string>('Marka');
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [queryError, setQueryError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<{
    totalInTenant: number;
    byClientId: number;
    byClientEmail: number;
    byProject: number;
    matched: number;
  } | null>(null);

  const [plans, setPlans] = useState<ContentPlan[]>([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setQueryError(null);
      // Görünürlük (atanmış proje / plan ataması / müşteriye açık durum) sunucuda uygulanır
      const data = await getPortalData();
      setPlans(data.plans);
      setPosts(data.posts);
      const firstProject = data.projects.find((p) => data.plans.some((pl) => pl.projectId === p.id)) || data.projects[0];
      if (firstProject?.name) setBrandName(firstProject.name);
      setDiagnostic({
        totalInTenant: data.plans.length,
        byClientId: data.plans.filter((p) => p.assignedClientId === user.uid).length,
        byClientEmail: data.plans.filter((p) => (p.assignedClientEmail || '') === (user.email || '').toLowerCase()).length,
        byProject: data.plans.filter((p) => ((user.profile as any)?.assignedProjectIds || []).includes(p.projectId)).length,
        matched: data.plans.length,
      });
    } catch (err: any) {
      console.error('[PortalClientCalendarPage] load error', err);
      setQueryError(err?.message || 'Veri çekilemedi');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** Post'un bağlı olduğu planın güncel inceleme turu */
  const reviewIdFor = (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    return plans.find((pl) => pl.id === post?.contentPlanId)?.reviewRequestId;
  };

  const stats = useMemo(() => {
    // Post status'ü 'approved' değilse ve 'revision_requested' değilse "onay bekliyor" sayılır.
    // (draft, pending_approval, internal_review, scheduled dahil)
    return {
      approved: posts.filter((p) => p.status === 'approved').length,
      revision: posts.filter(
        (p) =>
          p.status === 'revision_requested' ||
          p.status === 'revision_requested_internal'
      ).length,
      pending: posts.filter(
        (p) =>
          p.status !== 'approved' &&
          p.status !== 'revision_requested' &&
          p.status !== 'revision_requested_internal' &&
          p.status !== 'published'
      ).length,
    };
  }, [posts]);

  const callReviewApi = async (postId: string, action: 'approve' | 'revise' | 'undo', comment?: string) => {
    try {
      await reviewSinglePost({ postId, action, comment, reviewRequestId: reviewIdFor(postId) });
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-grotesk text-xs text-neutral-500">Merhaba {user?.displayName?.split(' ')[0] || ''}</p>
          <h1 className="font-grotesk text-2xl md:text-3xl font-bold text-[#171717]">
            Sosyal Medya Takviminiz
          </h1>
          <p className="font-grotesk text-sm text-neutral-500 mt-1">
            Gönderileri takvim üzerinde görüntüleyin, tıklayarak onaylayın veya revizyon isteyin.
          </p>
        </div>
        <div className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-full">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-full font-grotesk text-xs font-medium transition-colors ${
              viewMode === 'calendar'
                ? 'bg-white text-[#171717] shadow-sm'
                : 'text-neutral-500 hover:text-[#171717]'
            }`}
          >
            Takvim
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-full font-grotesk text-xs font-medium transition-colors ${
              viewMode === 'grid'
                ? 'bg-white text-[#171717] shadow-sm'
                : 'text-neutral-500 hover:text-[#171717]'
            }`}
          >
            Instagram
          </button>
        </div>
      </div>

      {/* Özet */}
      {posts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 font-grotesk text-xs text-green-700">
              <CheckCircle className="w-3.5 h-3.5" /> Onayladığınız
            </div>
            <p className="font-grotesk text-2xl font-bold text-green-800 mt-1">{stats.approved}</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 font-grotesk text-xs text-amber-700">
              <Clock className="w-3.5 h-3.5" /> Onayınızı bekliyor
            </div>
            <p className="font-grotesk text-2xl font-bold text-amber-800 mt-1">{stats.pending}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 font-grotesk text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5" /> Revizyon istediğiniz
            </div>
            <p className="font-grotesk text-2xl font-bold text-red-800 mt-1">{stats.revision}</p>
          </div>
        </div>
      )}

      {/* İçerik */}
      {queryError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="font-grotesk text-sm text-red-800 font-medium">
            Veri yüklenirken hata oluştu
          </p>
          <p className="font-grotesk text-xs text-red-700 mt-1">{queryError}</p>
          <p className="font-grotesk text-[11px] text-red-600 mt-3">
            Lütfen sayfayı yenileyin veya ajansınıza bildirin.
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-100 p-8 text-center">
          <Clock className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
          <p className="font-grotesk text-sm text-neutral-700 font-medium">
            Henüz onayınıza gönderilmiş bir gönderi yok
          </p>
          <p className="font-grotesk text-xs text-neutral-500 mt-1">
            Ajansınız size bir plan gönderdiğinde burada görünecek ve e-posta olarak haber vereceğiz.
          </p>
          {diagnostic && (
            <div className="mt-4 text-left max-w-md mx-auto p-3 bg-neutral-50 rounded-lg">
              <p className="font-grotesk text-[11px] font-semibold text-neutral-600 mb-2">
                Teknik detay (ajansla paylaşın)
              </p>
              <div className="font-grotesk text-[10px] text-neutral-600 space-y-0.5 font-mono">
                <div>E-posta: {user?.email}</div>
                <div>UID: {user?.uid}</div>
                <div>Tenant: {(user as any)?.tenantId}</div>
                <div>
                  Atanan projeler:{' '}
                  {((user?.profile as any)?.assignedProjectIds || []).join(', ') || '—'}
                </div>
                <div className="pt-2 mt-2 border-t border-neutral-200">
                  Tenant'ta {diagnostic.totalInTenant} plan var ama{' '}
                  {diagnostic.matched} tanesi size uygun.
                </div>
                {diagnostic.totalInTenant > 0 && diagnostic.matched === 0 && (
                  <div className="text-red-600 mt-1">
                    ⚠ Plan atanırken yanlış e-posta/UID kullanılmış olabilir.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'calendar' ? (
        <CalendarView
          posts={posts}
          initialMode="month"
          onPostClick={() => {
            /* CalendarView'in kendi drag-drop'u var; onaylama için grid'e yönlendirelim */
            setViewMode('grid');
          }}
          readOnly
        />
      ) : (
        <InstagramProfileView
          posts={posts}
          brandName={brandName}
          onApprove={handleApprove}
          onRequestRevision={handleRequestRevision}
          onUndo={handleUndo}
        />
      )}

      {viewMode === 'calendar' && posts.length > 0 && (
        <p className="font-grotesk text-[11px] text-neutral-400 text-center">
          Bir gönderiye tıklayınca Instagram görünümüne geçer, oradan onaylayabilir veya revizyon isteyebilirsiniz.
        </p>
      )}
    </motion.div>
  );
};

export default PortalClientCalendarPage;
