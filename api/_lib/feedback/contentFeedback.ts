/**
 * Ret/revizyon SEBEP kaydı — `content_feedback`. Yeni onay/yayın akışı değildir: mevcut Studio işlemlerine
 * (Düzeltilsin / Revizyona al → onay geçişiyle AYNI transaction; AI önerisini reddet → saklanmış öneri) bağlanır.
 *
 * Güvence:
 *  - Hedef sunucuda yüklenir; tenant/proje/plan hedeften (ve gerçek plan üyeliğinden) alınır, istemciye güvenilmez.
 *  - Actor ve zaman sunucudan; gövdede actor/tenant alanı → şema reddi (strict).
 *  - Sürüm: istemci gördüğü içeriğin hash'ini (expectedContentHash) gönderir; sunucu transaction içinde kendi
 *    hesapladığı güncel hash ile karşılaştırır, farklıysa 409 (kullanıcı görmediği sürüme eleştiri bağlanmaz).
 *  - İdempotency: belge kimliği = tenant + actor + idempotencyKey. Var olan kayıt önce aranır; aynı payload →
 *    önceki sonuç döner (yeniden yazma/geçiş yok), farklı payload/hedef/hash → 409. İçerik sonradan değişse de
 *    aynı anahtar yeni belge üretmez.
 *  - Kapsam: 'content_only' yalnız o içerik; 'brand_context' sonraki planlarda VERİ olarak bağlam.
 *    Onaylı marka hafızası (brand_leads analizi, agent_memories) burada hiç yazılmaz.
 */

import { createHash } from 'crypto';
import { z } from 'zod/v4';
import { canonicalPostContent, CONTENT_HASH_RE } from '../../../shared/feedback/contentVersion.js';

type Db = any;

export const FEEDBACK = 'content_feedback';
export const SUGGESTION_SETS = 'plan_suggestions';

export const FEEDBACK_CATEGORIES = ['görsel', 'metin', 'marka_sesi', 'ürün_bilgisi', 'format', 'zamanlama', 'tekrar', 'diğer'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export const FEEDBACK_SCOPES = ['content_only', 'brand_context'] as const;
export type FeedbackScope = (typeof FEEDBACK_SCOPES)[number];
export type FeedbackAction = 'internal_reject' | 'reopen' | 'suggestion_reject';
/** Sebep kaydının bağlanabildiği mevcut onay işlemleri (yeni geçiş tanımlamaz) */
export const POST_FEEDBACK_ACTIONS = new Set(['internal_reject', 'reopen']);

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

const core = {
  category: z.enum(FEEDBACK_CATEGORIES),
  note: z.string().max(500).default(''),
  scope: z.enum(FEEDBACK_SCOPES),
  /** Bir gönderim için istemci anahtarı (yeniden denemede aynı) */
  idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{16,64}$/),
  /** İstemcinin GÖRDÜĞÜ içerik sürümü (sunucu doğrular) */
  expectedContentHash: z.string().regex(CONTENT_HASH_RE),
};

/** Onay geçişiyle gelen post sebebi (transition gövdesinde `feedback`) */
export const PostFeedbackSchema = z.object(core).strict();
export type PostFeedbackInput = z.infer<typeof PostFeedbackSchema>;

/** AI öneri reddi (api/studio/feedback) */
export const SuggestionFeedbackSchema = z
  .object({ target: z.object({ kind: z.literal('suggestion'), suggestionSetId: ID, index: z.number().int().min(0).max(50) }).strict(), ...core })
  .strict();
export type SuggestionFeedbackInput = z.infer<typeof SuggestionFeedbackSchema>;

export type FeedbackTarget = { kind: 'post'; postId: string; planId: string } | { kind: 'suggestion'; suggestionSetId: string; index: number };

export interface FeedbackRecord {
  id: string;
  tenantId: string;
  projectId: string;
  target: FeedbackTarget;
  action: FeedbackAction;
  category: FeedbackCategory;
  note: string;
  scope: FeedbackScope;
  /** Sunucunun hesapladığı (ve istemcinin gördüğüyle eşit olduğu doğrulanan) sürüm */
  contentVersion: { hash: string; revisionCount: number | null };
  /** Kayıt anındaki içerik özeti (sunucu kaynaklı) — planlayıcı bağlamı için */
  snapshot: { postType: string; mediaIds: string[]; captionExcerpt: string; scheduledAt: number | null };
  actor: { uid: string; name: string; role: string };
  idempotencyKey: string;
  createdAt: number;
}

const msOf = (v: any): number | null => (v == null ? null : typeof v === 'number' ? v : typeof v.toMillis === 'function' ? v.toMillis() : null);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** Post içerik hash'i (sunucu) — shared/feedback/contentVersion.contentHashOf ile aynı değer */
export const postContentHash = (post: any): string => sha(canonicalPostContent(post)).slice(0, 32);

/** Saklanmış öneri içeriği hash'i (planSuggest aynı tanımı kullanır) */
export function suggestionContentHash(s: { mediaIds: string[]; postType: string; scheduledAt: string; captionDraft: string }): string {
  return sha(JSON.stringify({ mediaIds: s.mediaIds, postType: s.postType, scheduledAt: s.scheduledAt, captionDraft: s.captionDraft })).slice(0, 32);
}

/** İstek kimliği sabit: hedef/hash değişse de aynı anahtar aynı belge */
export const feedbackDocId = (tenantId: string, actorUid: string, idempotencyKey: string) => sha([tenantId, actorUid, idempotencyKey].join('|')).slice(0, 40);

/** Aynı gönderim mi (idempotent tekrar) — hedef, işlem, içerik ve beklenen sürüm birebir */
export function sameSubmission(existing: FeedbackRecord, c: { target: FeedbackTarget; action: FeedbackAction; category: string; note: string; scope: string; expectedContentHash: string }): boolean {
  return (
    JSON.stringify(existing.target) === JSON.stringify(c.target) &&
    existing.action === c.action &&
    existing.category === c.category &&
    existing.note === c.note.trim() &&
    existing.scope === c.scope &&
    existing.contentVersion.hash === c.expectedContentHash
  );
}

export function postSnapshot(post: any): FeedbackRecord['snapshot'] {
  return {
    postType: String(post?.postType || ''),
    mediaIds: [...new Set<string>(Array.isArray(post?.libraryAssetIds) ? post.libraryAssetIds : [])],
    captionExcerpt: String(post?.caption || '').slice(0, 160),
    scheduledAt: msOf(post?.scheduledAt),
  };
}

export type FeedbackConflict = { ok: false; httpStatus: 400 | 403 | 404 | 409; code: string; error: string };

export const IDEMPOTENCY_CONFLICT: FeedbackConflict = { ok: false, httpStatus: 409, code: 'IDEMPOTENCY_CONFLICT', error: 'Bu gönderim anahtarı farklı bir geri bildirimle kullanılmış' };
export const VERSION_CHANGED: FeedbackConflict = { ok: false, httpStatus: 409, code: 'CONTENT_VERSION_CHANGED', error: 'İçerik siz incelerken değişmiş; sayfayı yenileyip güncel hali inceleyin' };

/**
 * Onay transaction'ı İÇİNDE (okuma aşaması): var olan gönderimi bul veya yeni kaydı hazırla.
 * 'duplicate' → geçiş yeniden çalıştırılmaz, önceki sonuç döner. 'write' → geçişle birlikte tx.set(ref, record).
 */
export async function preparePostFeedback(
  tx: any,
  db: Db,
  p: {
    actor: { uid: string; name: string; role: string; tenantId: string };
    input: PostFeedbackInput;
    action: string;
    planId: string;
    planProjectId: string;
    postId: string;
    /** Transaction içinde okunmuş post verisi (null = yok) */
    post: any | null;
    /** Gerçek plan üyeliği (contentPlanId bağı veya plan.postIds) */
    isPlanMember: boolean;
    now: number;
  }
): Promise<{ kind: 'duplicate'; feedback: FeedbackRecord } | { kind: 'write'; ref: any; record: FeedbackRecord } | FeedbackConflict> {
  if (!POST_FEEDBACK_ACTIONS.has(p.action)) return { ok: false, httpStatus: 400, code: 'BAD_REQUEST', error: 'Bu işleme sebep bağlanamaz' };
  const ref = db.collection(FEEDBACK).doc(feedbackDocId(p.actor.tenantId, p.actor.uid, p.input.idempotencyKey));
  const target: FeedbackTarget = { kind: 'post', postId: p.postId, planId: p.planId };
  const existing = await tx.get(ref);
  if (existing.exists) {
    const ex = existing.data() as FeedbackRecord;
    if (ex.tenantId !== p.actor.tenantId || ex.actor.uid !== p.actor.uid) return IDEMPOTENCY_CONFLICT;
    return sameSubmission(ex, { ...p.input, target, action: p.action as FeedbackAction }) ? { kind: 'duplicate', feedback: ex } : IDEMPOTENCY_CONFLICT;
  }
  if (!p.post || p.post.tenantId !== p.actor.tenantId || p.post.projectId !== p.planProjectId) return { ok: false, httpStatus: 404, code: 'POST_NOT_FOUND', error: 'İçerik bulunamadı' };
  if (!p.isPlanMember) return { ok: false, httpStatus: 409, code: 'NOT_IN_PLAN', error: 'İçerik bu plana ait değil' };
  const hash = postContentHash(p.post);
  if (hash !== p.input.expectedContentHash) return VERSION_CHANGED;
  const record: FeedbackRecord = {
    id: ref.id,
    tenantId: p.actor.tenantId,
    projectId: p.planProjectId,
    target,
    action: p.action as FeedbackAction,
    category: p.input.category,
    note: p.input.note.trim(),
    scope: p.input.scope,
    contentVersion: { hash, revisionCount: typeof p.post.revisionCount === 'number' ? p.post.revisionCount : null },
    snapshot: postSnapshot(p.post),
    actor: { uid: p.actor.uid, name: p.actor.name, role: p.actor.role },
    idempotencyKey: p.input.idempotencyKey,
    createdAt: p.now,
  };
  return { kind: 'write', ref, record };
}

/**
 * AI öneri reddi: saklanmış öneri kümesine bağlanır (istemcinin gönderdiği içerik/marka kullanılmaz).
 * checkAccess, kümenin GERÇEK projectId'si ile çağrılır (mevcut kütüphane rol sınırı).
 */
export async function recordSuggestionFeedback(
  db: Db,
  p: {
    actor: { uid: string; name: string; role: string; tenantId: string };
    input: SuggestionFeedbackInput;
    now: number;
    checkAccess: (projectId: string) => Promise<{ ok: true } | { ok: false; httpStatus: 400 | 403 | 404; error: string }>;
  }
): Promise<{ ok: true; created: boolean; feedback: FeedbackRecord } | FeedbackConflict> {
  const { input, actor } = p;
  const setRef = db.collection(SUGGESTION_SETS).doc(input.target.suggestionSetId);
  const pre = await setRef.get();
  const set = pre.exists ? pre.data() : null;
  if (!set || set.tenantId !== actor.tenantId) return { ok: false, httpStatus: 404, code: 'NOT_FOUND', error: 'Öneri bulunamadı' };
  const access = await p.checkAccess(set.projectId);
  if (!access.ok) return { ...access, code: 'FORBIDDEN' };
  const ref = db.collection(FEEDBACK).doc(feedbackDocId(actor.tenantId, actor.uid, input.idempotencyKey));
  const target: FeedbackTarget = { kind: 'suggestion', suggestionSetId: input.target.suggestionSetId, index: input.target.index };
  return db.runTransaction(async (tx: any) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      const ex = existing.data() as FeedbackRecord;
      if (ex.tenantId !== actor.tenantId || ex.actor.uid !== actor.uid) return IDEMPOTENCY_CONFLICT;
      return sameSubmission(ex, { ...input, target, action: 'suggestion_reject' }) ? { ok: true as const, created: false, feedback: ex } : IDEMPOTENCY_CONFLICT;
    }
    const s = await tx.get(setRef);
    const cur = s.exists ? s.data() : null;
    if (!cur || cur.tenantId !== actor.tenantId || cur.projectId !== set.projectId) return { ok: false as const, httpStatus: 404 as const, code: 'NOT_FOUND', error: 'Öneri bulunamadı' };
    const item = (cur.posts || []).find((x: any) => x.index === input.target.index);
    if (!item) return { ok: false as const, httpStatus: 404 as const, code: 'NOT_FOUND', error: 'Öneri bulunamadı' };
    const hash = suggestionContentHash(item);
    if (item.contentHash !== hash || hash !== input.expectedContentHash) return VERSION_CHANGED;
    const record: FeedbackRecord = {
      id: ref.id,
      tenantId: actor.tenantId,
      projectId: cur.projectId,
      target,
      action: 'suggestion_reject',
      category: input.category,
      note: input.note.trim(),
      scope: input.scope,
      contentVersion: { hash, revisionCount: null },
      snapshot: { postType: item.postType, mediaIds: item.mediaIds, captionExcerpt: String(item.captionDraft || '').slice(0, 160), scheduledAt: Date.parse(item.scheduledAt) || null },
      actor: { uid: actor.uid, name: actor.name, role: actor.role },
      idempotencyKey: input.idempotencyKey,
      createdAt: p.now,
    };
    tx.set(ref, record);
    return { ok: true as const, created: true, feedback: record };
  });
}

export const PLANNER_FEEDBACK_LIMIT = 30;

/** Planlayıcı için bu tenant+proje geri bildirimleri (en yeni önce). Kapsam ayrımı çağıranda korunur. */
export async function loadPlannerFeedback(db: Db, tenantId: string, projectId: string, limit = PLANNER_FEEDBACK_LIMIT): Promise<FeedbackRecord[]> {
  const snap = await db.collection(FEEDBACK).where('tenantId', '==', tenantId).where('projectId', '==', projectId).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((d: any) => d.data() as FeedbackRecord).filter((f: FeedbackRecord) => f.tenantId === tenantId && f.projectId === projectId);
}
