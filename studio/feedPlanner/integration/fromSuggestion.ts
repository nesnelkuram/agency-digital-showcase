import type { Candidate, FormatId, SlotText } from '../types';
import { emptyPlan, FEED_SLOTS, type PlanState } from '../planner';
import { seriesRoles, type StoryRole } from '../storyLayout';
import { detectLang } from './language';
import type { LiveSuggestionResponse, LiveValidatedPost } from './liveTypes';

/** Sunucuda saklanmış öneri kümesine bağ: ret sebebi kaydı (api/studio/feedback) bu üçlüyle yapılır. */
export interface SuggestionRef {
  suggestionSetId: string;
  index: number;
  contentHash: string;
  scheduledAt: string;
  postType: LiveValidatedPost['postType'];
}

export interface PlacedMeta {
  rationale: string;
  warnings: string[];
  readinessWarnings: boolean;
  scheduledAt: string;
}

export type UnplacedReason = 'carousel_multi_media' | 'candidate_missing' | 'slot_limit';

/**
 * Story serisi: canlı şemada gerçek seri kimliği/rol alanı YOK (api/_lib/planSuggest; her story ayrı post).
 * Burada yalnız ÇIKARIM vardır: aynı marka-yerel gündeki ardışık story'ler. Aynı gün FARKLI ürünler de bu
 * kurala göre "seri" görünür; bu yüzden supported=false'tur ve roller yalnız bilgi amaçlıdır — metin başlık/gövdeye
 * dağıtılmaz, hiyerarşi denetimi bu çıkarımdan yapılmaz.
 */
export interface SeriesAdvisory {
  supported: false;
  basis: 'inferred_same_local_day';
  caveat: string;
  /** Yerleştirilen story slotlarıyla BİREBİR hizalı (uzunluk = yerleştirilen story sayısı) */
  inferredRoles: StoryRole[];
  localDays: string[];
}

export interface FromSuggestionResult {
  feed: PlanState;
  story: PlanState;
  /** Anahtar `${lane}:${slot}`; öneri kümesi saklanmadıysa boş (ret sebebi bağlanamaz) */
  refs: Record<string, SuggestionRef>;
  meta: Record<string, PlacedMeta>;
  series: SeriesAdvisory;
  unplaced: Array<{ index: number; reason: UnplacedReason }>;
  shortages: string[];
  notes: string[];
}

const FORMAT_FOR: Record<LiveValidatedPost['postType'], FormatId> = {
  static: 'feed-4x5',
  carousel: 'feed-4x5',
  story: 'story',
  reels: 'reels-cover',
};

/** Marka saat dilimindeki yerel gün (YYYY-MM-DD). Geçersiz saat dilimi açık hatadır; UTC'ye sessiz düşülmez. */
export function localDay(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`scheduledAt geçersiz: ${iso}`);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/**
 * Sunucuda DOĞRULANMIŞ öneriyi planlayıcı durumuna çevirir (saf; ağ yok). Varsayımlar açıkça notlanır:
 *  - Izgara sırası = zamana göre artan (canlı şemada ızgara sırası kavramı öneride yok).
 *  - Carousel (çok medya) tek slotla temsil edilemez → yerleştirilmez, "unplaced" olarak bildirilir.
 *  - Yerleştirilemeyen kareler slotları/rolleri KAYDIRMAZ: roller yalnız yerleştirilen story'lerden, slot sırasıyla kurulur.
 *  - Gün sınırı marka saat dilimine göredir (UTC günü değil).
 *  - Dil: sunucu dili denetlemez; her metin sezgiyle işaretlenir (tr/en/unknown). Story metni caption olarak taşınır.
 */
export function planFromSuggestion(resp: LiveSuggestionResponse, byId: Map<string, Candidate>, opts: { timeZone: string }): FromSuggestionResult {
  const feed = emptyPlan('feed');
  const story = emptyPlan('story');
  const refs: FromSuggestionResult['refs'] = {};
  const meta: FromSuggestionResult['meta'] = {};
  const unplaced: FromSuggestionResult['unplaced'] = [];
  const notes: string[] = [];
  if (!resp.suggestionSetId) notes.push('Öneri kümesi saklanmadı (suggestionSetId yok): ret sebebi bu önerilere bağlanamaz.');
  notes.push('Izgara sırası zamana göre varsayıldı; canlı öneri şemasında ızgara sırası yok.');

  const ordered = [...resp.accepted].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.index - b.index);
  const place = (lane: 'feed' | 'story', st: PlanState, p: LiveValidatedPost, slot: number) => {
    st.slots[slot] = p.mediaIds[0];
    st.formats[slot] = FORMAT_FOR[p.postType];
    st.texts[slot] = { source: 'suggestion', lang: detectLang(p.captionDraft), caption: p.captionDraft } as SlotText;
    st.versions[slot] = 1;
    if (resp.suggestionSetId) refs[`${lane}:${slot}`] = { suggestionSetId: resp.suggestionSetId, index: p.index, contentHash: p.contentHash, scheduledAt: p.scheduledAt, postType: p.postType };
    meta[`${lane}:${slot}`] = { rationale: p.rationale, warnings: p.warnings, readinessWarnings: p.readinessWarnings, scheduledAt: p.scheduledAt };
  };

  let feedN = 0;
  let storyN = 0;
  const placedStoryDays: string[] = [];
  const skippedStoryDays: string[] = [];
  for (const p of ordered) {
    const isStory = p.postType === 'story';
    const skip = (reason: UnplacedReason) => {
      unplaced.push({ index: p.index, reason });
      if (isStory) skippedStoryDays.push(localDay(p.scheduledAt, opts.timeZone));
    };
    if (p.mediaIds.length !== 1) { skip('carousel_multi_media'); continue; }
    if (!byId.has(p.mediaIds[0])) { skip('candidate_missing'); continue; }
    if (isStory) {
      if (storyN >= FEED_SLOTS) { skip('slot_limit'); continue; }
      placedStoryDays.push(localDay(p.scheduledAt, opts.timeZone));
      place('story', story, p, storyN++);
    } else {
      if (feedN >= FEED_SLOTS) { skip('slot_limit'); continue; }
      place('feed', feed, p, feedN++);
    }
  }
  if (skippedStoryDays.length) notes.push(`Yerleştirilemeyen story kareleri var (${[...new Set(skippedStoryDays)].join(', ')}): çıkarımsal seriler eksik olabilir.`);
  return {
    feed,
    story,
    refs,
    meta,
    series: {
      supported: false,
      basis: 'inferred_same_local_day',
      caveat: 'Canlı şemada seri kimliği/rolü yok. Aynı yerel gündeki ardışık story\'ler çıkarımla gruplanır; farklı ürünler de aynı seriye düşebilir. Rol bilgi amaçlıdır, metin buna göre dağıtılmaz.',
      inferredRoles: seriesRoles(placedStoryDays),
      localDays: placedStoryDays,
    },
    unplaced,
    shortages: resp.shortages,
    notes,
  };
}
