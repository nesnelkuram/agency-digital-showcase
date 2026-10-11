import type { PlannerDraft, DraftSlot, DraftText } from '@/shared/planner/plannerDraft';
import { copyContentHash } from '@/shared/planner/copyContract';
import { COPY_ISSUED, copyIssuedDocId } from '@/api/_lib/planCopy/planCopy';
import { correctionDocId } from '@/api/_lib/mediaAnalysis/spec';

export const RESP = 'resp-1';
/** Sunucunun ürettiği (hash'i gerçek medya+rol+metinden hesaplanmış) model metni */
export const issuedText = (mediaId: string, role: 'caption' | 'headline' | 'body', value: string): DraftText => {
  const text = { [role]: value } as { caption?: string; headline?: string; body?: string };
  return { ...text, source: 'model', lang: 'tr', evidenceBasis: 'persona_kanaat', contentHash: copyContentHash(mediaId, role, text), responseId: RESP, promptVersion: 'plan-copy-v1' };
};

export const slot = (mediaId: string, over: Partial<DraftSlot> = {}): DraftSlot => ({ mediaId, format: 'feed-4x5', locked: false, text: null, crop: null, seriesKey: null, ...over });
const pad = (xs: (DraftSlot | null)[]) => [...xs, ...Array(9 - xs.length).fill(null)] as (DraftSlot | null)[];

export const draft = (over: Partial<PlannerDraft> = {}): PlannerDraft => ({
  weekStart: '2026-10-12',
  feed: pad([
    slot('a1', { locked: true, text: issuedText('a1', 'caption', 'Sofrada kuralları biz koyarız, siz sadece oturun ve bakın.'), crop: { focus: { x: 0.3, y: 0.5 }, zoom: 1.5 } }),
    slot('a2', { format: 'reels-cover' }),
  ]),
  story: pad([
    slot('s1', { format: 'story', seriesKey: 'the-ghosting', locked: true, text: issuedText('s1', 'headline', 'Sabahın ilk kararı.') }),
    slot('s2', { format: 'story', seriesKey: 'the-ghosting', text: issuedText('s2', 'body', 'Bu masada karar çoktan verildi.') }),
  ]),
  dismissed: [{ lane: 'feed', mediaId: 'd1' }],
  rejected: [{ mediaId: 'r1', category: 'tekrar', note: 'geçen haftaya benziyor', scope: 'content_only' }],
  ...over,
});

/** Sunucu tarafı kanıt kayıtları: doğrulanmış ürün bağlantıları (the-ghosting) ve üretilmiş metin hash'leri (RESP). */
export const provenanceDocs = (tenantId = 't1', projectId = 'p1'): Array<[string, Record<string, unknown>]> => [
  ...['s1', 's2'].map((id): [string, Record<string, unknown>] => [`media_catalog_corrections/${correctionDocId(tenantId, projectId, id)}`, { tenantId, projectId, assetId: id, overrides: {}, verifiedProductIds: ['the-ghosting'], correctedBy: 'u', correctedAt: 1 }]),
  [`${COPY_ISSUED}/${copyIssuedDocId(tenantId, projectId, RESP)}`, {
    tenantId, projectId, responseId: RESP, issuedBy: 'u1', createdAt: 1,
    hashes: {
      [copyContentHash('a1', 'caption', { caption: 'Sofrada kuralları biz koyarız, siz sadece oturun ve bakın.' })]: 'a1',
      [copyContentHash('s1', 'headline', { headline: 'Sabahın ilk kararı.' })]: 's1',
      [copyContentHash('s2', 'body', { body: 'Bu masada karar çoktan verildi.' })]: 's2',
    },
  }],
];
