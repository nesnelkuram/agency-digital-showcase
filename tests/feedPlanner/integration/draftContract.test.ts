// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { toDraftPost, toDraftPlan, snapshotSlot, isSnapshotStale, MAX_CAPTION } from '@/studio/feedPlanner/integration/draftContract';
import { candidateFromBrandMedia } from '@/studio/feedPlanner/integration/fromBrandMedia';
import { emptyPlan, planFromIds, dismissSlot, replaceSlot, assignToSlot, type PlanCtx, type PlanState } from '@/studio/feedPlanner/planner';
import type { Candidate, SlotText } from '@/studio/feedPlanner/types';
import type { LiveBrandMediaAsset } from '@/studio/feedPlanner/integration/liveTypes';
import { dlUrl, POLICY, T, P } from './liveFixtures';

vi.mock('@/lib/firebase/config', () => ({ db: {}, storage: {} }));
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: vi.fn() }));
vi.mock('@/shared/services/socialMediaService', () => ({ createSocialPost: vi.fn() }));

const asset = (id: string, o: { w?: number; h?: number; kind?: 'photo' | 'video' } = {}): LiveBrandMediaAsset => {
  const p = `brand-media/${T}/${P}/${id}/${id}.jpg`;
  const kind = o.kind ?? 'photo';
  return { id, tenantId: T, projectId: P, kind, title: id, fileName: `${id}.jpg`, tags: [], status: 'active', createdBy: 'u1', storage: { path: p, downloadUrl: dlUrl(p), contentType: kind === 'video' ? 'video/mp4' : 'image/jpeg', size: 400_000, width: o.w ?? 1080, height: o.h ?? 1350, ...(kind === 'video' ? { duration: 20 } : {}) } };
};
const conv = (a: LiveBrandMediaAsset, verified = true) => {
  const r = candidateFromBrandMedia(a, { tenantId: T, projectId: P }, verified ? { policy: POLICY } : { allowUnverified: true });
  if (!r.ok) throw new Error(r.reason);
  return r;
};
const tpl = (o: Partial<SlotText> = {}): SlotText => ({ source: 'suggestion', lang: 'tr', caption: 'Biz çoktan seçtik.', ...o });
const stateWith = (id: string, format: 'feed-4x5' | 'story' | 'reels-cover' = 'feed-4x5', text: SlotText | null = tpl()): PlanState => {
  const s = planFromIds([id], format === 'story' ? 'story' : 'feed', [text]);
  s.formats[0] = format;
  return s;
};

describe('taslak post sözleşmesi (yazım yok)', () => {
  const photo = conv(asset('a1'));
  const base = (over: Record<string, unknown> = {}) => ({ projectId: P, state: stateWith('a1'), lane: 'feed' as const, slot: 0, candidate: photo.candidate, mediaItem: photo.mediaItem, ...over });

  it('başarılı: canlı createSocialPost girdisiyle aynı alanlar; yerel/AI olmayan metin ai-taslak etiketi almaz', () => {
    const r = toDraftPost(base({ scheduledAt: '2026-10-13T07:00:00.000Z', contentPlanId: 'plan1', gridPosition: 3 }) as any);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).toMatchObject({ projectId: P, caption: 'Biz çoktan seçtik.', postType: 'static', platforms: ['instagram'], tags: [], libraryAssetIds: ['a1'], mediaUrls: [photo.mediaItem.url], scheduledAt: '2026-10-13T07:00:00.000Z', contentPlanId: 'plan1', gridPosition: 3 });
    expect(r.payload.media[0]).toMatchObject({ libraryAssetId: 'a1', order: 0 });
    expect(r.snapshot).toMatchObject({ lane: 'feed', slot: 0, candidateId: 'a1', version: 0 });
    expect(r.warnings).toEqual([]);
  });

  it('PARİTE: payload anahtarları gerçek addSuggestionsAsDrafts çıktısının alt kümesi; fark açıkça: aiGeneratedCaption ve ai-taslak etiketi', async () => {
    const { addSuggestionsAsDrafts } = await import('@/studio/components/PlanSuggestPanel');
    const seen: any[] = [];
    await addSuggestionsAsDrafts(
      { tenantId: T, projectId: P, uid: 'u', name: 'n', posts: [{ index: 0, day: 0, time: '10:00', scheduledAt: '2026-10-13T07:00:00.000Z', postType: 'static', mediaIds: ['a1'], media: [photo.mediaItem], captionDraft: 'x', rationale: '', readinessWarnings: false, warnings: [], contentHash: 'a'.repeat(32) } as any] },
      (async (_t: string, data: any) => { seen.push(data); return 'id1'; }) as any,
    );
    const real = Object.keys(seen[0]);
    const ours = toDraftPost(base({ scheduledAt: '2026-10-13T07:00:00.000Z' }) as any);
    if (!ours.ok) throw new Error('beklenmedik');
    const ourKeys = Object.keys(ours.payload).filter((k) => k !== 'contentPlanId' && k !== 'gridPosition');
    expect(ourKeys.filter((k) => !real.includes(k))).toEqual([]);
    expect(real.filter((k) => !ourKeys.includes(k)).sort()).toEqual(['aiGeneratedCaption']);
    expect(seen[0].tags).toEqual(['ai-taslak']);
    expect(ours.payload.tags).toEqual([]);
  });

  it('kimlik eşleşmesi: verilen aday slotun tuttuğu medya değilse, medya öğesi başka varlıksa, marka başka projeyse REDDEDİLİR', () => {
    const other = conv(asset('a2'));
    expect(toDraftPost(base({ candidate: other.candidate, mediaItem: other.mediaItem }) as any)).toMatchObject({ ok: false, reason: 'identity_mismatch' });
    expect(toDraftPost(base({ mediaItem: other.mediaItem }) as any)).toMatchObject({ ok: false, reason: 'identity_mismatch' });
    expect(toDraftPost(base({ candidate: { ...photo.candidate, brand: 'p2' } }) as any)).toMatchObject({ ok: false, reason: 'scope_mismatch' });
    expect(toDraftPost(base({ projectId: 'p2' }) as any)).toMatchObject({ ok: false, reason: 'scope_mismatch' });
  });

  it('engeller: boş slot, Canva/yerel kayıt, doğrulanmamış depolama, eksik medya öğesi, uzun metin', () => {
    expect(toDraftPost(base({ state: emptyPlan(), candidate: undefined }) as any)).toMatchObject({ reason: 'empty_slot' });
    expect(toDraftPost(base({ candidate: { ...photo.candidate, origin: 'canva' } }) as any)).toMatchObject({ reason: 'not_studio_original' });
    const unv = conv(asset('a1'), false);
    expect(unv.candidate.storageVerified).toBe(false);
    expect(toDraftPost(base({ candidate: unv.candidate, mediaItem: unv.mediaItem }) as any)).toMatchObject({ reason: 'storage_unverified' });
    expect(toDraftPost(base({ mediaItem: undefined }) as any)).toMatchObject({ reason: 'missing_media_item' });
    expect(toDraftPost(base({ state: stateWith('a1', 'feed-4x5', tpl({ caption: 'x'.repeat(MAX_CAPTION + 1) })) }) as any)).toMatchObject({ reason: 'caption_too_long' });
    expect(toDraftPost(base({ state: stateWith('a1', 'feed-4x5', tpl({ caption: 'x'.repeat(MAX_CAPTION) })) }) as any).ok).toBe(true);
  });

  it('GERÇEK READINESS: özgün 3697×5546 feed için engellenir, Story için geçer', () => {
    const big = conv(asset('big', { w: 3697, h: 5546 }));
    expect(toDraftPost({ projectId: P, state: stateWith('big'), lane: 'feed', slot: 0, candidate: big.candidate, mediaItem: big.mediaItem })).toMatchObject({ ok: false, reason: 'readiness_error' });
    const st = toDraftPost({ projectId: P, state: stateWith('big', 'story'), lane: 'story', slot: 0, candidate: big.candidate, mediaItem: big.mediaItem });
    expect(st.ok && st.payload.postType).toBe('story');
  });

  it('Reels: fotoğraf kaydedilemez (canlı şema tek video ister); video kapağı reels olur', () => {
    expect(toDraftPost(base({ state: stateWith('a1', 'reels-cover') }) as any)).toMatchObject({ ok: false, reason: 'reels_needs_one_video' });
    const v = conv(asset('v1', { kind: 'video', w: 1080, h: 1920 }));
    const r = toDraftPost({ projectId: P, state: stateWith('v1', 'reels-cover'), lane: 'feed', slot: 0, candidate: v.candidate, mediaItem: v.mediaItem });
    expect(r.ok && r.payload.postType).toBe('reels');
  });

  it('uyarılar açıkça: saat yok, kırpma kalıcı değil, Story metni caption, dil doğrulanamadı, yerel şablon', () => {
    const r = toDraftPost({ projectId: P, state: stateWith('a1', 'story', tpl({ headline: 'Başlık', caption: undefined, lang: 'unknown', source: 'template' })), lane: 'story', slot: 0, candidate: photo.candidate, mediaItem: photo.mediaItem, crop: { focus: { x: 0.5, y: 0.5 }, zoom: 1.5 } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.sort()).toEqual(['crop_not_persisted', 'scheduledAt_missing', 'story_text_stored_as_caption', 'text_is_local_template', 'text_lang_unverified'].sort());
    expect(r.payload.caption).toBe('Başlık');
    expect(r.payload).not.toHaveProperty('scheduledAt');
  });

  it('atomik sürüm: slot değişince (başka medya) veya aynı medyanın metni değişince hazırlanan taslak ESKİ sayılır', () => {
    const cands = ['a1', 'a2', 'a3', 'a4'].map((id) => conv(asset(id)).candidate);
    const byId = new Map(cands.map((c) => [c.id, c]));
    const ctx: PlanCtx = { brand: P, byId, storyIds: [] };
    const s0 = planFromIds(['a1'], 'feed', [tpl()]);
    const snap = snapshotSlot(s0, 'feed', 0)!;
    expect(isSnapshotStale(snap, s0)).toBe(false);
    // 1) başka medya (eleme)
    const dismissed = dismissSlot(0, s0, ctx, 0);
    expect(dismissed.state.slots[0]).not.toBe('a1');
    expect(isSnapshotStale(snap, dismissed.state)).toBe(true);
    // 2) aynı medya, farklı metin
    const sameMediaNewText: PlanState = { ...s0, texts: [tpl({ caption: 'Başka metin' }), ...s0.texts.slice(1)] };
    expect(isSnapshotStale(snap, sameMediaNewText)).toBe(true);
    // 3) aynı medya ve metin, yalnız sürüm sayacı değişti
    expect(isSnapshotStale(snap, { ...s0, versions: s0.versions.map((v, i) => (i === 0 ? v + 1 : v)) })).toBe(true);
    // replace/assign sonrası da eski
    expect(isSnapshotStale(snap, replaceSlot(0, s0, ctx).state)).toBe(true);
    expect(isSnapshotStale(snap, assignToSlot('a3', 0, s0, ctx).state)).toBe(true);
  });

  it('plan dönüşümü: yazılabilenler ve engellenenler ayrı; hafta sonu +6 gün; ızgara sırası feed slotundan', () => {
    const a1 = conv(asset('a1'));
    const big = conv(asset('big', { w: 3697, h: 5546 }));
    const feed = planFromIds(['a1', 'big'], 'feed', [tpl(), tpl()]);
    const story = planFromIds(['big'], 'story', [tpl()]);
    const out = toDraftPlan({
      projectId: P, title: 'Dieci hafta', weekStart: '2026-10-12', feed, story,
      byId: new Map([a1, big].map((r) => [r.candidate.id, r.candidate as Candidate])), mediaItems: new Map([a1, big].map((r) => [r.candidate.id, r.mediaItem])),
    });
    expect(out.plan).toMatchObject({ platform: 'instagram', weekStartDate: '2026-10-12', weekEndDate: '2026-10-18' });
    expect(out.posts.map((p) => `${p.lane}:${p.slot}`)).toEqual(['feed:0', 'story:0']);
    expect(out.posts[0].payload.gridPosition).toBe(0);
    expect(out.posts[1].payload.gridPosition).toBeUndefined();
    expect(out.blocked).toEqual([{ lane: 'feed', slot: 1, reason: 'readiness_error', detail: expect.any(String) }]);
  });
});
