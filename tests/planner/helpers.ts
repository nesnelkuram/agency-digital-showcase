import type { BrandVoiceBundle } from '@/shared/planner/brandVoice';
import type { CopyItemRequest, CopyMedia, CopyRequest, ValidateCtx } from '@/shared/planner/copyContract';
import { sha256Hex } from '@/shared/planner/sha256';

const PERSONA = `# Persona\n${'Dieci sesi üzerine uzun açıklama. '.repeat(10)}\n### İmza Sözler\n- *"Biz çoktan seçtik. Siz sadece masaya oturun."*\n- *"Biz susacağız... tabaklar konuşacak."*\n\n---\nbitti`;
const LANG = `# Dil\n${'Dil rehberi metni. '.repeat(20)}\nDoğrulanmış menü adları (persona bölüm 7): The Ghosting (espresso), Lovebombing (tiramisu), Quattro Formaggi + acı bal. Alkol markası anılmaz.`;
const STYLE = `# Stiller\n${'Paylaşım stilleri. '.repeat(20)}`;

export const bundle = (over: Partial<BrandVoiceBundle> = {}): BrandVoiceBundle => ({
  schemaVersion: 1,
  brand: { name: 'Dieci', account: 'diecimoda' },
  builtFrom: { evidenceCount: 3, ownerFilter: 'diecimoda', excluded: [{ id: 'P10', reason: 'başka_hesap', owner: 'baska' }] },
  captions: [
    { id: 'P01', owner: 'diecimoda', date: '2026-10-04', format: 'Video', languageOrder: 'TR → EN', theme: 'Ürün', cta: 'x', caption: 'Büyük beklentilerin varsa anlaşırız. Jumbo spaghetti sarımsağın söz sahibi olduğu bir tabak.' },
    { id: 'P02', owner: 'diecimoda', date: '2026-09-11', format: 'Image', languageOrder: 'TR', theme: 'Zanaat', cta: 'x', caption: 'Hamur dinlenir, ateş bekler, masa sabreder.' },
  ],
  guides: { persona: PERSONA, languageGuide: LANG, shareStyles: STYLE },
  guideHashes: { persona: sha256Hex(PERSONA), languageGuide: sha256Hex(LANG), shareStyles: sha256Hex(STYLE) },
  verifiedProducts: [
    { id: 'the-ghosting', name: 'The Ghosting', note: 'espresso' },
    { id: 'lovebombing', name: 'Lovebombing', note: 'tiramisu' },
  ],
  ...over,
});

export const media = (id: string, over: Partial<CopyMedia> = {}): CopyMedia => ({
  mediaId: id,
  kind: 'photo',
  width: 1080,
  height: 1920,
  catalog: { subject: 'masada tabak', description: 'Beyaz örtülü masada porselen tabak.', tags: ['masa', 'tabak'], foodCategories: ['makarna'], visibleObjects: ['tabak', 'kadeh'], uncertainties: [] },
  verifiedProductIds: [],
  ...over,
});

export const feedItem = (slot: number, mediaId: string): CopyItemRequest => ({ slotKey: `feed:${slot}`, mediaId, lane: 'feed', role: 'caption' });
export const req = (items: CopyItemRequest[], avoidTexts?: string[]): CopyRequest => ({ projectId: 'p1', weekStart: '2026-10-12', items, ...(avoidTexts ? { avoidTexts } : {}) });
export const ctx = (ids: string[], over: Partial<ValidateCtx> = {}, mediaOver: Record<string, Partial<CopyMedia>> = {}): ValidateCtx => ({
  media: new Map(ids.map((i) => [i, media(i, mediaOver[i])])),
  bundle: bundle(),
  ...over,
});
export const out = (items: Array<Record<string, unknown>>) => ({ items: items.map((i) => ({ evidenceBasis: 'persona_kanaat', observation: 'Satırdaki olgulardan sade özet.', rationale: 'Persona kanaati.', ...i })), notes: [] });
