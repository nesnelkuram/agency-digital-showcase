/**
 * Aşama 3 istemci durum motoru (SAF; ağ/React yok): post başına fikir → seçim → caption → kontrol zinciri.
 *
 * Her aşama AYRI sürümlü durumdur ve bir BAĞLAMA (varlık + kırpım sürümü + kaynak sürümü) bağlıdır. Bağlam değişince aşamalar silinmez, "eski" olur
 * (insan düzenlemesi korunur); eski aşama yeni durum için geçerliymiş gibi KULLANILMAZ. Yanıtlar yalnız istek anındaki bağlam/sürümlerle
 * hâlâ eşleşiyorsa yazılır; eski başarı da eski hata da yeni duruma YAZILMAZ.
 *
 * Seçimsiz caption yok: caption/kontrol için GEÇERLİ bir seçim ve onun kanıt özeti (evidenceDigest) gerekir.
 */
import {
  ROLE_ATTEMPT_LIMIT, captionHash, type CaptionResponse, type CheckFinding, type CheckResponse, type CheckVerdict, type CreativeRole, type Evidence, type Idea, type IdeasResponse,
  type IntentKind, type SelectedIdea, type SourceMapEntry, type VoiceInfo, type CaptionDraft, type RecentContext, type PostIntent,
} from '../../../shared/planner/creativeContract';
import type { Candidate } from '../types';
import { PortError } from '../ports';
import type { PostText } from './postPlan';

/** Bir aşamanın dayandığı bağlam. sourceVersion: aday kaydından türetilen kaynak/analiz sürümü (istemci tarafı). */
export interface Binding {
  assetId: string;
  cropVersion: number;
  sourceVersion: string;
  /** Marka dili bağlamı: onaylı kaynak veya GEÇİCİ tonun içeriği. Ton/ses değişince önceki aşamalar eski olur (insan metni silinmez). Yoksa '' sayılır. */
  voiceSig?: string;
}
export const sameBinding = (a: Binding, b: Binding) => a.assetId === b.assetId && a.cropVersion === b.cropVersion && a.sourceVersion === b.sourceVersion && (a.voiceSig ?? '') === (b.voiceSig ?? '');
export const bindingSig = (b: Binding) => `${b.assetId}|${b.cropVersion}|${b.sourceVersion}|${b.voiceSig ?? ''}`;
/** Kaynak/analiz sürümü: kaynak içerik kimliği + analiz anahtarı + konu notu + ürün bağlantısı. Biri değişirse bu görselin kanıtı değişmiş olabilir. */
export const sourceVersionOf = (c: Candidate): string => [c.visual?.provenance.sourceSha256 || '?', c.visual?.provenance.analysisKey || '?', c.note || '', c.productId ?? ''].join('~');

export type StaleReason = 'eski_görsel' | 'eski_kırpım' | 'eski_kaynak' | 'eski_ses' | 'eski_niyet' | 'eski_fikir' | 'eski_metin' | 'eski_kanıt';
export type StageStatus = 'yok' | 'geçerli' | StaleReason;
export const STALE_LABEL: Record<StaleReason, string> = {
  eski_ses: 'ESKİ: marka dili / geçici ton değişti', eski_görsel: 'ESKİ: görsel değişti', eski_kırpım: 'ESKİ: kırpım sürümü değişti', eski_kaynak: 'ESKİ: kaynak/analiz sürümü değişti', eski_niyet: 'ESKİ: niyet değişti',
  eski_fikir: 'ESKİ: seçilen fikir değişti', eski_metin: 'ESKİ: metin değişti', eski_kanıt: 'ESKİ: görselin kanıtı değişti',
};

export function bindingDiff(a: Binding, cur: Binding): StaleReason | null {
  if (a.assetId !== cur.assetId) return 'eski_görsel';
  if (a.cropVersion !== cur.cropVersion) return 'eski_kırpım';
  if (a.sourceVersion !== cur.sourceVersion) return 'eski_kaynak';
  if ((a.voiceSig ?? '') !== (cur.voiceSig ?? '')) return 'eski_ses';
  return null;
}

export interface MetaView { model: string; promptVersion: string; cached: boolean; responseId: string | null; costUsd: number | null; budgetNotes: string[]; budgetTruncated: boolean }
export interface IntentState { kind: IntentKind | null; text: string; rev: number }
export interface IdeasStage { rev: number; binding: Binding; intentRev: number; status: 'ok' | 'bilgi_yetersiz'; ideas: Idea[]; missingInfo: string | null; evidence: Evidence; digest: string; voice: VoiceInfo; meta: MetaView | null; invalid: boolean }
export interface Selection {
  rev: number; binding: Binding; sourceIdeaId: 'i1' | 'i2' | 'i3'; mainMessage: string; creativeAngle: string; note: string; visualLink: string;
  factIds: string[]; productIds: string[]; brandIds: string[]; edited: boolean; evidenceDigest: string; invalid: boolean;
  /** Seçimin ÜRETİLDİĞİ niyet sürümü: niyet değişince seçim 'eski_niyet' olur (düzenleme korunur) */
  intentRev: number;
}
export interface CaptionStage { binding: Binding; selectionRev: number; textHash: string; sourceMap: SourceMapEntry[]; rationale: string; observation: string; evidenceBasis: string; contentHash: string; meta: MetaView | null; voice: VoiceInfo; warnings: string[] }
export interface CheckStage { binding: Binding; selectionRev: number; captionHash: string; verdict: CheckVerdict; summary: string; findings: CheckFinding[]; codeReasons: string[]; meta: MetaView | null; voice: VoiceInfo }
export interface TextHistoryItem { text: string; source: 'model' | 'manual'; why: string }

export interface Entry {
  postId: string;
  /** Tek yönlü sayaç: seçim/niyet sürümleri bundan türer */
  rev: number;
  intent: IntentState;
  ideas: IdeasStage | null;
  selection: Selection | null;
  /** İnsan DÜZENLEMESİ içeren, artık kullanılamayan seçimler: sessizce ezilmez, kullanıcı açıkça uygular veya atar */
  parked: Selection[];
  caption: CaptionStage | null;
  check: CheckStage | null;
  /** Rol başına ücretli (önbellek dışı) deneme sayısı; bağlam değişince sıfırlanır */
  attempts: Record<CreativeRole, { sig: string; n: number }>;
  textHistory: TextHistoryItem[];
}
export const MAX_PARKED = 3;
export const MAX_TEXT_HISTORY = 5;

export const emptyEntry = (postId: string): Entry => ({
  postId, rev: 0, intent: { kind: null, text: '', rev: 0 }, ideas: null, selection: null, parked: [], caption: null, check: null,
  attempts: { ideas: { sig: '', n: 0 }, caption: { sig: '', n: 0 }, check: { sig: '', n: 0 } }, textHistory: [],
});

const bump = (e: Entry): number => ++e.rev;
const copy = (e: Entry): Entry => ({ ...e, intent: { ...e.intent }, parked: [...e.parked], textHistory: [...e.textHistory], attempts: { ideas: { ...e.attempts.ideas }, caption: { ...e.attempts.caption }, check: { ...e.attempts.check } } });
export const textHash = (t: string) => captionHash(t);

// ── Durumlar ──
export function ideasStatus(e: Entry, cur: Binding): StageStatus {
  const s = e.ideas;
  if (!s) return 'yok';
  if (s.invalid) return 'eski_kanıt';
  const d = bindingDiff(s.binding, cur);
  if (d) return d;
  if (s.intentRev !== e.intent.rev) return 'eski_niyet';
  return 'geçerli';
}
export function selectionStatus(e: Entry, cur: Binding): StageStatus {
  const s = e.selection;
  if (!s) return 'yok';
  if (s.invalid) return 'eski_kanıt';
  const d = bindingDiff(s.binding, cur);
  if (d) return d;
  return s.intentRev !== e.intent.rev ? 'eski_niyet' : 'geçerli';
}
/** Caption durumu: metin + (model metniyse) seçim bağı. İnsanın elle yazdığı metin seçim bağından bağımsızdır ama görsel/kırpım/kaynak değişiminde ESKİ olur. */
export function captionStatus(e: Entry, text: PostText | null, cur: Binding): StageStatus {
  if (!text) return 'yok';
  if (text.assetId !== cur.assetId) return 'eski_görsel';
  if (text.cropVersion !== cur.cropVersion) return 'eski_kırpım';
  if (text.sourceVersion !== undefined && text.sourceVersion !== cur.sourceVersion) return 'eski_kaynak';
  if (text.voiceSig !== undefined && text.voiceSig !== (cur.voiceSig ?? '')) return 'eski_ses'; // ton/marka dili değişti: metin korunur ama güncel dile ait sayılmaz
  const c = e.caption;
  if (c && c.textHash === textHash(text.text)) {
    const d = bindingDiff(c.binding, cur);
    if (d) return d;
    if (!e.selection || c.selectionRev !== e.selection.rev) return 'eski_fikir';
    const ss = selectionStatus(e, cur);
    if (ss !== 'geçerli' && ss !== 'yok') return ss; // kanıt/niyet/bağlam değişti: seçime bağlı model caption'ı da eski
  }
  return 'geçerli';
}
export function checkStatus(e: Entry, text: PostText | null, cur: Binding): StageStatus {
  const k = e.check;
  if (!k) return 'yok';
  if (!text) return 'eski_metin';
  const d = bindingDiff(k.binding, cur);
  if (d) return d;
  if (!e.selection || k.selectionRev !== e.selection.rev) return 'eski_fikir';
  const ss = selectionStatus(e, cur);
  if (ss !== 'geçerli' && ss !== 'yok') return ss; // kanıt zinciri geçersizse eski kontrol YENİ duruma geçerli sayılmaz
  if (k.captionHash !== textHash(text.text)) return 'eski_metin';
  return 'geçerli';
}

export function attemptsUsed(e: Entry, role: CreativeRole, cur: Binding): number {
  const a = e.attempts[role];
  return a.sig === bindingSig(cur) ? a.n : 0;
}
export const attemptsLeft = (e: Entry, role: CreativeRole, cur: Binding) => Math.max(0, ROLE_ATTEMPT_LIMIT - attemptsUsed(e, role, cur));

// ── Çağrı öncesi koruma (UI model çağrısından ÖNCE sürümleri doğrular) ──
export type Block = { ok: true } | { ok: false; why: string; kind: 'sinir' | 'secim' | 'kilit' | 'korunan_metin' | 'eski' | 'hazir_degil' };
export function canRun(role: CreativeRole, e: Entry, cur: Binding, ctx: { text: PostText | null; locked: boolean; overwriteHuman: boolean; ready: boolean; refresh?: boolean }): Block {
  if (!ctx.ready) return { ok: false, why: 'Kırpılmış görünüm ölçümleri tamamlanmadı.', kind: 'hazir_degil' };
  if (attemptsLeft(e, role, cur) <= 0 && !ctx.refresh) return { ok: false, why: `Bu görsel/kırpım sürümü için ${ROLE_ATTEMPT_LIMIT} ücretli deneme kullanıldı; görsel, kırpım veya kaynak değişince sıfırlanır.`, kind: 'sinir' };
  if (attemptsLeft(e, role, cur) <= 0) return { ok: false, why: `Bu görsel/kırpım sürümü için ${ROLE_ATTEMPT_LIMIT} ücretli deneme kullanıldı.`, kind: 'sinir' };
  if (role === 'ideas') return { ok: true };
  const sel = selectionStatus(e, cur);
  if (!e.selection || sel !== 'geçerli') return { ok: false, why: e.selection ? `Seçilen fikir ${STALE_LABEL[sel as StaleReason].toLowerCase()}; yeni fikir üretip yeniden seçin (düzenlemeniz korunur).` : 'Önce üç fikirden birini SEÇİN; seçimsiz caption/kontrol yok.', kind: e.selection ? 'eski' : 'secim' };
  if (role === 'caption') {
    const st = captionStatus(e, ctx.text, cur);
    if (ctx.text && ctx.locked && st === 'geçerli') return { ok: false, why: 'Kilitli postun geçerli metni var; kilidi kaldırmadan ezilemez.', kind: 'kilit' };
    if (ctx.text && ctx.text.source === 'manual' && st === 'geçerli' && !ctx.overwriteHuman) return { ok: false, why: 'Bu metni siz yazdınız/düzenlediniz; üzerine yazmak için onay kutusunu işaretleyin (önceki metin geçmişte saklanır).', kind: 'korunan_metin' };
    return { ok: true };
  }
  if (!ctx.text) return { ok: false, why: 'Kontrol edilecek metin yok.', kind: 'secim' };
  const cs = captionStatus(e, ctx.text, cur);
  if (cs !== 'geçerli') return { ok: false, why: `Metin ${STALE_LABEL[cs as StaleReason].toLowerCase()}; kontrol yalnız güncel metne yapılır.`, kind: 'eski' };
  return { ok: true };
}

// ── Yanıtlar ──
export type Accept<T> = { ok: true; entry: Entry } & T | { ok: false; why: string };

const metaOf = (m: IdeasResponse['meta'], r: { cached: boolean; budget: { notes: string[]; truncated: boolean } | null }): MetaView | null =>
  m ? { model: m.model, promptVersion: m.promptVersion, cached: r.cached, responseId: m.responseId, costUsd: m.usage?.costUsd ?? null, budgetNotes: r.budget?.notes ?? [], budgetTruncated: r.budget?.truncated ?? false } : null;

const bumpAttempt = (e: Entry, role: CreativeRole, b: Binding, paid: boolean) => {
  const sig = bindingSig(b);
  const a = e.attempts[role];
  e.attempts[role] = { sig, n: (a.sig === sig ? a.n : 0) + (paid ? 1 : 0) };
};

export function setIntent(e: Entry, kind: IntentKind | null, text: string): Entry {
  const n = copy(e);
  n.intent = { kind, text: text.trim().slice(0, 200), rev: bump(n) };
  return n;
}

export function acceptIdeas(e: Entry, r: IdeasResponse, snap: { binding: Binding; intentRev: number }, cur: Binding): Accept<{}> {
  if (!sameBinding(snap.binding, cur)) return { ok: false, why: `Fikir yanıtı geldiğinde ${STALE_LABEL[bindingDiff(snap.binding, cur)!].toLowerCase()}; yok sayıldı.` };
  if (snap.intentRev !== e.intent.rev) return { ok: false, why: 'Fikir yanıtı geldiğinde niyet değişmişti; yok sayıldı.' };
  const n = copy(e);
  bumpAttempt(n, 'ideas', cur, !r.cached && !!r.meta);
  n.ideas = { rev: bump(n), binding: cur, intentRev: n.intent.rev, status: r.status, ideas: r.ideas, missingInfo: r.missingInfo, evidence: r.evidence, digest: r.evidence.digest, voice: r.voice, meta: metaOf(r.meta, r), invalid: false };
  return { ok: true, entry: n };
}

const toSelection = (n: Entry, idea: Idea, st: IdeasStage, human?: { mainMessage: string; creativeAngle: string; note: string }): Selection => ({
  rev: bump(n), binding: st.binding, sourceIdeaId: idea.id, mainMessage: human?.mainMessage ?? idea.mainMessage, creativeAngle: human?.creativeAngle ?? idea.creativeAngle, note: human?.note ?? '',
  visualLink: idea.visualLink, factIds: idea.basis.factIds, productIds: idea.basis.productIds, brandIds: idea.basis.brandIds, edited: !!human, evidenceDigest: st.digest, invalid: false, intentRev: st.intentRev,
});
const park = (n: Entry) => {
  const s = n.selection;
  if (s && s.edited) n.parked = [s, ...n.parked].slice(0, MAX_PARKED); // insan düzenlemesi SESSİZCE ezilmez
};

/** Üç fikirden birini AÇIKÇA seçer. Mevcut seçimde insan düzenlemesi varsa ezilmez: "park edilir" (kullanıcı uygular veya atar). */
export function selectIdea(e: Entry, ideaId: Idea['id'], cur: Binding): Accept<{}> {
  const st = e.ideas;
  if (!st) return { ok: false, why: 'Önce fikir üretin.' };
  const stale = ideasStatus(e, cur);
  if (stale !== 'geçerli') return { ok: false, why: `Bu fikirler ${STALE_LABEL[stale as StaleReason].toLowerCase()}; yeni fikir üretip ondan seçin (düzenlemeniz korunur).` };
  const idea = st.ideas.find((i) => i.id === ideaId);
  if (!idea) return { ok: false, why: 'Fikir bulunamadı.' };
  const n = copy(e);
  park(n);
  n.selection = toSelection(n, idea, st);
  return { ok: true, entry: n };
}

/** İnsan düzenlemesi: ana mesaj / yaratıcı açı / not. Seçim sürümü artar → önceki caption ve kontrol "eski: fikir değişti" olur (silinmez). */
export function editSelection(e: Entry, patch: { mainMessage?: string; creativeAngle?: string; note?: string }, cur: Binding): Accept<{}> {
  if (!e.selection || selectionStatus(e, cur) !== 'geçerli') return { ok: false, why: 'Düzenlenecek geçerli bir seçim yok.' };
  const mainMessage = (patch.mainMessage ?? e.selection.mainMessage).trim().slice(0, 200);
  const creativeAngle = (patch.creativeAngle ?? e.selection.creativeAngle).trim().slice(0, 240);
  const note = (patch.note ?? e.selection.note).trim().slice(0, 240);
  if (!mainMessage || !creativeAngle) return { ok: false, why: 'Ana mesaj ve yaratıcı açı boş olamaz.' };
  if (mainMessage === e.selection.mainMessage && creativeAngle === e.selection.creativeAngle && note === e.selection.note) return { ok: false, why: 'Değişiklik yok.' };
  const n = copy(e);
  n.selection = { ...e.selection, mainMessage, creativeAngle, note, edited: true, rev: bump(n) };
  return { ok: true, entry: n };
}

/** Park edilmiş (eski görsel/kaynak için yazılmış) insan düzenlemesini, GEÇERLİ yeni fikirlerden birinin dayanağıyla birleştirir. Açık kullanıcı eylemi. */
export function adoptParked(e: Entry, parkedIndex: number, ideaId: Idea['id'], cur: Binding): Accept<{}> {
  const st = e.ideas;
  const p = e.parked[parkedIndex];
  if (!p) return { ok: false, why: 'Korunan düzenleme bulunamadı.' };
  if (!st || ideasStatus(e, cur) !== 'geçerli') return { ok: false, why: 'Önce güncel durum (görsel/kırpım/kaynak/niyet) için yeni fikir üretin.' };
  const idea = st.ideas.find((i) => i.id === ideaId);
  if (!idea) return { ok: false, why: 'Fikir bulunamadı.' };
  const n = copy(e);
  park(n);
  n.parked = n.parked.filter((x) => x !== p && x.rev !== p.rev);
  n.selection = toSelection(n, idea, st, { mainMessage: p.mainMessage, creativeAngle: p.creativeAngle, note: p.note });
  return { ok: true, entry: n };
}
export function discardParked(e: Entry, parkedIndex: number): Entry {
  const n = copy(e);
  n.parked.splice(parkedIndex, 1);
  return n;
}

/**
 * Bağlam değişince (görsel/kırpım/kaynak) seçim GEÇERSİZ kalır ama İNSAN DÜZENLEMESİ varsa park edilir. Çağrı yeri: yeni fikir kabulünde.
 * (Eski seçim bağlamı farklıysa ve düzenlenmişse parked'a taşınır; aksi halde bırakılır — durum zaten 'eski_*' görünür.)
 */
export function parkStaleSelection(e: Entry, cur: Binding): Entry {
  if (!e.selection || !e.selection.edited) return e;
  if (selectionStatus(e, cur) === 'geçerli') return e;
  const n = copy(e);
  park(n);
  n.selection = null;
  return n;
}

export function acceptCaption(e: Entry, r: CaptionResponse, snap: { binding: Binding; selectionRev: number }, cur: Binding, prev: { text: PostText | null }): Accept<{ textHash: string }> {
  if (!sameBinding(snap.binding, cur)) return { ok: false, why: `Caption yanıtı geldiğinde ${STALE_LABEL[bindingDiff(snap.binding, cur)!].toLowerCase()}; yok sayıldı.` };
  if (!e.selection || e.selection.rev !== snap.selectionRev || selectionStatus(e, cur) !== 'geçerli') return { ok: false, why: 'Caption yanıtı geldiğinde seçilen fikir/kanıt zinciri değişmişti veya geçersizdi; yok sayıldı.' };
  const n = copy(e);
  bumpAttempt(n, 'caption', cur, !r.cached && !!r.meta);
  const h = textHash(r.caption.text);
  n.caption = { binding: cur, selectionRev: snap.selectionRev, textHash: h, sourceMap: r.caption.sourceMap, rationale: r.caption.rationale, observation: r.caption.observation, evidenceBasis: r.caption.evidenceBasis, contentHash: r.caption.contentHash, meta: metaOf(r.meta, r), voice: r.voice, warnings: r.caption.warnings };
  if (prev.text && prev.text.text !== r.caption.text) n.textHistory = [{ text: prev.text.text, source: prev.text.source, why: 'yeni caption üretilirken değiştirildi' }, ...n.textHistory].slice(0, MAX_TEXT_HISTORY);
  n.check = e.check; // kontrol silinmez: metin değişince 'eski_metin' görünür
  return { ok: true, entry: n, textHash: h };
}

export function pushHistory(e: Entry, item: TextHistoryItem): Entry {
  const n = copy(e);
  n.textHistory = [item, ...n.textHistory].slice(0, MAX_TEXT_HISTORY);
  return n;
}

export function acceptCheck(e: Entry, r: CheckResponse, snap: { binding: Binding; selectionRev: number; captionHash: string }, cur: Binding, currentText: PostText | null): Accept<{}> {
  if (!sameBinding(snap.binding, cur)) return { ok: false, why: `Kontrol yanıtı geldiğinde ${STALE_LABEL[bindingDiff(snap.binding, cur)!].toLowerCase()}; yok sayıldı.` };
  if (!e.selection || e.selection.rev !== snap.selectionRev) return { ok: false, why: 'Kontrol yanıtı geldiğinde seçilen fikir değişmişti; yok sayıldı.' };
  // Geçersizleşmiş zincir (kanıt değişti / niyet değişti) geç yanıtla CANLANMAZ
  if (selectionStatus(e, cur) !== 'geçerli') return { ok: false, why: 'Kontrol yanıtı geldiğinde seçim/kanıt zinciri geçersizdi; yok sayıldı.' };
  if (!currentText || textHash(currentText.text) !== snap.captionHash || r.captionHash !== snap.captionHash) return { ok: false, why: 'Kontrol yanıtı geldiğinde metin değişmişti; yok sayıldı.' };
  const n = copy(e);
  bumpAttempt(n, 'check', cur, !r.cached && !!r.meta);
  n.check = { binding: cur, selectionRev: snap.selectionRev, captionHash: snap.captionHash, verdict: r.verdict, summary: r.summary, findings: r.findings, codeReasons: r.codeReasons, meta: metaOf(r.meta, r), voice: r.voice };
  return { ok: true, entry: n };
}

/** Sunucu 409 evidence_changed: kanıt değişti → fikir ve seçim "eski_kanıt" (insan düzenlemesi KORUNUR, silinmez) */
export function markEvidenceChanged(e: Entry): Entry {
  const n = copy(e);
  if (n.ideas) n.ideas = { ...n.ideas, invalid: true };
  if (n.selection) n.selection = { ...n.selection, invalid: true };
  return n;
}

// ── İstek kurma ──
export const selectedIdeaOf = (s: Selection): SelectedIdea => ({
  sourceIdeaId: s.sourceIdeaId, mainMessage: s.mainMessage, creativeAngle: s.creativeAngle, note: s.note, visualLink: s.visualLink, factIds: s.factIds, productIds: s.productIds, brandIds: s.brandIds, edited: s.edited,
});
export const captionDraftOf = (e: Entry, text: PostText, locked: boolean): CaptionDraft => {
  const model = e.caption && e.caption.textHash === textHash(text.text);
  return { text: text.text, sourceMap: model ? e.caption!.sourceMap : [], rationale: model ? e.caption!.rationale : '', humanEdited: text.source === 'manual', locked };
};
export const intentOf = (e: Entry): PostIntent | undefined => (e.intent.kind || e.intent.text ? { kind: e.intent.kind, text: e.intent.text } : undefined);

/** Yakın geçmiş (bütçeli): planın DİĞER postlarının geçerli seçilmiş fikirleri ve geçerli metinleri; profil sırası (en yeni önce) */
export function recentOf(items: Array<{ postId: string; entry: Entry | undefined; text: PostText | null; binding: Binding }>, selfId: string): RecentContext {
  const ideas: string[] = [];
  const texts: string[] = [];
  for (const it of items) {
    if (it.postId === selfId) continue;
    if (it.entry?.selection && selectionStatus(it.entry, it.binding) === 'geçerli') ideas.push(it.entry.selection.mainMessage.slice(0, 200));
    if (it.text && it.entry && captionStatus(it.entry, it.text, it.binding) === 'geçerli') texts.push(it.text.text.slice(0, 400));
  }
  return { ideas: ideas.slice(0, 12), texts: texts.slice(0, 20) };
}

// ── Hata sınıfları (rol hatası, eksik bilgi, geçersiz çıktı, iptal, kapalı… AYRI) ──
export type FailureKind = 'engellendi' | 'kapalı' | 'iptal' | 'eksik_bilgi' | 'geçersiz_çıktı' | 'eski_kanıt' | 'devam_ediyor' | 'rol_hatası' | 'ses_yok';
export interface Failure { kind: FailureKind; message: string; details?: string[] }
export const FAILURE_LABEL: Record<FailureKind, string> = {
  engellendi: 'Çağrı yapılmadı',
  kapalı: 'Üretim kapalı', iptal: 'İptal edildi', eksik_bilgi: 'Eksik bilgi', geçersiz_çıktı: 'Geçersiz yapılandırılmış çıktı', eski_kanıt: 'Kanıt değişti', devam_ediyor: 'Aynı istek sürüyor', rol_hatası: 'Rol hatası', ses_yok: 'Marka dili yok',
};
export function failureOf(err: unknown): Failure {
  if (err instanceof DOMException && err.name === 'AbortError') return { kind: 'iptal', message: 'İptal edildi; sağlayıcıda tamamlanmış olabilir ama yanıt yok sayıldı.' };
  if (err instanceof PortError) {
    const d = err.details as { reasons?: string[]; reason?: string } | undefined;
    const reasons = Array.isArray(d?.reasons) ? d!.reasons!.slice(0, 6) : undefined;
    switch (err.code) {
      case 'feature_disabled': case 'model_unavailable': return { kind: 'kapalı', message: err.message };
      case 'brand_voice_missing': return { kind: 'ses_yok', message: err.message };
      case 'evidence_insufficient': return { kind: 'eksik_bilgi', message: err.message };
      case 'evidence_changed': return { kind: 'eski_kanıt', message: err.message };
      case 'in_progress': return { kind: 'devam_ediyor', message: err.message };
      case 'invalid_output': return { kind: 'geçersiz_çıktı', message: err.message, details: reasons };
      case 'abort': return { kind: 'iptal', message: 'İptal edildi.' };
      default: return { kind: 'rol_hatası', message: `${err.message}${err.code ? ` [${err.code}]` : ''}` };
    }
  }
  if (err instanceof Error && err.name === 'AbortError') return { kind: 'iptal', message: 'İptal edildi; sağlayıcıda tamamlanmış olabilir ama yanıt yok sayıldı.' };
  return { kind: 'rol_hatası', message: err instanceof Error ? err.message : 'Bilinmeyen hata' };
}
