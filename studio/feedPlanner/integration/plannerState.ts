import type { SlotText } from '../types';
import type { Lane, PlanState } from '../planner';
import { sha256Hex } from '../../../scripts/lib/dietiDraftImport.mjs';

/**
 * ÖNERİ SÖZLEŞMESİ — canlı şemada YOKTUR, dağıtılmadı, hiçbir uç noktaya/arayüze bağlı DEĞİL.
 * Kalıcı "Kalsın" ve "Ele" durumu için taslak belge biçimi, ortak doğrulama ve önerilen Firestore kuralı
 * (docs/proposals/planner-state.rules; emülatörde test edilir). Amaç: tenant/proje erişimi, eski-sürüm koruması ve
 * atomik öneri bağını tasarlayıp kanıtlamak; çalışıyor iddiası değildir.
 *
 * Güvence sınırı: Firestore kuralları liste ELEMANLARINI doğrulayamaz (yalnız boyut/şekil). Eleman denetimi bu
 * modüldeki validatePlannerStateDoc'tur; kalıcılık eklenirse yazım yolu (sunucu ucu) bunu zorunlu çalıştırmalıdır.
 */
export const PLANNER_STATE_COLLECTION = 'content_plan_planner_state';
export const PROPOSAL_NOTICE = 'ÖNERİ: canlı şemada yok; dağıtılmadı; hiçbir uç noktaya bağlı değil.';
/** Kural önerisi üretime hazır veya tam güvenli kalıcılık DEĞİLDİR. Emülatör testi bu sınırı kanıtlar. */
export const PROPOSAL_LIMITATIONS =
  'Firestore kuralları liste ELEMANLARINI doğrulayamaz (yalnız boyut/şekil): null, eksik veya çöp eleman kuraldan geçer. ' +
  'Gerçek yazımda zorunlu sunucu doğrulaması (validatePlannerStateDoc) ya da kurallarda doğrulanabilir belge biçimi (ör. elemanları alt belge yapmak) gerekir. ' +
  'Bu öneri üretime hazır veya tam güvenli kalıcılık olarak sunulamaz.';
export const MAX_LOCKS = 18;
export const MAX_DISMISSED = 200;

/** Kilit, slotun ATOMİK önerisine (medya + metin) bağlıdır: aynı medyanın metni değişirse eski kilit düşer. */
export interface PlannerLock {
  lane: Lane;
  slot: number;
  mediaId: string;
  /** suggestionHash(mediaId, text) — 32 hex */
  suggestionHash: string;
}
export interface PlannerDismissed {
  lane: Lane;
  mediaId: string;
}
export interface PlannerStateDoc {
  tenantId: string;
  projectId: string;
  /** content_plans belge kimliği: kural, planın aynı tenant/projeye ait olduğunu doğrular */
  planId: string;
  version: number;
  locks: PlannerLock[];
  dismissed: PlannerDismissed[];
  updatedBy: string;
  updatedAt: number;
}

const SAFE = /^[A-Za-z0-9_-]{1,128}$/;
const HASH = /^[0-9a-f]{32}$/;
export const plannerStateDocId = (tenantId: string, projectId: string, planId: string) => `${tenantId}_${projectId}_${planId}`;

/** Öneri (medya + metin) içerik hash'i; metin alan sırasından bağımsızdır. */
export function suggestionHash(mediaId: string, text: SlotText | null): string {
  const t = text ? { headline: text.headline ?? null, body: text.body ?? null, caption: text.caption ?? null, source: text.source, lang: text.lang, templateId: text.templateId ?? null } : null;
  return sha256Hex(JSON.stringify({ mediaId, text: t })).slice(0, 32);
}

export type BuildResult =
  | { ok: true; doc: PlannerStateDoc }
  | { ok: false; error: 'locks_capacity' | 'dismissed_capacity'; count: number; max: number };

export function toPlannerStateDoc(a: {
  tenantId: string;
  projectId: string;
  planId: string;
  feed: PlanState;
  story: PlanState;
  /** Okunan belgenin sürümü; yeni belge için null */
  baseVersion: number | null;
  uid: string;
  now: number;
}): BuildResult {
  const locks: PlannerLock[] = [];
  (['feed', 'story'] as Lane[]).forEach((lane) => {
    const st = lane === 'feed' ? a.feed : a.story;
    st.slots.forEach((id, slot) => {
      if (id && st.locked[slot]) locks.push({ lane, slot, mediaId: id, suggestionHash: suggestionHash(id, st.texts[slot]) });
    });
  });
  if (locks.length > MAX_LOCKS) return { ok: false, error: 'locks_capacity', count: locks.length, max: MAX_LOCKS };
  const seen = new Set<string>();
  const dismissed: PlannerDismissed[] = [];
  (['feed', 'story'] as Lane[]).forEach((lane) => {
    for (const mediaId of (lane === 'feed' ? a.feed : a.story).dismissed) {
      const k = `${lane}:${mediaId}`;
      if (!seen.has(k)) {
        seen.add(k);
        dismissed.push({ lane, mediaId });
      }
    }
  });
  // Sessiz kırpma YOK: kapasite aşımı eski elenenin geri gelmesine yol açar; bu yüzden açık hata.
  if (dismissed.length > MAX_DISMISSED) return { ok: false, error: 'dismissed_capacity', count: dismissed.length, max: MAX_DISMISSED };
  return {
    ok: true,
    doc: { tenantId: a.tenantId, projectId: a.projectId, planId: a.planId, version: (a.baseVersion ?? 0) + 1, locks, dismissed, updatedBy: a.uid, updatedAt: a.now },
  };
}

const KEYS = ['tenantId', 'projectId', 'planId', 'version', 'locks', 'dismissed', 'updatedBy', 'updatedAt'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const safeStr = (v: unknown): v is string => typeof v === 'string' && SAFE.test(v);
const isLane = (v: unknown): v is Lane => v === 'feed' || v === 'story';

/**
 * Şekil ve eleman denetimi (sürüm kuralı hariç). Hiçbir girdide FIRLATMAZ: null, eksik alan, yanlış tip veya
 * bilinmeyen alanlı kayıt kontrollü hata olarak döner. Kuralların yapamadığı eleman denetimini üstlenir.
 */
export function validatePlannerStateShape(input: unknown): string[] {
  if (!isObj(input)) return ['belge nesne olmalı'];
  const doc = input;
  const e: string[] = [];
  const extra = Object.keys(doc).filter((k) => !KEYS.includes(k));
  if (extra.length) e.push(`bilinmeyen alan: ${extra.join(',')}`);
  for (const k of ['tenantId', 'projectId', 'planId'] as const) if (!safeStr(doc[k])) e.push(`${k} güvenli desende (metin) değil`);
  if (typeof doc.updatedBy !== 'string' || !doc.updatedBy) e.push('updatedBy metin olmalı');
  if (typeof doc.updatedAt !== 'number' || !Number.isFinite(doc.updatedAt)) e.push('updatedAt sonlu sayı olmalı');
  if (!Array.isArray(doc.locks) || !Array.isArray(doc.dismissed)) return [...e, 'locks/dismissed liste olmalı'];
  if (doc.locks.length > MAX_LOCKS) e.push(`en fazla ${MAX_LOCKS} kilit`);
  if (doc.dismissed.length > MAX_DISMISSED) e.push(`en fazla ${MAX_DISMISSED} eleme (sessiz kırpma yok)`);
  const lockKeys = new Set<string>();
  doc.locks.forEach((l: unknown, i: number) => {
    if (!isObj(l)) { e.push(`kilit[${i}] nesne değil`); return; }
    const unknownKeys = Object.keys(l).filter((k) => !['lane', 'slot', 'mediaId', 'suggestionHash'].includes(k));
    if (unknownKeys.length) e.push(`kilit[${i}] bilinmeyen alan: ${unknownKeys.join(',')}`);
    const bad = !safeStr(l.mediaId) || typeof l.suggestionHash !== 'string' || !HASH.test(l.suggestionHash) || !Number.isInteger(l.slot) || (l.slot as number) < 0 || (l.slot as number) > 8 || !isLane(l.lane);
    if (bad) { e.push(`kilit[${i}] geçersiz veya eksik alan (lane/slot/mediaId/suggestionHash)`); return; }
    const k = `${l.lane}:${l.slot}`;
    if (lockKeys.has(k)) e.push(`aynı slot iki kez kilitli: ${k}`);
    lockKeys.add(k);
  });
  doc.dismissed.forEach((d: unknown, i: number) => {
    if (!isObj(d)) { e.push(`eleme[${i}] nesne değil`); return; }
    const unknownKeys = Object.keys(d).filter((k) => !['lane', 'mediaId'].includes(k));
    if (unknownKeys.length) e.push(`eleme[${i}] bilinmeyen alan: ${unknownKeys.join(',')}`);
    if (!safeStr(d.mediaId) || !isLane(d.lane)) e.push(`eleme[${i}] geçersiz veya eksik alan (lane/mediaId)`);
  });
  return e;
}

/** Önerilen kuralın denetimiyle aynı: şekil + sürüm (ilk belge 1; güncelleme önceki + 1). */
export function validatePlannerStateDoc(input: unknown, prev?: { version: number } | null): string[] {
  const e = validatePlannerStateShape(input);
  if (!isObj(input)) return e;
  const doc = input as unknown as PlannerStateDoc;
  if (!Number.isInteger(doc.version) || doc.version < 1) e.push('version >= 1 tam sayı olmalı');
  else if (prev ? doc.version !== prev.version + 1 : doc.version !== 1) e.push(prev ? 'version, önceki sürüm + 1 olmalı (eski sürüm yazımı reddedilir)' : 'ilk belge version = 1 olmalı');
  return e;
}

export type DroppedReason = 'slot_changed' | 'text_changed';
export type ApplyResult =
  | {
      ok: true;
      feed: PlanState;
      story: PlanState;
      /** Kaydedilmiş ama artık geçerli olmayan kilitler (başka medya veya aynı medyanın değişmiş metni) */
      dropped: Array<{ lane: Lane; slot: number; mediaId: string; reason: DroppedReason }>;
      /** Yerelde kilitliyken yetkili belgede kilidi olmayanlar: kilitleri KALDIRILDI */
      unlockedByServer: Array<{ lane: Lane; slot: number; mediaId: string }>;
      /** Yerelde elenmiş ama yetkili belgede olmayanlar: yetkili belge kazandı */
      localOnlyDismissed: Array<{ lane: Lane; mediaId: string }>;
    }
  | { ok: false; errors: string[] };

/**
 * Yetkili (kayıtlı) belgeyi plana uygular. Yerel kilitler ÖNCE temizlenir, sonra yalnız doğrulanmış kilitler uygulanır:
 * sunucuda kaldırılmış kilit yerelde kalmaz. Kilit, medya VE metin hash'i eşleşince uygulanır.
 * Elemeler yetkili belgeyle değiştirilir; yerelde yalnız bulunanlar raporlanır (sessizce korunmaz/silinmez).
 */
export function applyPlannerStateDoc(input: PlannerStateDoc | unknown, feed: PlanState, story: PlanState): ApplyResult {
  const errors = validatePlannerStateShape(input);
  if (errors.length) return { ok: false, errors };
  const doc = input as PlannerStateDoc;
  const next: Record<Lane, PlanState> = {
    feed: { ...feed, locked: feed.locked.map(() => false), dismissed: [] },
    story: { ...story, locked: story.locked.map(() => false), dismissed: [] },
  };
  const before: Record<Lane, PlanState> = { feed, story };
  const dropped: Extract<ApplyResult, { ok: true }>['dropped'] = [];
  for (const l of doc.locks) {
    const st = next[l.lane];
    if (st.slots[l.slot] !== l.mediaId) dropped.push({ lane: l.lane, slot: l.slot, mediaId: l.mediaId, reason: 'slot_changed' });
    else if (suggestionHash(l.mediaId, st.texts[l.slot]) !== l.suggestionHash) dropped.push({ lane: l.lane, slot: l.slot, mediaId: l.mediaId, reason: 'text_changed' });
    else st.locked[l.slot] = true;
  }
  const unlockedByServer: Extract<ApplyResult, { ok: true }>['unlockedByServer'] = [];
  (['feed', 'story'] as Lane[]).forEach((lane) => {
    before[lane].locked.forEach((was, slot) => {
      const id = before[lane].slots[slot];
      if (was && id && !next[lane].locked[slot]) unlockedByServer.push({ lane, slot, mediaId: id });
    });
  });
  for (const d of doc.dismissed) if (!next[d.lane].dismissed.includes(d.mediaId)) next[d.lane].dismissed.push(d.mediaId);
  const localOnlyDismissed: Extract<ApplyResult, { ok: true }>['localOnlyDismissed'] = [];
  (['feed', 'story'] as Lane[]).forEach((lane) => {
    for (const id of before[lane].dismissed) if (!next[lane].dismissed.includes(id)) localOnlyDismissed.push({ lane, mediaId: id });
  });
  return { ok: true, feed: next.feed, story: next.story, dropped, unlockedByServer, localOnlyDismissed };
}
