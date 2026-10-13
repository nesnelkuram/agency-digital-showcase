// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { analyzeBrandMedia, decideClaim, isRetryableModelError, selectAnalysisSource, type AnalysisRecord, type AnalysisStore, type BrandMediaLike, type ModelCall } from '@/api/_lib/mediaAnalysis/runner';
import { analysisOutput, visual } from './helpers/visualFixture';
import { CATALOG_MODEL, CATALOG_SYSTEM_PROMPT, ImageCatalogSchema, analysisKey, estimateCostUsd, normalizeCatalog, toPlannerLine, type ImageCatalog } from '@/api/_lib/mediaAnalysis/spec';

const catalog: ImageCatalog = {
  subject: 'masada tatlı ve kahve',
  description: 'Beyaz tabakta bir dilim tatlı ve yanında bir fincan kahve.',
  tags: ['Tatlı', 'kahve', 'tatlı'],
  visibleObjects: ['tabak', 'fincan'],
  foodCategories: ['tatlı', 'içecek'],
  composition: { shotType: 'yakın_çekim', orientation: 'dikey', hasTextOverlay: false, subjectPlacement: 'merkez', negativeSpace: true },
  productIdentity: { status: 'genel_kategori', note: 'tatlı türü görünmüyor' },
  usageSuggestions: ['story', 'feed', 'story'],
  peoplePresent: false,
  uncertainties: ['tatlının içeriği görünmüyor'],
  planningNotes: ['dikey kadraj hikâyeye uygun'],
  overallConfidence: 'orta',
};

function memStore(): AnalysisStore & { recs: Map<string, AnalysisRecord> } {
  const recs = new Map<string, AnalysisRecord>();
  return {
    recs,
    async get(k) {
      return recs.get(k) ? { ...recs.get(k)! } : null;
    },
    async claim(k, init, now) {
      const ex = recs.get(k) || null;
      const d = decideClaim(ex, now);
      if (d === 'skip') return { claimed: false, record: ex! };
      if (d === 'exhaust') {
        const closed = { ...ex!, status: 'failed' as const, retryable: false, leaseUntil: null, leaseOwner: null, error: { code: 'attempts_exhausted', message: 'x' } };
        recs.set(k, closed);
        return { claimed: false, record: closed };
      }
      const rec = d === 'new' ? init : { ...ex!, status: 'running' as const, attempts: ex!.attempts + 1, leaseUntil: init.leaseUntil, leaseOwner: init.leaseOwner };
      recs.set(k, rec);
      return { claimed: true, record: rec };
    },
    async update(k, owner, p) {
      if (recs.get(k)?.leaseOwner !== owner) return false;
      recs.set(k, { ...recs.get(k)!, ...p });
      return true;
    },
    async setLatest() {},
  };
}

const asset = (over: Partial<BrandMediaLike['storage']> = {}, kind: 'photo' | 'video' = 'photo'): BrandMediaLike => ({
  id: 'a1',
  tenantId: 't1',
  projectId: 'p1',
  kind,
  status: 'active',
  storage: { path: 'brand-media/t1/p1/a1/x.jpg', contentType: 'image/jpeg', size: 2_000_000, width: 3000, height: 4000, thumbPath: 'brand-media/t1/p1/a1/thumb.jpg', ...over },
});

const usageDetail = { inputTokens: 5000, outputTokens: 600, totalTokens: 5600, cachedTokens: 0, reasoningTokens: 120, costUsd: 0.0031 };
const okCall = () => vi.fn<ModelCall>(async () => ({ id: 'gen-1', stopReason: 'end_turn', usageDetail, parsed: analysisOutput(catalog), provider: 'openrouter', modelUsed: 'anthropic/claude-haiku-5.5', requestId: 'req-1aB2cD34' }));

describe('kaynak seçimi (orijinal / önizleme açıkça)', () => {
  it('API sınırına uyan orijinal → original; büyük orijinal → studio_preview; boyut bilinmiyorsa önizleme', () => {
    expect(selectAnalysisSource(asset())).toMatchObject({ quality: 'original' });
    expect(selectAnalysisSource(asset({ size: 17_400_000, width: 3840, height: 5760 }))).toMatchObject({ quality: 'studio_preview', path: 'brand-media/t1/p1/a1/thumb.jpg' });
    expect(selectAnalysisSource(asset({ width: 9000 }))).toMatchObject({ quality: 'studio_preview' });
    expect(selectAnalysisSource(asset({ width: undefined }))).toMatchObject({ quality: 'studio_preview' });
    expect(selectAnalysisSource(asset({ size: 17_400_000, thumbPath: undefined }))).toHaveProperty('unsupported');
    expect(selectAnalysisSource(asset({}, 'video'))).toHaveProperty('unsupported');
  });
});

describe('analiz çalıştırıcısı', () => {
  it('model ID, prompt/şema sürümü, kaynak hash, usage ve maliyet kaydedilir', async () => {
    const store = memStore();
    const call = okCall();
    const r = await analyzeBrandMedia(asset(), { store, readBytes: async () => Buffer.from('jpegbytes'), callModel: call, now: () => 1000 });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][0]).toMatchObject({ model: 'anthropic/claude-haiku-5.5', mediaType: 'image/jpeg' });
    expect(r).toMatchObject({ status: 'done', model: 'anthropic/claude-haiku-5.5', modelUsed: 'anthropic/claude-haiku-5.5', provider: 'openrouter', requestId: null, promptVersion: 'media-catalog-v3', schemaVersion: '3', catalogSchemaVersion: '2', visualSchemaVersion: 'visual-decision-3', visualPromptVersion: 'visual-decision-prompt-3', sourceQuality: 'original', responseId: 'gen-1', visualStatus: 'ok' });
    expect(r.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    // Maliyet SAĞLAYICININ bildirdiği değerdir; yerel tahmin yoktur
    expect(r.costUsd).toBe(0.0031);
    expect(r.estimatedCostUsd).toBeUndefined();
    expect(r.usageDetail).toMatchObject({ inputTokens: 5000, outputTokens: 600, reasoningTokens: 120 });
    expect(r.visual).toMatchObject({ density: 'sakin', subject: { scale: 'orta' } });
    expect(r.result!.tags).toEqual(['tatlı', 'kahve']); // normalize: küçük harf + tekil
  });

  it('aynı kaynak/model/prompt için ikinci istek ÜCRETLİ ÇAĞRI YAPMAZ', async () => {
    const store = memStore();
    const call = okCall();
    const deps = { store, readBytes: async () => Buffer.from('same'), callModel: call, now: () => 1000 };
    await analyzeBrandMedia(asset(), deps);
    const again = await analyzeBrandMedia(asset(), deps);
    expect(call).toHaveBeenCalledTimes(1);
    expect(again.status).toBe('done');
  });

  it('önizlemeden analiz kaydı "studio_preview" olarak işaretlenir ve ayrı anahtar alır', async () => {
    const store = memStore();
    const read = vi.fn(async (p: string) => Buffer.from(p));
    const r = await analyzeBrandMedia(asset({ size: 17_400_000 }), { store, readBytes: read, callModel: okCall(), now: () => 1 });
    expect(read).toHaveBeenCalledWith('brand-media/t1/p1/a1/thumb.jpg');
    expect(r.sourceQuality).toBe('studio_preview');
    expect(r.sourceWidth).toBeUndefined();
  });

  it('429/5xx → yeniden denenebilir, en fazla 3 deneme; 400 kalıcı', async () => {
    const store = memStore();
    const call = vi.fn(async () => {
      throw Object.assign(new Error('overloaded'), { status: 529 });
    });
    const deps = { store, readBytes: async () => Buffer.from('b'), callModel: call, now: () => 1 };
    for (let i = 0; i < 5; i++) await analyzeBrandMedia(asset(), deps);
    expect(call).toHaveBeenCalledTimes(3);
    expect(isRetryableModelError({ status: 400 })).toBe(false);
    expect(isRetryableModelError({ status: 429 })).toBe(true);
    expect(isRetryableModelError(new Error('ECONNRESET'))).toBe(true);
  });

  it('refusal ve şema dışı yanıt "done" sayılmaz; refusal tekrar çağrılmaz', async () => {
    const store = memStore();
    const call = vi.fn(async () => ({ id: 'm', stopReason: 'refusal', parsed: null }));
    const deps = { store, readBytes: async () => Buffer.from('r'), callModel: call, now: () => 1 };
    expect((await analyzeBrandMedia(asset(), deps)).error?.code).toBe('refusal');
    await analyzeBrandMedia(asset(), deps);
    expect(call).toHaveBeenCalledTimes(1);
    const s2 = memStore();
    const bad = vi.fn(async () => ({ id: 'm', stopReason: 'end_turn', parsed: null }));
    expect((await analyzeBrandMedia(asset(), { store: s2, readBytes: async () => Buffer.from('q'), callModel: bad, now: () => 1 })).error?.code).toBe('schema_invalid');
  });

  it('eşzamanlı çalıştırma (lease) ikinci ücretli çağrıyı engeller', () => {
    expect(decideClaim({ status: 'running', leaseUntil: 5000, attempts: 1 } as AnalysisRecord, 1000)).toBe('skip');
    expect(decideClaim({ status: 'running', leaseUntil: 500, attempts: 1 } as AnalysisRecord, 1000)).toBe('retry');
  });

  it('süresi geçmiş yarım kayıt deneme sınırındaysa ÇAĞRI YOK, failed (attempts_exhausted) olur', async () => {
    expect(decideClaim({ status: 'running', leaseUntil: 500, attempts: 3 } as AnalysisRecord, 1000)).toBe('exhaust');
    const store = memStore();
    const call = okCall();
    const deps = { store, readBytes: async () => Buffer.from('z'), callModel: call, now: () => 10_000_000 };
    // ilk kaydı oluşturup yarım bırakılmış (running, süresi geçmiş, 3 deneme) hâle getir
    await analyzeBrandMedia(asset(), { ...deps, callModel: vi.fn(async () => Promise.reject(Object.assign(new Error('x'), { status: 503 }))) as any });
    const k = [...store.recs.keys()][0];
    store.recs.set(k, { ...store.recs.get(k)!, status: 'running', attempts: 3, leaseUntil: 1 });
    const r = await analyzeBrandMedia(asset(), deps);
    expect(call).not.toHaveBeenCalled();
    expect(r.status).toBe('failed');
    expect(r.error?.code).toBe('attempts_exhausted');
  });

  it('eski çalıştırıcı (lease süresi geçti, yenisi aldı) sonucunu YAZAMAZ', async () => {
    const store = memStore();
    let t = 1000;
    let releaseOld!: (v: any) => void;
    const slow = new Promise((r) => (releaseOld = r));
    const oldCall = vi.fn(async () => slow as any);
    const pOld = analyzeBrandMedia(asset(), { store, readBytes: async () => Buffer.from('s'), callModel: oldCall, now: () => t });
    await new Promise((r) => setTimeout(r, 0));
    t += 10_000_000; // eski lease dolar
    const fresh = await analyzeBrandMedia(asset(), { store, readBytes: async () => Buffer.from('s'), callModel: okCall(), now: () => t });
    expect(fresh.status).toBe('done');
    expect(fresh.attempts).toBe(2);
    releaseOld({ id: 'old', stopReason: 'end_turn', parsed: analysisOutput({ ...catalog, description: 'ESKİ SONUÇ' }) });
    await pOld;
    const k = [...store.recs.keys()][0];
    expect(store.recs.get(k)!.result!.description).not.toBe('ESKİ SONUÇ');
    expect(store.recs.get(k)!.responseId).toBe('gen-1');
  });
});

describe('spesifikasyon', () => {
  it('model kimliği ve prompt kuralları (uydurma yok, kimlik tahmini yok)', () => {
    expect(CATALOG_MODEL).toBe('anthropic/claude-haiku-5.5');
    expect(CATALOG_SYSTEM_PROMPT).toMatch(/UYDURMA/);
    expect(CATALOG_SYSTEM_PROMPT).toMatch(/isim, yaş, köken/);
    expect(ImageCatalogSchema.safeParse(catalog).success).toBe(true);
    expect(ImageCatalogSchema.safeParse({ ...catalog, composition: { ...catalog.composition, shotType: 'selfie' } }).success).toBe(false);
  });

  it('resmi fiyatlar: Haiku 100K eşiği, Sonnet düz; cache token\'ları dahil', () => {
    expect(estimateCostUsd('claude-haiku-5-5', { input_tokens: 1_000_000, output_tokens: 0 }).usd).toBeCloseTo(0.5, 6); // >100K → üst kademe
    expect(estimateCostUsd('claude-haiku-5-5', { input_tokens: 100_000, output_tokens: 1_000_000 }).usd).toBeCloseTo(0.01 + 0.5, 6);
    expect(estimateCostUsd('claude-sonnet-5-5', { input_tokens: 1_000_000, output_tokens: 1_000_000, cache_read_input_tokens: 1_000_000 }).usd).toBeCloseTo(2 + 10 + 0.1, 6);
    expect(() => estimateCostUsd('claude-unknown', { input_tokens: 1, output_tokens: 1 })).toThrow();
  });

  it('anahtar: model/kalite/hash değişince farklı; aynı girdide aynı', () => {
    const b = { tenantId: 't', projectId: 'p', sourceKind: 'brand_media', sourceId: 'a', sourceSha256: 'h', sourceQuality: 'original' as const, model: 'claude-haiku-5-5' };
    expect(analysisKey(b)).toBe(analysisKey({ ...b }));
    expect(analysisKey(b)).not.toBe(analysisKey({ ...b, model: 'claude-sonnet-5-5' }));
    expect(analysisKey(b)).not.toBe(analysisKey({ ...b, sourceQuality: 'studio_preview' }));
    expect(analysisKey(b)).not.toBe(analysisKey({ ...b, sourceSha256: 'h2' }));
  });

  it('planlayıcı satırı: ürün yalnız doğrulanmış bağlantıdan; belirsizlik/kaynak kalitesi/kullanım açık', () => {
    const line = toPlannerLine({ mediaId: 'a1', tenantId: 't', projectId: 'p', kind: 'photo', width: 3840, height: 5760, sourceQuality: 'studio_preview', catalog: normalizeCatalog(catalog), verifiedProductIds: [], usedInPostCount: null, archived: false })!;
    expect(line).toContain('media:a1');
    expect(line).toContain('kaynak:studio_preview');
    expect(line).toContain('ürün:doğrulanmamış');
    expect(line).toContain('belirsiz:1');
    expect(line).toContain('kullanım:bilinmiyor');
    expect(toPlannerLine({ mediaId: 'x', tenantId: 't', projectId: 'p', kind: 'photo', sourceQuality: 'original', catalog: null, verifiedProductIds: ['menu-12'], usedInPostCount: 2, archived: false })).toContain('ürün:menu-12');
    expect(toPlannerLine({ mediaId: 'x', tenantId: 't', projectId: 'p', kind: 'photo', sourceQuality: 'original', catalog: null, verifiedProductIds: [], usedInPostCount: 0, archived: true })).toBeNull();
  });
});
