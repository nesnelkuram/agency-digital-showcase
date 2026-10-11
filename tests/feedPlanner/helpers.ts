import type { Aesthetics, Candidate } from '@/studio/feedPlanner/types';
import type { PlanCtx } from '@/studio/feedPlanner/planner';
import { templateTextFor } from '@/studio/feedPlanner/suggestionText';

export const aest = (o: Partial<Aesthetics> = {}): Aesthetics => ({
  measured: true, palette: ['#aa5533', '#eeddcc', '#331100', '#887766'], brightness: 0.5, warmth: 0.1, contrast: 0.2,
  density: 0.3, negativeSpace: 0.2, negativeZone: 'dağınık', ...o,
});

export const cand = (id: string, o: Partial<Candidate> = {}): Candidate => ({
  id, imageKey: `k-${id}`, brand: 'dieci', kind: 'photo', origin: 'canva', provenance: 'test', published: false,
  dims: { w: 1000, h: 1500 }, dimsSource: 'kaynak', group: 'pizza', note: '', aiMark: 'yok', humanPresence: 'hayır',
  semantic: { shotScale: 'bilinmiyor', subjectPos: 'bilinmiyor', source: 'bilinmiyor' }, aesthetics: aest(), ...o,
});

const groups = ['pizza', 'makarna', 'mekan_atmosfer', 'genel_yemek_tabagi', 'katlanmis_focaccia'];
/** 14 uygun fotoğraf + dışlanması gerekenler (video, yatay, başka marka, yayımlanmış) + 9 hikâye karesi */
export function pool(): { all: Candidate[]; ctx: PlanCtx; storyIds: string[]; eligible: string[] } {
  const all: Candidate[] = [];
  const eligible: string[] = [];
  for (let i = 0; i < 14; i++) {
    const c = cand(`p${i}`, {
      group: groups[i % groups.length],
      aesthetics: aest({ palette: [`#${(40 + i * 12).toString(16)}5533`, '#eeddcc', '#331100', '#887766'], density: 0.1 + (i % 5) * 0.15, negativeSpace: (i % 4) * 0.2, brightness: 0.35 + (i % 6) * 0.06 }),
    });
    all.push(c);
    eligible.push(c.id);
  }
  all.push(cand('video1', { kind: 'video_cover', dims: { w: 114, h: 200 } }));
  all.push(cand('wide1', { dims: { w: 3000, h: 1000 } }));
  all.push(cand('other1', { brand: 'baska' }));
  all.push(cand('hist1', { published: true, origin: 'history' }));
  all.push(cand('histOther', { published: true, brand: 'baska', origin: 'history' }));
  const storyIds: string[] = [];
  for (let i = 0; i < 9; i++) {
    const c = cand(`s${i}`, { weekFrame: { day: 'Pazartesi', frame: 1, copy: 'x' } });
    all.push(c);
    storyIds.push(c.id);
  }
  return { all, ctx: { brand: 'dieci', byId: new Map(all.map((c) => [c.id, c])), storyIds, textFor: templateTextFor }, storyIds, eligible };
}
