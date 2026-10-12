import { vi } from 'vitest';
import { buildEvidence, CHECK_DIMENSIONS, type CaptionResponse, type CheckResponse, type CreativeRequest, type CreativeRole, type IdeasResponse } from '@/shared/planner/creativeContract';
import { reviewPorts, PortError, type CreativePort, type PlannerPorts } from '@/studio/feedPlanner/ports';

export const EV = buildEvidence({
  catalog: { subject: 'masada makarna tabağı', description: 'Beyaz örtülü masada porselen tabakta makarna.', tags: [], visibleObjects: ['tabak'], foodCategories: ['makarna'], uncertainties: ['sos içeriği görünmüyor'], source: 'ai' },
  visibility: { cropped: false, facts: 'tam' },
});
export const VOICE = { source: 'temporary_tone' as const, guideVersion: null, assumptions: ['Geçici ton'], tempToneIgnored: false };
const meta = (id: string) => ({ responseId: id, model: 'mock/model', requestedModel: 'mock/model', provider: 'mock', requestId: null, promptVersion: 'mock-p', schemaVersion: 's', usage: null });
let seq = 0;
export const ideasResp = (o: Partial<IdeasResponse> = {}): IdeasResponse => {
  const n = ++seq;
  return {
    role: 'ideas', status: 'ok', missingInfo: null, blockReason: null, evidence: EV, voice: VOICE, budget: null, cached: false, meta: meta(`ri${n}`), source: { analysisKey: null, sourceSha256: null }, draftOnly: true,
    ideas: [1, 2, 3].map((i) => ({
      id: `i${i}` as 'i1', mainMessage: `Ana mesaj ${i} (${n})`, creativeAngle: `Açı ${i} (${n})`, visualLink: `Tabak bağlantısı ${i}`, targetEffect: { kind: 'hisset' as const, note: 'sakinlik' },
      basis: { factIds: ['F1', 'F2'], productIds: [], brandIds: [] }, interpretation: `Yaratıcı yorum ${i}`, uncertainties: ['sos bilinmiyor'], missingInfoNote: null,
    })),
    ...o,
  };
};
export const captionResp = (text: string, o: Partial<CaptionResponse> = {}): CaptionResponse => ({
  role: 'caption', evidence: EV, voice: VOICE, budget: null, cached: false, meta: meta(`rc${++seq}`), source: { analysisKey: null, sourceSha256: null }, draftOnly: true,
  caption: { text, contentHash: `h${seq}`, evidenceBasis: 'katalog_gozlem', observation: 'Masada makarna tabağı var.', rationale: 'Seçilen fikrin açısı ve F2 olgusu.', sourceMap: [{ segment: 'makarna', source: 'gorunur_gercek', ref: 'F2' }], warnings: [] },
  ...o,
});
export const checkResp = (captionHash: string, o: Partial<CheckResponse> = {}): CheckResponse => ({
  role: 'check', evidence: EV, voice: VOICE, budget: null, cached: false, meta: meta(`rv${++seq}`), source: { analysisKey: null, sourceSha256: null }, draftOnly: true, captionHash,
  verdict: 'uygun', summary: 'Mock kontrol: uygun.', codeReasons: [],
  findings: [...CHECK_DIMENSIONS.map((d) => ({ dimension: d, status: 'tamam' as const, claim: null, reason: 'Mock', sourceRef: null, origin: 'model' as const })), { dimension: 'insan_kilit' as const, status: 'tamam' as const, claim: null, reason: 'Kontrol metni değiştirmez.', sourceRef: null, origin: 'kod' as const }],
  ...o,
});

type Handler = (req: any, o: { signal?: AbortSignal }) => Promise<any> | any;
/** Sahte yaratıcı port: SIFIR gerçek sağlayıcı. calls = gelen istekler (rol bazlı sayılabilir). */
export function mkPort(handlers: Partial<Record<CreativeRole, Handler>> = {}, captionTexts: string[] = []) {
  const calls: CreativeRequest[] = [];
  let cap = 0;
  const run = vi.fn(async (req: CreativeRequest, o: { signal?: AbortSignal } = {}) => {
    calls.push(req);
    const h = handlers[req.role];
    if (h) return h(req, o);
    if (req.role === 'ideas') return ideasResp();
    if (req.role === 'caption') return captionResp(captionTexts[cap++] ?? `Masadaki makarna tabağı bugün de sofrada. Metin ${cap}`);
    return checkResp((await import('@/studio/feedPlanner/post/creativeState')).textHash(req.caption.text));
  });
  const port: CreativePort & { calls: CreativeRequest[]; run: typeof run; count: (r: CreativeRole) => number } = { available: true, run, calls, count: (r) => calls.filter((c) => c.role === r).length };
  return port;
}
export const portsWith = (creative: CreativePort): PlannerPorts => ({ ...reviewPorts(), mode: 'studio', imageSrc: () => '/__mock/image.svg', creative, persistence: null });
export { PortError };
