/**
 * Kalıcı planlayıcı taslağı — sunucu deposu. Koleksiyonlar istemci kuralı tanımsız (varsayılan red); YALNIZ Admin SDK yazar.
 *  - Şema: shared/planner/plannerDraft.validatePlannerDraft (liste elemanları dahil)
 *  - Kapsam: tenant/proje kimlik doğrulamasından gelir (gövdeden değil); medya kimlikleri bu tenant+projede var olmalı
 *  - Sürüm: iyimser kilit (expectedVersion); eski sürümle yazım 409
 *  - İdempotency: tenant+uid+anahtar; aynı yük → önceki sonuç (yeniden yazım yok), farklı yük → 409
 */
import { validatePlannerDraft, draftMediaRefs, type PlannerDraft } from '../../../shared/planner/plannerDraft.js';
import { sha256Hex } from '../../../shared/planner/sha256.js';
import { copyContentHash } from '../../../shared/planner/copyContract.js';
import { correctionDocId } from '../mediaAnalysis/spec.js';
import { COPY_ISSUED, copyIssuedDocId } from '../planCopy/planCopy.js';

type Db = any;

export const DRAFTS = 'planner_drafts';
export const DRAFT_REQUESTS = 'planner_draft_requests';
export const draftDocId = (tenantId: string, projectId: string, weekStart: string) => `${tenantId}_${projectId}_${weekStart}`;
const KEY_RE = /^[A-Za-z0-9-]{16,64}$/;
const SAFE = /^[A-Za-z0-9_-]{1,128}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class DraftError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export interface LoadedDraft {
  version: number;
  draft: PlannerDraft;
  updatedAt: number;
  updatedBy: string;
}

export async function loadDraft(db: Db, p: { tenantId: string; projectId: string; weekStart: string }): Promise<LoadedDraft | null> {
  if (!SAFE.test(p.projectId) || !DATE.test(p.weekStart)) throw new DraftError(400, 'bad_request', 'projectId/weekStart geçersiz');
  const s = await db.collection(DRAFTS).doc(draftDocId(p.tenantId, p.projectId, p.weekStart)).get();
  if (!s.exists) return null;
  const d = s.data();
  if (d.tenantId !== p.tenantId || d.projectId !== p.projectId || d.weekStart !== p.weekStart) return null; // başka kapsam: yok say
  const v = validatePlannerDraft(d.draft);
  if (!v.ok) throw new DraftError(500, 'draft_corrupt', 'Saklanan taslak geçersiz.', v.errors.slice(0, 5));
  return { version: d.version, draft: v.draft, updatedAt: d.updatedAt, updatedBy: d.updatedBy };
}

/** Taslak medya/seri/kaynak doğrulaması — TÜM okumalar çağıranın transaction'ı üzerinden yapılır (doğrulama ile yazım arasında medya değişemez). */
async function verifyInTransaction(tx: any, db: Db, p: { tenantId: string; projectId: string }, draft: PlannerDraft) {
  const { slotIds, otherIds } = draftMediaRefs(draft);
  const invalid: Array<{ id: string; reason: string; where?: string }> = [];
  const all = [...slotIds.map((id) => ({ id, needActive: true })), ...otherIds.map((id) => ({ id, needActive: false }))];
  const media = new Map<string, any>();
  for (let i = 0; i < all.length; i += 20) {
    await Promise.all(
      all.slice(i, i + 20).map(async ({ id, needActive }) => {
        const s = await tx.get(db.collection('brand_media').doc(id));
        const d = s.exists ? s.data() : null;
        if (!d || d.tenantId !== p.tenantId || d.projectId !== p.projectId) invalid.push({ id, reason: 'unknown_media' }); // başka marka: varlığı sızdırma
        else if (needActive && d.status !== 'active') invalid.push({ id, reason: 'archived' });
        else media.set(id, d);
      })
    );
  }
  if (invalid.length) return { code: 'media_invalid' as const, message: 'Taslaktaki medya bu marka kütüphanesinde geçerli değil.', details: invalid.slice(0, 20) };

  // Seri kimliği: medyanın İNSAN-DOĞRULAMALI ürün bağlantısında olmalı (aynı gün/aynı kare olmak seri kanıtı değildir)
  const seriesSlots = draft.story.map((s, i) => ({ s, i })).filter((x): x is { s: NonNullable<typeof x.s>; i: number } => !!x.s && x.s.seriesKey !== null);
  const badSeries: Array<{ where: string; seriesKey: string | null }> = [];
  await Promise.all(
    seriesSlots.map(async ({ s, i }) => {
      const c = await tx.get(db.collection('media_catalog_corrections').doc(correctionDocId(p.tenantId, p.projectId, s.mediaId)));
      const cd = c.exists ? c.data() : null;
      const ok = !!cd && cd.tenantId === p.tenantId && cd.projectId === p.projectId && Array.isArray(cd.verifiedProductIds) && cd.verifiedProductIds.includes(s.seriesKey);
      if (!ok) badSeries.push({ where: `story[${i}]`, seriesKey: s.seriesKey });
    })
  );
  if (badSeries.length) return { code: 'series_unverified' as const, message: 'Seri kimliği medyanın doğrulanmış ürün bağlantısıyla eşleşmiyor.', details: badSeries };

  // Model kaynağı: istemci iddiası güvenilmez — hash gerçek metin+medyadan yeniden hesaplanır ve sunucunun ürettiği kayıtla eşleşmelidir
  const modelTexts: Array<{ where: string; mediaId: string; text: any }> = [];
  (['feed', 'story'] as const).forEach((lane) => draft[lane].forEach((s, i) => { if (s?.text?.source === 'model') modelTexts.push({ where: `${lane}[${i}]`, mediaId: s.mediaId, text: s.text }); }));
  const issued = new Map<string, any>();
  const rids = [...new Set(modelTexts.map((m) => m.text.responseId as string))];
  await Promise.all(rids.map(async (rid) => { const r = await tx.get(db.collection(COPY_ISSUED).doc(copyIssuedDocId(p.tenantId, p.projectId, rid))); if (r.exists) issued.set(rid, r.data()); }));
  const badModel: Array<{ where: string; reason: string }> = [];
  for (const m of modelTexts) {
    const t = m.text;
    const role = t.caption ? 'caption' : t.headline ? 'headline' : 'body';
    const recomputed = copyContentHash(m.mediaId, role, t);
    const rec = issued.get(t.responseId);
    if (recomputed !== t.contentHash) badModel.push({ where: m.where, reason: 'hash_text_media_mismatch' });
    else if (!rec || rec.tenantId !== p.tenantId || rec.projectId !== p.projectId || rec.hashes?.[t.contentHash] !== m.mediaId) badModel.push({ where: m.where, reason: 'not_issued_by_server' });
    // Ses kaynağı: istemci beyanı üretim kaydıyla AYNI olmalı. Beyan yoksa 'approved_bundle' sayılır (eski kayıtlar); geçici ton metni bu yolla onaylı gibi saklanamaz.
    else if ((t.voiceSource ?? 'approved_bundle') !== (rec.voiceSource ?? 'approved_bundle')) badModel.push({ where: m.where, reason: 'voice_source_mismatch' });
  }
  if (badModel.length) return { code: 'provenance_invalid' as const, message: 'Model kaynaklı metin sunucu kaydıyla doğrulanamadı; model çıktısı olarak kaydedilemez (elle metin için source:"manual" kullanın).', details: badModel.slice(0, 20) };
  return null;
}

export async function saveDraft(
  db: Db,
  p: { tenantId: string; projectId: string; uid: string; weekStart: string; expectedVersion: unknown; idempotencyKey: unknown; draft: unknown; now: number }
): Promise<{ version: number; replayed: boolean }> {
  if (!SAFE.test(p.projectId) || !DATE.test(p.weekStart)) throw new DraftError(400, 'bad_request', 'projectId/weekStart geçersiz');
  if (!Number.isInteger(p.expectedVersion) || (p.expectedVersion as number) < 0) throw new DraftError(400, 'bad_request', 'expectedVersion 0 veya pozitif tam sayı olmalı');
  if (typeof p.idempotencyKey !== 'string' || !KEY_RE.test(p.idempotencyKey)) throw new DraftError(400, 'bad_request', 'idempotencyKey 16-64 karakter [A-Za-z0-9-] olmalı');
  const expected = p.expectedVersion as number;
  const v = validatePlannerDraft(p.draft);
  if (!v.ok) throw new DraftError(422, 'draft_invalid', 'Taslak şemaya uymuyor.', v.errors.slice(0, 15));
  if (v.draft.weekStart !== p.weekStart) throw new DraftError(422, 'draft_invalid', 'Taslağın weekStart değeri istekle uyuşmuyor.');

  // Kapsam (tenant + PROJE + hafta) hash'in, saklanan isteğin ve tekrar kontrolünün parçasıdır
  const payloadHash = sha256Hex(JSON.stringify({ t: p.tenantId, p: p.projectId, w: p.weekStart, e: expected, d: v.draft }));
  const reqRef = db.collection(DRAFT_REQUESTS).doc(sha256Hex([p.tenantId, p.uid, p.idempotencyKey].join('|')).slice(0, 40));
  const draftRef = db.collection(DRAFTS).doc(draftDocId(p.tenantId, p.projectId, p.weekStart));
  return db.runTransaction(async (tx: any) => {
    const prior = await tx.get(reqRef);
    if (prior.exists) {
      const r = prior.data();
      if (r.tenantId !== p.tenantId || r.uid !== p.uid || r.projectId !== p.projectId || r.weekStart !== p.weekStart || r.payloadHash !== payloadHash) {
        throw new DraftError(409, 'idempotency_conflict', 'Bu gönderim anahtarı farklı bir istekle (proje/hafta/yük) kullanılmış.');
      }
      return { version: r.version as number, replayed: true };
    }
    const cur = await tx.get(draftRef);
    const bad = await verifyInTransaction(tx, db, p, v.draft);
    if (bad) throw new DraftError(422, bad.code, bad.message, bad.details);
    let next: number;
    if (cur.exists) {
      const c = cur.data();
      if (c.tenantId !== p.tenantId || c.projectId !== p.projectId || c.weekStart !== p.weekStart) throw new DraftError(409, 'scope_conflict', 'Belge kapsamı uyuşmuyor.');
      if (c.version !== expected) throw new DraftError(409, 'version_conflict', 'Taslak başka bir yerde değişmiş; güncel sürümü yükleyin.', { currentVersion: c.version });
      next = c.version + 1;
    } else {
      if (expected !== 0) throw new DraftError(409, 'version_conflict', 'Taslak yok; ilk kayıt expectedVersion=0 olmalı.', { currentVersion: 0 });
      next = 1;
    }
    tx.set(draftRef, { tenantId: p.tenantId, projectId: p.projectId, weekStart: p.weekStart, version: next, draft: v.draft, updatedBy: p.uid, updatedAt: p.now });
    tx.set(reqRef, { tenantId: p.tenantId, projectId: p.projectId, weekStart: p.weekStart, uid: p.uid, payloadHash, version: next, createdAt: p.now });
    return { version: next, replayed: false };
  });
}
