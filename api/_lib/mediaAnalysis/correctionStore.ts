/**
 * İnsan katalog düzeltmesi — `media_catalog_corrections`. Bir onay kapısı DEĞİLDİR (medyada onay alanı yok). Otorite insandır:
 * AI analizi/yeniden analizi bu koleksiyona hiç yazmaz; etkin katalog effectiveCatalog() ile birleşir.
 */

import { effectiveCatalog, correctionDocId, type CatalogOverrides, type EffectiveCatalog, type ImageCatalog, type MediaCatalogCorrection } from './spec.js';
import { humanSemanticOf } from './catalogLite.js';
import { VISUAL_SCHEMA_VERSION, type CandidateVisual } from '../../../shared/planner/visualDecision.js';

type Db = any;

export const CORRECTIONS = 'media_catalog_corrections';
export const ANALYSES = 'media_ai_analyses';
export const ANALYSIS_LATEST = 'media_ai_analysis_latest';

export interface CorrectionInput {
  overrides?: CatalogOverrides;
  verifiedProductIds?: string[];
  note?: string;
}

/** Kısmi güncelleme: verilen alanlar yazılır, verilmeyen insan alanları KORUNUR */
export async function saveCorrection(
  db: Db,
  p: { tenantId: string; projectId: string; assetId: string; input: CorrectionInput; uid: string; now: number; basedOnAnalysisKey?: string | null }
): Promise<MediaCatalogCorrection> {
  const ref = db.collection(CORRECTIONS).doc(correctionDocId(p.tenantId, p.projectId, p.assetId));
  return db.runTransaction(async (tx: any) => {
    const s = await tx.get(ref);
    const prev = s.exists ? (s.data() as MediaCatalogCorrection) : null;
    if (prev && (prev.tenantId !== p.tenantId || prev.projectId !== p.projectId || prev.assetId !== p.assetId)) throw new Error('correction_scope_mismatch');
    const next: MediaCatalogCorrection = {
      tenantId: p.tenantId,
      projectId: p.projectId,
      assetId: p.assetId,
      overrides: { ...(prev?.overrides || {}), ...(p.input.overrides || {}) },
      verifiedProductIds: p.input.verifiedProductIds ?? prev?.verifiedProductIds ?? [],
      ...(p.input.note !== undefined ? { note: p.input.note } : prev?.note ? { note: prev.note } : {}),
      basedOnAnalysisKey: p.basedOnAnalysisKey ?? prev?.basedOnAnalysisKey ?? null,
      correctedBy: p.uid,
      correctedAt: p.now,
    };
    tx.set(ref, next);
    return next;
  });
}

export async function loadCorrection(db: Db, tenantId: string, projectId: string, assetId: string): Promise<MediaCatalogCorrection | null> {
  const s = await db.collection(CORRECTIONS).doc(correctionDocId(tenantId, projectId, assetId)).get();
  if (!s.exists) return null;
  const r = s.data() as MediaCatalogCorrection;
  return r.tenantId === tenantId && r.projectId === projectId && r.assetId === assetId ? r : null;
}

/**
 * Kayıttaki kompozisyon kararı → planlayıcıya giden taşıyıcı. YALNIZ: tamamlanmış, kapsamı eşleşen, güncel görsel şemada ve
 * doğrulanmış (visualStatus=ok|partial) kayıt. partial: kutu bilinmiyor/bölge düşürüldü; diğer alanlar kullanılır, geometri uydurulmaz. Eski şema / geçersiz / eksik → null (bilinmiyor); uydurma ve eski sürüm sızmaz.
 */
export function candidateVisualOf(rec: any, scope: { tenantId: string; projectId: string; assetId: string }): CandidateVisual | null {
  if (!rec || rec.status !== 'done' || !rec.visual || (rec.visualStatus !== 'ok' && rec.visualStatus !== 'partial')) return null;
  if (rec.tenantId !== scope.tenantId || rec.projectId !== scope.projectId || rec.sourceId !== scope.assetId) return null;
  if (rec.visualSchemaVersion !== VISUAL_SCHEMA_VERSION) return null;
  return {
    decision: rec.visual,
    provenance: {
      tenantId: rec.tenantId,
      projectId: rec.projectId,
      assetId: rec.sourceId,
      analysisKey: String(rec.key),
      sourceSha256: String(rec.sourceSha256 ?? ''),
      analyzedAt: typeof rec.updatedAt === 'number' ? rec.updatedAt : typeof rec.createdAt === 'number' ? rec.createdAt : 0,
      model: String(rec.model),
      promptVersion: String(rec.promptVersion),
      schemaVersion: String(rec.schemaVersion),
      visualSchemaVersion: rec.visualSchemaVersion,
      visualPromptVersion: String(rec.visualPromptVersion ?? ''),
      sourceQuality: String(rec.sourceQuality),
      geometryBasis: rec.sourceQuality === 'original' ? 'original' : 'preview_assumed_same_aspect',
    },
  };
}

/** Son tamamlanmış AI kataloğu (kapsam doğrulamalı); yoksa null */
export async function loadLatestCatalog(db: Db, tenantId: string, projectId: string, assetId: string): Promise<{ key: string; catalog: ImageCatalog | null; sourceQuality?: string; /** Analizin dayandığı kaynak içerik kimliği (SHA-256); kaydı yoksa null */ sourceSha256: string | null; visual: CandidateVisual | null } | null> {
  const l = await db.collection(ANALYSIS_LATEST).doc(`${tenantId}_${projectId}_${assetId}`).get();
  if (!l.exists) return null;
  const key = l.data().key;
  const r = await db.collection(ANALYSES).doc(key).get();
  if (!r.exists) return null;
  const rec = r.data();
  if (rec.tenantId !== tenantId || rec.projectId !== projectId || rec.sourceId !== assetId) return null;
  return { key, catalog: rec.status === 'done' ? rec.result || null : null, sourceQuality: rec.sourceQuality, sourceSha256: typeof rec.sourceSha256 === 'string' && rec.sourceSha256 ? rec.sourceSha256 : null, visual: candidateVisualOf({ ...rec, key }, { tenantId, projectId, assetId }) };
}

const clip = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined);
const strList = (v: unknown, n: number, max: number): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, n).map((x) => x.slice(0, max)) : undefined;

/** İstemciye giden GÜVENLİ insan düzeltmesi görünümü (alan seçimli): correctedBy (uid) ve basedOnAnalysisKey çıkarılır. */
export interface CorrectionView {
  overrides: {
    subject?: string;
    description?: string;
    tags?: string[];
    foodCategories?: string[];
    productIdentity?: { status: string; note: string };
    usageSuggestions?: string[];
    shotType?: string;
    peoplePresent?: boolean;
  };
  verifiedProductIds: string[];
  note?: string;
  correctedAt: number | null;
}

export function toCorrectionView(c: MediaCatalogCorrection | null): CorrectionView | null {
  if (!c) return null;
  const o: any = c.overrides || {};
  const overrides: CorrectionView['overrides'] = {};
  const subject = clip(o.subject, 120);
  const description = clip(o.description, 400);
  if (subject !== undefined) overrides.subject = subject;
  if (description !== undefined) overrides.description = description;
  const tags = strList(o.tags, 15, 40);
  if (tags) overrides.tags = tags;
  const food = strList(o.foodCategories, 10, 40);
  if (food) overrides.foodCategories = food;
  if (o.productIdentity && typeof o.productIdentity === 'object' && typeof o.productIdentity.status === 'string') {
    overrides.productIdentity = { status: o.productIdentity.status.slice(0, 40), note: clip(o.productIdentity.note, 200) ?? '' };
  }
  const use = strList(o.usageSuggestions, 8, 40);
  if (use) overrides.usageSuggestions = use;
  if (typeof o.shotType === 'string') overrides.shotType = o.shotType.slice(0, 40);
  if (typeof o.peoplePresent === 'boolean') overrides.peoplePresent = o.peoplePresent;
  const at: any = (c as any).correctedAt;
  const correctedAt = typeof at === 'number' ? at : typeof at?.toMillis === 'function' ? at.toMillis() : null;
  const note = clip(c.note, 300);
  return {
    overrides,
    verifiedProductIds: (strList(c.verifiedProductIds, 10, 64) ?? []).filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id)),
    ...(note !== undefined ? { note } : {}),
    correctedAt,
  };
}

export async function loadEffectiveCatalog(
  db: Db,
  tenantId: string,
  projectId: string,
  assetId: string
): Promise<EffectiveCatalog & { analysisKey: string | null; sourceQuality: string | null; sourceSha256: string | null; visual: CandidateVisual | null; human: ReturnType<typeof humanSemanticOf> }> {
  const [latest, correction] = await Promise.all([loadLatestCatalog(db, tenantId, projectId, assetId), loadCorrection(db, tenantId, projectId, assetId)]);
  return {
    ...effectiveCatalog(latest?.catalog || null, correction),
    analysisKey: latest?.key || null,
    sourceQuality: latest?.sourceQuality || null,
    sourceSha256: latest?.sourceSha256 ?? null,
    visual: latest?.visual || null,
    // AI analizi yokken (catalog:null) insanın yazdığı açıklama kaybolmaz; tam katalog UYDURULMAZ, ayrı alan olarak taşınır
    human: humanSemanticOf(correction),
  };
}
