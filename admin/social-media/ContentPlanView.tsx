import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  Check,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Calendar,
  Mail,
  X,
  Loader2,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import type {
  ContentPlan,
  SocialMediaPost,
  ContentPlanStatus,
  ApprovalAction,
} from '@/shared/types/socialMedia';
import { SOCIAL_PLATFORM_LABELS, DEFAULT_APPROVAL_CONFIG } from '@/shared/types/socialMedia';
import {
  getContentPlan,
  submitForApproval,
  updateApprovalConfig,
  assignAndSubmitToClient,
} from '@/shared/services/contentPlanService';
import { getSocialPostsForPlan } from '@/shared/services/socialMediaService';
import { getProject } from '@/shared/services/projectService';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { User } from '@/shared/types/user';
import type { Project } from '@/shared/types/project';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';
import PlatformPreviewContainer from './components/previews/PlatformPreviewContainer';
import { authenticatedFetch } from '@/lib/firebase/apiClient';
import ApprovalFlowIndicator from './components/ApprovalFlowIndicator';
import PostApprovalBadge from './components/PostApprovalBadge';
import PostApprovalActions from './components/PostApprovalActions';
import ApprovalAuditTrail from './components/ApprovalAuditTrail';
import ApprovalConfigSection from './components/ApprovalConfigSection';
import ViewSwitcher, { SocialMediaViewMode } from './components/ViewSwitcher';
import CalendarView from './components/calendar/CalendarView';
import InstagramProfileView from './components/grid/InstagramProfileView';

const STATUS_CONFIG: Record<ContentPlanStatus, { label: string; icon: React.ReactNode; color: string }> = {
  draft: { label: 'Taslak', icon: <FileText className="w-4 h-4" />, color: 'bg-gray-100 text-gray-700' },
  internal_review: { label: 'Dahili Inceleme', icon: <Eye className="w-4 h-4" />, color: 'bg-sky-100 text-sky-700' },
  pending_approval: { label: 'Musteri Onayi Bekliyor', icon: <Clock className="w-4 h-4" />, color: 'bg-amber-100 text-amber-700' },
  partially_approved: { label: 'Kismi Onay', icon: <ShieldCheck className="w-4 h-4" />, color: 'bg-violet-100 text-violet-700' },
  approved: { label: 'Onaylandi', icon: <CheckCircle className="w-4 h-4" />, color: 'bg-emerald-100 text-emerald-700' },
  revision_requested: { label: 'Revizyon Istendi', icon: <AlertCircle className="w-4 h-4" />, color: 'bg-red-100 text-red-700' },
};

const ContentPlanView: React.FC = () => {
  const { projectId, planId } = useParams<{ projectId: string; planId: string }>();
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { user } = useAuth();

  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [submittingForApproval, setSubmittingForApproval] = useState(false);

  // Email modal state — "Müşteriye Gönder"
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [selectedClientUid, setSelectedClientUid] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  // Projeye bağlı müşteri kullanıcıları + proje verisi
  const [projectClients, setProjectClients] = useState<User[]>([]);
  const [projectInfo, setProjectInfo] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<SocialMediaViewMode>('list');

  const loadData = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      const planData = await getContentPlan(tenantId, planId);
      if (planData) {
        setPlan(planData);
        const planPosts = await getSocialPostsForPlan(tenantId, planId, planData.postIds || []);
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

  // Projeye bağlı client-role kullanıcılarını yükle
  useEffect(() => {
    if (!plan?.projectId || !db) return;
    let cancelled = false;
    (async () => {
      try {
        const project = await getProject(tenantId, plan.projectId);
        if (!cancelled) setProjectInfo(project);

        // Müşteri kullanıcıları: users.role='client' + profile.assignedProjectIds içerir
        const snap = await getDocs(
          query(
            collection(db, 'users'),
            where('tenantId', '==', tenantId),
            where('role', '==', 'client')
          )
        );
        const list: User[] = [];
        snap.forEach((d) => {
          const u = { uid: d.id, ...d.data() } as User;
          const assigned = (u.profile as any)?.assignedProjectIds || [];
          if (Array.isArray(assigned) && assigned.includes(plan.projectId)) {
            list.push(u);
          }
        });
        if (!cancelled) setProjectClients(list);
      } catch (e) {
        console.warn('[ContentPlanView] Project clients load failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan?.projectId, tenantId]);

  const shareUrl = plan
    ? `${window.location.origin}/icerik-plani/${plan.shareToken}`
    : '';

  const handleCopyShareLink = () => {
    if (!plan) return;
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

  const handleSendEmail = async () => {
    if (!clientEmail.trim() || !clientName.trim() || !plan || !user) return;
    setSendingEmail(true);
    setEmailError(null);
    try {
      const weekRange = [
        plan.weekStartDate
          ?.toDate()
          .toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
        plan.weekEndDate
          ?.toDate()
          .toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
      ]
        .filter(Boolean)
        .join(' – ');

      // 1. Plan'ı müşteriye ata + status'ü pending_approval'a çevir
      await assignAndSubmitToClient(plan.id, {
        clientId: selectedClientUid || undefined,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim().toLowerCase(),
        sentByUid: user.uid,
        sentByName: user.displayName || user.email || 'Ekip',
      });

      // 2. E-posta gönder
      const res = await authenticatedFetch('/api/send-content-plan-notification', {
        method: 'POST',
        body: JSON.stringify({
          type: 'submitted',
          recipientEmail: clientEmail.trim(),
          recipientName: clientName.trim(),
          senderName: user.displayName || 'intiba ekibi',
          planTitle: plan.title,
          brandName: projectInfo?.name,
          postCount: posts.length,
          shareUrl,
          weekRange,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'E-posta gönderilemedi');
      }

      // 3. Local state güncelle
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              status: 'pending_approval',
              assignedClientName: clientName.trim(),
              assignedClientEmail: clientEmail.trim().toLowerCase(),
              assignedClientId: selectedClientUid || undefined,
            }
          : prev
      );
      setEmailSent(true);
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailSent(false);
        setClientEmail('');
        setClientName('');
        setSelectedClientUid('');
      }, 2000);
    } catch (err: any) {
      setEmailError(err.message || 'E-posta gönderilemedi');
    } finally {
      setSendingEmail(false);
    }
  };

  // Modal açıldığında varsa mevcut atanmış kişi ile prefill et
  useEffect(() => {
    if (!showEmailModal || !plan) return;
    if (plan.assignedClientEmail && !clientEmail) setClientEmail(plan.assignedClientEmail);
    if (plan.assignedClientName && !clientName) setClientName(plan.assignedClientName);
    if (plan.assignedClientId && !selectedClientUid) setSelectedClientUid(plan.assignedClientId);
  }, [showEmailModal, plan]);

  const handleApprovalAction = async (action: ApprovalAction, comment?: string) => {
    if (!plan) return;
    setTransitioning(true);
    try {
      const postIds = posts.map((p) => p.id);
      const res = await authenticatedFetch('/api/content-approval/transition', {
        method: 'POST',
        body: JSON.stringify({ planId: plan.id, postIds, action, comment }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('Approval transition failed:', body.error);
        return;
      }
      // Veriyi yeniden yukle
      await loadData();
    } catch (err) {
      console.error('Approval transition error:', err);
    } finally {
      setTransitioning(false);
    }
  };

  const handleApprovalConfigChange = async (config: typeof DEFAULT_APPROVAL_CONFIG) => {
    if (!plan) return;
    try {
      await updateApprovalConfig(tenantId, plan.id, config);
      setPlan((prev) => prev ? { ...prev, approvalConfig: config } : prev);
    } catch (err) {
      console.error('Approval config update error:', err);
    }
  };

  const approvalConfig = plan?.approvalConfig || DEFAULT_APPROVAL_CONFIG;

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
        <p className="font-grotesk text-neutral-500">İçerik planı bulunamadı.</p>
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
        <ProjectBreadcrumb projectId={projectId} currentPage="İçerik Planı" />
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

        <div className="flex items-center gap-2 ml-11 md:ml-0 flex-wrap">
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

          {(plan.status === 'draft' || plan.status === 'pending_approval' || plan.status === 'internal_review') && (
            <button
              onClick={() => setShowEmailModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
            >
              <Mail className="w-4 h-4" />
              {plan.assignedClientEmail ? 'Yeniden Gönder' : 'Müşteriye Gönder'}
            </button>
          )}
        </div>
      </div>

      {/* Approval Flow Indicator */}
      <div className="bg-white rounded-xl border border-neutral-100 p-4 overflow-x-auto">
        <ApprovalFlowIndicator
          currentStatus={plan.status}
          requireInternalReview={approvalConfig.requireInternalReview}
          internalReviewedByName={plan.internalReviewedByName}
          approvedByName={plan.approvedByName}
        />
      </div>

      {/* Bulk Approval Actions */}
      {plan.status !== 'approved' && plan.status !== 'partially_approved' && posts.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-100 p-4">
          <div className="flex items-center justify-between">
            <span className="font-grotesk text-xs text-neutral-500">
              {posts.length} post — toplu islem
            </span>
            <PostApprovalActions
              postStatus={posts[0]?.status || 'draft'}
              planRequiresInternalReview={approvalConfig.requireInternalReview}
              onAction={handleApprovalAction}
              loading={transitioning}
            />
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Preview */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-grotesk text-sm font-semibold text-neutral-700">
              Plan Görünümü
            </h3>
            <ViewSwitcher value={viewMode} onChange={setViewMode} />
          </div>
          {viewMode === 'list' && (
            <div className="bg-white rounded-xl border border-neutral-100 p-6">
              <PlatformPreviewContainer
                platform={plan.platform}
                posts={posts}
                brandName="Brand"
              />
            </div>
          )}
          {viewMode === 'calendar' && (
            <CalendarView
              posts={posts}
              onPostsChange={setPosts}
            />
          )}
          {viewMode === 'grid' && (
            <InstagramProfileView
              posts={posts}
              brandName={plan.title || 'Marka'}
              readOnly
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Mini Calendar */}
          <div className="bg-white rounded-xl border border-neutral-100 p-4">
            <h3 className="font-grotesk text-sm font-semibold text-[#171717] mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              İçerik Takvimi
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
                  Henüz planlanmış içerik yok
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
                          Müşteri
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

          {/* Post Approval Summary */}
          {plan.postApprovalSummary && plan.postApprovalSummary.total > 0 && (
            <div className="bg-white rounded-xl border border-neutral-100 p-4">
              <h3 className="font-grotesk text-sm font-semibold text-[#171717] mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Post Onay Durumu
              </h3>
              <div className="space-y-1.5">
                {plan.postApprovalSummary.approved > 0 && (
                  <div className="flex justify-between items-center px-2 py-1">
                    <PostApprovalBadge status="approved" size="sm" />
                    <span className="font-grotesk text-xs font-medium text-[#171717]">{plan.postApprovalSummary.approved}</span>
                  </div>
                )}
                {plan.postApprovalSummary.pendingApproval > 0 && (
                  <div className="flex justify-between items-center px-2 py-1">
                    <PostApprovalBadge status="pending_approval" size="sm" />
                    <span className="font-grotesk text-xs font-medium text-[#171717]">{plan.postApprovalSummary.pendingApproval}</span>
                  </div>
                )}
                {plan.postApprovalSummary.internalReview > 0 && (
                  <div className="flex justify-between items-center px-2 py-1">
                    <PostApprovalBadge status="internal_review" size="sm" />
                    <span className="font-grotesk text-xs font-medium text-[#171717]">{plan.postApprovalSummary.internalReview}</span>
                  </div>
                )}
                {plan.postApprovalSummary.revisionRequested > 0 && (
                  <div className="flex justify-between items-center px-2 py-1">
                    <PostApprovalBadge status="revision_requested" size="sm" />
                    <span className="font-grotesk text-xs font-medium text-[#171717]">{plan.postApprovalSummary.revisionRequested}</span>
                  </div>
                )}
                {plan.postApprovalSummary.draft > 0 && (
                  <div className="flex justify-between items-center px-2 py-1">
                    <PostApprovalBadge status="draft" size="sm" />
                    <span className="font-grotesk text-xs font-medium text-[#171717]">{plan.postApprovalSummary.draft}</span>
                  </div>
                )}
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
              {plan.internalReviewedByName && (
                <div className="flex justify-between">
                  <span>Dahili Onaylayan:</span>
                  <span className="font-medium text-sky-700">{plan.internalReviewedByName}</span>
                </div>
              )}
              {plan.approvedByName && (
                <div className="flex justify-between">
                  <span>Onaylayan:</span>
                  <span className="font-medium text-emerald-700">{plan.approvedByName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Approval Config */}
          {plan.status === 'draft' && (
            <ApprovalConfigSection
              config={approvalConfig}
              onChange={handleApprovalConfigChange}
            />
          )}

          {/* Approval Audit Trail */}
          <div className="bg-white rounded-xl border border-neutral-100 p-4">
            <ApprovalAuditTrail planId={plan.id} compact />
          </div>
        </div>
      </div>

      {/* Email Modal */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowEmailModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-grotesk text-lg font-bold text-[#171717]">
                  Müşteriye Onaya Gönder
                </h3>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-4 h-4 text-neutral-500" />
                </button>
              </div>

              <p className="font-grotesk text-sm text-neutral-500 mb-4">
                <strong>{plan.title}</strong> planı müşterinin onayına gönderilecek ve belirttiğiniz kişiye e-posta iletilecek.
              </p>

              {/* Proje müşterilerinden hızlı seçim */}
              {projectClients.length > 0 && (
                <div className="mb-4">
                  <label className="block font-grotesk text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                    Projeye bağlı kişiler
                  </label>
                  <div className="space-y-1.5">
                    {projectClients.map((u) => (
                      <button
                        key={u.uid}
                        type="button"
                        onClick={() => {
                          setSelectedClientUid(u.uid);
                          setClientName(u.displayName || u.email);
                          setClientEmail(u.email);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-colors text-left ${
                          selectedClientUid === u.uid
                            ? 'border-[#171717] bg-neutral-50'
                            : 'border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-grotesk text-sm font-medium text-[#171717] truncate">
                            {u.displayName || u.email}
                          </p>
                          <p className="font-grotesk text-xs text-neutral-500 truncate">
                            {u.email}
                            {u.profile?.clientCompany ? ` · ${u.profile.clientCompany}` : ''}
                          </p>
                        </div>
                        {selectedClientUid === u.uid && <Check className="w-4 h-4 text-[#171717]" />}
                      </button>
                    ))}
                  </div>
                  <p className="font-grotesk text-[11px] text-neutral-400 mt-2">
                    Ya da aşağıda farklı bir e-posta girin.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 mb-4">
                <div>
                  <label className="block font-grotesk text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
                    Alıcı adı
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      if (selectedClientUid) setSelectedClientUid('');
                    }}
                    placeholder="Ayşe Yılmaz"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                  />
                </div>
                <div>
                  <label className="block font-grotesk text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
                    E-posta
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => {
                      setClientEmail(e.target.value);
                      if (selectedClientUid) setSelectedClientUid('');
                    }}
                    placeholder="musteri@ornek.com"
                    onKeyDown={(e) => e.key === 'Enter' && handleSendEmail()}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                  />
                </div>
              </div>

              <div className="bg-neutral-50 rounded-xl px-3 py-2 mb-4">
                <p className="font-grotesk text-[11px] text-neutral-500 mb-1">E-postadaki link:</p>
                <p className="font-grotesk text-[11px] text-neutral-700 break-all">{shareUrl}</p>
              </div>

              {emailError && (
                <p className="font-grotesk text-xs text-red-500 mb-3">{emailError}</p>
              )}

              <button
                onClick={handleSendEmail}
                disabled={sendingEmail || !clientEmail.trim() || !clientName.trim() || emailSent}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#171717] text-white rounded-xl font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                {emailSent ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    Gönderildi — müşteri bilgilendirildi
                  </>
                ) : sendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Onaya Gönder ve E-posta At
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContentPlanView;
