import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, RotateCcw, CheckCircle2, PencilLine, Copy, Check, Mail, X } from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { authenticatedFetch } from '@/lib/firebase/apiClient';
import type { ContentPlan, SocialMediaPost } from '@/shared/types/socialMedia';
import { runApprovalAction, ApprovalApiError, type ApprovalActionName } from '@/shared/services/contentApprovalApi';
import ApprovalAuditTrail from '@/admin/social-media/components/ApprovalAuditTrail';
import { useStudio } from '../StudioLayout';
import StudioPostCard from '../components/StudioPostCard';
import { formatDate, getBrandKit, getPlan, getProjectPosts, STUDIO_STATUS_LABEL } from '../studioData';

/** Metni düzenlenebilir durumlar (firestore.rules ile aynı) */
const EDITABLE = new Set(['draft', 'internal_review', 'revision_requested_internal', 'revision_requested']);

interface PostActionDef {
  action: ApprovalActionName;
  label: string;
  needsComment?: boolean;
  tone: 'primary' | 'neutral' | 'danger';
}

/** Şeyma'nın bir post için yapabileceği işlemler (Studio politikası: iç inceleme zorunlu) */
function actionsFor(status: string): PostActionDef[] {
  switch (status) {
    case 'draft':
      return [{ action: 'submit_for_review', label: 'Kontrole al', tone: 'neutral' }];
    case 'internal_review':
      return [{ action: 'internal_reject', label: 'Düzeltilsin', needsComment: true, tone: 'danger' }];
    case 'revision_requested_internal':
      return [{ action: 'resubmit', label: 'Düzeltildi, kontrole al', tone: 'neutral' }];
    case 'revision_requested':
      return [{ action: 'resubmit', label: 'Düzenlendi, kontrole al', tone: 'neutral' }];
    case 'pending_approval':
    case 'approved':
      return [{ action: 'reopen', label: 'Revizyona al', tone: 'neutral' }];
    default:
      return [];
  }
}

const StudioPlanPage: React.FC = () => {
  const { project, tenantId } = useStudio();
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Metin düzenleme
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');

  // Yorum isteyen işlem
  const [commentFor, setCommentFor] = useState<{ postId: string; action: ApprovalActionName } | null>(null);
  const [comment, setComment] = useState('');

  // Firmaya gönderme
  const [sendOpen, setSendOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!project || !planId) return;
    setLoading(true);
    try {
      const [p, all] = await Promise.all([getPlan(planId), getProjectPosts(tenantId, project.id)]);
      if (!p || p.projectId !== project.id) {
        setPlan(null);
        return;
      }
      setPlan(p);
      const ids = new Set(p.postIds || []);
      setPosts(
        all
          .filter((x) => x.contentPlanId === p.id || ids.has(x.id))
          .sort((a, b) => ((a.scheduledAt as any)?.toMillis?.() || 0) - ((b.scheduledAt as any)?.toMillis?.() || 0))
      );
    } catch (err) {
      console.error('[Studio] Plan yüklenemedi:', err);
      setError('Plan yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [project?.id, planId, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  // Firma iletişim bilgisi: plandaki atama → projedeki müşteri bilgisi
  useEffect(() => {
    if (!plan || !project) return;
    if (plan.assignedClientEmail) {
      setClientEmail(plan.assignedClientEmail);
      setClientName(plan.assignedClientName || '');
      return;
    }
    getBrandKit(project.id)
      .then((kit) => {
        setClientEmail(kit.project.clientEmail || '');
        setClientName(kit.project.clientName || '');
      })
      .catch(() => {});
  }, [plan?.id, project?.id]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    posts.forEach((p) => (c[p.status] = (c[p.status] || 0) + 1));
    return c;
  }, [posts]);

  const run = async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (success) setNotice(success);
      await load();
      return true;
    } catch (err) {
      const msg =
        err instanceof ApprovalApiError
          ? err.message
          : (err as any)?.code === 'permission-denied'
            ? 'Bu içerik şu an düzenlenemez (firmaya gönderilmiş veya onaylanmış olabilir).'
            : 'İşlem başarısız.';
      setError(msg);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const postAction = (postId: string, action: ApprovalActionName, text?: string) =>
    run(`${postId}:${action}`, () =>
      runApprovalAction({ planId: plan!.id, action, postIds: [postId], comment: text, reviewRequestId: plan!.reviewRequestId })
    );

  const bulk = (action: ApprovalActionName, label: string) =>
    run(`bulk:${action}`, () => runApprovalAction({ planId: plan!.id, action, reviewRequestId: plan!.reviewRequestId }), label);

  /** Kontroldeki içerikleri onayla → firmaya gönder (atama + e-posta) */
  const approveAndSend = async () => {
    const email = clientEmail.trim().toLowerCase();
    if (!email || !clientName.trim()) {
      setError('Firma yetkilisinin adı ve e-postası gerekli.');
      return;
    }
    const ok = await run('send', async () => {
      if ((counts.internal_review || 0) > 0) {
        await runApprovalAction({
          planId: plan!.id,
          action: 'internal_approve',
          assignee: { clientName: clientName.trim(), clientEmail: email },
        });
      } else {
        // İçerikler zaten firmada: yalnızca yetkiliyi güncelle / yeniden bildir
        await runApprovalAction({
          planId: plan!.id,
          action: 'submit_to_client',
          assignee: { clientName: clientName.trim(), clientEmail: email },
        });
      }
      const res = await authenticatedFetch('/api/send-content-plan-notification', {
        method: 'POST',
        body: JSON.stringify({
          type: 'submitted',
          planId: plan!.id,
          recipientEmail: email,
          recipientName: clientName.trim(),
          brandName: project?.name,
          postCount: posts.length,
          weekRange: `${formatDate(plan!.weekStartDate)} – ${formatDate(plan!.weekEndDate)}`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApprovalApiError(`Onaylandı fakat e-posta gönderilemedi: ${body?.error || res.status}`);
      }
    }, 'Firmaya gönderildi.');
    if (ok) setSendOpen(false);
  };

  const saveCaption = (post: SocialMediaPost) =>
    run(`${post.id}:edit`, async () => {
      await updateDoc(doc(db!, 'social_media_posts', post.id), { caption: editCaption, updatedAt: serverTimestamp() });
      setEditingId(null);
    });

  const shareUrl = plan ? `${window.location.origin}/icerik-plani/${plan.shareToken}` : '';

  if (!project) return null;
  if (loading && !plan) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }
  if (!plan) {
    return (
      <div className="text-center py-16">
        <p className="font-grotesk text-sm text-neutral-600">Plan bulunamadı.</p>
        <Link to={`/studio/${project.id}/planlar`} className="inline-block mt-3 font-grotesk text-sm underline">
          Planlara dön
        </Link>
      </div>
    );
  }

  const toReview = counts.internal_review || 0;
  const drafts = (counts.draft || 0) + (counts.revision_requested_internal || 0);
  const withClient = counts.pending_approval || 0;

  return (
    <div className="space-y-5">
      <Link to={`/studio/${project.id}/planlar`} className="inline-flex items-center gap-1 font-grotesk text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="w-4 h-4" /> Planlar
      </Link>

      <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-grotesk text-xl font-bold text-[#171717]">{plan.title}</h1>
            <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
              {formatDate(plan.weekStartDate)} – {formatDate(plan.weekEndDate)} · {posts.length} içerik
              {plan.assignedClientName && ` · Firma yetkilisi: ${plan.assignedClientName}`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {drafts > 0 && (
              <button
                onClick={() => (counts.draft ? bulk('submit_for_review', 'Taslaklar kontrole alındı.') : bulk('resubmit', 'Kontrole alındı.'))}
                disabled={!!busy}
                className="px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm hover:bg-neutral-50 disabled:opacity-50"
              >
                Hepsini kontrole al
              </button>
            )}
            {(toReview > 0 || withClient > 0) && (
              <button
                onClick={() => setSendOpen(true)}
                disabled={!!busy}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#171717] text-white rounded-lg font-grotesk text-sm hover:bg-neutral-800 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {toReview > 0 ? `Onayla ve firmaya gönder (${toReview})` : 'Firmaya yeniden bildir'}
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {Object.entries(counts).map(([status, n]) => (
            <span key={status} className="px-2 py-0.5 bg-neutral-100 rounded-full font-grotesk text-[11px] text-neutral-600">
              {STUDIO_STATUS_LABEL[status] || status}: {n}
            </span>
          ))}
        </div>

        {withClient > 0 && plan.shareToken && (
          <div className="flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2">
            <span className="font-grotesk text-[11px] text-neutral-600 truncate flex-1">{shareUrl}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1 font-grotesk text-[11px] text-neutral-700"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Kopyalandı' : 'Firma linkini kopyala'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 font-grotesk text-sm text-red-700">{error}</p>}
      {notice && <p className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 font-grotesk text-sm text-green-700">{notice}</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        {posts.map((post) => {
          const editable = EDITABLE.has(post.status);
          const isEditing = editingId === post.id;
          return (
            <StudioPostCard key={post.id} post={post}>
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    rows={5}
                    className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-xs resize-y"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveCaption(post)}
                      disabled={!!busy}
                      className="px-3 py-1.5 bg-[#171717] text-white rounded-lg font-grotesk text-[11px] disabled:opacity-50"
                    >
                      Kaydet
                    </button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-[11px]">
                      Vazgeç
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {editable && (
                    <button
                      onClick={() => {
                        setEditingId(post.id);
                        setEditCaption(post.caption || '');
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 border border-neutral-200 rounded-lg font-grotesk text-[11px] text-neutral-700 hover:bg-neutral-50"
                    >
                      <PencilLine className="w-3.5 h-3.5" /> Metni düzenle
                    </button>
                  )}
                  {actionsFor(post.status).map((a) => (
                    <button
                      key={a.action}
                      disabled={!!busy}
                      onClick={() => (a.needsComment ? setCommentFor({ postId: post.id, action: a.action }) : postAction(post.id, a.action))}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-grotesk text-[11px] disabled:opacity-50 ${
                        a.tone === 'danger'
                          ? 'border border-red-200 text-red-700 hover:bg-red-50'
                          : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {a.action === 'reopen' ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {busy === `${post.id}:${a.action}` ? '…' : a.label}
                    </button>
                  ))}
                  {!editable && post.status !== 'published' && (
                    <span className="font-grotesk text-[10px] text-neutral-400">Firmaya gönderildi — düzenlemek için "Revizyona al"</span>
                  )}
                </div>
              )}
            </StudioPostCard>
          );
        })}
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <h2 className="font-grotesk text-sm font-semibold text-[#171717] mb-2">Geçmiş</h2>
        <ApprovalAuditTrail planId={plan.id} compact />
      </div>

      {/* Yorum gerektiren işlem */}
      {commentFor && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setCommentFor(null)}>
          <div className="bg-white rounded-xl p-4 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-grotesk text-sm font-semibold">Ne düzeltilsin?</h3>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Ekip için not (firma görmez)"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setCommentFor(null)} className="px-3 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-sm">
                Vazgeç
              </button>
              <button
                disabled={!comment.trim() || !!busy}
                onClick={async () => {
                  const ok = await postAction(commentFor.postId, commentFor.action, comment.trim());
                  if (ok) {
                    setCommentFor(null);
                    setComment('');
                  }
                }}
                className="px-3 py-1.5 bg-[#171717] text-white rounded-lg font-grotesk text-sm disabled:opacity-50"
              >
                Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Firmaya gönder */}
      {sendOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setSendOpen(false)}>
          <div className="bg-white rounded-xl p-4 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-grotesk text-sm font-semibold">
                <Mail className="w-4 h-4" /> {toReview > 0 ? 'Onayla ve firmaya gönder' : 'Firmaya yeniden bildir'}
              </h3>
              <button onClick={() => setSendOpen(false)}>
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
            <p className="font-grotesk text-xs text-neutral-500">
              {toReview > 0
                ? `Kontrolündeki ${toReview} içerik onaylanıp firma yetkilisine gönderilecek. Firma bir link üzerinden onaylayacak veya revizyon isteyecek.`
                : 'Firma yetkilisine onay linki yeniden e-postayla gönderilecek.'}
            </p>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Firma yetkilisi adı"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm"
            />
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="yetkili@firma.com"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setSendOpen(false)} className="px-3 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-sm">
                Vazgeç
              </button>
              <button
                onClick={approveAndSend}
                disabled={busy === 'send'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] text-white rounded-lg font-grotesk text-sm disabled:opacity-50"
              >
                {busy === 'send' && <Loader2 className="w-4 h-4 animate-spin" />}
                Gönder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudioPlanPage;
