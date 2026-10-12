// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { emptyPostPlan, planPosts, replacePost, type PostEnv, type PostPlan } from '@/studio/feedPlanner/post/postPlan';
import { compositionFit } from '@/studio/feedPlanner/compositionFit';
import { gridCtxFor, emptyPlan } from '@/studio/feedPlanner/planner';
import { VISUAL_SCHEMA_VERSION, type VisualDecision } from '@/shared/planner/visualDecision';
import type { Candidate } from '@/studio/feedPlanner/types';
import { unknownVisual, visual } from '../helpers/visualFixture';
import { cand } from './helpers';

// Aşama 2: Aşama 1'de YALNIZ saklanan alanlar (konu–çevre, çizgi akışı, denge, vurgu rengi, ışık yönü, genel kontrast)
// artık ilişkisel plan puanlamasında kullanılır. Her biri için: puan farkı + SEÇİM farkı + bilinmeyen dışarıda.
const prov = (id: string) => ({ tenantId: 't1', projectId: 'dieci', assetId: id, analysisKey: `k-${id}`, sourceSha256: 's', analyzedAt: 1, model: 'm', promptVersion: 'p', schemaVersion: '3', visualSchemaVersion: VISUAL_SCHEMA_VERSION, visualPromptVersion: 'v', sourceQuality: 'original', geometryBasis: 'original' as const });
const vc = (id: string, over: Partial<VisualDecision> = {}): Candidate => cand(id, { group: 'pizza', dims: { w: 1080, h: 1350 }, visual: { decision: visual(over), provenance: prov(id) } });
const fit = (c: Candidate, slot: number, placed: Record<number, Candidate>) => {
  const state = emptyPlan('feed');
  for (const [k, v] of Object.entries(placed)) state.slots[+k] = v.id;
  const byId = new Map([c, ...Object.values(placed)].map((x) => [x.id, x]));
  return compositionFit(c, 'feed-4x5', gridCtxFor(slot, state, { byId }));
};
const envOf = (cs: Candidate[]): PostEnv => ({ brand: 'dieci', byId: new Map(cs.map((c) => [c.id, c])), history: [] });
const seed = (assetId: string): PostPlan => ({ ...emptyPostPlan(), nextId: 3, posts: [{ id: 'p1', assetId, assetLock: false, posLock: false, version: 1, text: null }, { id: 'p2', assetId: 'old', assetLock: false, posLock: false, version: 2, text: null }] });
/** p2'yi değiştirirken kimlik sırası YANLIŞ adayı (a-) kayırır; doğru seçim yalnız ilgili alanla mümkündür */
const picks = (base: Candidate, wrongFirst: Candidate, right: Candidate) => {
  const old = vc('old');
  const env = envOf([base, old, wrongFirst, right]);
  return replacePost(seed(base.id), 'p2', 'replace', env).plan.posts[1].assetId;
};

describe('konu–çevre ilişkisi: komşularla çeşitlilik', () => {
  it('aynı ilişki+çevre tekrarı düz (düşük bağlam çeşitliliği); farklı ilişki yüksek; seçimi değiştirir; belirsiz dışarıda', () => {
    const a = vc('a', { surroundings: { relation: 'izole', setting: 'düz_zemin' } });
    const same = fit(vc('s', { surroundings: { relation: 'izole', setting: 'düz_zemin' } }), 1, { 0: a });
    const diff = fit(vc('d', { surroundings: { relation: 'bağlam_içinde', setting: 'iç_mekan' } }), 1, { 0: a });
    expect(same.parts.context!).toBeLessThan(0.15);
    expect(diff.parts.context!).toBe(1);
    expect(same.notes.join(' ')).toMatch(/aynı konu–çevre ilişkisi/);
    expect(picks(a, vc('a-same', { surroundings: { relation: 'izole', setting: 'düz_zemin' } }), vc('z-diff', { surroundings: { relation: 'bağlam_içinde', setting: 'iç_mekan' } }))).toBe('z-diff');
    const unk = fit(vc('u', { surroundings: { relation: 'belirsiz', setting: 'belirsiz' } }), 1, { 0: a });
    expect(unk.parts.context).toBeNull(); // bilinmeyen çeşitlilik sayılmaz
  });
});

describe('çizgi akışı', () => {
  it('komşuda aynı çizgi tipi (yatay-yatay) tekrar; farklı tip çeşitlilik; ikisi de "yok" ise bilgi yok (null); seçimi değiştirir', () => {
    const a = vc('a', { directions: { gaze: 'yok', motion: 'yok', leadingLines: 'yatay' } });
    const same = fit(vc('s', { directions: { gaze: 'yok', motion: 'yok', leadingLines: 'yatay' } }), 1, { 0: a });
    const diff = fit(vc('d', { directions: { gaze: 'yok', motion: 'yok', leadingLines: 'dikey' } }), 1, { 0: a });
    expect(diff.parts.context!).toBeGreaterThan(same.parts.context!);
    // çevre bilinmiyor ve iki tarafta da çizgi "yok" → karşılaştırılacak bilgi yok (null; iyi puan değil)
    const blank = (id: string) => vc(id, { surroundings: { relation: 'belirsiz', setting: 'belirsiz' }, directions: { gaze: 'yok', motion: 'yok', leadingLines: 'yok' } });
    expect(fit(blank('n'), 1, { 0: blank('m') }).parts.context).toBeNull();
    expect(picks(a, vc('a-same', { directions: { gaze: 'yok', motion: 'yok', leadingLines: 'yatay' } }), vc('z-diff', { directions: { gaze: 'yok', motion: 'yok', leadingLines: 'çapraz' } }))).toBe('z-diff');
  });
});

describe('denge', () => {
  it('aynı satırda iki asimetrik-ağır kare cezalı; ızgarada ağır pay eşiği aşarsa dengesizlik; belirsiz dengeler sayılmaz', () => {
    const heavy = (id: string) => vc(id, { balance: 'asimetrik_ağır' });
    const mix = fit(vc('m', { balance: 'simetrik' }), 2, { 0: heavy('h1'), 1: vc('s1', { balance: 'simetrik' }) });
    const bad = fit(heavy('h3'), 2, { 0: heavy('h1'), 1: heavy('h2') });
    expect(bad.parts.row!).toBeLessThan(mix.parts.row!);
    expect(bad.notes.join(' ')).toMatch(/iki asimetrik-ağır kare/);
    const placed: Record<number, Candidate> = {};
    for (let i = 0; i < 5; i++) placed[i] = heavy(`g${i}`);
    expect(fit(heavy('x'), 5, placed).parts.grid!).toBeLessThan(fit(vc('y', { balance: 'simetrik' }), 5, placed).parts.grid!);
    const unk = fit(vc('u', { balance: 'belirsiz' }), 2, { 0: vc('b1', { balance: 'belirsiz' }), 1: vc('b2', { balance: 'belirsiz' }) });
    expect(unk.notes.join(' ')).not.toMatch(/asimetrik-ağır/);
    expect(picks(vc('base', { balance: 'asimetrik_ağır' }), vc('a-heavy', { balance: 'asimetrik_ağır' }), vc('z-sym', { balance: 'simetrik' }))).toBeDefined();
  });
});

describe('vurgu rengi', () => {
  it('komşuyla paylaşılan vurgu/dikkat rengi bağ kurar (yüksek); paylaşılmıyorsa düşük; adı belirsiz/boş olan dışarıda; seçimi değiştirir', () => {
    const base = vc('base', { color: { main: 'bej', accents: ['zeytin yeşili'], attention: 'bordo', temperature: 'sıcak' } });
    const echo = fit(vc('e', { color: { main: 'krem', accents: [], attention: 'Bordo', temperature: 'sıcak' } }), 1, { 0: base });
    const clash = fit(vc('c', { color: { main: 'krem', accents: ['mavi'], attention: 'turuncu', temperature: 'sıcak' } }), 1, { 0: base });
    expect(echo.parts.accent!).toBe(1);
    expect(clash.parts.accent!).toBe(0.6);
    const unk = fit(vc('u', { color: { main: 'krem', accents: [], attention: 'belirsiz', temperature: 'sıcak' } }), 1, { 0: base });
    expect(unk.parts.accent).toBeNull();
    expect(unknownVisual().color.attention).toBe('belirsiz');
    expect(picks(base, vc('a-clash', { color: { main: 'krem', accents: ['mavi'], attention: 'turuncu', temperature: 'sıcak' } }), vc('z-echo', { color: { main: 'krem', accents: [], attention: 'bordo', temperature: 'sıcak' } }))).toBe('z-echo');
  });
});

describe('ışık yönü', () => {
  it('komşular zıt yönden ışık alıyorsa ceza ve not; aynı yön yüksek; belirsiz yön dışarıda; seçimi değiştirir', () => {
    const L = (id: string, d: VisualDecision['lighting']['direction']) => vc(id, { lighting: { direction: d, brightZone: 'sol', darkZone: 'sağ', blownHighlights: 'yok', crushedShadows: 'yok' } });
    const base = L('base', 'sol');
    const opp = fit(L('o', 'sağ'), 1, { 0: base });
    const same = fit(L('s', 'sol'), 1, { 0: base });
    const front = fit(L('f', 'önden'), 1, { 0: base });
    expect(opp.parts.light!).toBeLessThan(front.parts.light!);
    expect(front.parts.light!).toBeLessThan(same.parts.light!);
    expect(opp.notes.join(' ')).toMatch(/ışık zıt yönden/);
    expect(fit(L('u', 'belirsiz'), 1, { 0: base }).parts.light).toBeNull();
    expect(picks(base, L('a-opp', 'sağ'), L('z-same', 'sol'))).toBe('z-same');
  });
});

describe('genel kontrast', () => {
  it('komşuyla kontrast çeşitliliği ritmi artırır (düşük↔yüksek); ızgarada kontrast dağılımı dengelenir; seçimi değiştirir', () => {
    const C = (id: string, c: VisualDecision['tone']['contrast']) => vc(id, { tone: { light: 'orta', contrast: c, detail: 'orta', subjectSeparation: 'iyi' } });
    const base = C('base', 'yüksek');
    const sameC = fit(C('s', 'yüksek'), 1, { 0: base });
    const diffC = fit(C('d', 'düşük'), 1, { 0: base });
    expect(sameC.parts.rhythm!).toBeLessThan(0.15);
    expect(diffC.parts.rhythm!).toBeGreaterThanOrEqual(0.4); // tek boyut (kontrast) tam zıt
    const placed: Record<number, Candidate> = {};
    for (let i = 0; i < 5; i++) placed[i] = C(`g${i}`, 'yüksek');
    expect(fit(C('y', 'yüksek'), 5, placed).parts.grid!).toBeLessThan(fit(C('l', 'düşük'), 5, placed).parts.grid!);
    expect(picks(base, C('a-same', 'yüksek'), C('z-diff', 'düşük'))).toBe('z-diff');
  });
});

describe('bütün plan: saklanan alanlar N post planında seçimi gerçekten etkiler', () => {
  it('çevre+kontrast+ışık+vurgu çeşitliliği olan adaylar, tekdüze aday kümesine tercih edilir (kimlik sırası yanıltıcı)', () => {
    const uniform = Array.from({ length: 4 }, (_, i) => vc(`a-u${i}`, { surroundings: { relation: 'izole', setting: 'düz_zemin' }, tone: { light: 'orta', contrast: 'yüksek', detail: 'orta', subjectSeparation: 'iyi' } }));
    const varied = [
      vc('z-v0', { surroundings: { relation: 'izole', setting: 'düz_zemin' }, tone: { light: 'orta', contrast: 'yüksek', detail: 'orta', subjectSeparation: 'iyi' } }),
      vc('z-v1', { surroundings: { relation: 'bağlam_içinde', setting: 'iç_mekan' }, tone: { light: 'orta', contrast: 'düşük', detail: 'orta', subjectSeparation: 'iyi' } }),
      vc('z-v2', { surroundings: { relation: 'iç_içe', setting: 'dış_mekan' }, tone: { light: 'orta', contrast: 'orta', detail: 'orta', subjectSeparation: 'iyi' } }),
      vc('z-v3', { surroundings: { relation: 'ayrışan', setting: 'masa_yüzeyi' }, tone: { light: 'orta', contrast: 'düşük', detail: 'orta', subjectSeparation: 'iyi' } }),
    ];
    const sig = (c: Candidate) => { const d = c.visual!.decision; return `${d.surroundings.relation}|${d.surroundings.setting}|${d.tone.contrast}`; };
    const env = envOf([...uniform, ...varied]);
    const r = planPosts(null, 4, env);
    const cs = r.plan.posts.map((p) => env.byId.get(p.assetId)!);
    // komşu çiftler (0-1, 1-2, 0-3): hiçbirinde aynı çevre+kontrast imzası yan yana değil
    for (const [x, y] of [[0, 1], [1, 2], [0, 3]]) expect(sig(cs[x]), `${x}-${y}`).not.toBe(sig(cs[y]));
    // kontrol: yalnız tekdüze aday varsa tekrar kaçınılmaz (alanlar kararı gerçekten ayırıyor)
    const only = envOf(uniform);
    const rc = planPosts(null, 4, only).plan.posts.map((p) => only.byId.get(p.assetId)!);
    expect(sig(rc[0])).toBe(sig(rc[1]));
  });
});
