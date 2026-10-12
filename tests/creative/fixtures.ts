import { vi } from 'vitest';
import { fakeFirestore } from '../helpers/fakeFirestore';
import { BRAND_VOICE_COLLECTION, brandVoiceDocId, BRAND_GUIDE_COLLECTION, brandGuideDocId, type CopyModelCall } from '@/api/_lib/planCopy/planCopy';
import { ANALYSES, ANALYSIS_LATEST } from '@/api/_lib/mediaAnalysis/correctionStore';
import { runCreative, type CreativeDeps } from '@/api/_lib/creative/creative';
import { VISUAL_SCHEMA_VERSION } from '@/shared/planner/visualDecision';
import { creativeCacheKey, type CreativeRequest, type CreativeRole, type SelectedIdea, type CaptionDraft } from '@/shared/planner/creativeContract';
import { seedAsset, POLICY, T, P } from '../feedPlanner/integration/liveFixtures';
import { bundle } from '../planner/helpers';
import { visual } from '../helpers/visualFixture';

export { T, P, POLICY, creativeCacheKey };
export const CAT = {
  subject: 'masada makarna tabağı', description: 'Beyaz örtülü masada porselen tabakta makarna.', tags: ['makarna'], visibleObjects: ['tabak', 'zeytin kasesi'], foodCategories: ['makarna'],
  composition: { shotType: 'orta_plan', subjectPlacement: 'merkez', negativeSpace: true }, uncertainties: ['sos içeriği görünmüyor'], peoplePresent: false, usageSuggestions: ['feed'],
};
export const FULL = { focus: { x: 0.5, y: 0.5 }, zoom: 1, version: 1 };
export const GUIDE = { brandName: 'HAL', whatTheyDo: 'Mahalle lokantası.', audience: 'Semt sakinleri', toneLabels: ['samimi'], toneNotes: '', examples: [], avoid: ['indirim vaadi'], facts: ['Masalar her gün özenle kurulur'], openQuestions: [] };

/** Katalog + (isteğe bağlı) kompozisyon kararı olan gerçek-biçimli sahte kayıtlar */
export function seed(db: any, id = 'a1', o: { w?: number; h?: number; catalog?: unknown; vis?: unknown; key?: string; tenantId?: string } = {}) {
  seedAsset(db, id, { w: o.w ?? 1080, h: o.h ?? 1350, tenantId: o.tenantId });
  const key = o.key ?? `k-${id}`;
  db.data.set(`${ANALYSIS_LATEST}/${o.tenantId ?? T}_${P}_${id}`, { key });
  db.data.set(`${ANALYSES}/${key}`, { key, tenantId: o.tenantId ?? T, projectId: P, sourceId: id, status: 'done', sourceQuality: 'original', visualSchemaVersion: VISUAL_SCHEMA_VERSION, visualStatus: 'ok', ...(o.vis === undefined ? {} : { visual: o.vis }), result: o.catalog ?? CAT });
}
export const withBundle = (db: any, b = bundle()) => db.data.set(`${BRAND_VOICE_COLLECTION}/${brandVoiceDocId(T, P)}`, { tenantId: T, projectId: P, bundle: b, updatedBy: 'a', updatedAt: 1 });
export const withGuide = (db: any) => db.data.set(`${BRAND_GUIDE_COLLECTION}/${brandGuideDocId(T, P)}`, { tenantId: T, projectId: P, guide: GUIDE, version: 2 });
export const fresh = (o: Parameters<typeof seed>[2] = {}) => { const db = fakeFirestore(); seed(db, 'a1', o); return db; };
export { visual };

type Fn = ReturnType<typeof vi.fn>;
/** Rol başına AYRI sahte model çağrısı: hangi rolün ne kadar çağrıldığı sayılır (sıfır gerçek sağlayıcı) */
export interface Mock { ideas: Fn; caption: Fn; check: Fn; deps: CreativeDeps; total: () => number }
export const reply = (parsed: unknown, id = 'resp-x') => async () => ({ id, stopReason: 'end_turn', parsed, provider: 'openrouter', modelUsed: 'mock/model', requestId: 'rq-1', usageDetail: { inputTokens: 100, outputTokens: 50, totalTokens: 150, cachedTokens: 0, reasoningTokens: 0, costUsd: 0.001 } });
export function mockDeps(o: Partial<Record<CreativeRole, unknown>> = {}, models = { ideas: 'mock/ideas', caption: 'mock/caption', check: 'mock/check' }): Mock {
  const ideas = vi.fn(reply('ideas' in o ? o.ideas : IDEAS_OK(), 'r-ideas'));
  const caption = vi.fn(reply('caption' in o ? o.caption : CAPTION_OK(), 'r-caption'));
  const check = vi.fn(reply('check' in o ? o.check : CHECK_OK(), 'r-check'));
  const by = { ideas, caption, check } as Record<CreativeRole, Fn>;
  return { ideas, caption, check, deps: { callModel: (r) => by[r] as unknown as CopyModelCall, policy: POLICY, models }, total: () => ideas.mock.calls.length + caption.mock.calls.length + check.mock.calls.length };
}

export const IDEAS_OK = (): any => ({
  status: 'ok', missingInfo: null,
  ideas: [
    { mainMessage: 'Sade bir masada makarna keyfi', creativeAngle: 'Sakin öğle molası hissi', visualLink: 'Beyaz örtülü masada porselen tabaktaki makarna', targetEffect: { kind: 'hisset', note: 'Sakinlik hissi' }, basisFactIds: ['F1', 'F2'], basisProductIds: [], basisBrandIds: [], interpretation: 'Telaşsız bir mola davetidir; bu bir yorumdur', uncertainties: ['sos içeriği görünmüyor'], missingInfoNote: null },
    { mainMessage: 'Yanındaki zeytin kasesiyle paylaşılan sofra', creativeAngle: 'Paylaşma ve sofra kültürü', visualLink: 'Tabağın yanındaki zeytin kasesi', targetEffect: { kind: 'düşün', note: 'Birlikte yemeyi düşündürür' }, basisFactIds: ['F4'], basisProductIds: [], basisBrandIds: [], interpretation: 'Sofranın ortak olduğu fikri yoruma dayanır', uncertainties: [], missingInfoNote: null },
    { mainMessage: 'Bugün öğle yemeğini kendine ayır', creativeAngle: 'Doğrudan ve davet eden çağrı', visualLink: 'Masada hazır bekleyen tabak', targetEffect: { kind: 'yap', note: 'Masaya oturmaya çağırır' }, basisFactIds: ['F3'], basisProductIds: [], basisBrandIds: [], interpretation: 'Çağrı tonu bir yaratıcı tercihtir', uncertainties: [], missingInfoNote: null },
  ],
});
export const CAPTION_TEXT = 'Öğle arası kendine bir masa kur. Beyaz örtülü masada porselen tabakta makarna, yanında zeytin kasesi. Telaşı kapıda bırak, sofraya otur.';
export const CAPTION_OK = (over: Record<string, unknown> = {}): any => ({
  caption: CAPTION_TEXT, observation: 'Masada makarna tabağı ve zeytin kasesi görünür.', rationale: 'Fikrin sakin mola açısı; F2 ve F4 olgularına dayanır.',
  sourceMap: [
    { segment: 'Beyaz örtülü masada porselen tabakta makarna', source: 'gorunur_gercek', ref: 'F2' },
    { segment: 'yanında zeytin kasesi', source: 'gorunur_gercek', ref: 'F4' },
    { segment: 'Telaşı kapıda bırak', source: 'yaratici_yorum', ref: null },
  ],
  ...over,
});
export const CHECK_OK = (): any => ({
  verdict: 'uygun', summary: 'Metin kanıta ve tona uygun.',
  findings: ['marka_dili', 'tekrar', 'niyet', 'gorsel_uyum', 'kanitsiz_iddia'].map((dimension) => ({ dimension, status: 'tamam', claim: null, reason: 'Sorun görülmedi.', sourceRef: null })),
});

export const IDEA: SelectedIdea = { sourceIdeaId: 'i1', mainMessage: 'Sade bir masada makarna keyfi', creativeAngle: 'Sakin öğle molası hissi', note: '', visualLink: 'Beyaz örtülü masada porselen tabaktaki makarna', factIds: ['F1', 'F2'], productIds: [], brandIds: [], edited: false };
export const DRAFT: CaptionDraft = { text: CAPTION_TEXT, sourceMap: CAPTION_OK().sourceMap, rationale: 'Fikrin sakin mola açısı.', humanEdited: false, locked: false };
export const base = (over: Record<string, unknown> = {}) => ({ projectId: P, mediaId: 'a1', crop: FULL, tempTone: { label: 'samimi' as const }, ...over });
export const ideasReq = (over: Record<string, unknown> = {}): CreativeRequest => ({ role: 'ideas', ...base(), ...over }) as CreativeRequest;
export const captionReq = (digest: string, over: Record<string, unknown> = {}): CreativeRequest => ({ role: 'caption', ...base(), idea: IDEA, evidenceDigest: digest, ...over }) as CreativeRequest;
export const checkReq = (digest: string, over: Record<string, unknown> = {}): CreativeRequest => ({ role: 'check', ...base(), idea: IDEA, caption: DRAFT, evidenceDigest: digest, ...over }) as CreativeRequest;
export const run = (db: any, m: Mock, req: CreativeRequest, tenantId = T, uid = 'u1') => runCreative(db, m.deps, { tenantId, projectId: P, uid, req });
export const catchErr = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as any; } throw new Error('hata beklendi'); };
export const sentOf = (fn: Fn) => fn.mock.calls[0][0] as { model: string; system: string; user: string };
