/**
 * Marka sesi paketi: metin üretim hattının TEK bağlamı (hesap caption'ları, üç rehber, doğrulanmış ürün listesi).
 * scripts/build-brand-voice-bundle.mjs üretir; sunucu Firestore'a yazarken ve okurken bu doğrulayıcıyı çalıştırır.
 * Saf; ağ/DB yok.
 */
export const BUNDLE_SCHEMA_VERSION = 1;
export const MAX_BUNDLE_BYTES = 350_000;
export const MAX_EXCLUDED = 200;
export const MAX_CAPTIONS = 60;
export const GUIDE_MIN = 200;
export const GUIDE_MAX = 80_000;

export interface BrandCaption {
  id: string;
  owner: string;
  date: string;
  format: string;
  languageOrder: string;
  theme: string;
  cta: string;
  caption: string;
}
export interface VerifiedProduct {
  id: string;
  name: string;
  note: string;
}
export interface BrandVoiceBundle {
  schemaVersion: number;
  brand: { name: string; account: string };
  builtFrom: { evidenceCount: number; ownerFilter: string; excluded: Array<{ id: string; reason: string; owner: string | null }> };
  captions: BrandCaption[];
  guides: { persona: string; languageGuide: string; shareStyles: string };
  guideHashes: { persona: string; languageGuide: string; shareStyles: string };
  verifiedProducts: VerifiedProduct[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number, min = 0): v is string => typeof v === 'string' && v.length >= min && v.length <= max;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type BundleCheck = { ok: true; bundle: BrandVoiceBundle } | { ok: false; errors: string[] };

/** Hiçbir girdide fırlatmaz. `hash` verilirse rehber özetleri yeniden hesaplanıp karşılaştırılır. */
export function validateBrandVoiceBundle(raw: unknown, hash?: (s: string) => string): BundleCheck {
  const e: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['paket nesne olmalı'] };
  if (raw.schemaVersion !== BUNDLE_SCHEMA_VERSION) e.push('schemaVersion desteklenmiyor');
  const brand = raw.brand;
  const account = isObj(brand) && str(brand.account, 60, 1) ? brand.account : null;
  if (!isObj(brand) || !str(brand.name, 60, 1) || !account) e.push('brand.name/account geçersiz');
  const built = raw.builtFrom;
  if (!isObj(built) || built.ownerFilter !== account) e.push('builtFrom.ownerFilter marka hesabıyla aynı olmalı');
  if (isObj(built)) {
    const ex = built.excluded;
    if (!Array.isArray(ex) || ex.length > MAX_EXCLUDED) e.push(`builtFrom.excluded en fazla ${MAX_EXCLUDED} kayıt olmalı`);
    else ex.forEach((x: unknown, i: number) => { if (!isObj(x) || !str(x.id, 40, 1) || !str(x.reason, 60, 1) || !(x.owner === null || str(x.owner, 60))) e.push(`builtFrom.excluded[${i}] geçersiz`); });
  }
  if (!Array.isArray(raw.captions) || raw.captions.length < 1 || raw.captions.length > MAX_CAPTIONS) e.push(`captions 1-${MAX_CAPTIONS} kayıt olmalı`);
  else {
    const seen = new Set<string>();
    raw.captions.forEach((c: unknown, i: number) => {
      if (!isObj(c)) { e.push(`captions[${i}] nesne değil`); return; }
      if (!str(c.id, 40, 1) || !ID.test(c.id as string)) e.push(`captions[${i}].id geçersiz`);
      else if (seen.has(c.id as string)) e.push(`captions[${i}].id yinelenmiş`);
      else seen.add(c.id as string);
      if (c.owner !== account) e.push(`captions[${i}] başka hesaba ait (${String(c.owner)})`);
      if (!str(c.date, 10, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(c.date as string)) e.push(`captions[${i}].date geçersiz`);
      for (const k of ['format', 'languageOrder', 'theme', 'cta'] as const) if (!str(c[k], 160)) e.push(`captions[${i}].${k} geçersiz`);
      if (!str(c.caption, 2200, 1)) e.push(`captions[${i}].caption boş veya çok uzun`);
    });
    const excluded = isObj(built) && Array.isArray(built.excluded) ? built.excluded : [];
    for (const x of excluded) if (isObj(x) && typeof x.id === 'string' && seen.has(x.id)) e.push(`hariç tutulan kayıt (${x.id}) captions içinde`);
  }
  const g = raw.guides;
  const gh = raw.guideHashes;
  if (!isObj(g) || !isObj(gh)) e.push('guides/guideHashes nesne olmalı');
  else {
    for (const k of ['persona', 'languageGuide', 'shareStyles'] as const) {
      if (!str(g[k], GUIDE_MAX, GUIDE_MIN)) e.push(`guides.${k} ${GUIDE_MIN}-${GUIDE_MAX} karakter olmalı`);
      else if (!str(gh[k], 64, 64) || !/^[0-9a-f]{64}$/.test(gh[k] as string)) e.push(`guideHashes.${k} geçersiz`);
      else if (hash && hash(g[k] as string) !== gh[k]) e.push(`guideHashes.${k} rehber içeriğiyle uyuşmuyor`);
    }
  }
  if (!Array.isArray(raw.verifiedProducts) || raw.verifiedProducts.length > 50) e.push('verifiedProducts en fazla 50 kayıt');
  else {
    const ids = new Set<string>();
    raw.verifiedProducts.forEach((p: unknown, i: number) => {
      if (!isObj(p) || !str(p.id, 60, 1) || !SLUG.test(p.id as string) || !str(p.name, 80, 1) || !str(p.note, 160)) e.push(`verifiedProducts[${i}] geçersiz`);
      else if (ids.has(p.id as string)) e.push(`verifiedProducts[${i}].id yinelenmiş`);
      else ids.add(p.id as string);
    });
  }
  if (e.length === 0 && JSON.stringify(raw).length > MAX_BUNDLE_BYTES) e.push('paket çok büyük');
  return e.length ? { ok: false, errors: e } : { ok: true, bundle: raw as unknown as BrandVoiceBundle };
}
