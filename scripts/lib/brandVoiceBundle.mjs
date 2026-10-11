/**
 * Marka sesi paketi (saf mantık, IO yok). Girdi: araştırma kaydı (evidence-43.json), üç rehber metni.
 * Çıktı: model üretim hattının TEK bağlamı. Yalnız doğrulanmış marka hesabına ait kayıtlar girer; üçüncü taraf
 * sahipli (ör. P10) veya sesten çıkarılmış kayıtlar paket dışı bırakılır ve nedeniyle raporlanır.
 */
import { sha256Hex } from './dietiDraftImport.mjs';

export const BUNDLE_SCHEMA_VERSION = 1;

const slug = (s) =>
  s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Dil Rehberi §7: "Doğrulanmış menü adları (persona bölüm 7): A (x), B (y), ..." → [{id,name,note}] */
export function parseVerifiedProducts(languageGuide) {
  const line = languageGuide.split('\n').join(' ').match(/Doğrulanmış menü adları[^:]*:\s*(.+?)\.\s+(?:Alkol|$)/s);
  if (!line) throw new Error('Dil Rehberi\'nde "Doğrulanmış menü adları" satırı bulunamadı; ürün listesi uydurulmaz.');
  const parts = line[1].split(/,\s*(?![^()]*\))/).map((p) => p.trim()).filter(Boolean);
  const out = parts.map((p) => {
    const m = /^(.+?)\s*\(([^)]+)\)\s*$/.exec(p);
    const name = (m ? m[1] : p).trim();
    return { id: slug(name), name, note: m ? m[2].trim() : '' };
  });
  if (out.length < 1) throw new Error('Doğrulanmış ürün listesi boş.');
  return out;
}

const clean = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();

export function buildBrandVoiceBundle({ evidence, persona, languageGuide, shareStyles, account }) {
  if (!account) throw new Error('account zorunlu');
  if (!Array.isArray(evidence) || evidence.length === 0) throw new Error('evidence boş');
  for (const [k, v] of Object.entries({ persona, languageGuide, shareStyles })) if (typeof v !== 'string' || v.trim().length < 200) throw new Error(`${k} rehberi eksik veya çok kısa`);
  const captions = [];
  const excluded = [];
  for (const ev of evidence) {
    if (ev.owner_username !== account) { excluded.push({ id: ev.evidence_id, reason: 'başka_hesap', owner: ev.owner_username ?? null }); continue; }
    if (ev.included_in_voice_analysis === false) { excluded.push({ id: ev.evidence_id, reason: 'sesten_çıkarılmış', owner: ev.owner_username }); continue; }
    const caption = clean(ev.caption);
    if (!caption) { excluded.push({ id: ev.evidence_id, reason: 'boş_metin', owner: ev.owner_username }); continue; }
    captions.push({
      id: String(ev.evidence_id),
      owner: ev.owner_username,
      date: String(ev.publication_istanbul || '').slice(0, 10),
      format: String(ev.format || ''),
      languageOrder: String(ev.language_order || ''),
      theme: String(ev.theme || ''),
      cta: String(ev.cta || ''),
      caption: caption.slice(0, 2200),
    });
  }
  if (captions.length === 0) throw new Error('Doğrulanmış hesaba ait caption yok.');
  return {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    brand: { name: 'Dieci', account },
    builtFrom: { evidenceCount: evidence.length, ownerFilter: account, excluded },
    captions,
    guides: { persona, languageGuide, shareStyles },
    guideHashes: { persona: sha256Hex(persona), languageGuide: sha256Hex(languageGuide), shareStyles: sha256Hex(shareStyles) },
    verifiedProducts: parseVerifiedProducts(languageGuide),
  };
}
