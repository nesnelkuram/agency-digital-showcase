/**
 * İnsan katalog düzeltmesi — `media_catalog_corrections`. Bir onay kapısı DEĞİLDİR (medyada onay alanı yok). Otorite insandır:
 * AI analizi/yeniden analizi bu koleksiyona hiç yazmaz; etkin katalog effectiveCatalog() ile birleşir.
 */

import { effectiveCatalog, correctionDocId, type CatalogOverrides, type EffectiveCatalog, type ImageCatalog, type MediaCatalogCorrection } from './spec.js';

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

/** Son tamamlanmış AI kataloğu (kapsam doğrulamalı); yoksa null */
export async function loadLatestCatalog(db: Db, tenantId: string, projectId: string, assetId: string): Promise<{ key: string; catalog: ImageCatalog | null; sourceQuality?: string } | null> {
  const l = await db.collection(ANALYSIS_LATEST).doc(`${tenantId}_${projectId}_${assetId}`).get();
  if (!l.exists) return null;
  const key = l.data().key;
  const r = await db.collection(ANALYSES).doc(key).get();
  if (!r.exists) return null;
  const rec = r.data();
  if (rec.tenantId !== tenantId || rec.projectId !== projectId || rec.sourceId !== assetId) return null;
  return { key, catalog: rec.status === 'done' ? rec.result || null : null, sourceQuality: rec.sourceQuality };
}

export async function loadEffectiveCatalog(db: Db, tenantId: string, projectId: string, assetId: string): Promise<EffectiveCatalog & { analysisKey: string | null; sourceQuality: string | null }> {
  const [latest, correction] = await Promise.all([loadLatestCatalog(db, tenantId, projectId, assetId), loadCorrection(db, tenantId, projectId, assetId)]);
  return { ...effectiveCatalog(latest?.catalog || null, correction), analysisKey: latest?.key || null, sourceQuality: latest?.sourceQuality || null };
}
