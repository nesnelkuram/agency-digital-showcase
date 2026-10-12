import type { Candidate } from '../types';
import { hardCheck, scoreCandidate, type Scored } from '../scorer';
import { defaultFocusOf, type EffectiveCrop, type GridCtx, type Placed } from '../compositionFit';
import { FULL_FRAME_EPS, cropWindow, type CropEvalCache } from '../../../shared/planner/visualDecision';
import type { FormatId } from '../types';

/**
 * Post (Instagram feed) planı — DEĞİŞKEN SAYILI, ilişkisel, saf durum makinesi. Model/ağ çağrısı YOK; metin ayrı bir sonraki adımdır.
 *
 * Biçim: yalnız 1080×1350 px (4:5). Plan düzeni PROFİL SIRASIDIR: indeks 0 = en yeni / sol üst; 3 sütun; son sıra kısmi olabilir.
 * YAYIN (kronolojik) sırası bunun tersidir: indeks N-1 ilk yayınlanır, indeks 0 son yayınlanır (bkz. postViews.ts). Mevcut yayınlar
 * (geçmiş snapshot) profilde plan bloğundan SONRA gelir ve komşuluk/ritim/grid değerlendirmesine girer.
 *
 * Kimlikler kararlıdır: post kimliği (`p1`…) hiç yeniden kullanılmaz; dizi indeksi varlığın/postun kimliği DEĞİLDİR. Her içerik değişimi
 * (görsel, kırpım, kilit, metin) post sürümünü GLOBAL tek yönlü sayaçtan yükseltir; sürümle gelen eski işlem/yanıt yok sayılır.
 *
 * İki AYRI kilit: assetLock ("Görseli koru") varlığı seçimde tutar, konum serbesttir (yeniden düzenleme/silme-kompaktlaştırma onu
 * kaydırabilir). posLock ("Yerini de koru") varlığı VE profil konumunu birlikte tutar; posLock assetLock'u gerektirir.
 */
export const POST_FORMAT: FormatId = 'feed-4x5';
export const POST_SIZE = { w: 1080, h: 1350 } as const;
export const POST_RATIO = 4 / 5;
export const POST_COLS = 3;
export const MAX_POSTS = 30;
export const UNDO_LIMIT = 50;
/** Aynı satırda toplam puan farkı bu eşiğin altındaysa "iyileşme" sayılmaz (kararsız salınımı önler) */
const EPS = 0.1;

export interface Focus {
  x: number;
  y: number;
}
/** Kırpım DÜZENLEMESİ (orijinal kaynak değişmez). focus null = otomatik (konu merkezli). version her düzenlemede artar ve ASLA geri düşmez. */
export interface CropEdit {
  focus: Focus | null;
  zoom: number;
  version: number;
}
export interface PostText {
  text: string;
  source: 'model' | 'manual';
  /** Metnin yazıldığı varlık ve kırpım sürümü: bunlar değişirse metin GEÇERSİZLEŞİR (eski) */
  assetId: string;
  cropVersion: number;
  /** Yazıldığı plan revizyonu (geri alırken yeni metni korumak için) */
  rev: number;
  responseId?: string;
  contentHash?: string;
  evidenceBasis?: string;
  voiceSource?: string;
  promptVersion?: string;
  observation?: string;
  rationale?: string;
  assumptions?: string[];
  /** Sunucunun kırpımda görünür saydığı olgu kapsamı (model metni için) */
  facts?: 'tam' | 'yalnız_konu' | 'yok';
  /** Metnin yazıldığı kaynak/analiz sürümü (istemci türevi): değişirse metin 'eski_kaynak' olur */
  sourceVersion?: string;
  /** Metnin yazıldığı marka dili/geçici ton bağlamı (istemci türevi) */
  voiceSig?: string;
}
export interface Post {
  id: string;
  assetId: string;
  assetLock: boolean;
  posLock: boolean;
  version: number;
  text: PostText | null;
}
interface Intent {
  requested: number;
  posts: Post[];
  crops: Record<string, CropEdit>;
  dismissed: string[];
  rejected: string[];
  nextId: number;
}
export interface LayoutCell {
  /** Plan hücresinin O ANKİ kırpım düzenlemesi (null = otomatik). Önce/sonra önizlemeleri her anlık görüntünün KENDİ kırpımıyla çizilir; geçmiş hücrelerde yok. */
  crop?: CropEdit | null;
  idx: number;
  id: string | null;
  assetId: string;
  assetLock: boolean;
  posLock: boolean;
  kind: 'plan' | 'history';
}
export interface PlanChange {
  label: string;
  before: LayoutCell[];
  after: LayoutCell[];
  notes: string[];
}
interface UndoEntry {
  label: string;
  rev: number;
  snap: Intent;
}
export interface PostPlan extends Intent {
  rev: number;
  undo: UndoEntry[];
  lastChange: PlanChange | null;
}

export interface PostEnv {
  brand: string;
  /** Aday havuzu. `aesthetics`, NİHAİ 4:5 kırpılmış görünümden ölçülmüş olmalıdır (orijinalinki kopyalanmaz); yoksa pikseller bilinmiyor sayılır. */
  byId: Map<string, Candidate>;
  /** Mevcut yayınlar (geçmiş snapshot), en yeni önce. Profilde plan bloğundan sonra gelir. */
  history: Candidate[];
  cache?: CropEvalCache;
}

export interface Conflict {
  kind: 'delete';
  postId: string;
  /** Çatışmanın hesaplandığı plan revizyonu: eskimiş önizleme uygulanamaz */
  planRev: number;
  reason: string;
  conflictingIds: string[];
  before: LayoutCell[];
  /** "Konum kilitlerini kaldır" seçeneği uygulanırsa oluşacak düzen */
  afterRelease: LayoutCell[];
  options: Array<{ id: ConflictOption; label: string }>;
}
export type ConflictOption = 'cancel' | 'release_and_delete';
export interface OpResult {
  plan: PostPlan;
  message?: string;
  /** Eski sürümle gelen işlem: hiçbir şey değişmedi */
  stale?: boolean;
  conflict?: Conflict;
}

export const emptyPostPlan = (): PostPlan => ({ requested: 0, posts: [], crops: {}, dismissed: [], rejected: [], nextId: 1, rev: 0, undo: [], lastChange: null });

// ── Yardımcılar ──

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const intentOf = (p: PostPlan): Intent => clone({ requested: p.requested, posts: p.posts, crops: p.crops, dismissed: p.dismissed, rejected: p.rejected, nextId: p.nextId });
export const cropVersionOf = (plan: Pick<PostPlan, 'crops'>, assetId: string) => plan.crops[assetId]?.version ?? 0;

/** Adayın ETKİN kırpımı: manuel (focus+zoom) veya otomatik (konu merkezli, zoom 1) */
export function effectiveCrop(plan: Pick<PostPlan, 'crops'>, c: Candidate): EffectiveCrop {
  const e = plan.crops[c.id];
  if (!e) return { focus: defaultFocusOf(c), zoom: 1 };
  return { focus: e.focus ?? defaultFocusOf(c), zoom: e.zoom };
}

/** 3 sütunlu ızgarada 4 yönlü komşu hücreler (toplam hücre sayısı sınırlı; son sıra kısmi olabilir) */
export function neighborIdx(i: number, total: number): number[] {
  const out: number[] = [];
  if (i - POST_COLS >= 0) out.push(i - POST_COLS);
  if (i + POST_COLS < total) out.push(i + POST_COLS);
  if (i % POST_COLS > 0) out.push(i - 1);
  if (i % POST_COLS < POST_COLS - 1 && i + 1 < total) out.push(i + 1);
  return out.sort((a, b) => a - b);
}
export const rowsOf = (n: number) => Math.ceil(n / POST_COLS);

export function layoutOf(posts: Post[], history: Candidate[] = [], crops: Record<string, CropEdit> = {}): LayoutCell[] {
  return [
    ...posts.map((p, idx) => ({ idx, id: p.id, assetId: p.assetId, assetLock: p.assetLock || p.posLock, posLock: p.posLock, kind: 'plan' as const, crop: crops[p.assetId] ?? null })),
    ...history.map((c, k) => ({ idx: posts.length + k, id: null, assetId: c.id, assetLock: false, posLock: false, kind: 'history' as const })),
  ];
}

// ── Puanlama (kayıtlı analiz + nihai kırpım; model/ağ yok) ──

type Layout = Array<string | null>;

/**
 * `cand` adayı `layout[idx]` konumundayken (başka hücreler olduğu gibi) bağlamsal puanı: profil komşuları (geçmiş dahil), satır üçlüsü,
 * tüm grid, kırpım etkisi, renk/ritim/tekrar ve kullanım geçmişi. Kırpım etkin kırpımdır (manuel ya da otomatik).
 */
export function scoreAt(layout: Layout, crops: Pick<PostPlan, 'crops'>, idx: number, cand: Candidate, env: PostEnv): Scored {
  const planCands: Array<Candidate | null> = layout.map((id, j) => (j === idx ? cand : id ? env.byId.get(id) ?? null : null));
  if (idx >= planCands.length) planCands[idx] = cand;
  const cells = [...planCands, ...env.history];
  const placed = new Map<number, Placed>();
  cells.forEach((c, j) => {
    if (j !== idx && c) placed.set(j, { c, format: POST_FORMAT });
  });
  const nb = neighborIdx(idx, cells.length);
  const grid: GridCtx = { slot: idx, lane: 'feed', placed, neighborSlots: nb, slotCount: cells.length, cache: env.cache, cropFor: (c) => effectiveCrop(crops, c), finalCropOnly: true };
  // Tam-kaynak yorumlar (çekim ölçeği/konum, katalog kaynaklı) kırpılmış görünümde YEREL doğrulanamaz: kırpılan adayda bilinmiyor sayılır
  const lc = (c: Candidate) => localizeSemantic(c, crops, env);
  return scoreCandidate(
    lc(cand),
    POST_FORMAT,
    nb.map((j) => cells[j]).filter((c): c is Candidate => !!c).map(lc),
    planCands.filter((c, j): c is Candidate => j !== idx && !!c).map(lc),
    env.history.map(lc),
    grid,
  );
}

/** Etkin kırpım kareyi gerçekten kesiyorsa tam-kaynak anlamsal çekim bilgisi (ölçek/konum) bilinmiyor sayılır; aksi halde aday aynen döner. */
function localizeSemantic(c: Candidate, crops: Pick<PostPlan, 'crops'>, _env: PostEnv): Candidate {
  const e = effectiveCrop(crops, c);
  const w = cropWindow(c.dims, POST_RATIO, e.focus, e.zoom);
  if (w.w * w.h >= 1 - FULL_FRAME_EPS) return c;
  if (c.semantic.shotScale === 'bilinmiyor' && c.semantic.subjectPos === 'bilinmiyor') return c;
  return { ...c, semantic: { ...c.semantic, shotScale: 'bilinmiyor', subjectPos: 'bilinmiyor' } };
}

export interface PlanEvaluation {
  total: number;
  perPost: Array<{ id: string; assetId: string; idx: number; total: number; notes: string[]; unknown: string[] }>;
  notes: string[];
}
/** Bütün planın uyumunu yeniden hesaplar (her post, diğer tüm hücreler yerindeyken). Kayıtlı veri + nihai kırpım; çağrı yok. */
export function evaluatePlan(plan: Pick<PostPlan, 'posts' | 'crops'>, env: PostEnv): PlanEvaluation {
  const layout: Layout = plan.posts.map((p) => p.assetId);
  const per = plan.posts.map((p, idx) => {
    const c = env.byId.get(p.assetId);
    if (!c) return { id: p.id, assetId: p.assetId, idx, total: 0, notes: ['varlık havuzda yok'], unknown: [] as string[] };
    const s = scoreAt(layout, plan, idx, c, env);
    return { id: p.id, assetId: p.assetId, idx, total: s.exact, notes: s.compositionNotes, unknown: s.compositionUnknown as string[] };
  });
  const total = per.length ? per.reduce((a, b) => a + b.total, 0) / per.length : 0;
  return { total: Math.round(total * 10) / 10, perPost: per, notes: [...new Set(per.flatMap((x) => x.notes))].slice(0, 8) };
}

// ── Aday havuzu ve kapasite ──

/** Marka, yayımlanmış-olmama, ret/ele, biçim (4:5 kapsama), hazırlık ve plan-içi tekrar sert kısıtlarını geçen adaylar (kimlik sırası) */
export function eligiblePool(plan: Pick<PostPlan, 'rejected' | 'dismissed'>, env: PostEnv, inPlan: Set<string>, opts: { includeDismissed?: boolean; exclude?: Set<string> } = {}): Candidate[] {
  const rejected = new Set(plan.rejected);
  const dismissed = new Set(plan.dismissed);
  const out: Candidate[] = [];
  for (const c of env.byId.values()) {
    if (c.published || c.brand !== env.brand) continue;
    if (!opts.includeDismissed && dismissed.has(c.id)) continue;
    if (opts.exclude?.has(c.id)) continue;
    if (hardCheck(c, POST_FORMAT, { brand: env.brand, rejected, inPlan })) continue;
    out.push(c);
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

export interface Capacity {
  requested: number;
  filled: number;
  /** Plana girebilecek DAHA fazla uygun, tekrarsız aday sayısı */
  available: number;
  shortfall: number;
  note: string | null;
}
export function capacityOf(plan: Pick<PostPlan, 'requested' | 'posts' | 'rejected' | 'dismissed'>, env: PostEnv): Capacity {
  const inPlan = new Set(plan.posts.map((p) => p.assetId));
  const available = eligiblePool(plan, env, inPlan).length;
  const filled = plan.posts.length;
  const shortfall = Math.max(0, plan.requested - filled);
  return {
    requested: plan.requested,
    filled,
    available,
    shortfall,
    note: shortfall > 0 ? `İstenen ${plan.requested} post; yalnız ${filled} uygun görsel var. Eksik ${shortfall} post sahte veya tekrarlı görselle DOLDURULMADI.` : null,
  };
}

function bestFor(layout: Layout, plan: Pick<PostPlan, 'crops'>, idx: number, env: PostEnv, pool: Candidate[]): { c: Candidate; s: Scored } | null {
  let best: { c: Candidate; s: Scored } | null = null;
  for (const c of pool) {
    const s = scoreAt(layout, plan, idx, c, env);
    if (!best || s.exact > best.s.exact + 1e-9 || (Math.abs(s.exact - best.s.exact) <= 1e-9 && c.id < best.c.id)) best = { c, s };
  }
  return best;
}

// ── Değişiklik kaydı, geri alma ve sürüm ──

const bump = (plan: PostPlan): number => ++plan.rev;

function describeChange(before: Post[], after: Post[]): string[] {
  const notes: string[] = [];
  const b = new Map(before.map((p, i) => [p.id, { p, i }]));
  const a = new Map(after.map((p, i) => [p.id, { p, i }]));
  for (const [id, { p, i }] of a) {
    const o = b.get(id);
    if (!o) notes.push(`${id} eklendi (konum ${i + 1})`);
    else {
      if (o.p.assetId !== p.assetId) notes.push(`${id}: görsel ${o.p.assetId} → ${p.assetId}`);
      if (o.i !== i) notes.push(`${id}: konum ${o.i + 1} → ${i + 1}`);
      if (o.p.assetLock !== p.assetLock || o.p.posLock !== p.posLock) notes.push(`${id}: kilit değişti`);
    }
  }
  for (const id of b.keys()) if (!a.has(id)) notes.push(`${id} silindi`);
  return notes;
}

function finish(prev: PostPlan, next: PostPlan, label: string, env: PostEnv | null, message?: string): OpResult {
  const hist = env?.history ?? [];
  next.rev++; // her yapısal işlem plan revizyonunu ilerletir (eskimiş çatışma önizlemesi uygulanamaz)
  next.undo = withUndoFrom(prev, label);
  next.lastChange = { label, before: layoutOf(prev.posts, hist, prev.crops), after: layoutOf(next.posts, hist, next.crops), notes: describeChange(prev.posts, next.posts) };
  return { plan: next, ...(message ? { message } : {}) };
}
function withUndoFrom(prev: PostPlan, label: string): UndoEntry[] {
  return [...prev.undo.slice(-(UNDO_LIMIT - 1)), { label, rev: prev.rev, snap: intentOf(prev) }];
}
const cloneFor = (p: PostPlan): PostPlan => ({ ...clone({ requested: p.requested, posts: p.posts, crops: p.crops, dismissed: p.dismissed, rejected: p.rejected, nextId: p.nextId }), rev: p.rev, undo: p.undo, lastChange: p.lastChange });

const STALE = 'Bu post zaten değişti; işlem yok sayıldı.';
const isStale = (p: Post, expected?: number) => expected !== undefined && p.version !== expected;
const LOCKED_MSG = 'Kilitli post değiştirilemez/silinemez; önce kilidi kaldırın.';

// ── Plan oluşturma ──

const clampN = (n: number) => Math.max(0, Math.min(MAX_POSTS, Math.floor(Number.isFinite(n) ? n : 0)));

/**
 * N post için görsel plan. Kilitli postlar korunur: konum kilitli olanlar AYNI profil konumunda, yalnız görsel kilitli olanlar mümkünse
 * mevcut konumlarında (gerekirse başka boş konuma). Kalan konumlar sırayla, hedef konuma ve o ana kadarki plana uyumuna göre seçilir;
 * ardından kilitsiz konumlar bir kez daha bağlamda iyileştirilir. Yetersiz aday: eksik kapasite açıkça söylenir, tekrarlı doldurma YOK.
 */
export function planPosts(prev: PostPlan | null, nRequested: number, env: PostEnv): OpResult {
  const base = prev ?? emptyPostPlan();
  const n = clampN(nRequested);
  if (n < 1) return { plan: base, message: 'Post sayısı en az 1 olmalı.' };
  const locked = base.posts.filter((p) => p.assetLock || p.posLock);
  if (locked.length > n) return { plan: base, message: `Kilitli ${locked.length} post var; istenen sayı (${n}) bundan az olamaz. Önce bazı kilitleri kaldırın.` };
  const lockedAssets = new Set(locked.map((p) => p.assetId));
  const pool0 = eligiblePool(base, env, lockedAssets, { exclude: lockedAssets });
  // Kilitli varlığın kendisi artık geçersizse (arşivlendi/başka marka) dürüstçe söylenir ama KALDIRILMAZ
  const target = Math.min(n, locked.length + pool0.length);
  const posLocked = locked.filter((p) => p.posLock);
  const outside = posLocked.filter((p) => base.posts.indexOf(p) >= target);
  if (outside.length) return { plan: base, message: `Konum kilitli post(lar) (${outside.map((p) => p.id).join(', ')}) hedef sayının (${target}) dışında kalıyor; kilidi kaldırın veya sayıyı artırın.` };

  const next = cloneFor(base);
  next.requested = n;
  const slots: Array<Post | null> = Array(target).fill(null);
  for (const p of posLocked) slots[base.posts.indexOf(p)] = next.posts.find((x) => x.id === p.id)!;
  for (const p of locked.filter((x) => !x.posLock)) {
    const cur = base.posts.indexOf(p);
    const q = next.posts.find((x) => x.id === p.id)!;
    if (cur < target && !slots[cur]) slots[cur] = q;
    else slots[slots.findIndex((s) => !s)] = q;
  }
  const layout: Layout = slots.map((s) => s?.assetId ?? null);
  const used = new Set(lockedAssets);
  for (let idx = 0; idx < target; idx++) {
    if (slots[idx]) continue;
    const pool = pool0.filter((c) => !used.has(c.id));
    const best = bestFor(layout, next, idx, env, pool);
    if (!best) break;
    used.add(best.c.id);
    layout[idx] = best.c.id;
    slots[idx] = { id: `p${next.nextId++}`, assetId: best.c.id, assetLock: false, posLock: false, version: bump(next), text: null };
  }
  // İyileştirme: kilitsiz konumları, diğer hepsi yerindeyken, havuzdan daha uygun adayla değiştir
  for (let pass = 0; pass < 2; pass++) {
    let changed = false;
    for (let idx = 0; idx < target; idx++) {
      const cur = slots[idx];
      if (!cur || cur.assetLock || cur.posLock) continue;
      const curC = env.byId.get(cur.assetId);
      const curScore = curC ? scoreAt(layout, next, idx, curC, env).exact : -1;
      const pool = pool0.filter((c) => c.id === cur.assetId || !layout.includes(c.id));
      const best = bestFor(layout, next, idx, env, pool);
      if (best && best.c.id !== cur.assetId && best.s.exact > curScore + EPS) {
        layout[idx] = best.c.id;
        slots[idx] = { id: cur.id, assetId: best.c.id, assetLock: false, posLock: false, version: bump(next), text: null };
        changed = true;
      }
    }
    if (!changed) break;
  }
  next.posts = slots.filter((s): s is Post => !!s);
  const cap = capacityOf(next, env);
  const msg = target === 0 ? 'Uygun aday yok: plan boş.' : cap.note ?? undefined;
  return finish(base, next, 'Planla', env, msg);
}

/** Sayıyı ARTIRIR: yeni postlar profil sırasının SONUNA eklenir (mevcut konumlar ve kilitler değişmez). Azaltma yalnız Sil ile. */
export function addPosts(plan: PostPlan, count: number, env: PostEnv): OpResult {
  const k = Math.max(0, Math.floor(count));
  if (k < 1) return { plan, message: 'Eklenecek sayı en az 1 olmalı.' };
  const want = Math.min(MAX_POSTS, plan.posts.length + k);
  if (want === plan.posts.length) return { plan, message: `En fazla ${MAX_POSTS} post planlanabilir.` };
  const next = cloneFor(plan);
  const layout: Layout = next.posts.map((p) => p.assetId);
  const used = new Set(layout as string[]);
  while (next.posts.length < want) {
    const pool = eligiblePool(next, env, used);
    const idx = next.posts.length;
    const best = bestFor(layout, next, idx, env, pool);
    if (!best) break;
    used.add(best.c.id);
    layout.push(best.c.id);
    next.posts.push({ id: `p${next.nextId++}`, assetId: best.c.id, assetLock: false, posLock: false, version: bump(next), text: null });
  }
  next.requested = Math.max(next.requested, want);
  const cap = capacityOf(next, env);
  if (next.posts.length === plan.posts.length) return { plan: { ...plan, requested: Math.max(plan.requested, want) }, message: cap.note ?? 'Eklenecek uygun aday yok.' };
  return finish(plan, next, `${next.posts.length - plan.posts.length} post ekle`, env, cap.note ?? undefined);
}

// ── Değiştir / ele ──

/**
 * Tek post için başka aday: post sayısı AYNI kalır. Aday yalnız bağımsız en yüksek puana göre değil, o konuma ve kalan plana (geçmiş dahil)
 * uyumuna göre seçilir. Kilitli post değişmez. Uygun aday yoksa mevcut durum aynen korunur ve nedeni söylenir. Eski caption yeni varlığa
 * taşınmaz (metin düşer; geri alınabilir). dismiss: eski varlık otomatik önerilerden elenir.
 */
export function replacePost(plan: PostPlan, id: string, mode: 'replace' | 'dismiss', env: PostEnv, expected?: number): OpResult {
  const idx = plan.posts.findIndex((p) => p.id === id);
  if (idx < 0) return { plan, message: 'Post bulunamadı (silinmiş olabilir); işlem yok sayıldı.', stale: true };
  const cur = plan.posts[idx];
  if (isStale(cur, expected)) return { plan, message: STALE, stale: true };
  if (cur.assetLock || cur.posLock) return { plan, message: LOCKED_MSG };
  const inPlan = new Set(plan.posts.filter((_, i) => i !== idx).map((p) => p.assetId));
  const pool = eligiblePool(plan, env, inPlan, { exclude: new Set([cur.assetId]) });
  const layout: Layout = plan.posts.map((p) => p.assetId);
  const best = bestFor(layout, plan, idx, env, pool);
  if (!best) return { plan, message: `Bu konuma uygun başka aday yok; mevcut görsel korundu. Tekrarlı doldurma yapılmadı.` };
  const next = cloneFor(plan);
  next.posts[idx] = { id: cur.id, assetId: best.c.id, assetLock: false, posLock: false, version: bump(next), text: null };
  if (mode === 'dismiss') next.dismissed = [...new Set([...next.dismissed, cur.assetId])];
  return finish(plan, next, mode === 'dismiss' ? 'Ele ve yenisini getir' : 'Değiştir', env, cur.text ? 'Eski metin yeni görsele taşınmadı (geçersizleşti; geri alınabilir).' : undefined);
}

// ── Sil ve konum kilidi çatışması ──

/**
 * Silme sonrası düzen: konum kilitli postlar AYNI konumda kalır; kalan kilitsiz postlar sırayla boşlukları doldurur. Konum kilitli bir postun
 * konumu yeni sayının dışında kalıyorsa çatışmadır (döndürülür).
 */
function reflowAfterRemoval(posts: Post[], removedId: string): { posts: Post[]; conflicting: Post[] } {
  const rest = posts.filter((p) => p.id !== removedId);
  const n = rest.length;
  const pinned = new Map<number, Post>();
  const conflicting: Post[] = [];
  for (const p of rest) {
    if (!p.posLock) continue;
    const at = posts.findIndex((x) => x.id === p.id);
    if (at < n) pinned.set(at, p);
    else conflicting.push(p);
  }
  if (conflicting.length) return { posts: rest, conflicting };
  const free = rest.filter((p) => !p.posLock);
  const out: Post[] = [];
  let k = 0;
  for (let i = 0; i < n; i++) out.push(pinned.get(i) ?? free[k++]);
  return { posts: out, conflicting: [] };
}

export function deletePost(plan: PostPlan, id: string, env: PostEnv, expected?: number): OpResult {
  const idx = plan.posts.findIndex((p) => p.id === id);
  if (idx < 0) return { plan, message: 'Post bulunamadı (zaten silinmiş olabilir); işlem yok sayıldı.', stale: true };
  const cur = plan.posts[idx];
  if (isStale(cur, expected)) return { plan, message: STALE, stale: true };
  if (cur.assetLock || cur.posLock) return { plan, message: LOCKED_MSG };
  const rf = reflowAfterRemoval(plan.posts, id);
  if (rf.conflicting.length) {
    const released = plan.posts.map((p) => (rf.conflicting.some((c) => c.id === p.id) ? { ...p, posLock: false } : p));
    const after = reflowAfterRemoval(released, id).posts;
    return {
      plan,
      conflict: {
        kind: 'delete',
        postId: id,
        planRev: plan.rev,
        reason: `Konum kilitli post(lar) (${rf.conflicting.map((p) => `${p.id} · konum ${plan.posts.indexOf(p) + 1}`).join(', ')}) silme sonrası var olmayacak konumda kalıyor.`,
        conflictingIds: rf.conflicting.map((p) => p.id),
        before: layoutOf(plan.posts, env.history, plan.crops),
        afterRelease: layoutOf(after, env.history, plan.crops),
        options: [
          { id: 'cancel', label: 'Vazgeç (hiçbir şey değişmesin)' },
          { id: 'release_and_delete', label: 'Konum kilidini kaldır, sil ve yeniden diz' },
        ],
      },
    };
  }
  const next = cloneFor(plan);
  next.posts = rf.posts.map((p) => next.posts.find((x) => x.id === p.id)!);
  next.requested = next.posts.length;
  return finish(plan, next, 'Sil', env, 'Silindi: post sayısı azaldı, otomatik yeni görsel eklenmedi.');
}

/** Çatışma çözümü. Önizleme eskidiyse (plan o arada değiştiyse) uygulanmaz. */
export function resolveDelete(plan: PostPlan, conflict: Conflict, option: ConflictOption, env: PostEnv): OpResult {
  if (conflict.planRev !== plan.rev) return { plan, message: 'Önizleme eskidi (plan değişti); işlemi yeniden başlatın.', stale: true };
  if (option === 'cancel') return { plan, message: 'Silme iptal edildi; hiçbir şey değişmedi.' };
  if (!plan.posts.some((p) => p.id === conflict.postId)) return { plan, message: 'Post artık yok; işlem yok sayıldı.', stale: true };
  const next = cloneFor(plan);
  for (const p of next.posts) if (conflict.conflictingIds.includes(p.id)) { p.posLock = false; p.version = bump(next); }
  const rf = reflowAfterRemoval(next.posts, conflict.postId);
  next.posts = rf.posts.map((p) => next.posts.find((x) => x.id === p.id)!);
  next.requested = next.posts.length;
  return finish(plan, next, 'Sil (konum kilidi kaldırıldı)', env, 'Silindi; çatışan konum kilidi kaldırıldı (görsel kilidi korundu).');
}

// ── Kilitler ──

export function setAssetLock(plan: PostPlan, id: string, on: boolean, expected?: number): OpResult {
  const idx = plan.posts.findIndex((p) => p.id === id);
  if (idx < 0) return { plan, message: 'Post bulunamadı; işlem yok sayıldı.', stale: true };
  const cur = plan.posts[idx];
  if (isStale(cur, expected)) return { plan, message: STALE, stale: true };
  if (on === cur.assetLock && (on || !cur.posLock)) return { plan };
  const next = cloneFor(plan);
  const p = next.posts[idx];
  p.assetLock = on;
  if (!on) p.posLock = false; // konum kilidi görsel kilidini gerektirir
  p.version = bump(next);
  return finish(plan, next, on ? 'Görseli koru' : 'Görsel kilidini kaldır', null);
}
export function setPositionLock(plan: PostPlan, id: string, on: boolean, expected?: number): OpResult {
  const idx = plan.posts.findIndex((p) => p.id === id);
  if (idx < 0) return { plan, message: 'Post bulunamadı; işlem yok sayıldı.', stale: true };
  const cur = plan.posts[idx];
  if (isStale(cur, expected)) return { plan, message: STALE, stale: true };
  if (on === cur.posLock) return { plan };
  const next = cloneFor(plan);
  const p = next.posts[idx];
  p.posLock = on;
  if (on) p.assetLock = true;
  p.version = bump(next);
  return finish(plan, next, on ? 'Yerini de koru' : 'Konum kilidini kaldır', null);
}

// ── Sıralama ──

/** Komşuyla yer değiştirir (profil sırasında yukarı = -1 / aşağı = +1). Konum kilitli bir post dahilse yapılmaz. */
export function movePost(plan: PostPlan, id: string, dir: -1 | 1, env: PostEnv): OpResult {
  const i = plan.posts.findIndex((p) => p.id === id);
  if (i < 0) return { plan, message: 'Post bulunamadı; işlem yok sayıldı.', stale: true };
  const j = i + dir;
  if (j < 0 || j >= plan.posts.length) return { plan, message: 'Bu yönde taşınacak konum yok.' };
  if (plan.posts[i].posLock || plan.posts[j].posLock) return { plan, message: 'Konum kilitli post yerinden oynatılamaz; önce "Yerini de koru" kilidini kaldırın.' };
  const next = cloneFor(plan);
  [next.posts[i], next.posts[j]] = [next.posts[j], next.posts[i]];
  return finish(plan, next, 'Sırayı değiştir', env);
}

/**
 * Aynı varlıklarla SIRAYI iyileştirir (çiftli yer değiştirme tırmanışı): konum kilitli postlar sabit, görsel kilitli ve kilitsiz postlar
 * serbest konumlanır; hiçbir varlık eklenmez/çıkmaz. Bütün plan puanı gerçekten artmıyorsa değişiklik yapılmaz.
 */
export function arrangePlan(plan: PostPlan, env: PostEnv): OpResult {
  const movable = plan.posts.map((p, i) => (p.posLock ? -1 : i)).filter((i) => i >= 0);
  if (movable.length < 2) return { plan, message: 'Yeniden düzenlenecek serbest konum yok.' };
  if (plan.posts.length > 18) return { plan, message: 'Otomatik düzenleme en fazla 18 postta çalışır.' };
  let cur = cloneFor(plan);
  let curScore = evaluatePlan(cur, env).total;
  const startScore = curScore;
  for (let pass = 0; pass < 2; pass++) {
    let improved = false;
    for (let a = 0; a < movable.length; a++) {
      for (let b = a + 1; b < movable.length; b++) {
        const i = movable[a];
        const j = movable[b];
        const trial = cloneFor(cur);
        [trial.posts[i], trial.posts[j]] = [trial.posts[j], trial.posts[i]];
        const sc = evaluatePlan(trial, env).total;
        if (sc > curScore + EPS) {
          cur = trial;
          curScore = sc;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  if (curScore <= startScore + EPS) return { plan, message: `Sıra zaten uyumlu; iyileştirme bulunamadı (plan puanı ${startScore}).` };
  return finish(plan, cur, 'Sırayı iyileştir', env, `Plan uyumu ${startScore} → ${curScore}. Konum kilitli postlar yerinde kaldı.`);
}

// ── Kırpım (sürümlü, manuel) ──

export interface CropPatch {
  focus?: Focus;
  zoom?: number;
  /** true: otomatik (konu merkezli) kırpıma dön — sürüm YİNE artar */
  auto?: boolean;
}
/**
 * Varlığın 4:5 kırpımını düzenler (orijinal kaynak DEĞİŞMEZ). Kırpım sürümü artar; o varlığı taşıyan postların sürümü artar (eski işlem/yanıt
 * yok sayılır) ve metinleri "eski" olur (görünür olgular değişmiş olabilir) ama SİLİNMEZ. Arka arkaya aynı varlığın düzenlemesi tek geri-al adımıdır.
 */
export function setCrop(plan: PostPlan, assetId: string, patch: CropPatch, expectedCropVersion?: number): OpResult {
  if (!plan.posts.some((p) => p.assetId === assetId)) return { plan, message: 'Bu varlık planda değil; kırpım yok sayıldı.', stale: true };
  const prev = plan.crops[assetId];
  if (expectedCropVersion !== undefined && (prev?.version ?? 0) !== expectedCropVersion) return { plan, message: 'Kırpım bu arada değişti; işlem yok sayıldı.', stale: true };
  const next = cloneFor(plan);
  const zoom = patch.auto ? 1 : Math.min(2.5, Math.max(1, patch.zoom ?? prev?.zoom ?? 1));
  const focus = patch.auto ? null : patch.focus ? { x: Math.min(1, Math.max(0, patch.focus.x)), y: Math.min(1, Math.max(0, patch.focus.y)) } : prev?.focus ?? null;
  next.crops[assetId] = { focus, zoom, version: (prev?.version ?? 0) + 1 };
  bump(next);
  for (const p of next.posts) if (p.assetId === assetId) p.version = next.rev;
  const label = `Kırpım ${assetId}`;
  const top = plan.undo[plan.undo.length - 1];
  const out = finishNoUndo(plan, next, label);
  out.plan.undo = top && top.label === label ? plan.undo : withUndoFrom(plan, label);
  return out;
}
function finishNoUndo(prev: PostPlan, next: PostPlan, label: string): OpResult {
  next.lastChange = { label, before: layoutOf(prev.posts, [], prev.crops), after: layoutOf(next.posts, [], next.crops), notes: [`${label}: kırpım sürümü arttı`] };
  return { plan: next };
}

// ── Geri al ──

export function undoLast(plan: PostPlan, env: PostEnv): OpResult {
  const top = plan.undo[plan.undo.length - 1];
  if (!top) return { plan, message: 'Geri alınacak işlem yok.' };
  const snap = clone(top.snap);
  const next: PostPlan = { ...snap, rev: plan.rev, undo: plan.undo.slice(0, -1), lastChange: null };
  const dropped: string[] = [];
  // Yalnız kullanıcı niyeti geri gelir; havuz/analiz/arşiv gibi UZAK veri geri alınmaz: artık geçerli olmayan varlık geri getirilmez
  const valid = (assetId: string) => {
    const c = env.byId.get(assetId);
    return !!c && !c.published && c.brand === env.brand && !hardCheck(c, POST_FORMAT, { brand: env.brand, rejected: new Set(), inPlan: new Set() });
  };
  next.posts = next.posts.filter((p) => {
    const ok = valid(p.assetId);
    if (!ok) dropped.push(p.id);
    return ok;
  });
  // Anlık görüntüden SONRA gelen metin (geç yanıt / insan düzenlemesi) aynı post+varlıkta geçerliyse KORUNUR
  for (const p of next.posts) {
    const now = plan.posts.find((x) => x.id === p.id);
    if (now && now.assetId === p.assetId && now.text && now.text.rev > top.rev && (!p.text || p.text.rev < now.text.rev)) p.text = now.text;
    p.version = bump(next);
  }
  // Kırpım sürümleri GERİ DÜŞMEZ: içerik geri gelse de sürüm ilerler (eski kırpım yanıtı yeni duruma uygulanamasın); içerik aynıysa sürüm korunur
  for (const [a, e] of Object.entries(plan.crops)) {
    const s2 = next.crops[a];
    if (!s2) next.crops[a] = { focus: null, zoom: 1, version: e.version + 1 };
    else if (s2.zoom !== e.zoom || s2.focus?.x !== e.focus?.x || s2.focus?.y !== e.focus?.y) s2.version = Math.max(s2.version, e.version) + 1;
    else s2.version = e.version;
  }
  // Sayaç geri düşmez (kimlikler yeniden kullanılmaz)
  next.nextId = Math.max(next.nextId, plan.nextId);
  next.lastChange = { label: `Geri alındı: ${top.label}`, before: layoutOf(plan.posts, env.history, plan.crops), after: layoutOf(next.posts, env.history, next.crops), notes: describeChange(plan.posts, next.posts) };
  return { plan: next, message: dropped.length ? `Geri alındı; artık geçerli olmayan varlıklar geri getirilmedi: ${dropped.join(', ')}.` : `Geri alındı: ${top.label}.` };
}

/**
 * GÖRSEL plan imzası: sıra + varlıklar + her varlığın kırpım sürümü/içeriği. "Görsel planı tamamladım" onayı bu imzaya bağlıdır; görsel, sıra
 * veya kırpım değişince imza değişir ve onay yeniden gerekir. Metin, kilit ve elle metin düzenlemesi imzayı DEĞİŞTİRMEZ.
 */
export function visualPlanSig(plan: Pick<PostPlan, 'posts' | 'crops'>): string {
  return plan.posts
    .map((p) => {
      const c = plan.crops[p.assetId];
      return `${p.id}:${p.assetId}:${c ? `${c.version}/${c.zoom}/${c.focus ? `${c.focus.x.toFixed(4)},${c.focus.y.toFixed(4)}` : 'auto'}` : '0'}`;
    })
    .join('|');
}

// ── Metin aşaması (görsel plandan AYRI, açık eylem) ──

export type TextStatus = 'yok' | 'geçerli' | 'eski_kırpım' | 'eski_görsel';
export function textStatus(plan: Pick<PostPlan, 'crops'>, p: Post): TextStatus {
  const t = p.text;
  if (!t) return 'yok';
  if (t.assetId !== p.assetId) return 'eski_görsel';
  if (t.cropVersion !== cropVersionOf(plan, p.assetId)) return 'eski_kırpım';
  return 'geçerli';
}
/** Metin ÜRETİLMESİ gereken postlar: metni yok, eski, veya (zorla) hepsi. Kilitli ve GEÇERLİ metni olan post değişmez. */
export function postsNeedingText(plan: PostPlan, force = false): Post[] {
  return plan.posts.filter((p) => {
    const st = textStatus(plan, p);
    if (st === 'geçerli' && (p.assetLock || p.posLock)) return false;
    return force || st !== 'geçerli';
  });
}

export interface TextArrival {
  postId: string;
  /** İstek anındaki post sürümü, varlığı ve kırpım sürümü */
  expected: { version: number; assetId: string; cropVersion: number };
  text: Omit<PostText, 'assetId' | 'cropVersion' | 'rev'>;
}
/** Geç/eski yanıt yeni slota/varlığa/kırpıma YAZILAMAZ. Dönüş: yazılanlar ve yok sayılanlar. */
export function applyTexts(plan: PostPlan, arrivals: TextArrival[]): { plan: PostPlan; applied: string[]; stale: Array<{ postId: string; why: string }> } {
  const next = cloneFor(plan);
  const applied: string[] = [];
  const stale: Array<{ postId: string; why: string }> = [];
  for (const a of arrivals) {
    const p = next.posts.find((x) => x.id === a.postId);
    if (!p) { stale.push({ postId: a.postId, why: 'post silinmiş' }); continue; }
    if (p.assetId !== a.expected.assetId) { stale.push({ postId: a.postId, why: 'görsel değişmiş' }); continue; }
    if (cropVersionOf(next, p.assetId) !== a.expected.cropVersion) { stale.push({ postId: a.postId, why: 'kırpım değişmiş' }); continue; }
    if (p.version !== a.expected.version) { stale.push({ postId: a.postId, why: 'post (kilit/sürüm) değişmiş' }); continue; }
    if ((p.assetLock || p.posLock) && textStatus(next, p) === 'geçerli') { stale.push({ postId: a.postId, why: 'kilitli ve geçerli metni var' }); continue; }
    bump(next);
    p.text = { ...a.text, assetId: p.assetId, cropVersion: cropVersionOf(next, p.assetId), rev: next.rev };
    p.version = next.rev;
    applied.push(p.id);
  }
  return { plan: next, applied, stale };
}

/** İnsanın elle yazdığı/düzenlediği metin (kaynak 'manual'); sürüm denetimli. */
export function setManualText(plan: PostPlan, id: string, text: string, expected?: number, meta?: { sourceVersion?: string; voiceSig?: string }): OpResult {
  const idx = plan.posts.findIndex((p) => p.id === id);
  if (idx < 0) return { plan, message: 'Post bulunamadı; işlem yok sayıldı.', stale: true };
  if (isStale(plan.posts[idx], expected)) return { plan, message: STALE, stale: true };
  const next = cloneFor(plan);
  const p = next.posts[idx];
  bump(next);
  const t = text.trim();
  p.text = t ? { text: t, source: 'manual', assetId: p.assetId, cropVersion: cropVersionOf(next, p.assetId), rev: next.rev, ...(meta?.sourceVersion !== undefined ? { sourceVersion: meta.sourceVersion } : {}), ...(meta?.voiceSig !== undefined ? { voiceSig: meta.voiceSig } : {}) } : null;
  p.version = next.rev;
  return { plan: next };
}
