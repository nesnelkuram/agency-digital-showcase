import type { Candidate, FormatId, SlotText } from './types';
import { FEED_SLOTS, emptyPlan, type PlanState, type Lane } from './planner';
import { validatePlannerDraft, type DraftSlot, type DraftText, type PlannerDraft, type DraftRejected } from '../../shared/planner/plannerDraft';
import type { Focus } from './crop';

/**
 * PlanState ↔ kalıcı taslak. Kilit slotun KENDİSİNDE saklanır (görsel + metin + kırpma + seri birlikte). Kodlayıcı
 * şablon kaynaklı ('template'/'suggestion') metni KALICI saklamaz (hata döner): kalıcılığa yalnız model/plan metni girer.
 */
export interface CropState {
  focus: Focus;
  zoom: number;
}
export interface RejectionReason {
  category: string;
  note: string;
  scope: string;
}

export type EncodeResult = { ok: true; draft: PlannerDraft } | { ok: false; errors: string[] };

const toDraftText = (t: SlotText | null, where: string, errors: string[]): DraftText | null => {
  if (!t) return null;
  if (t.source !== 'model' && t.source !== 'plan' && t.source !== 'manual') {
    errors.push(`${where}: '${t.source}' kaynaklı metin kalıcı saklanamaz (yalnız gerçek model, plan veya elle girilmiş metin)`);
    return null;
  }
  const out: DraftText = { source: t.source, lang: t.lang };
  const modelOnly = t.source === 'model';
  if (t.headline) out.headline = t.headline;
  if (t.body) out.body = t.body;
  if (t.caption) out.caption = t.caption;
  if (modelOnly && t.evidenceBasis) out.evidenceBasis = t.evidenceBasis;
  if (modelOnly && t.voiceSource) out.voiceSource = t.voiceSource;
  if (modelOnly && t.contentHash) out.contentHash = t.contentHash;
  if (modelOnly && t.responseId) out.responseId = t.responseId;
  if (modelOnly && t.promptVersion) out.promptVersion = t.promptVersion;
  return out;
};

export function encodeDraft(a: {
  weekStart: string;
  feed: PlanState;
  story: PlanState;
  crops: Record<string, CropState>;
  rejections: Record<string, RejectionReason>;
  /** Story slot indeksine göre GERÇEK seri kimliği (yok = null) */
  storySeriesKeys: (string | null)[];
}): EncodeResult {
  const errors: string[] = [];
  const lane = (st: PlanState, name: Lane): (DraftSlot | null)[] =>
    Array.from({ length: FEED_SLOTS }, (_, i) => {
      const id = st.slots[i];
      if (!id) return null;
      return {
        mediaId: id,
        format: st.formats[i],
        locked: !!st.locked[i],
        text: toDraftText(st.texts[i], `${name}[${i}]`, errors),
        crop: a.crops[id] ? { focus: { x: a.crops[id].focus.x, y: a.crops[id].focus.y }, zoom: a.crops[id].zoom } : null,
        seriesKey: name === 'story' ? a.storySeriesKeys[i] ?? null : null,
      };
    });
  const dismissed = (['feed', 'story'] as Lane[]).flatMap((l) => (l === 'feed' ? a.feed : a.story).dismissed.map((mediaId) => ({ lane: l, mediaId })));
  const rejected: DraftRejected[] = Object.entries(a.rejections).map(([mediaId, r]) => ({ mediaId, category: r.category, note: r.note, scope: r.scope }));
  const draft: PlannerDraft = { weekStart: a.weekStart, feed: lane(a.feed, 'feed'), story: lane(a.story, 'story'), dismissed, rejected };
  if (errors.length) return { ok: false, errors };
  const v = validatePlannerDraft(draft);
  return v.ok ? { ok: true, draft: v.draft } : { ok: false, errors: v.errors };
}

export interface DecodeResult {
  feed: PlanState;
  story: PlanState;
  crops: Record<string, CropState>;
  rejections: Record<string, RejectionReason>;
  /** Kayıtlı ama envanterde artık bulunmayan medya: slot BOŞALTILDI ve raporlanır (sessiz değil) */
  dropped: Array<{ lane: Lane; slot: number; mediaId: string; reason: 'not_in_inventory' }>;
}

export function decodeDraft(draft: PlannerDraft, byId: Map<string, Candidate>): DecodeResult {
  const feed = emptyPlan('feed');
  const story = emptyPlan('story');
  const crops: Record<string, CropState> = {};
  const dropped: DecodeResult['dropped'] = [];
  const apply = (st: PlanState, arr: (DraftSlot | null)[], name: Lane) => {
    arr.forEach((s, i) => {
      if (!s) return;
      if (!byId.has(s.mediaId)) { dropped.push({ lane: name, slot: i, mediaId: s.mediaId, reason: 'not_in_inventory' }); return; }
      st.slots[i] = s.mediaId;
      st.formats[i] = s.format as FormatId;
      st.locked[i] = s.locked;
      st.texts[i] = s.text ? ({ ...s.text } as SlotText) : null;
      st.versions[i] = 1;
      if (s.crop) crops[s.mediaId] = { focus: { ...s.crop.focus }, zoom: s.crop.zoom };
    });
  };
  apply(feed, draft.feed, 'feed');
  apply(story, draft.story, 'story');
  for (const d of draft.dismissed) (d.lane === 'feed' ? feed : story).dismissed.push(d.mediaId);
  const rejections: Record<string, RejectionReason> = {};
  for (const r of draft.rejected) {
    rejections[r.mediaId] = { category: r.category, note: r.note, scope: r.scope };
    feed.rejected.push(r.mediaId);
    story.rejected.push(r.mediaId);
  }
  return { feed, story, crops, rejections, dropped };
}
