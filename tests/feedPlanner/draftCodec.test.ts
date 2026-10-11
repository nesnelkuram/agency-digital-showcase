import { describe, it, expect } from 'vitest';
import { encodeDraft, decodeDraft } from '@/studio/feedPlanner/draftCodec';
import { emptyPlan, type PlanState } from '@/studio/feedPlanner/planner';
import type { SlotText } from '@/studio/feedPlanner/types';
import { cand } from './helpers';

const model = (caption: string): SlotText => ({ caption, source: 'model', lang: 'tr', evidenceBasis: 'persona_kanaat', contentHash: 'a'.repeat(32), responseId: 'r1', promptVersion: 'plan-copy-v1' });
const withSlots = (lane: 'feed' | 'story', fill: Record<number, { id: string; text?: SlotText | null; locked?: boolean; format?: any }>): PlanState => {
  const st = emptyPlan(lane);
  for (const [k, v] of Object.entries(fill)) {
    const i = Number(k);
    st.slots[i] = v.id; st.texts[i] = v.text ?? null; st.locked[i] = !!v.locked; if (v.format) st.formats[i] = v.format; st.versions[i] = 3;
  }
  return st;
};
const base = { weekStart: '2026-10-12', crops: {}, rejections: {}, storySeriesKeys: Array(9).fill(null) as (string | null)[] };

describe('PlanState ↔ kalıcı taslak', () => {
  it('gidiş-dönüş: slotlar, format, Kalsın, model metni, kırpma, Story seri kimliği, eleme ve gerekçeli ret birebir korunur', () => {
    const feed = withSlots('feed', { 0: { id: 'a1', text: model('Sofrada sakinlik.'), locked: true }, 1: { id: 'a2', format: 'reels-cover' } });
    feed.dismissed = ['d1'];
    const story = withSlots('story', { 0: { id: 's1', text: { headline: 'Sabah.', source: 'model', lang: 'tr', contentHash: 'b'.repeat(32), responseId: 'r1' }, format: 'story' }, 1: { id: 's2', text: { body: 'Devam.', source: 'plan', lang: 'tr' }, format: 'story' } });
    const enc = encodeDraft({ ...base, feed, story, crops: { a1: { focus: { x: 0.3, y: 0.6 }, zoom: 1.5 } }, rejections: { r1: { category: 'tekrar', note: 'benziyor', scope: 'content_only' } }, storySeriesKeys: ['the-ghosting', 'the-ghosting', ...Array(7).fill(null)] });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    expect(enc.draft.feed[0]).toMatchObject({ mediaId: 'a1', locked: true, crop: { zoom: 1.5 }, seriesKey: null, text: { source: 'model', caption: 'Sofrada sakinlik.', responseId: 'r1' } });
    expect(enc.draft.story[1]).toMatchObject({ seriesKey: 'the-ghosting', text: { source: 'plan', body: 'Devam.' } });
    expect(enc.draft.story[1]!.text).not.toHaveProperty('contentHash'); // plan metni model kanıtı taşımaz
    const byId = new Map(['a1', 'a2', 's1', 's2', 'd1', 'r1'].map((id) => [id, cand(id)]));
    const dec = decodeDraft(JSON.parse(JSON.stringify(enc.draft)), byId);
    expect(dec.dropped).toEqual([]);
    expect(dec.feed.slots.slice(0, 2)).toEqual(['a1', 'a2']);
    expect(dec.feed.locked[0]).toBe(true);
    expect(dec.feed.formats[1]).toBe('reels-cover');
    expect(dec.feed.texts[0]).toMatchObject({ caption: 'Sofrada sakinlik.', source: 'model' });
    expect(dec.feed.dismissed).toEqual(['d1']);
    expect(dec.feed.rejected).toEqual(['r1']);
    expect(dec.story.rejected).toEqual(['r1']);
    expect(dec.crops.a1).toEqual({ focus: { x: 0.3, y: 0.6 }, zoom: 1.5 });
    expect(dec.rejections.r1).toEqual({ category: 'tekrar', note: 'benziyor', scope: 'content_only' });
  });

  it('şablon/öneri kaynaklı metin KALICI saklanmaz: açık hata (başarı iddiası yok)', () => {
    for (const source of ['template', 'suggestion'] as const) {
      const feed = withSlots('feed', { 0: { id: 'a1', text: { caption: 'x', source, lang: 'tr' } } });
      const enc = encodeDraft({ ...base, feed, story: emptyPlan('story') });
      expect(enc.ok).toBe(false);
      expect(!enc.ok && enc.errors.join()).toMatch(new RegExp(`'${source}' kaynaklı metin kalıcı saklanamaz`));
    }
  });

  it('manual metin saklanır ve model kanıtı taşımaz (taşıyorsa bile kodlayıcı atar)', () => {
    const feed = withSlots('feed', { 0: { id: 'a1', text: { caption: 'Elle.', source: 'manual', lang: 'tr', contentHash: 'c'.repeat(32), responseId: 'x' } } });
    const enc = encodeDraft({ ...base, feed, story: emptyPlan('story') });
    expect(enc.ok && enc.draft.feed[0]!.text).toEqual({ source: 'manual', lang: 'tr', caption: 'Elle.' });
  });

  it('şema ihlali (ör. aynı medya iki şeritte) kodlayıcıda yakalanır', () => {
    const enc = encodeDraft({ ...base, feed: withSlots('feed', { 0: { id: 'a1' } }), story: withSlots('story', { 0: { id: 'a1', format: 'story' } }) });
    expect(enc.ok).toBe(false);
  });

  it('envanterde artık olmayan medya: slot BOŞALTILIR ve raporlanır (sessiz değil); diğerleri korunur', () => {
    const feed = withSlots('feed', { 0: { id: 'a1', text: model('x') }, 1: { id: 'gone' } });
    const enc = encodeDraft({ ...base, feed, story: emptyPlan('story') });
    if (!enc.ok) throw new Error(enc.errors.join());
    const dec = decodeDraft(enc.draft, new Map([['a1', cand('a1')]]));
    expect(dec.feed.slots[0]).toBe('a1');
    expect(dec.feed.slots[1]).toBeNull();
    expect(dec.dropped).toEqual([{ lane: 'feed', slot: 1, mediaId: 'gone', reason: 'not_in_inventory' }]);
  });
});
