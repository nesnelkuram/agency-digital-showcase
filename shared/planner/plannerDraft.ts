/**
 * Kalıcı planlayıcı TASLAĞI (hafta başına tek belge: feed 9 + story 9 slot, elemeler, gerekçeli retler).
 * Kilit slotun KENDİSİNDE tutulur (aynı kayıtta görsel + metin + kırpma + kilit): kilit başka içeriğe kayamaz.
 * Yalnız sunucu yazar (istemci kuralı yok). Bu doğrulayıcı sunucuda zorunludur; eleman denetimi burada yapılır,
 * kurallar listeleri doğrulayamaz. Hiçbir girdide FIRLATMAZ.
 *
 * Saklanan: görsel seçimi, format, metin (model kaynaklı), kırpma/odak, Kalsın, eleme, ret. Bunlar planlayıcı taslağıdır;
 * post'a dönüştürülürken kırpma ve Story görsel üstü metni post şemasında YOKTUR (taslak yazım sözleşmesi uyarır).
 */
import { EVIDENCE_BASES } from './copyContract';

export const DRAFT_SCHEMA_VERSION = 1;
export const DRAFT_SLOTS = 9;
export const MAX_DISMISSED = 200;
export const MAX_REJECTED = 200;
export const MAX_DRAFT_BYTES = 120_000;
export const VOICE_SOURCES = ['approved_bundle', 'approved_guide', 'temporary_tone'] as const;
export const FEED_FORMATS = ['feed-1x1', 'feed-4x5', 'reels-cover'] as const;
export const FEEDBACK_CATEGORIES = ['görsel', 'metin', 'marka_sesi', 'ürün_bilgisi', 'format', 'zamanlama', 'tekrar', 'diğer'] as const;
export const FEEDBACK_SCOPES = ['content_only', 'brand_context'] as const;

export interface DraftText {
  headline?: string;
  body?: string;
  caption?: string;
  /** model: sunucunun ürettiği ve kaydederken doğruladığı metin (hash + yanıt kaydı). plan/manual: DOĞRULANMAMIŞ insan/plan metni; model alanı taşıyamaz. */
  source: 'model' | 'plan' | 'manual';
  lang: 'tr' | 'en' | 'unknown';
  evidenceBasis?: (typeof EVIDENCE_BASES)[number];
  /** Model metninin ses kaynağı; sunucu, kayıtlı üretim kaydıyla karşılaştırır (geçici ton metni onaylı gibi saklanamaz) */
  voiceSource?: (typeof VOICE_SOURCES)[number];
  contentHash?: string;
  responseId?: string;
  promptVersion?: string;
}
export interface DraftCrop {
  focus: { x: number; y: number };
  zoom: number;
}
export interface DraftSlot {
  mediaId: string;
  format: string;
  locked: boolean;
  text: DraftText | null;
  crop: DraftCrop | null;
  /** Yalnız GERÇEK ürün seri kimliği (insan doğrulamalı ürün); aynı gün olmak seri değildir. Feed'de null. */
  seriesKey: string | null;
}
export interface DraftDismissed { lane: 'feed' | 'story'; mediaId: string }
export interface DraftRejected { mediaId: string; category: string; note: string; scope: string }
export interface PlannerDraft {
  weekStart: string;
  feed: (DraftSlot | null)[];
  story: (DraftSlot | null)[];
  dismissed: DraftDismissed[];
  rejected: DraftRejected[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const SAFE = /^[A-Za-z0-9_-]{1,128}$/;
const exactKeys = (o: Record<string, unknown>, keys: string[], p: string, e: string[]) => {
  const extra = Object.keys(o).filter((k) => !keys.includes(k));
  if (extra.length) e.push(`${p}: bilinmeyen alan ${extra.join(',')}`);
};
const maxLen: Record<'headline' | 'body' | 'caption', number> = { headline: 70, body: 240, caption: 1500 };

export type DraftCheck = { ok: true; draft: PlannerDraft } | { ok: false; errors: string[] };

function validText(t: unknown, p: string, e: string[]) {
  if (t === null) return;
  if (!isObj(t)) { e.push(`${p}: metin nesne veya null olmalı`); return; }
  exactKeys(t, ['headline', 'body', 'caption', 'source', 'lang', 'evidenceBasis', 'voiceSource', 'contentHash', 'responseId', 'promptVersion'], p, e);
  for (const k of ['headline', 'body', 'caption'] as const) {
    const v = t[k];
    if (v !== undefined && (typeof v !== 'string' || v.length === 0 || v.length > maxLen[k])) e.push(`${p}.${k}: boş olmayan metin ≤ ${maxLen[k]} olmalı`);
  }
  if (t.headline === undefined && t.body === undefined && t.caption === undefined) e.push(`${p}: en az bir metin alanı gerekir (metinsiz kare için text null)`);
  if (t.caption !== undefined && (t.headline !== undefined || t.body !== undefined)) e.push(`${p}: caption ile başlık/gövde birlikte olamaz`);
  if (t.source !== 'model' && t.source !== 'plan' && t.source !== 'manual') e.push(`${p}.source geçersiz`);
  if (t.lang !== 'tr' && t.lang !== 'en' && t.lang !== 'unknown') e.push(`${p}.lang geçersiz`);
  if (t.evidenceBasis !== undefined && !(EVIDENCE_BASES as readonly string[]).includes(t.evidenceBasis as string)) e.push(`${p}.evidenceBasis geçersiz`);
  if (t.voiceSource !== undefined && !(VOICE_SOURCES as readonly string[]).includes(t.voiceSource as string)) e.push(`${p}.voiceSource geçersiz`);
  if (t.contentHash !== undefined && (typeof t.contentHash !== 'string' || !/^[0-9a-f]{32}$/.test(t.contentHash))) e.push(`${p}.contentHash geçersiz`);
  if (t.responseId !== undefined && (typeof t.responseId !== 'string' || t.responseId.length > 128)) e.push(`${p}.responseId geçersiz`);
  if (t.promptVersion !== undefined && (typeof t.promptVersion !== 'string' || t.promptVersion.length > 40)) e.push(`${p}.promptVersion geçersiz`);
  if (t.source === 'model' && (t.contentHash === undefined || t.responseId === undefined)) e.push(`${p}: model kaynaklı metin contentHash ve responseId taşımalı`);
  if ((t.source === 'plan' || t.source === 'manual') && (t.contentHash !== undefined || t.responseId !== undefined || t.evidenceBasis !== undefined || t.promptVersion !== undefined || t.voiceSource !== undefined)) e.push(`${p}: ${String(t.source)} metni model kanıtı alanları taşıyamaz (doğrulanmamış metin model çıktısı gibi sunulamaz)`);
}

function validSlot(s: unknown, lane: 'feed' | 'story', p: string, e: string[]): string | null {
  if (s === null) return null;
  if (!isObj(s)) { e.push(`${p}: slot nesne veya null olmalı`); return null; }
  exactKeys(s, ['mediaId', 'format', 'locked', 'text', 'crop', 'seriesKey'], p, e);
  const id = typeof s.mediaId === 'string' && SAFE.test(s.mediaId) ? s.mediaId : null;
  if (!id) e.push(`${p}.mediaId güvenli kimlik olmalı`);
  const formats: readonly string[] = lane === 'feed' ? FEED_FORMATS : ['story'];
  if (typeof s.format !== 'string' || !formats.includes(s.format)) e.push(`${p}.format ${lane} için geçersiz`);
  if (typeof s.locked !== 'boolean') e.push(`${p}.locked boolean olmalı`);
  validText(s.text === undefined ? 'EKSIK' : s.text, `${p}.text`, e);
  if (s.crop !== null) {
    const c = s.crop;
    if (!isObj(c) || !isObj(c.focus)) e.push(`${p}.crop nesne veya null olmalı`);
    else {
      exactKeys(c, ['focus', 'zoom'], `${p}.crop`, e);
      exactKeys(c.focus as Record<string, unknown>, ['x', 'y'], `${p}.crop.focus`, e);
      const f = c.focus as Record<string, unknown>;
      for (const k of ['x', 'y'] as const) if (typeof f[k] !== 'number' || !Number.isFinite(f[k] as number) || (f[k] as number) < 0 || (f[k] as number) > 1) e.push(`${p}.crop.focus.${k} 0-1 olmalı`);
      if (typeof c.zoom !== 'number' || !Number.isFinite(c.zoom) || c.zoom < 1 || c.zoom > 4) e.push(`${p}.crop.zoom 1-4 olmalı`);
    }
  }
  if (s.seriesKey !== null && (typeof s.seriesKey !== 'string' || !SAFE.test(s.seriesKey))) e.push(`${p}.seriesKey null veya güvenli kimlik olmalı`);
  if (lane === 'feed' && s.seriesKey !== null) e.push(`${p}: feed slotu seri kimliği taşıyamaz`);
  return id;
}

export function validatePlannerDraft(raw: unknown): DraftCheck {
  const e: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['taslak nesne olmalı'] };
  exactKeys(raw, ['weekStart', 'feed', 'story', 'dismissed', 'rejected'], 'taslak', e);
  if (typeof raw.weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.weekStart) || Number.isNaN(Date.parse(raw.weekStart))) e.push('weekStart geçersiz');
  const used = new Map<string, string>();
  const laneIds: Record<'feed' | 'story', Set<string>> = { feed: new Set(), story: new Set() };
  for (const lane of ['feed', 'story'] as const) {
    const arr = raw[lane];
    if (!Array.isArray(arr) || arr.length !== DRAFT_SLOTS) { e.push(`${lane}: tam ${DRAFT_SLOTS} slot olmalı`); continue; }
    arr.forEach((s: unknown, i: number) => {
      const id = validSlot(s, lane, `${lane}[${i}]`, e);
      if (!id) return;
      if (used.has(id)) e.push(`${lane}[${i}]: aynı medya iki slotta (${used.get(id)})`);
      else used.set(id, `${lane}[${i}]`);
      laneIds[lane].add(id);
    });
  }
  const dismissedKeys = new Set<string>();
  if (!Array.isArray(raw.dismissed)) e.push('dismissed liste olmalı');
  else {
    if (raw.dismissed.length > MAX_DISMISSED) e.push(`dismissed_capacity: en fazla ${MAX_DISMISSED} eleme (sessiz kırpma yok)`);
    raw.dismissed.forEach((d: unknown, i: number) => {
      if (!isObj(d)) { e.push(`dismissed[${i}] nesne değil`); return; }
      exactKeys(d, ['lane', 'mediaId'], `dismissed[${i}]`, e);
      if ((d.lane !== 'feed' && d.lane !== 'story') || typeof d.mediaId !== 'string' || !SAFE.test(d.mediaId)) { e.push(`dismissed[${i}] geçersiz`); return; }
      const k = `${d.lane}:${d.mediaId}`;
      if (dismissedKeys.has(k)) e.push(`dismissed[${i}] yinelenmiş`);
      dismissedKeys.add(k);
      if (laneIds[d.lane].has(d.mediaId)) e.push(`dismissed[${i}]: eleneni aynı şeritte slotta tutulamaz`);
    });
  }
  const rejectedIds = new Set<string>();
  if (!Array.isArray(raw.rejected)) e.push('rejected liste olmalı');
  else {
    if (raw.rejected.length > MAX_REJECTED) e.push(`rejected_capacity: en fazla ${MAX_REJECTED} ret (sessiz kırpma yok)`);
    raw.rejected.forEach((r: unknown, i: number) => {
      if (!isObj(r)) { e.push(`rejected[${i}] nesne değil`); return; }
      exactKeys(r, ['mediaId', 'category', 'note', 'scope'], `rejected[${i}]`, e);
      if (typeof r.mediaId !== 'string' || !SAFE.test(r.mediaId)) { e.push(`rejected[${i}].mediaId geçersiz`); return; }
      if (!(FEEDBACK_CATEGORIES as readonly string[]).includes(r.category as string)) e.push(`rejected[${i}].category geçersiz`);
      if (typeof r.note !== 'string' || r.note.length > 500) e.push(`rejected[${i}].note ≤ 500 karakter olmalı`);
      if (!(FEEDBACK_SCOPES as readonly string[]).includes(r.scope as string)) e.push(`rejected[${i}].scope geçersiz`);
      if (rejectedIds.has(r.mediaId)) e.push(`rejected[${i}] yinelenmiş`);
      rejectedIds.add(r.mediaId);
      if (used.has(r.mediaId)) e.push(`rejected[${i}]: reddedilen medya slotta tutulamaz (${used.get(r.mediaId)})`);
    });
  }
  if (e.length === 0 && JSON.stringify(raw).length > MAX_DRAFT_BYTES) e.push('taslak çok büyük');
  return e.length ? { ok: false, errors: e } : { ok: true, draft: raw as unknown as PlannerDraft };
}

/** Taslağın başvurduğu tüm medya kimlikleri: slotlar (aktif olmalı) ve elenen/reddedilenler (arşivde olabilir) */
export function draftMediaRefs(d: PlannerDraft): { slotIds: string[]; otherIds: string[] } {
  const slotIds = [...d.feed, ...d.story].filter((s): s is DraftSlot => !!s).map((s) => s.mediaId);
  const set = new Set(slotIds);
  const otherIds = [...new Set([...d.dismissed.map((x) => x.mediaId), ...d.rejected.map((x) => x.mediaId)])].filter((i) => !set.has(i));
  return { slotIds, otherIds };
}
