/**
 * Konuşmayla marka rehberi — sunucu deposu. Koleksiyonlar istemci kuralı tanımsız (varsayılan red); YALNIZ Admin SDK yazar.
 *  - brand_guide_drafts   : çalışma TASLAĞI (tek belge/proje, sürümlü). AI yalnız buraya yazar.
 *  - brand_guides         : İNSAN ONAYLI rehber (tek belge/proje, sürümlü). Yalnız `approveDraft` yazar (açık onay + yönetici).
 *  - brand_guide_versions : onaylanan her sürümün değişmez kopyası (write-once)
 *  - brand_guide_requests : idempotency kayıtları (generate için: pending → done | failed; model çağrısından ÖNCE atomik rezervasyon)
 *  - brand_guide_locks    : proje başına süren (pending) üretim kilidi; aynı projede eşzamanlı ücretli çağrıyı önler
 * AI hiçbir yolda onaylı rehbere yazamaz; onay taslağın TAM içerik anahtarına verilir (araya giren düzenleme onaylanmış olmaz).
 * Kapsam (tenant + PROJE) kimlik doğrulamasından gelir. Yüklü marka sesi paketi varsa konuşmalı rehber onaylanamaz (paket öncelikli).
 */
import { z } from 'zod/v4';
import { sha256Hex } from '../../../shared/planner/sha256.js';
import { TONE_KEYS, type ToneLabel } from '../../../shared/planner/copyContract.js';
import {
  validateBrief, validateBrandGuide, assembleGuideDraft, buildGuideDraftPrompt, guideContentKey, GUIDE_PROMPT_VERSION,
  type BrandGuide, type BrandBrief, type GuideDraftModelOutput,
} from '../../../shared/planner/brandGuide.js';
import { BRAND_GUIDE_COLLECTION, brandGuideDocId, BRAND_VOICE_COLLECTION, brandVoiceDocId, type CopyModelCall, type CopyUsage } from '../planCopy/planCopy.js';

type Db = any;
export const GUIDE_DRAFTS = 'brand_guide_drafts';
export const GUIDE_VERSIONS = 'brand_guide_versions';
export const GUIDE_REQUESTS = 'brand_guide_requests';
export const GUIDE_LOCKS = 'brand_guide_locks';
/** Model zaman aşımı (100 sn) + işlem payı. Süre dolan pending KÖR yeniden denenmez (belirsiz sonuç/ücret). */
export const GENERATE_LEASE_MS = 150_000;
const KEY_RE = /^[A-Za-z0-9-]{16,64}$/;
const SAFE = /^[A-Za-z0-9_-]{1,128}$/;

export class GuideError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

/** OpenRouter yapılandırılmış çıktı şeması (rehber taslağı) */
export const GuideDraftOutputSchema = z.object({
  toneLabels: z.array(z.enum(TONE_KEYS as unknown as [ToneLabel, ...ToneLabel[]])),
  toneNotes: z.string(),
  avoid: z.array(z.string()),
  facts: z.array(z.string()),
  openQuestions: z.array(z.string()),
});
export const GUIDE_SCHEMA_NAME = 'brand_guide_draft';

export interface DraftRecord {
  version: number;
  guide: BrandGuide;
  contentKey: string;
  origin: 'ai' | 'human';
  baseApprovedVersion: number | null;
  assumptions: string[];
  droppedFacts: string[];
  updatedAt: number;
  updatedBy: string;
  ai: null | { provider: string | null; requestedModel: string; modelUsed: string | null; requestId: string | null; responseId: string | null; usage: CopyUsage; promptVersion: string };
}
export interface ApprovedRecord { version: number; guide: BrandGuide; contentKey: string; approvedAt: number; approvedBy: string }

const scopeOk = (d: any, t: string, p: string) => !!d && d.tenantId === t && d.projectId === p;
const docs = (db: Db, t: string, p: string) => ({
  draft: db.collection(GUIDE_DRAFTS).doc(brandGuideDocId(t, p)),
  approved: db.collection(BRAND_GUIDE_COLLECTION).doc(brandGuideDocId(t, p)),
  bundle: db.collection(BRAND_VOICE_COLLECTION).doc(brandVoiceDocId(t, p)),
});

function toDraft(d: any): DraftRecord {
  const v = validateBrandGuide(d.guide);
  if (!v.ok) throw new GuideError(500, 'draft_corrupt', 'Saklanan taslak geçersiz.', v.errors.slice(0, 5));
  return {
    version: d.version, guide: v.guide, contentKey: guideContentKey(v.guide, sha256Hex), origin: d.origin, baseApprovedVersion: d.baseApprovedVersion ?? null,
    assumptions: Array.isArray(d.assumptions) ? d.assumptions : [], droppedFacts: Array.isArray(d.droppedFacts) ? d.droppedFacts : [],
    updatedAt: d.updatedAt, updatedBy: d.updatedBy, ai: d.ai ?? null,
  };
}
function toApproved(d: any): ApprovedRecord {
  const v = validateBrandGuide(d.guide);
  if (!v.ok) throw new GuideError(500, 'brand_guide_invalid', 'Saklanan marka rehberi geçersiz.', v.errors.slice(0, 5));
  return { version: d.version, guide: v.guide, contentKey: guideContentKey(v.guide, sha256Hex), approvedAt: d.approvedAt, approvedBy: d.approvedBy };
}

export async function loadGuideState(db: Db, p: { tenantId: string; projectId: string }) {
  if (!SAFE.test(p.projectId)) throw new GuideError(400, 'bad_request', 'projectId geçersiz');
  const r = docs(db, p.tenantId, p.projectId);
  const [d, a, b] = await Promise.all([r.draft.get(), r.approved.get(), r.bundle.get()]);
  const dd = d.exists ? d.data() : null;
  const ad = a.exists ? a.data() : null;
  const bd = b.exists ? b.data() : null;
  return {
    draft: scopeOk(dd, p.tenantId, p.projectId) ? toDraft(dd) : null,
    approved: scopeOk(ad, p.tenantId, p.projectId) ? toApproved(ad) : null,
    bundleExists: scopeOk(bd, p.tenantId, p.projectId),
  };
}

const checkKey = (k: unknown): string => {
  if (typeof k !== 'string' || !KEY_RE.test(k)) throw new GuideError(400, 'bad_request', 'idempotencyKey 16-64 karakter [A-Za-z0-9-] olmalı');
  return k;
};
const checkExpected = (v: unknown, name: string): number => {
  if (!Number.isInteger(v) || (v as number) < 0) throw new GuideError(400, 'bad_request', `${name} 0 veya pozitif tam sayı olmalı`);
  return v as number;
};
const reqRef = (db: Db, t: string, uid: string, action: string, key: string) => db.collection(GUIDE_REQUESTS).doc(sha256Hex([t, uid, action, key].join('|')).slice(0, 40));

/**
 * AI TASLAK üretimi. Brief eksikse model ÇAĞRILMAZ (422 + ne eksik). Model yalnız yapılandırır; olgular brief'e dayandırılır.
 * Mevcut taslak sürümü beklenenle eşleşmezse 409 (insan düzenlemesi sessizce ezilmez). Onaylı rehbere DOKUNMAZ.
 *
 * ÇİFT ÇAĞRI KORUMASI: model çağrısından ÖNCE tek transaction'da (1) idempotency kaydı `pending` olarak, (2) proje kilidi rezerve edilir.
 *  - aynı anahtar+yük, süren istek → model ÇAĞRILMAZ, 409 request_pending (sonucu bekleyin; aynı anahtarla tekrar sorulabilir)
 *  - aynı anahtar+yük, tamamlanmış → önceki taslak (replay), model çağrılmaz
 *  - aynı anahtar+yük, başarısız → aynı hata (replay), model çağrılmaz; yeniden deneme YENİ anahtarla bilinçli yapılır
 *  - aynı anahtar, farklı yük/kapsam → 409 idempotency_conflict, model çağrılmaz
 *  - başka anahtarla aynı projede süren üretim → 409 request_pending (eşzamanlı ücretli çağrı yok)
 *  - süresi dolmuş pending → 409 request_expired: sonuç belirsiz (ücretlendirilmiş olabilir); otomatik yeniden deneme YOK
 */
export async function generateDraft(
  db: Db,
  deps: { callModel: CopyModelCall; model: string },
  p: { tenantId: string; projectId: string; uid: string; brief: unknown; expectedDraftVersion: unknown; idempotencyKey: unknown; now: number }
): Promise<{ draft: DraftRecord; replayed: boolean }> {
  const key = checkKey(p.idempotencyKey);
  const expected = checkExpected(p.expectedDraftVersion, 'expectedDraftVersion');
  const b = validateBrief(p.brief);
  if (!b.ok) throw new GuideError(422, 'brief_incomplete', 'Brief eksik; taslak oluşturulmadı.', b.errors);
  const brief: BrandBrief = b.brief;
  const payloadHash = sha256Hex(JSON.stringify({ t: p.tenantId, p: p.projectId, a: 'generate', e: expected, b: brief }));
  const rr = reqRef(db, p.tenantId, p.uid, 'generate', key);
  const r = docs(db, p.tenantId, p.projectId);
  const lockRef = db.collection(GUIDE_LOCKS).doc(brandGuideDocId(p.tenantId, p.projectId));
  const curDraftVersion = (snap: any) => (snap.exists && scopeOk(snap.data(), p.tenantId, p.projectId) ? snap.data().version : 0);

  // 1) ATOMİK REZERVASYON (model çağrılmadan önce)
  const reserved = await db.runTransaction(async (tx: any): Promise<{ kind: 'reserved' } | { kind: 'replay'; draft: DraftRecord }> => {
    const [prior, lock, cur] = await Promise.all([tx.get(rr), tx.get(lockRef), tx.get(r.draft)]);
    if (prior.exists) {
      const pr = prior.data();
      if (pr.payloadHash !== payloadHash || pr.projectId !== p.projectId || pr.tenantId !== p.tenantId || pr.uid !== p.uid) throw new GuideError(409, 'idempotency_conflict', 'Bu gönderim anahtarı farklı bir istekle kullanılmış.');
      if (pr.status === 'done') {
        const dv = curDraftVersion(cur);
        if (dv !== pr.version) throw new GuideError(409, 'draft_conflict', 'Taslak sonradan değişti; güncel sürümü yükleyin.', { currentVersion: dv });
        return { kind: 'replay', draft: toDraft(cur.data()) };
      }
      if (pr.status === 'failed') throw new GuideError(pr.errorStatus ?? 502, pr.errorCode ?? 'model_error', pr.errorMessage ?? 'Önceki deneme başarısız oldu; yeni bir deneme için yeni gönderim anahtarı kullanın.');
      if (pr.leaseUntil > p.now) throw new GuideError(409, 'request_pending', 'Aynı istek işleniyor; sonucu bekleyin ve aynı anahtarla tekrar sorun.', { retryAfterMs: Math.min(5000, pr.leaseUntil - p.now) });
      throw new GuideError(409, 'request_expired', 'Önceki istek yarıda kalmış olabilir; sonuç belirsiz (ücretlendirilmiş olabilir). Yeniden denemek için yeni bir gönderim anahtarı kullanın.');
    }
    if (lock.exists && lock.data().leaseUntil > p.now) throw new GuideError(409, 'request_pending', 'Bu markada bir taslak üretimi sürüyor; bitmesini bekleyin.', { retryAfterMs: Math.min(5000, lock.data().leaseUntil - p.now) });
    const dv = curDraftVersion(cur);
    if (dv !== expected) throw new GuideError(409, 'draft_conflict', 'Taslak başka bir yerde değişmiş; güncel sürümü yükleyin.', { currentVersion: dv });
    const leaseUntil = p.now + GENERATE_LEASE_MS;
    tx.set(rr, { tenantId: p.tenantId, projectId: p.projectId, uid: p.uid, action: 'generate', payloadHash, status: 'pending', leaseUntil, createdAt: p.now });
    tx.set(lockRef, { tenantId: p.tenantId, projectId: p.projectId, requestId: rr.id, leaseUntil, createdAt: p.now });
    return { kind: 'reserved' };
  });
  if (reserved.kind === 'replay') return { draft: reserved.draft, replayed: true };

  // 2) Bu noktadan sonra YALNIZ rezervasyonu alan çağrı modele gider. Başarısızlık kalıcı işaretlenir (kör yeniden deneme yok).
  const failWith = async (err: GuideError): Promise<never> => {
    try {
      await db.runTransaction(async (tx: any) => {
        const [pr, lock] = await Promise.all([tx.get(rr), tx.get(lockRef)]);
        if (pr.exists && pr.data().status === 'pending') tx.set(rr, { ...pr.data(), status: 'failed', errorStatus: err.status, errorCode: err.code, errorMessage: err.message, failedAt: p.now });
        if (lock.exists && lock.data().requestId === rr.id) tx.delete(lockRef);
      });
    } catch {
      // işaretlenemezse kayıt pending kalır → süre dolunca request_expired (yine kör yeniden deneme olmaz)
    }
    throw err;
  };

  const prompt = buildGuideDraftPrompt(brief);
  let res;
  try {
    res = await deps.callModel({ model: deps.model, system: prompt.system, user: prompt.user });
  } catch (e: any) {
    console.error('brand-guide model error:', e?.status ?? '', e?.code ?? '');
    return failWith(new GuideError(502, 'model_error', 'Taslak modeli çağrısı başarısız; taslak oluşturulmadı. Yeniden denemek için yeni bir deneme başlatın.'));
  }
  if (res.stopReason === 'refusal') return failWith(new GuideError(422, 'model_refusal', 'Model isteği reddetti; taslak oluşturulmadı.'));
  const parsed = GuideDraftOutputSchema.safeParse(res.parsed);
  if (!parsed.success) return failWith(new GuideError(422, 'model_no_output', 'Model geçerli yapılandırılmış çıktı döndürmedi; taslak oluşturulmadı.'));
  const out: GuideDraftModelOutput = parsed.data;
  const { guide, droppedFacts, assumptions } = assembleGuideDraft(brief, out);
  const v = validateBrandGuide(guide);
  if (!v.ok) return failWith(new GuideError(422, 'draft_invalid', 'Üretilen taslak şemaya uymuyor.', v.errors.slice(0, 5)));
  const usage: CopyUsage = res.usageDetail ?? { inputTokens: res.usage?.input_tokens ?? null, outputTokens: res.usage?.output_tokens ?? null, totalTokens: null, cachedTokens: null, reasoningTokens: null, costUsd: null };

  // 3) Tamamlama: kayıt hâlâ BİZİM pending kaydımızsa ve taslak sürümü değişmediyse yazılır
  try {
    return await db.runTransaction(async (tx: any) => {
      const [pr, lock, cur, appr] = await Promise.all([tx.get(rr), tx.get(lockRef), tx.get(r.draft), tx.get(r.approved)]);
      if (!pr.exists || pr.data().status !== 'pending' || pr.data().payloadHash !== payloadHash) throw new GuideError(409, 'idempotency_conflict', 'İstek kaydı değişti; sonuç yazılmadı.');
      const dv = curDraftVersion(cur);
      if (dv !== expected) throw new GuideError(409, 'draft_conflict', 'Taslak üretim sırasında başka bir yerde değişti; sonuç yazılmadı, mevcut taslak korundu.', { currentVersion: dv });
      const next = dv + 1;
      const ap = appr.exists && scopeOk(appr.data(), p.tenantId, p.projectId) ? appr.data().version : null;
      const rec = {
        tenantId: p.tenantId, projectId: p.projectId, version: next, guide: v.guide, origin: 'ai', baseApprovedVersion: ap, assumptions, droppedFacts,
        updatedAt: p.now, updatedBy: p.uid,
        ai: { provider: res.provider ?? null, requestedModel: deps.model, modelUsed: res.modelUsed ?? null, requestId: res.requestId ?? null, responseId: res.id || null, usage, promptVersion: GUIDE_PROMPT_VERSION },
      };
      tx.set(r.draft, rec);
      tx.set(rr, { ...pr.data(), status: 'done', version: next, completedAt: p.now });
      if (lock.exists && lock.data().requestId === rr.id) tx.delete(lockRef);
      return { draft: toDraft(rec), replayed: false };
    });
  } catch (e) {
    if (e instanceof GuideError) return failWith(e);
    throw e;
  }
}

/** İnsan düzenlemesi: taslak güncellenir (AI yok). Sürüm iyimser kilitli; onaylı rehbere dokunmaz. */
export async function saveDraftEdit(
  db: Db,
  p: { tenantId: string; projectId: string; uid: string; guide: unknown; expectedDraftVersion: unknown; idempotencyKey: unknown; now: number }
): Promise<{ draft: DraftRecord; replayed: boolean }> {
  const key = checkKey(p.idempotencyKey);
  const expected = checkExpected(p.expectedDraftVersion, 'expectedDraftVersion');
  const v = validateBrandGuide(p.guide);
  if (!v.ok) throw new GuideError(422, 'guide_invalid', 'Rehber şemaya uymuyor.', v.errors.slice(0, 10));
  const payloadHash = sha256Hex(JSON.stringify({ t: p.tenantId, p: p.projectId, a: 'save', e: expected, g: v.guide }));
  const rr = reqRef(db, p.tenantId, p.uid, 'save', key);
  const r = docs(db, p.tenantId, p.projectId);
  return db.runTransaction(async (tx: any) => {
    const prior = await tx.get(rr);
    const cur = await tx.get(r.draft);
    const appr = await tx.get(r.approved);
    if (prior.exists) {
      const pr = prior.data();
      if (pr.payloadHash !== payloadHash || pr.projectId !== p.projectId || pr.tenantId !== p.tenantId) throw new GuideError(409, 'idempotency_conflict', 'Bu gönderim anahtarı farklı bir istekle kullanılmış.');
      return { draft: toDraft(cur.data()), replayed: true };
    }
    const curData = cur.exists && scopeOk(cur.data(), p.tenantId, p.projectId) ? cur.data() : null;
    const curVer = curData ? curData.version : 0;
    if (curVer !== expected) throw new GuideError(409, 'draft_conflict', 'Taslak başka bir yerde değişmiş; güncel sürümü yükleyin.', { currentVersion: curVer });
    const next = curVer + 1;
    const ap = appr.exists && scopeOk(appr.data(), p.tenantId, p.projectId) ? appr.data().version : null;
    const rec = {
      tenantId: p.tenantId, projectId: p.projectId, version: next, guide: v.guide, origin: 'human', baseApprovedVersion: ap,
      assumptions: curData?.assumptions ?? [], droppedFacts: curData?.droppedFacts ?? [], updatedAt: p.now, updatedBy: p.uid, ai: curData?.ai ?? null,
    };
    tx.set(r.draft, rec);
    tx.set(rr, { tenantId: p.tenantId, projectId: p.projectId, uid: p.uid, action: 'save', payloadHash, version: next, createdAt: p.now });
    return { draft: toDraft(rec), replayed: false };
  });
}

/**
 * İNSAN ONAYI. Yalnız yönetici (uç nokta), açık `confirm:true`, taslağın TAM sürümü + içerik anahtarı ve (varsa) önceki onaylı sürüm
 * eşleşirse yazılır. Var olan onaylı rehber SESSİZCE ezilmez: expectedApprovedVersion tutmalı; yeni sürüm = eski + 1, eski sürüm kopyası saklanır.
 * Yüklü marka sesi paketi varsa onay reddedilir (paket öncelikli; iki kaynak karışmaz).
 */
export async function approveDraft(
  db: Db,
  p: { tenantId: string; projectId: string; uid: string; confirm: unknown; expectedDraftVersion: unknown; contentKey: unknown; expectedApprovedVersion: unknown; idempotencyKey: unknown; now: number }
): Promise<{ approved: ApprovedRecord; replayed: boolean }> {
  if (p.confirm !== true) throw new GuideError(400, 'confirm_required', 'Onay için açık onay (confirm:true) gerekir.');
  const key = checkKey(p.idempotencyKey);
  const expectedDraft = checkExpected(p.expectedDraftVersion, 'expectedDraftVersion');
  if (expectedDraft < 1) throw new GuideError(400, 'bad_request', 'Onaylanacak taslak sürümü 1 veya üstü olmalı');
  if (typeof p.contentKey !== 'string' || !/^[0-9a-f]{32}$/.test(p.contentKey)) throw new GuideError(400, 'bad_request', 'contentKey geçersiz');
  const expAppr = p.expectedApprovedVersion === null ? null : checkExpected(p.expectedApprovedVersion, 'expectedApprovedVersion');
  const payloadHash = sha256Hex(JSON.stringify({ t: p.tenantId, p: p.projectId, a: 'approve', d: expectedDraft, k: p.contentKey, ea: expAppr }));
  const rr = reqRef(db, p.tenantId, p.uid, 'approve', key);
  const r = docs(db, p.tenantId, p.projectId);
  return db.runTransaction(async (tx: any) => {
    const prior = await tx.get(rr);
    const [dRaw, aRaw, bRaw] = await Promise.all([tx.get(r.draft), tx.get(r.approved), tx.get(r.bundle)]);
    if (prior.exists) {
      const pr = prior.data();
      if (pr.payloadHash !== payloadHash || pr.projectId !== p.projectId || pr.tenantId !== p.tenantId) throw new GuideError(409, 'idempotency_conflict', 'Bu gönderim anahtarı farklı bir istekle kullanılmış.');
      return { approved: toApproved(aRaw.data()), replayed: true };
    }
    if (scopeOk(bRaw.exists ? bRaw.data() : null, p.tenantId, p.projectId)) throw new GuideError(409, 'bundle_guide_exists', 'Yüklü marka sesi paketi öncelikli; konuşmalı rehber paket varken onaylanamaz.');
    const dd = dRaw.exists && scopeOk(dRaw.data(), p.tenantId, p.projectId) ? dRaw.data() : null;
    if (!dd) throw new GuideError(404, 'draft_missing', 'Onaylanacak taslak yok.');
    if (dd.version !== expectedDraft) throw new GuideError(409, 'draft_conflict', 'Taslak onay ekranından sonra değişti; güncel taslağı inceleyip yeniden onaylayın.', { currentVersion: dd.version });
    const draft = toDraft(dd);
    if (draft.contentKey !== p.contentKey) throw new GuideError(409, 'content_mismatch', 'Onaylanan içerik taslakla uyuşmuyor; yeniden inceleyin.');
    const ad = aRaw.exists && scopeOk(aRaw.data(), p.tenantId, p.projectId) ? aRaw.data() : null;
    const curAppr = ad ? ad.version : null;
    if (curAppr !== expAppr) throw new GuideError(409, 'approved_version_conflict', 'Onaylı rehber başka bir yerde değişmiş; mevcut onaylı sürümü inceleyin.', { currentApprovedVersion: curAppr });
    const next = (curAppr ?? 0) + 1;
    const rec = { tenantId: p.tenantId, projectId: p.projectId, version: next, guide: draft.guide, approvedBy: p.uid, approvedAt: p.now, sourceDraftVersion: draft.version, draftOrigin: draft.origin, contentKey: draft.contentKey };
    tx.set(r.approved, rec);
    tx.set(db.collection(GUIDE_VERSIONS).doc(`${brandGuideDocId(p.tenantId, p.projectId)}_v${next}`), rec);
    tx.set(rr, { tenantId: p.tenantId, projectId: p.projectId, uid: p.uid, action: 'approve', payloadHash, version: next, createdAt: p.now });
    return { approved: toApproved(rec), replayed: false };
  });
}
