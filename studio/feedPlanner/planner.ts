import type { Candidate, FormatId, SlotText, TextRole } from './types';
import { FORMATS } from './types';
import { hardCheck, scoreCandidate, explainShortage, HARD_LABEL, type HardReason } from './scorer';

export const GRID_COLS = 3;
export const FEED_SLOTS = 9;
export const DEFAULT_SLOT_FORMAT: FormatId = 'feed-4x5';

export type Lane = 'feed' | 'story';

/** Elenen taslak önerinin yerel geçmiş kaydı. Kaynak medya/arşiv bu listeyle silinmez. */
export interface HistoryEntry {
  seq: number;
  slot: number;
  candidateId: string;
  text: SlotText | null;
}

/**
 * Plan durumu (yalnız bellekte). Bir slot = tek sürümlü öneri: aday + metin birlikte değişir; her değişimde
 * slot sürümü artar. İşlemler beklenen sürümü alabilir: eski/tekrarlı tıklama güvenle yok sayılır.
 */
export interface PlanState {
  /** feed: 3 sütunlu ızgara komşuluğu; story: ardışık kare sırası. Varsayılan feed. */
  lane?: Lane;
  slots: (string | null)[];
  locked: boolean[];
  formats: FormatId[];
  rejected: string[];
  texts: (SlotText | null)[];
  versions: number[];
  /** Elenenler: otomatik öneriler bunları tekrar getirmez (elle atama serbest). */
  dismissed: string[];
  history: HistoryEntry[];
  seq: number;
}

export interface PlanCtx {
  brand: string;
  byId: Map<string, Candidate>;
  /** Diğer şeridin kullandığı varlıklar: tekrar edilmez */
  storyIds: string[];
  /** Story serisi rolleri (konuma göre): başlık yalnız ilk karede. Yoksa 'headline'. */
  roleOf?: (i: number, slots: (string | null)[]) => TextRole;
  /**
   * Senkron metin kaynağı. NORMAL üretimde YOKTUR: metin yalnız gerçek model hattından (copy port) gelir ve
   * commitSuggestion/setSlotText ile atomik yazılır. Yalnız testler/QA şablon sağlayıcısı verebilir.
   */
  textFor?: (c: Candidate, role: TextRole, prev: SlotText | null) => SlotText | null;
}

export interface SlotMessage {
  slot: number;
  text: string;
}

export interface OpResult {
  state: PlanState;
  message?: string;
  /** Eski sürümle gelen işlem: hiçbir şey değişmedi */
  stale?: boolean;
}

export const emptyPlan = (lane: Lane = 'feed'): PlanState => ({
  lane,
  slots: Array(FEED_SLOTS).fill(null),
  locked: Array(FEED_SLOTS).fill(false),
  formats: Array(FEED_SLOTS).fill(lane === 'story' ? 'story' : DEFAULT_SLOT_FORMAT),
  rejected: [],
  texts: Array(FEED_SLOTS).fill(null),
  versions: Array(FEED_SLOTS).fill(0),
  dismissed: [],
  history: [],
  seq: 0,
});

/** Mevcut sıralı kayıttan (ör. haftalık Story serisi) bellek kopyası: kaynağa dokunmaz. */
export const planFromIds = (ids: string[], lane: Lane, texts: (SlotText | null)[] = []): PlanState => ({
  ...emptyPlan(lane),
  slots: Array.from({ length: FEED_SLOTS }, (_, i) => ids[i] ?? null),
  texts: Array.from({ length: FEED_SLOTS }, (_, i) => texts[i] ?? null),
});

const clone = (s: PlanState): PlanState => ({
  ...s,
  slots: [...s.slots],
  locked: [...s.locked],
  formats: [...s.formats],
  rejected: [...s.rejected],
  texts: [...s.texts],
  versions: [...s.versions],
  dismissed: [...s.dismissed],
  history: [...s.history],
});

const roleFor = (state: PlanState, ctx: PlanCtx, i: number): TextRole =>
  state.lane === 'story' ? ctx.roleOf?.(i, state.slots) ?? 'headline' : 'caption';

/** Aday ve metni TEK adımda yazar (atomik) ve slot sürümünü artırır. */
function put(state: PlanState, i: number, c: Candidate | null, ctx: PlanCtx, text?: SlotText | null, prev: SlotText | null = null): void {
  state.slots[i] = c ? c.id : null;
  state.texts[i] = text !== undefined ? text : c && ctx.textFor ? ctx.textFor(c, roleFor(state, ctx, i), prev) : null;
  state.versions[i] = (state.versions[i] ?? 0) + 1;
}

const STALE = 'Bu öneri zaten değişti; işlem yok sayıldı.';
const isStale = (state: PlanState, i: number, expected?: number) => expected !== undefined && state.versions[i] !== expected;

/** Izgarada 4 yönlü komşular; Story'de önceki/sonraki kare. */
export function neighborSlots(i: number, lane: Lane = 'feed'): number[] {
  if (lane === 'story') return [i - 1, i + 1].filter((j) => j >= 0 && j < FEED_SLOTS);
  const out: number[] = [];
  if (i - GRID_COLS >= 0) out.push(i - GRID_COLS);
  if (i + GRID_COLS < FEED_SLOTS) out.push(i + GRID_COLS);
  if (i % GRID_COLS > 0) out.push(i - 1);
  if (i % GRID_COLS < GRID_COLS - 1 && i + 1 < FEED_SLOTS) out.push(i + 1);
  return out;
}

interface Evaluation {
  best: Candidate | null;
  eliminated: Partial<Record<HardReason, number>>;
  pool: number;
}

/** Slot i için en iyi geçerli aday. Sert kısıtlar önce; önceki elemeler dışlanır; sonra bağlamsal puan. */
function evaluate(i: number, state: PlanState, ctx: PlanCtx, exclude: Set<string>): Evaluation {
  const inPlan = new Set<string>(ctx.storyIds);
  state.slots.forEach((id, j) => {
    if (j !== i && id) inPlan.add(id);
  });
  const rejected = new Set(state.rejected);
  const dismissed = new Set(state.dismissed);
  const all = [...ctx.byId.values()].filter((c) => c.brand === ctx.brand);
  const planned = state.slots
    .map((id, j) => (j !== i && id ? ctx.byId.get(id) : undefined))
    .filter((c): c is Candidate => !!c);
  const neighbors = neighborSlots(i, state.lane)
    .map((j) => state.slots[j])
    .map((id) => (id ? ctx.byId.get(id) : undefined))
    .filter((c): c is Candidate => !!c);
  const published = all.filter((c) => c.published);
  const pool = all.filter((c) => !c.published);
  const format = state.formats[i];
  const eliminated: Partial<Record<HardReason, number>> = {};
  let best: Candidate | null = null;
  let bestScore = -1;
  for (const c of pool) {
    if (exclude.has(c.id) || dismissed.has(c.id)) continue;
    const r = hardCheck(c, format, { brand: ctx.brand, rejected, inPlan });
    if (r) {
      eliminated[r] = (eliminated[r] ?? 0) + 1;
      continue;
    }
    const s = scoreCandidate(c, format, neighbors, planned, published).total;
    if (!best || s > bestScore || (s === bestScore && c.id < best.id)) {
      best = c;
      bestScore = s;
    }
  }
  return { best, eliminated, pool: pool.length };
}

const dismissedNote = (state: PlanState) => (state.dismissed.length ? ` (${state.dismissed.length} elenen aday tekrar önerilmez)` : '');

/**
 * Plan oluştur (regenerate=false) veya kalanları yeniden öner (regenerate=true).
 * Yeniden öner: önce yeni aday; yoksa eski öğe hâlâ geçerliyse nedenle korunur. Kilitliler ve dolu plan boşaltılmaz.
 */
export function generate(state: PlanState, ctx: PlanCtx, regenerate = false): { state: PlanState; messages: SlotMessage[] } {
  const messages: SlotMessage[] = [];
  if (!regenerate) {
    const next = clone(state);
    for (let i = 0; i < FEED_SLOTS; i++) if (!state.locked[i] && next.slots[i]) put(next, i, null, ctx);
    for (let i = 0; i < FEED_SLOTS; i++) {
      if (state.locked[i]) continue;
      const ev = evaluate(i, next, ctx, new Set());
      if (ev.best) put(next, i, ev.best, ctx);
      else messages.push({ slot: i, text: explainShortage(ev.eliminated, ev.pool) + dismissedNote(next) });
    }
    return { state: next, messages };
  }

  const previous = new Set(state.slots.filter((id, i) => id && !state.locked[i]) as string[]);
  const next = clone(state);
  for (let i = 0; i < FEED_SLOTS; i++) {
    if (state.locked[i]) continue;
    const current = state.slots[i];
    const currentText = state.texts[i];
    next.slots[i] = null;
    const ev = evaluate(i, next, ctx, previous);
    if (ev.best) {
      put(next, i, ev.best, ctx);
      continue;
    }
    const others = new Set(next.slots.filter((_, j) => j !== i).filter(Boolean) as string[]);
    const keep = current ? ctx.byId.get(current) : undefined;
    const r = keep ? hardCheck(keep, state.formats[i], { brand: ctx.brand, rejected: new Set(state.rejected), inPlan: new Set([...ctx.storyIds, ...others]) }) : 'reddedildi';
    if (current && keep && !r) {
      next.slots[i] = current;
      next.texts[i] = currentText; // eski öneri aynen korunur (aday + metin birlikte)
      messages.push({ slot: i, text: `Önceki öğe korundu: ${explainShortage(ev.eliminated, ev.pool)}` });
    } else {
      next.texts[i] = null;
      next.versions[i] = (next.versions[i] ?? 0) + 1;
      messages.push({ slot: i, text: explainShortage(ev.eliminated, ev.pool) });
    }
  }
  return { state: next, messages };
}

/** "Kalsın": desired verilirse idempotent (tekrarlı tıklama aynı sonucu verir); verilmezse tersler. */
export function toggleLock(i: number, state: PlanState, desired?: boolean, expected?: number): OpResult {
  if (isStale(state, i, expected)) return { state, message: STALE, stale: true };
  if (!state.slots[i]) return { state, message: 'Boş öğe kilitlenemez; önce plan oluşturun.' };
  const want = desired ?? !state.locked[i];
  return { state: { ...state, locked: state.locked.map((l, j) => (j === i ? want : l)) } };
}

/** Kilitli değilse slottaki öneriyi başka gerçek bir adayla (ve metniyle) değiştirir. Geçmişe yazmaz. */
export function replaceSlot(i: number, state: PlanState, ctx: PlanCtx, expected?: number): OpResult {
  if (isStale(state, i, expected)) return { state, message: STALE, stale: true };
  if (state.locked[i]) return { state, message: 'Kilitli öğe değiştirilemez; önce "Kalsın" işaretini kaldırın.' };
  try {
    const current = state.slots[i];
    const next = clone(state);
    next.slots[i] = null;
    const ev = evaluate(i, next, ctx, new Set(current ? [current] : []));
    if (!ev.best) return { state, message: explainShortage(ev.eliminated, ev.pool) };
    put(next, i, ev.best, ctx, undefined, state.texts[i]);
    return { state: next };
  } catch {
    return { state, message: 'Beklenmeyen hata; mevcut öneri korundu.' };
  }
}

/**
 * "Ele ve yenisini getir": yalnız TASLAK öneri elenir (yerel geçmişe yazılır); kaynak medya/arşiv silinmez.
 * Elenen aday otomatik olarak geri gelmez; önceki elemeler ve komşuluk skoru hesaba katılır. Alternatif yoksa
 * veya hata olursa mevcut öneri aynen kalır ve neden gösterilir.
 */
export function dismissSlot(i: number, state: PlanState, ctx: PlanCtx, expected?: number): OpResult {
  if (isStale(state, i, expected)) return { state, message: STALE, stale: true };
  const current = state.slots[i];
  if (!current) return { state, message: 'Boş slot: elenecek öneri yok.' };
  if (state.locked[i]) return { state, message: 'Kalsın işaretli öneri elenemez; önce işareti kaldırın.' };
  try {
    const trial = clone(state);
    trial.dismissed = [...new Set([...state.dismissed, current])];
    trial.slots[i] = null;
    const ev = evaluate(i, trial, ctx, new Set([current]));
    if (!ev.best) return { state, message: `Alternatif yok, mevcut öneri korundu. ${explainShortage(ev.eliminated, ev.pool)}` };
    put(trial, i, ev.best, ctx, undefined, state.texts[i]);
    trial.seq = state.seq + 1;
    trial.history = [...state.history, { seq: trial.seq, slot: i, candidateId: current, text: state.texts[i] }];
    return { state: trial };
  } catch {
    return { state, message: 'Beklenmeyen hata; mevcut öneri korundu.' };
  }
}

/** Yerel geçmişten bir elenen öneriyi (aday + özgün metni) geri getirir; yerine geçen öneri geçmişe gider. */
export function restoreFromHistory(seq: number, state: PlanState, ctx: PlanCtx, expectedVersion?: number): OpResult {
  const entry = state.history.find((h) => h.seq === seq);
  if (!entry) return { state, message: 'Bu kayıt geçmişte yok (zaten geri getirilmiş olabilir).', stale: true };
  const i = entry.slot;
  if (isStale(state, i, expectedVersion)) return { state, message: STALE, stale: true };
  if (state.locked[i]) return { state, message: 'Kalsın işaretli slotun yerine geri getirilemez.' };
  const c = ctx.byId.get(entry.candidateId);
  if (!c) return { state, message: 'Aday kütüphanede bulunamadı.' };
  const inPlan = new Set<string>([...ctx.storyIds, ...state.slots.filter((s, j) => j !== i && s).map((s) => s as string)]);
  const r = hardCheck(c, state.formats[i], { brand: ctx.brand, rejected: new Set(state.rejected), inPlan });
  if (r) return { state, message: `Geri getirilemedi: ${HARD_LABEL[r]}` };
  const next = clone(state);
  const displaced = state.slots[i];
  next.history = next.history.filter((h) => h.seq !== seq);
  next.dismissed = next.dismissed.filter((id) => id !== entry.candidateId);
  if (displaced) {
    next.seq = state.seq + 1;
    next.dismissed = [...new Set([...next.dismissed, displaced])];
    next.history.push({ seq: next.seq, slot: i, candidateId: displaced, text: state.texts[i] });
  }
  put(next, i, c, ctx, entry.text);
  return { state: next };
}

/** Reddeder: plandan çıkarır, kilidi açar, slotu başka adayla doldurmayı dener. Red yalnız bellekte. */
export function rejectItem(id: string, state: PlanState, ctx: PlanCtx, fill = true): OpResult {
  const rejected = state.rejected.includes(id) ? state.rejected : [...state.rejected, id];
  const i = state.slots.indexOf(id);
  if (i < 0) return { state: { ...state, rejected } };
  const next = clone(state);
  next.rejected = rejected;
  next.locked[i] = false;
  put(next, i, null, ctx);
  if (!fill) return { state: next };
  const ev = evaluate(i, next, ctx, new Set());
  if (ev.best) {
    put(next, i, ev.best, ctx);
    return { state: next };
  }
  return { state: next, message: explainShortage(ev.eliminated, ev.pool) };
}

/**
 * Slot formatını değiştirir ve plan durumuna yazar. Mevcut öğe yeni formata uymazsa:
 * kilitliyse değişmez ve neden söylenir; kilitsizse başka uygun adayla değiştirilir.
 */
export function setSlotFormat(i: number, format: FormatId, state: PlanState, ctx: PlanCtx): OpResult {
  const base: PlanState = { ...state, formats: state.formats.map((f, j) => (j === i ? format : f)) };
  const id = state.slots[i];
  if (!id) return { state: base };
  const c = ctx.byId.get(id);
  const inPlan = new Set<string>([...ctx.storyIds, ...state.slots.filter((s, j) => j !== i && s).map((s) => s as string)]);
  const r = c ? hardCheck(c, format, { brand: ctx.brand, rejected: new Set(state.rejected), inPlan }) : 'reddedildi';
  if (!r) return { state: base };
  if (state.locked[i]) return { state: base, message: `Kilitli öğe bu formata uymuyor: ${r}` };
  const next = clone(base);
  next.slots[i] = null;
  const ev = evaluate(i, next, ctx, new Set([id]));
  if (ev.best) {
    put(next, i, ev.best, ctx);
    return { state: next };
  }
  put(next, i, null, ctx);
  return { state: next, message: explainShortage(ev.eliminated, ev.pool) };
}

/**
 * Kütüphaneden slota aday atar. Kilitli slot ve sert kısıt ihlali reddedilir; aynı fotoğraf iki kez
 * eklenmez (plan-içi-tekrar). Dolu kilitsiz slotun yerine geçer; aday ve metin birlikte yazılır.
 */
export function assignToSlot(id: string, i: number, state: PlanState, ctx: PlanCtx, expected?: number): OpResult {
  if (i < 0 || i >= FEED_SLOTS) return { state, message: 'Önce bir slot seçin.' };
  if (isStale(state, i, expected)) return { state, message: STALE, stale: true };
  if (state.locked[i]) return { state, message: 'Kilitli slota atanamaz; önce "Kalsın" işaretini kaldırın.' };
  const c = ctx.byId.get(id);
  if (!c) return { state, message: 'Aday bulunamadı.' };
  const inPlan = new Set<string>([...ctx.storyIds, ...state.slots.filter((s, j) => j !== i && s).map((s) => s as string)]);
  const r = hardCheck(c, state.formats[i], { brand: ctx.brand, rejected: new Set(state.rejected), inPlan });
  if (r) return { state, message: `Atanamadı: ${HARD_LABEL[r]}` };
  const next = clone(state);
  next.dismissed = next.dismissed.filter((d) => d !== id);
  put(next, i, c, ctx);
  return { state: next };
}

export const formatLabel = (f: FormatId) => FORMATS[f].label;

// ── İki aşamalı (görsel + metin ATOMİK) yenileme: önce aday önerilir, metin gerçek model hattından gelir, sonra TEK adımda yazılır ──

export type ProposeMode = 'dismiss' | 'replace' | 'fill';
export type Proposal = { ok: true; candidateId: string; version: number } | { ok: false; message: string; stale?: boolean };

/**
 * Slot için yeni aday ÖNERİR; durumu DEĞİŞTİRMEZ. dismiss: elenenler ve mevcut öneri dışlanır. Kilitli/boş slot veya
 * eski sürüm reddedilir. Hata/alternatif yok durumunda mevcut öneri hiç dokunulmadan kalır.
 */
export function proposeSlot(i: number, mode: ProposeMode, state: PlanState, ctx: PlanCtx, expected?: number): Proposal {
  if (isStale(state, i, expected)) return { ok: false, message: STALE, stale: true };
  const current = state.slots[i];
  if (mode === 'fill') {
    if (current) return { ok: false, message: 'Slot dolu: doldurulacak bir şey yok.' };
  } else {
    if (!current) return { ok: false, message: 'Boş slot: yenilenecek öneri yok.' };
    if (state.locked[i]) return { ok: false, message: 'Kalsın işaretli öneri yenilenemez; önce işareti kaldırın.' };
  }
  try {
    const trial = clone(state);
    trial.slots[i] = null;
    if (mode === 'dismiss' && current) trial.dismissed = [...new Set([...state.dismissed, current])];
    const ev = evaluate(i, trial, ctx, new Set(current ? [current] : []));
    if (!ev.best) return { ok: false, message: `Alternatif yok${current ? ', mevcut öneri korundu' : ''}. ${explainShortage(ev.eliminated, ev.pool)}` };
    return { ok: true, candidateId: ev.best.id, version: state.versions[i] };
  } catch {
    return { ok: false, message: `Beklenmeyen hata${current ? '; mevcut öneri korundu' : ''}.` };
  }
}

/**
 * Önerilen adayı ve gerçek model metnini TEK adımda yazar. Aday artık geçerli değilse (kilit, sürüm, sert kısıt,
 * başka slotta kullanım) hiçbir şey değişmez. dismiss: eski öneri yerel geçmişe ve elenenlere yazılır.
 * Metin zorunlu: rol 'none' dışında null metinle yazılmaz (görsel metinsiz kalmaz).
 */
export function commitSuggestion(i: number, candidateId: string, text: SlotText | null, mode: ProposeMode | 'fill', state: PlanState, ctx: PlanCtx, expected?: number): OpResult {
  if (isStale(state, i, expected)) return { state, message: STALE, stale: true };
  if (state.locked[i]) return { state, message: 'Kalsın işaretli slot değiştirilemez.' };
  const c = ctx.byId.get(candidateId);
  if (!c) return { state, message: 'Aday bulunamadı.' };
  // Rol, ADAY slota konmuş gibi hesaplanır (seri sınırları adayın gerçek ürün kimliğine bağlıdır)
  const role = roleFor({ ...state, slots: state.slots.map((s, j) => (j === i ? candidateId : s)) }, ctx, i);
  if (role !== 'none' && !text) return { state, message: 'Metin üretilmeden görsel değiştirilemez; mevcut öneri korundu.' };
  if (mode !== 'fill' && state.slots[i] === candidateId) return { state, message: 'Aday zaten bu slotta.' };
  const inPlan = new Set<string>([...ctx.storyIds, ...state.slots.filter((s, j) => j !== i && s).map((s) => s as string)]);
  const r = hardCheck(c, state.formats[i], { brand: ctx.brand, rejected: new Set(state.rejected), inPlan });
  if (r) return { state, message: `Aday artık uygun değil: ${HARD_LABEL[r]}; mevcut öneri korundu.` };
  const current = state.slots[i];
  const next = clone(state);
  if (mode === 'dismiss' && current) {
    next.dismissed = [...new Set([...state.dismissed, current])];
    next.seq = state.seq + 1;
    next.history = [...state.history, { seq: next.seq, slot: i, candidateId: current, text: state.texts[i] }];
  }
  put(next, i, c, ctx, text);
  return { state: next };
}

/** Yalnız metni (aynı görselle) yazar: ilk dolum için. Slot başka içeriğe geçmişse veya sürüm eskiyse yok sayılır. */
export function setSlotText(i: number, candidateId: string, text: SlotText | null, state: PlanState, expected?: number): OpResult {
  if (isStale(state, i, expected)) return { state, message: STALE, stale: true };
  if (state.slots[i] !== candidateId) return { state, message: 'Slot artık bu görseli tutmuyor; metin yok sayıldı.', stale: true };
  const next = clone(state);
  next.texts[i] = text;
  next.versions[i] = (next.versions[i] ?? 0) + 1;
  return { state: next };
}
