import type { Candidate } from '../types';
import { FORMATS } from '../types';
import { ratioOf, type Focus } from '../crop';
import { deriveLibraryAssetIds, POST_MAX_LIBRARY_ASSETS } from '../../../shared/types/brandMedia';
import type { MediaItem } from '../../../shared/types/socialMedia';
import type { Lane, PlanState } from '../planner';

/**
 * Plan slotundan MEVCUT taslak post sözleşmesine (shared/services/socialMediaService.createSocialPost girdisi,
 * studio/components/PlanSuggestPanel.addSuggestionsAsDrafts ile aynı alanlar) saf dönüşüm. Hiçbir şey yazmaz.
 * Dönüştürülemeyen slot için sebep döner; uydurma kayıt üretilmez.
 */
export interface CreateSocialPostInput {
  projectId: string;
  caption: string;
  media: MediaItem[];
  mediaUrls: string[];
  libraryAssetIds: string[];
  postType: 'static' | 'story' | 'reels';
  platforms: ['instagram'];
  tags: string[];
  scheduledAt?: string;
  contentPlanId?: string;
  gridPosition?: number;
}

export type DraftBlock = 'empty_slot' | 'identity_mismatch' | 'scope_mismatch' | 'not_studio_original' | 'storage_unverified' | 'missing_media_item' | 'reels_needs_one_video' | 'readiness_error' | 'caption_too_long';
export type DraftWarning =
  | 'scheduledAt_missing'
  | 'crop_not_persisted'
  | 'story_text_stored_as_caption'
  | 'text_lang_unverified'
  | 'text_is_local_template'
  | 'readiness_warning';

/** Slotun o anki sürümü: hazırlanan taslak bu sürüme aittir; slot değişirse eski taslak yazılmamalı. */
export interface SlotSnapshot {
  lane: Lane;
  slot: number;
  version: number;
  candidateId: string;
  textKey: string;
}

export const snapshotSlot = (state: PlanState, lane: Lane, slot: number): SlotSnapshot | null => {
  const id = state.slots[slot];
  return id ? { lane, slot, version: state.versions[slot], candidateId: id, textKey: JSON.stringify(state.texts[slot]) } : null;
};
export const isSnapshotStale = (snap: SlotSnapshot, state: PlanState): boolean =>
  state.slots[snap.slot] !== snap.candidateId || state.versions[snap.slot] !== snap.version || JSON.stringify(state.texts[snap.slot]) !== snap.textKey;

export const MAX_CAPTION = 2200;

export type DraftResult =
  | { ok: true; payload: CreateSocialPostInput; warnings: DraftWarning[]; snapshot: SlotSnapshot }
  | { ok: false; reason: DraftBlock; detail: string };

export function toDraftPost(a: {
  projectId: string;
  state: PlanState;
  lane: Lane;
  slot: number;
  candidate: Candidate | undefined;
  mediaItem: MediaItem | undefined;
  crop?: { focus: Focus; zoom: number };
  scheduledAt?: string;
  contentPlanId?: string;
  gridPosition?: number;
}): DraftResult {
  const snapshot = snapshotSlot(a.state, a.lane, a.slot);
  const c = a.candidate;
  if (!snapshot || !c) return { ok: false, reason: 'empty_slot', detail: 'Slot boş.' };
  // Slotun GERÇEK içeriği (medya + metin) ile verilen aday/medya öğesi aynı olmalı: başka medya/marka eşleştirmesi reddedilir.
  if (snapshot.candidateId !== c.id) return { ok: false, reason: 'identity_mismatch', detail: 'Verilen aday, slotun tuttuğu medya değil.' };
  if (c.brand !== a.projectId) return { ok: false, reason: 'scope_mismatch', detail: 'Aday başka bir marka/projeye ait.' };
  if (a.mediaItem && a.mediaItem.libraryAssetId !== c.id) return { ok: false, reason: 'identity_mismatch', detail: 'Medya öğesi bu adayın kütüphane varlığı değil.' };
  if (c.origin !== 'studio')
    return { ok: false, reason: 'not_studio_original', detail: 'Canva/yerel kayıt Studio orijinali değil: takvime/posta eklenemez (api/canva/folder.ts).' };
  if (c.storageVerified !== true) return { ok: false, reason: 'storage_unverified', detail: 'Depolama ilkesi (güvenilen host/bucket) doğrulanmadı: taslak yazılamaz.' };
  if (!a.mediaItem) return { ok: false, reason: 'missing_media_item', detail: 'Kütüphane varlığından medya öğesi üretilemedi.' };
  const format = a.state.formats[a.slot];
  const lane = FORMATS[format].lane;
  const postType = lane === 'feed' ? 'static' : lane === 'story' ? 'story' : 'reels';
  if (postType === 'reels' && c.kind !== 'video_cover')
    return { ok: false, reason: 'reels_needs_one_video', detail: 'Canlı şema Reels için tek video ister (reels_needs_one_video); fotoğraf Reels kapağı taslağı kaydedilemez.' };
  if (c.readiness?.[postType] === 'error') return { ok: false, reason: 'readiness_error', detail: `Instagram hazırlık denetimi (${postType}) geçmiyor.` };

  const text = a.state.texts[a.slot];
  const caption = [text?.headline, text?.body, text?.caption].filter(Boolean).join('\n');
  if (caption.length > MAX_CAPTION) return { ok: false, reason: 'caption_too_long', detail: `Metin ${MAX_CAPTION} karakteri aşıyor.` };

  const media = [{ ...a.mediaItem, order: 0 }];
  const libraryAssetIds = deriveLibraryAssetIds(media);
  if (libraryAssetIds.length > POST_MAX_LIBRARY_ASSETS) return { ok: false, reason: 'missing_media_item', detail: 'Kütüphane varlığı sınırı aşıldı.' };

  const warnings: DraftWarning[] = [];
  if (!a.scheduledAt) warnings.push('scheduledAt_missing');
  const srcRatio = c.dims.w / c.dims.h;
  if (Math.abs(srcRatio - ratioOf(format)) > 0.01 || (a.crop?.zoom ?? 1) > 1) warnings.push('crop_not_persisted');
  if (lane === 'story' && (text?.headline || text?.body)) warnings.push('story_text_stored_as_caption');
  if (text?.lang === 'unknown') warnings.push('text_lang_unverified');
  if (text?.source === 'template') warnings.push('text_is_local_template');
  if (c.readiness?.[postType] === 'warning') warnings.push('readiness_warning');

  return {
    ok: true,
    snapshot,
    warnings,
    payload: {
      projectId: a.projectId,
      caption,
      media,
      mediaUrls: media.map((m) => m.url),
      libraryAssetIds,
      postType,
      platforms: ['instagram'],
      // Yerel şablon/AI olmayan metin 'ai-taslak' ile etiketlenmez; AI olduğu iddia edilmez.
      tags: [],
      ...(a.scheduledAt ? { scheduledAt: a.scheduledAt } : {}),
      ...(a.contentPlanId ? { contentPlanId: a.contentPlanId } : {}),
      ...(a.gridPosition !== undefined ? { gridPosition: a.gridPosition } : {}),
    },
  };
}

export interface DraftPlanInput {
  projectId: string;
  title: string;
  /** Pazartesi, YYYY-MM-DD */
  weekStart: string;
  feed: PlanState;
  story: PlanState;
  byId: Map<string, Candidate>;
  mediaItems: Map<string, MediaItem>;
}

export interface DraftPlan {
  plan: { projectId: string; title: string; description: string; platform: 'instagram'; weekStartDate: string; weekEndDate: string };
  posts: Array<{ lane: Lane; slot: number; payload: CreateSocialPostInput; warnings: DraftWarning[]; snapshot: SlotSnapshot }>;
  blocked: Array<{ lane: Lane; slot: number; reason: DraftBlock; detail: string }>;
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Tüm planı taslak girdilerine çevirir. Yazım YAPMAZ; engellenen slotlar nedeniyle raporlanır. */
export function toDraftPlan(a: DraftPlanInput): DraftPlan {
  const out: DraftPlan = {
    plan: { projectId: a.projectId, title: a.title, description: '', platform: 'instagram', weekStartDate: a.weekStart, weekEndDate: addDays(a.weekStart, 6) },
    posts: [],
    blocked: [],
  };
  (['feed', 'story'] as Lane[]).forEach((lane) => {
    const st = lane === 'feed' ? a.feed : a.story;
    st.slots.forEach((id, slot) => {
      if (!id) return;
      const r = toDraftPost({ projectId: a.projectId, state: st, lane, slot, candidate: a.byId.get(id), mediaItem: a.mediaItems.get(id), gridPosition: lane === 'feed' ? slot : undefined });
      if (r.ok) out.posts.push({ lane, slot, payload: r.payload, warnings: r.warnings, snapshot: r.snapshot });
      else out.blocked.push({ lane, slot, reason: r.reason, detail: r.detail });
    });
  });
  return out;
}
