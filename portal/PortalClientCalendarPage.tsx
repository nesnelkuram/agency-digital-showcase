import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { collection, query as fsQuery, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import type { ContentPlan, SocialMediaPost } from '@/shared/types/socialMedia';
import { getSocialPostsForPlan } from '@/shared/services/socialMediaService';
import { matchPlanForClient } from '@/shared/services/contentPlanAccess';
import CalendarView from '@/admin/social-media/components/calendar/CalendarView';
import InstagramProfileView from '@/admin/social-media/components/grid/InstagramProfileView';

type ViewMode = 'calendar' | 'grid';

const PortalClientCalendarPage: React.FC = () => {
  const { user } = useAuth();
  const tenantId = useTenantId();
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

  useEffect(() => {
    if (!db || !user) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const assigned: string[] = (user.profile as any)?.assignedProjectIds || [];
        const userEmail = (user.email || '').toLowerCase();

        console.info('[PortalClientCalendar] User context:', {
          uid: user.uid,
          role: user.role,
          email: userEmail,
          tenantId,
          assignedProjectIds: assigned,
        });

        // Basitleştirilmiş: TÜM tenant planlarını oku, client-side filtrele.
        // Firestore rules'ın isClient() branch'i buna izin verir (belongsToTenant).
        const plansById: Map<string, ContentPlan> = new Map();
        const clientContext = {
          uid: user.uid,
          email: user.email || '',
          assignedProjectIds: assigned,
        };

        let totalInTenant = 0;
        let byClientId = 0;
        let byClientEmail = 0;
        let byProject = 0;

        try {
          const snap = await getDocs(
            fsQuery(collection(db!, 'content_plans'), where('tenantId', '==', tenantId))
          );
          totalInTenant = snap.size;
          snap.forEach((d) => {
            const data = { id: d.id, ...d.data() } as ContentPlan;
            const match = matchPlanForClient(data, clientContext);
            if (match.visible) {
              plansById.set(d.id, data);
              if (match.reason === 'uid') byClientId++;
              else if (match.reason === 'email') byClientEmail++;
              else if (match.reason === 'project') byProject++;
            }
          });
        } catch (err: any) {
          console.error('[PortalClientCalendar] Firestore query failed:', err);
          const msg = err?.code === 'permission-denied'
            ? 'Firestore izin hatası — yetkiniz olmayabilir. Ajansınıza bildirin.'
            : err?.message || 'Veri çekilemedi';
          setQueryError(msg);
        }

        // En yeniye göre sırala
        const relevantPlans = Array.from(plansById.values()).sort((a, b) => {
          const at = (a.createdAt as any)?.toDate?.()?.getTime?.() || 0;
          const bt = (b.createdAt as any)?.toDate?.()?.getTime?.() || 0;
          return bt - at;
        });

        setDiagnostic({
          totalInTenant,
          byClientId,
          byClientEmail,
          byProject,
          matched: relevantPlans.length,
        });

        console.info('[PortalClientCalendar] Query sonuçları:', {
          totalInTenant,
          byClientId,
          byClientEmail,
          byProject,
          matchedPlans: relevantPlans.length,
        });

        // Her planın post'larını yükle (paralel + hataları logla)
        const allPosts: SocialMediaPost[] = [];
        const postLoadResults: Array<{ planId: string; count: number; error?: string }> = [];
        await Promise.all(
          relevantPlans.map(async (plan) => {
            try {
              // plan.postIds varsa bunu kullan (orphan post'lar için fallback)
              const planPosts = await getSocialPostsForPlan(
                tenantId,
                plan.id,
                plan.postIds || []
              );
              postLoadResults.push({ planId: plan.id, count: planPosts.length });
              planPosts.forEach((p) => allPosts.push(p));
            } catch (err: any) {
              console.error(
                '[PortalClientCalendar] getSocialPostsForPlan failed for',
                plan.id,
                err
              );
              postLoadResults.push({
                planId: plan.id,
                count: 0,
                error: err?.code || err?.message || 'unknown',
              });
            }
          })
        );
        console.info('[PortalClientCalendar] Post loading:', postLoadResults);
        const failedLoads = postLoadResults.filter((r) => r.error);
        if (failedLoads.length > 0) {
          setQueryError(
            `${failedLoads.length} plan için gönderiler yüklenemedi (${failedLoads[0].error}).`
          );
        }

        // Marka adı: ilk projenin adını kullan (basit yaklaşım)
        if (relevantPlans.length > 0 && assigned.length > 0) {
          try {
            const projSnap = await getDocs(
              fsQuery(
                collection(db!, 'projects'),
                where('tenantId', '==', tenantId),
              )
            );
            const firstProject = projSnap.docs.find((d) => assigned.includes(d.id));
            if (firstProject) {
              const pd = firstProject.data();
              setBrandName(pd.name || 'Marka');
            }
          } catch {
            // skip
          }
        }

        // Dedupe by postId
        const seen = new Set<string>();
        const unique = allPosts.filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });

        if (!cancelled) setPosts(unique);
      } catch (e) {
        console.error('[PortalClientCalendarPage] load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, tenantId]);

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

  const callReviewApi = async (postId: string, action: 'approve' | 'revise', comment?: string) => {
    // Firebase Auth token'ı — cache'li, yeni istek göndermez (network-request-failed'e karşı)
    let token: string | undefined;
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        throw new Error('Oturum bulunamadı. Lütfen sayfayı yenileyip tekrar giriş yapın.');
      }
      // forceRefresh=false → cache'den oku; refresh gerekiyorsa network'e gider
      token = await currentUser.getIdToken(false);
    } catch (err: any) {
      if (err?.code === 'auth/network-request-failed' || /network/i.test(err?.message || '')) {
        throw new Error(
          'Firebase bağlantı hatası: Tarayıcınızın gizlilik ayarları veya adblocker Firebase Auth erişimini engelliyor olabilir. Lütfen adblocker\'ı kapatın, Safari kullanıyorsanız "Prevent cross-site tracking"i kapatın veya Chrome/Firefox deneyin.'
        );
      }
      throw new Error(err?.message || 'Kimlik doğrulama başarısız');
    }

    const res = await fetch('/api/social-media/client-review-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ postId, action, comment }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `API ${res.status} döndü`);
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
