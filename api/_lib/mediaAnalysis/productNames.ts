/**
 * İnsan doğrulamalı ürün kimliklerinin ADLARI. Tek kaynak: bu tenant+projeye ait, doğrulanmış marka sesi paketinin
 * `verifiedProducts` listesi. Yalnız istenen kimlikler çözülür (listenin tamamı dönmez); eşleşmeyen/erişilemeyen kimlik
 * `name: null` olur — kimlikten ad TAHMİN EDİLMEZ. Salt okuma (tek doc get).
 */
import { validateBrandVoiceBundle } from '../../../shared/planner/brandVoice.js';
import { sha256Hex } from '../../../shared/planner/sha256.js';
import { BRAND_VOICE_COLLECTION, brandVoiceDocId } from '../planCopy/planCopy.js';

type Db = any;

export type ProductNameSource = 'bundle' | 'no_bundle' | 'invalid_bundle' | 'unavailable';
export interface ResolvedProduct {
  id: string;
  name: string | null;
}
export interface ProductNames {
  source: ProductNameSource;
  items: ResolvedProduct[];
}

export async function resolveVerifiedProductNames(db: Db, tenantId: string, projectId: string, ids: string[]): Promise<ProductNames> {
  const unresolved = (source: ProductNameSource): ProductNames => ({ source, items: ids.map((id) => ({ id, name: null })) });
  if (ids.length === 0) return { source: 'bundle', items: [] };
  let doc: any;
  try {
    const s = await db.collection(BRAND_VOICE_COLLECTION).doc(brandVoiceDocId(tenantId, projectId)).get();
    doc = s.exists ? s.data() : null;
  } catch {
    return unresolved('unavailable');
  }
  if (!doc || doc.tenantId !== tenantId || doc.projectId !== projectId) return unresolved('no_bundle');
  const v = validateBrandVoiceBundle(doc.bundle, sha256Hex);
  if (!v.ok) return unresolved('invalid_bundle');
  const names = new Map(v.bundle.verifiedProducts.map((p) => [p.id, p.name]));
  return { source: 'bundle', items: ids.map((id) => ({ id, name: names.get(id) ?? null })) };
}
