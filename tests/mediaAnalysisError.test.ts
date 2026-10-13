// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeFirestore } from './helpers/fakeFirestore';
import { seedAsset, T, P } from './feedPlanner/integration/liveFixtures';
import { analysisOutput } from './helpers/visualFixture';

// Hata tanılaması: adaptör → runner → kayıt → yetkili yanıt. Yalnız mock/offline: sahte fetch, bellek içi Firestore; gerçek ağ/model YOK.
const h = vi.hoisted(() => ({ db: null as any, user: null as any }));
vi.mock('@/api/_lib/withAuth', () => ({ withAuth: (fn: any) => (req: any, res: any) => fn(Object.assign(req, h.user), res) }));
vi.mock('@/api/_lib/firebaseAdmin', () => ({
  getAdminDb: () => h.db,
  getAdminStorage: async () => ({ bucket: () => ({ file: (p: string) => ({ download: async () => [Buffer.from(`PIXELS:${p}`)] }) }) }),
}));
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import analyzeHandler from '@/api/media/analyze';
import { openrouterVisionCall } from '@/api/_lib/mediaAnalysis/openrouterVisionCall';
import { OpenRouterError } from '@/api/_lib/planCopy/openrouterCopyCall';
import { analyzeBrandMedia, failureOf, firestoreAnalysisStore, selectAnalysisSource, isRetryableModelError, type AnalysisRecord } from '@/api/_lib/mediaAnalysis/runner';
import { ALLOWED_MEDIA_MODELS, CATALOG_MODEL } from '@/api/_lib/mediaAnalysis/spec';
import { readQueueView } from '@/api/_lib/mediaAnalysis/autoQueue';
import {
  ALLOWED_ERROR_MODELS, CATEGORY_MESSAGES, FAILURE_CATEGORIES, GENERIC_STORED_MESSAGE, KNOWN_LOCAL_CODES, NETWORK_MESSAGE,
  buildProviderFailure, classifyProviderFailure, describeAnalysisFailure, safeErrorCode, safeModelId, safeRequestId, sanitizeStoredError,
} from '@/shared/mediaAnalysisError';

const SECRET = 'sk-or-v1-0123456789abcdef0123456789abcdef';
const PII = 'Ayse Yilmaz ayse@ornek.com';
const URLQ = 'https://ic.ornek.net/dosya?token=GIZLI123';
const B64 = 'QUJDREVGR0hJSktMTU5PUA==';
const LEAKS = [SECRET, PII, URLQ, B64, 'GIZLI123', 'Azure', 'ham-metadata', 'PROMPT_PARCASI', 'Bearer '];
const noLeak = (v: unknown) => { const t = typeof v === 'string' ? v : JSON.stringify(v); for (const l of LEAKS) expect(t, `sızıntı: ${l}`).not.toContain(l); };

const reply = (status: number, body: unknown, rid: string | null = 'req-abc12345') => ({
  ok: status < 400, status, headers: { get: (k: string) => (k === 'x-request-id' ? rid : null) },
  json: async () => { if (body === '__throw__') throw new SyntaxError(`Unexpected token <html> ${SECRET}`); return body; },
});
const evil = (message: string, extra: Record<string, unknown> = {}) => ({
  error: { code: 400, message: `${message} | Authorization: Bearer ${SECRET} | ${PII} | ${URLQ} | PROMPT_PARCASI`, metadata: { raw: `blob:${B64} ham-metadata`, provider_name: 'Azure' }, ...extra },
});
const callWith = (r: unknown, model = CATALOG_MODEL) => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(r);
  return openrouterVisionCall({ apiKey: 'or-test', fetchImpl: fetchMock as any })({ model, imageBase64: 'QUJD', mediaType: 'image/jpeg' });
};
const failure = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as OpenRouterError; } throw new Error('hata beklendi'); };

describe('sınıflandırma: yalnız bilinen biçimler; serbest sağlayıcı metni ASLA çıktıya geçmez', () => {
  const cases: Array<[string, number, string, string]> = [
    ['şema', 400, 'Provider does not support response_format json_schema', 'schema_unsupported'],
    ['parametre', 400, 'Unsupported parameter: reasoning', 'parameter_unsupported'],
    ['yönlendirme', 404, 'No endpoints found that support the requested parameters (require_parameters) and response_format', 'routing_unavailable'],
    ['görsel', 400, 'Invalid image media type', 'image_rejected'],
    ['bağlam', 400, 'Prompt is too long: context length exceeded', 'input_too_large'],
    ['model', 400, 'The model does not exist', 'model_unavailable'],
    ['moderasyon', 403, 'Input flagged by moderation', 'moderation'],
    ['sınıflandırılamayan', 400, 'Provider returned error', 'bad_request'],
    ['şema karmaşıklığı', 400, 'Schema is too complex for compilation', 'schema_too_complex'],
    ['derlenmiş gramer', 400, 'The compiled grammar is too large', 'schema_too_complex'],
    ['görsel boyutu', 400, 'messages.0.content.1.image.source.base64: image exceeds 5 MB maximum', 'image_rejected'],
  ];
  it.each(cases)('upstream 400 ailesi — %s', async (_n, status, msg, cat) => {
    const e = await failure(callWith(reply(status, evil(msg))));
    expect(e.failure).toEqual({ code: `http_${status}`, message: CATEGORY_MESSAGES[cat as keyof typeof CATEGORY_MESSAGES], category: cat, status, model: CATALOG_MODEL });
    expect(e.failure).not.toHaveProperty('requestId'); // doğrulanamayan istek kimliği OMIT (fail-closed)
    noLeak(e.failure); noLeak(e.message);
    expect(e.status).toBe(status);
  });

  it('çakışan anahtar sözcükler kesin kök neden gibi sunulmaz: "unexpected image … response_format" → bad_request (sınıflandırılamadı)', () => {
    expect(classifyProviderFailure(400, { error: { message: 'unexpected image in response_format' } })).toBe('bad_request');
    expect(classifyProviderFailure(400, { error: { message: 'content flagged: bad image' } })).toBe('bad_request');
    expect(CATEGORY_MESSAGES.bad_request).toMatch(/sınıflandırılamadı/);
    for (const c of ['schema_unsupported', 'parameter_unsupported', 'routing_unavailable', 'image_rejected', 'input_too_large', 'model_unavailable', 'moderation'] as const) expect(CATEGORY_MESSAGES[c]).toMatch(/^Olası neden:/);
  });

  it('mesajın içine görsel/base64 sözcükleri karışmış sızıntı yükü: tek kategori kanıtlanamazsa bad_request, yine sızıntı yok', async () => {
    const noisy = { error: { code: 400, message: `Provider does not support response_format json_schema; data:image/jpeg;base64,${B64}; Bearer ${SECRET}` } };
    const e = await failure(callWith(reply(400, noisy)));
    expect(e.failure).toMatchObject({ code: 'http_400', category: 'bad_request' });
    noLeak(e.failure);
  });

  it('durum kodundan kategoriler (gövde olmadan)', () => {
    const t = (s: number) => classifyProviderFailure(s, null);
    expect([t(401), t(402), t(408), t(429), t(500), t(529), t(504)]).toEqual(['auth', 'credits', 'timeout', 'rate_limit', 'upstream_error', 'upstream_error', 'timeout']);
    expect([t(400), t(422), t(404)]).toEqual(['bad_request', 'bad_request', 'bad_request']);
    expect(classifyProviderFailure(null, undefined)).toBe('unknown');
  });

  it('bozuk / JSON olmayan gövde: ayrıştırma hatası metni sızmaz, genel güvenli açıklama + durum (kimliksiz)', async () => {
    const e = await failure(callWith(reply(400, '__throw__')));
    expect(e.failure).toMatchObject({ code: 'http_400', category: 'bad_request', status: 400 });
    expect(e.failure).not.toHaveProperty('requestId');
    noLeak(e.failure); noLeak(e.message); noLeak(e.stack ?? '');
    for (const body of [null, 'metin', 42, [], { error: 'düz metin ' + SECRET }, { error: { message: { nested: SECRET } } }]) {
      const f = await failure(callWith(reply(400, body)));
      expect(f.failure?.category).toBe('bad_request');
      noLeak(f.failure);
    }
  });

  it('gövde-içi hata (HTTP 200 + error): durum gövdedeki doğrulanmış kodtan, ayrı kategori; sızıntı yok', async () => {
    const e = await failure(callWith(reply(200, evil('Provider does not support response_format json_schema'))));
    expect(e.failure).toMatchObject({ code: 'http_400', category: 'schema_unsupported', status: 400, model: CATALOG_MODEL });
    noLeak(e.failure); noLeak(e.message);
    const bad = await failure(callWith(reply(200, { error: { code: 'GIZLI_KOD_abc', message: SECRET } })));
    expect(bad.failure).toMatchObject({ code: 'provider_error' });
    expect(bad.failure?.status).toBeUndefined();
    noLeak(bad.failure);
  });

  it('çok uzun serbest metin kırpılmaz-kopyalanmaz: çıktı boyutu sabit sınırda', async () => {
    const e = await failure(callWith(reply(400, evil('json_schema ' + 'A'.repeat(200_000)))));
    expect(JSON.stringify(e.failure).length).toBeLessThan(400);
    noLeak(e.failure);
  });
});

describe('requestId / model / code: exact allowlist, biçim eşleşmesi yeterli değil', () => {
  const MARKER = 'PRIVATE_FIXTURE_DO_NOT_PERSIST';
  const FREE_TEXT = [
    MARKER, `req-${MARKER}`, 'req-PRIVATEFIXTUREDONOTPERSIST', 'req-PRIVATE1', 'req-Alice123', 'req-AyseYilmazMusteri', 'req-Ayse_Yilmaz_1', 'req-ayse@ornek.com', 'Ayse Yilmaz', 'hesap:acme-ltd-42',
    'customer_secret_abc', 'req-customersecretabc', 'musteri adi', 'tenant_t1_project_p1', 'req-tokenAbcdefghij1', 'Bearer abc123456789',
  ];
  const ALL_SHAPES = [
    // mock fixture ve iki kısa req- örneği: biçimleri "doğru görünse" bile kanıt yok → reddedilir
    'req-abc12345', 'req-9fA3kL0qZx81Mn27', 'req-12345678', 'req-a1b2c3d4', 'req-0123456789abcdef0123456789abcdef01234567',
    // üretim kimliği (generationId) requestId DEĞİLDİR; UUID/başka biçimler belgesiz
    'gen-1a2b3c4d5e', 'gen-tts-1791408882-gsi0JmqAdk574VPMDHMH', '0f8fad5b-d9cb-469f-a165-70867728950e', 'abc123.def_456:x', 'rq-1', 'abc12345',
    ' req-abc12345', 'req-abc12345 ', 'req-abc12345\n', 'REQ-abc12345',
    SECRET, 'sk-abc1234567', 'Bearer abc123456', 'or-v1-abcdef1234', 'key_abcdef1234', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl', 'aaaaaaaaaa.bbbbbbbbbb.cccccccccc',
    'ghp_abcdef123456', 'AKIAABCDEFGH1234', 'ASIAABCDEFGH123456', 'AIzaSyA-abcdefghijk1234', 'AIzaSyD0123456789abcdefghijklmnopqrstu', 'req-AKIAABCDEFGH1234', 'req-ASIAABCDEFGH123456',
    'x'.repeat(65), '', null, undefined, 12345, {}, ['req-abc12345'],
    ...FREE_TEXT,
  ];
  it('requestId FAIL-CLOSED: belgeli tam biçim/kaynak kanıtı yok → safeRequestId HER girdide null (kısa req- örnekleri, gen-, UUID, serbest metin, PII, token-benzeri dahil)', () => {
    for (const b of ALL_SHAPES) expect(safeRequestId(b as any), String(b)).toBeNull();
  });

  it('gizlilik: PRIVATE_FIXTURE_DO_NOT_PERSIST ve serbest kişi/hesap metni (req-PRIVATE1, req-Alice123 dahil) sanitizeStoredError / buildProviderFailure / tam Error JSON\'una GEÇMEZ; kimlik hiçbir yolda saklanmaz', async () => {
    const okBody = analysisOutput({ subject: 's', description: 'd', tags: [], visibleObjects: [], foodCategories: [], composition: { shotType: 'orta_plan', orientation: 'dikey', hasTextOverlay: false, subjectPlacement: 'merkez', negativeSpace: true }, productIdentity: { status: 'belirsiz', note: 'n' }, usageSuggestions: [], peoplePresent: false, uncertainties: [], planningNotes: [], overallConfidence: 'orta' });
    for (const t of [...FREE_TEXT, 'req-abc12345', 'req-9fA3kL0qZx81Mn27']) {
      const stored = sanitizeStoredError({ code: 'http_400', message: t, requestId: t, category: 'schema_unsupported' });
      expect(stored!.requestId, t).toBeUndefined();
      expect(JSON.stringify(stored)).not.toContain(t);
      const built = buildProviderFailure({ status: 400, body: { error: { message: 'json_schema' } }, requestId: t, model: CATALOG_MODEL });
      expect(built.requestId, t).toBeUndefined();
      expect(JSON.stringify(built)).not.toContain(t);
      const e = await failure(callWith(reply(400, { error: { message: 'json_schema' } }, t)));
      expect(e.failure?.requestId, t).toBeUndefined();
      const dump = [JSON.stringify(e), e.message, String(e), JSON.stringify(e.failure)].join('\n');
      expect(dump).not.toContain(t);
      // başarı yolunda da kalıcı kayda gitmez
      const ok = await callWith({ ok: true, status: 200, headers: { get: (k: string) => (k === 'x-request-id' ? t : null) }, json: async () => ({ id: 'gen-1', model: CATALOG_MODEL, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(okBody) } }], usage: {} }) });
      expect(ok.requestId, t).toBeNull();
    }
  });

  it('gizlilik: kayıtlı eski/serbest requestId (hata ve üst düzey) yetkili GET/POST yanıtından ve kuyruk görünümünden düşer', async () => {
    // endpoint testleri aşağıdaki describe\'da; burada saf izdüşüm
    const stored = sanitizeStoredError({ code: 'unknown', message: MARKER, requestId: MARKER, model: MARKER });
    expect(JSON.stringify(stored)).not.toContain(MARKER);
    expect(stored).toEqual({ code: 'unknown', message: GENERIC_STORED_MESSAGE });
  });

  it('model: yalnız izinli kimlikler (spec.ts ile birebir); biçimi uyan ama listede olmayan değer atılır', () => {
    expect([...ALLOWED_ERROR_MODELS]).toEqual([...ALLOWED_MEDIA_MODELS]);
    for (const m of ALLOWED_MEDIA_MODELS) expect(safeModelId(m)).toBe(m);
    for (const b of ['account/private-key', 'anthropic/claude-haiku-5.5-20261007', 'openai/gpt-x', 'anthropic/claude-haiku-5.5 ', SECRET, null, 1]) expect(safeModelId(b as any), String(b)).toBeNull();
  });

  it('code: bilinen yerel kodlar + http_100..599; sağlayıcı/özel değerler atılır', () => {
    for (const c of KNOWN_LOCAL_CODES) expect(safeErrorCode(c)).toBe(c);
    for (const c of ['http_400', 'http_529', 'http_100', 'http_599']) expect(safeErrorCode(c)).toBe(c);
    for (const c of ['customer_secret_abc', 'http_99', 'http_600', 'http_4000', 'http_40a', 'HTTP_400', 'invalid_request_error', SECRET, '', null, 400]) expect(safeErrorCode(c as any), String(c)).toBeNull();
  });

  it('sanitizeStoredError: customer_secret_abc / account/private-key gibi değerler geçmez; bilinmeyen alanlar taşınmaz', () => {
    const out = sanitizeStoredError({ code: 'customer_secret_abc', model: 'account/private-key', requestId: SECRET, status: 99999, message: PII, category: 'hack', raw: 'ham-metadata', providerCode: 'x' });
    expect(out).toEqual({ code: 'unknown', message: GENERIC_STORED_MESSAGE });
    noLeak(out);
    const good = sanitizeStoredError({ code: 'http_400', message: 'rastgele ' + PII, category: 'schema_unsupported', status: 400, requestId: 'req-abc12345', model: CATALOG_MODEL, x: 1 });
    expect(good).toEqual({ code: 'http_400', message: CATEGORY_MESSAGES.schema_unsupported, category: 'schema_unsupported', status: 400, model: CATALOG_MODEL }); // requestId kimliksiz (fail-closed)
    expect(sanitizeStoredError(null)).toBeNull();
    expect(sanitizeStoredError('metin')).toBeNull();
  });

  it('sabit iletiler korunur: runner/seçici/eski adaptör iletileri aynen geçer; serbest metin düşer', () => {
    const keep = ['Model bu görseli işlemeyi reddetti', 'Yapılandırılmış çıktı alınamadı', 'Deneme sınırı doldu (yarım kalan çağrı)', 'Varlık analize uygun değil', 'OpenRouter isteği başarısız (400)', 'OPENROUTER_API_KEY tanımlı değil'];
    for (const m of keep) expect(sanitizeStoredError({ code: 'unknown', message: m })!.message).toBe(m);
    for (const k of ['photo', 'video']) {
      const sel = selectAnalysisSource({ id: 'a', tenantId: 't', projectId: 'p', kind: k as any, status: k === 'video' ? 'active' : 'archived', storage: { path: 'x', contentType: 'image/jpeg', size: 1 } });
      if ('unsupported' in sel) expect(sanitizeStoredError({ code: 'unsupported', message: sel.unsupported })!.message).toBe(sel.unsupported);
    }
    expect(sanitizeStoredError({ code: 'network', message: 'ENOENT /srv/x ' + SECRET })!.message).toBe(GENERIC_STORED_MESSAGE);
  });

  it('describeAnalysisFailure: HTTP, model ve istek kimliğini allowlist\'li alanlardan gösterir; bozuk girdi güvenli', () => {
    const f = buildProviderFailure({ status: 400, body: { error: { message: 'response_format json_schema' } }, requestId: 'req-abc12345', model: CATALOG_MODEL });
    expect(describeAnalysisFailure(f)).toBe(`Görsel analizi başarısız: ${CATEGORY_MESSAGES.schema_unsupported} (HTTP 400 · model ${CATALOG_MODEL}).`);
    expect(describeAnalysisFailure({ code: 'x y', message: SECRET, model: 'a/b', requestId: SECRET })).not.toContain(SECRET);
    expect(describeAnalysisFailure(undefined)).toMatch(/ayrıntı kaydedilmemiş/);
    expect(FAILURE_CATEGORIES.every((c) => !!CATEGORY_MESSAGES[c])).toBe(true);
  });
});

describe('runner: kalıcı kayıt YALNIZ güvenli alanlar; yeniden deneme davranışı korunur', () => {
  const asset = () => ({ id: 'a1', tenantId: T, projectId: P, kind: 'photo' as const, status: 'active', storage: { path: `brand-media/${T}/${P}/a1/a1.jpg`, contentType: 'image/jpeg', size: 10, width: 800, height: 1000 } });
  const memStore = () => {
    const m = new Map<string, AnalysisRecord>();
    return {
      map: m,
      get: async (k: string) => m.get(k) ?? null,
      claim: async (k: string, init: AnalysisRecord) => { m.set(k, init); return { claimed: true, record: init }; },
      update: async (k: string, _o: string, patch: Partial<AnalysisRecord>) => { m.set(k, { ...m.get(k)!, ...patch }); return true; },
      setLatest: async () => {},
    };
  };
  const run = async (callModel: any) => {
    const store = memStore();
    return analyzeBrandMedia(asset(), { store, readBytes: async () => Buffer.from('x'), callModel, now: () => 1 });
  };

  it('upstream 400: kayıt kodu http_400 (geriye uyumlu) + kategori/durum/model (kimliksiz); yeniden denenmez; sızıntı yok', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(reply(400, evil('Provider does not support response_format json_schema')));
    const rec = await run(openrouterVisionCall({ apiKey: 'or-test', fetchImpl: fetchMock as any }));
    expect(rec).toMatchObject({ status: 'failed', retryable: false, error: { code: 'http_400', category: 'schema_unsupported', status: 400, model: CATALOG_MODEL } });
    expect(rec.error).not.toHaveProperty('requestId');
    noLeak(rec.error); noLeak(rec);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('adaptör doğrulamasa bile kalıcı kayıt istek kimliği SAKLAMAZ (serbest metin / gen- / UUID / req- hepsi null)', async () => {
    const okOut = analysisOutput({ subject: 's', description: 'd', tags: [], visibleObjects: [], foodCategories: [], composition: { shotType: 'orta_plan', orientation: 'dikey', hasTextOverlay: false, subjectPlacement: 'merkez', negativeSpace: true }, productIdentity: { status: 'belirsiz', note: 'n' }, usageSuggestions: [], peoplePresent: false, uncertainties: [], planningNotes: [], overallConfidence: 'orta' });
    for (const [rid, expected] of [['PRIVATE_FIXTURE_DO_NOT_PERSIST', null], ['gen-abc123xyz', null], ['0f8fad5b-d9cb-469f-a165-70867728950e', null], ['req-9fA3kL0qZx81Mn27', null], ['req-PRIVATE1', null], ['req-Alice123', null]] as const) {
      const rec = await run(async () => ({ id: 'g', stopReason: 'end_turn', parsed: okOut, provider: 'openrouter' as const, modelUsed: CATALOG_MODEL, requestId: rid }));
      expect(rec.requestId, rid).toBe(expected);
      expect(JSON.stringify(rec)).not.toContain('PRIVATE_FIXTURE');
    }
  });

  it('429/5xx geçici (retryable) kalır; 401/402/400 kalıcı', async () => {
    for (const [s, retry] of [[429, true], [503, true], [529, true], [400, false], [401, false], [402, false]] as const) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(reply(s, evil('x')));
      const rec = await run(openrouterVisionCall({ apiKey: 'or-test', fetchImpl: fetchMock as any }));
      expect(rec.retryable, String(s)).toBe(retry);
      expect(rec.error?.code).toBe(`http_${s}`);
    }
    expect(isRetryableModelError(Object.assign(new Error('x'), { status: 429 }))).toBe(true);
  });

  it('adaptör dışı hatalar (depolama, ağ, zaman aşımı): e.message KOPYALANMAZ, sabit ileti', () => {
    const net = failureOf(new Error(`ENOENT brand-media/${T}/${P} ${SECRET} ${PII}`));
    expect(net).toEqual({ code: 'network', message: NETWORK_MESSAGE });
    noLeak(net);
    const abort = failureOf(Object.assign(new Error(SECRET), { name: 'AbortError' }));
    expect(abort).toMatchObject({ code: 'network', category: 'timeout' });
    noLeak(abort);
    expect(failureOf(new OpenRouterError('OPENROUTER_API_KEY tanımlı değil', null, 'no_api_key'))).toMatchObject({ code: 'no_api_key' });
    // eski/başka adaptör: yalnız durum
    expect(failureOf(Object.assign(new Error(SECRET), { status: 429 }))).toEqual({ code: 'http_429', message: CATEGORY_MESSAGES.rate_limit, category: 'rate_limit', status: 429 });
    // zehirli failure alanı taşıyan hata
    const poisoned = failureOf(Object.assign(new Error('x'), { failure: { code: 'customer_secret_abc', message: SECRET, model: 'account/private-key', requestId: SECRET } }));
    noLeak(poisoned);
    expect(poisoned.code).toBe('unknown');
  });

  it('görsel analizi hatası ile yapılandırılmış çıktı (caption/şema) hatası ayrışır: sağlayıcı reddi ≠ schema_invalid', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, headers: { get: () => 'req-abc12345' }, json: async () => ({ id: 'g', model: CATALOG_MODEL, choices: [{ finish_reason: 'stop', message: { content: '{"yanlis":1}' } }], usage: {} }) });
    const rec = await run(openrouterVisionCall({ apiKey: 'or-test', fetchImpl: fetchMock as any }));
    expect(rec.error).toEqual({ code: 'schema_invalid', message: 'Yapılandırılmış çıktı alınamadı' });
    expect(describeAnalysisFailure(rec.error)).toBe('Görsel analizi başarısız: Yapılandırılmış çıktı alınamadı.');
  });
});

describe('yetkili yanıt ve kuyruk görünümü: eski kayıtlardan serbest hata metni sızmaz; yetki/tenant sınırı aynı', () => {
  const res = () => {
    const r: any = { statusCode: 0, body: null, headers: {} };
    r.setHeader = (k: string, v: string) => ((r.headers[k] = v), r);
    r.status = (s: number) => ((r.statusCode = s), r);
    r.json = (b: any) => ((r.body = b), r);
    return r;
  };
  const ENV = ['MEDIA_AI_ANALYSIS_ENABLED', 'OPENROUTER_API_KEY', 'FIREBASE_STORAGE_BUCKET', 'MEDIA_AI_MODEL'];
  const saved: Record<string, string | undefined> = {};
  const as = (uid: string, role: string, tenantId = T) => (h.user = { userId: uid, userUid: uid, tenantId, userRole: role });
  const call = async (method: 'GET' | 'POST', assetId = 'a1') => {
    const r = res();
    await analyzeHandler(method === 'GET' ? ({ method, query: { projectId: P, assetId } } as any) : ({ method, body: { projectId: P, assetId }, query: {} } as any), r);
    return r;
  };
  beforeEach(() => {
    for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; }
    Object.assign(process.env, { MEDIA_AI_ANALYSIS_ENABLED: 'true', OPENROUTER_API_KEY: 'or-test-sahte', FIREBASE_STORAGE_BUCKET: 'demo.appspot.com' });
    fetchMock.mockReset();
    h.db = fakeFirestore();
    h.db.data.set('projects/p1', { tenantId: 't1' });
    h.db.data.set('users/admin1', { tenantId: 't1', role: 'admin' });
    h.db.data.set('users/other', { tenantId: 't2', role: 'admin' });
    seedAsset(h.db, 'a1');
    as('admin1', 'admin');
  });
  afterEach(() => { for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

  it('POST: sağlayıcı 400 → endpoint HTTP 200 + başarısız kayıt; istemci mesajı görsel analizi hatası olarak ayrışır, model/HTTP görünür (istek kimliği yok)', async () => {
    fetchMock.mockResolvedValue(reply(400, evil('Provider does not support response_format json_schema')));
    const r = await call('POST');
    expect(r.statusCode).toBe(200);
    expect(r.body.analysis).toMatchObject({ status: 'failed', error: { code: 'http_400', category: 'schema_unsupported', status: 400, model: CATALOG_MODEL } });
    expect(r.body.analysis.error).not.toHaveProperty('requestId');
    noLeak(r.body);
    const msg = describeAnalysisFailure(r.body.analysis.error);
    expect(msg).toMatch(/^Görsel analizi başarısız: Olası neden:.*HTTP 400.*model /);
    expect(msg).not.toMatch(/istek kimliği/);
    // kalıcı kayıt da güvenli
    noLeak([...h.db.data.entries()].filter(([k]) => k.startsWith('media_ai_')));
  });

  it('GET: eski kayıttaki serbest hata metni, sahte kod/model/requestId ve ek alanlar yanıta GEÇMEZ', async () => {
    const key = 'legacy-key';
    h.db.data.set(`media_ai_analyses/${key}`, {
      key, tenantId: T, projectId: P, sourceId: 'a1', status: 'failed', retryable: false,
      error: { code: 'customer_secret_abc', message: `OpenRouter isteği başarısız (400) ${SECRET} ${PII}`, model: 'account/private-key', requestId: SECRET, rawBody: 'ham-metadata', category: 'schema_unsupported' },
    });
    h.db.data.set(`media_ai_analysis_latest/${T}_${P}_a1`, { tenantId: T, projectId: P, sourceId: 'a1', key });
    const r = await call('GET');
    expect(r.statusCode).toBe(200);
    expect(r.body.analysis.error).toEqual({ code: 'unknown', message: CATEGORY_MESSAGES.schema_unsupported, category: 'schema_unsupported' });
    noLeak(r.body);
  });

  it('GET: legacy kayıt tamamen serbest metinse genel güvenli açıklama; çıktı \'error\' alanı dışında kayıt aynen', async () => {
    const key = 'legacy-2';
    h.db.data.set(`media_ai_analyses/${key}`, { key, tenantId: T, projectId: P, sourceId: 'a1', status: 'failed', attempts: 2, error: { code: 'http_400', message: `Firestore: ${PII} ${URLQ}` } });
    h.db.data.set(`media_ai_analysis_latest/${T}_${P}_a1`, { tenantId: T, projectId: P, sourceId: 'a1', key });
    const r = await call('GET');
    expect(r.body.analysis).toMatchObject({ key, status: 'failed', attempts: 2, error: { code: 'http_400', message: GENERIC_STORED_MESSAGE } });
    noLeak(r.body);
  });

  it('GET: eski kayıttaki üst düzey requestId serbest metinse yanıttan düşer (hiçbir biçim korunmaz)', async () => {
    for (const [rid, expected] of [['PRIVATE_FIXTURE_DO_NOT_PERSIST', null], ['rq-1', null], ['req-9fA3kL0qZx81Mn27', null], ['req-PRIVATE1', null]] as const) {
      const key = 'k-' + String(rid).slice(0, 6);
      h.db.data.set(`media_ai_analyses/${key}`, { key, tenantId: T, projectId: P, sourceId: 'a1', status: 'done', requestId: rid, result: null });
      h.db.data.set(`media_ai_analysis_latest/${T}_${P}_a1`, { tenantId: T, projectId: P, sourceId: 'a1', key });
      const r = await call('GET');
      expect(r.body.analysis.requestId, rid).toBe(expected);
      expect(JSON.stringify(r.body)).not.toContain('PRIVATE_FIXTURE');
    }
  });

  it('kuyruk görünümü lastError aynı allowlist\'ten geçer (eski serbest metin / sahte kod / ek alan düşer)', async () => {
    h.db.data.set(`media_ai_queue/${T}_${P}_a1`, { tenantId: T, projectId: P, assetId: 'a1', state: 'failed', attempts: 3, lastError: { code: 'source_error', message: `ENOENT ${SECRET}`, extra: PII } });
    const v = await readQueueView(h.db, T, P, 'a1', Date.now());
    expect(v!.lastError).toEqual({ code: 'source_error', message: GENERIC_STORED_MESSAGE });
    noLeak(v);
  });

  it('yetki ve tenant sınırı bozulmadı: başka tenant kullanıcısı kayıt/hata göremez (GET 403/404, POST model çağrılmaz)', async () => {
    const key = 'k-auth';
    h.db.data.set(`media_ai_analyses/${key}`, { key, tenantId: T, projectId: P, sourceId: 'a1', status: 'failed', error: { code: 'http_400', message: 'x' } });
    h.db.data.set(`media_ai_analysis_latest/${T}_${P}_a1`, { tenantId: T, projectId: P, sourceId: 'a1', key });
    as('other', 'admin', 't2');
    const g = await call('GET');
    expect(g.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(g.body)).not.toContain('http_400');
    const p = await call('POST');
    expect(p.statusCode).toBeGreaterThanOrEqual(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('firestoreAnalysisStore ile uçtan uca: upstream 400 sonrası kalıcı belge yalnız güvenli alanlar içerir', async () => {
    fetchMock.mockResolvedValue(reply(400, evil('Unsupported parameter: reasoning')));
    await call('POST');
    const docs = [...h.db.data.entries()].filter(([k]) => k.startsWith('media_ai_analyses/'));
    expect(docs).toHaveLength(1);
    expect(docs[0][1].error).toEqual({ code: 'http_400', message: CATEGORY_MESSAGES.parameter_unsupported, category: 'parameter_unsupported', status: 400, model: CATALOG_MODEL });
    void firestoreAnalysisStore; void analysisOutput;
  });
});

import { analysisOutcome } from '@/studio/mediaAnalysisOutcome';

describe('istemci mesajı: sunucu isteği hatası ≠ görsel analizi (sağlayıcı) hatası; ham metin gösterilmez', () => {
  it('sunucu 200 + başarısız kayıt (upstream 400): "Görsel analizi başarısız" + HTTP/model/istek kimliği; fatal değil', async () => {
    const f = buildProviderFailure({ status: 400, body: { error: { message: 'response_format json_schema' } }, requestId: 'req-abc12345', model: CATALOG_MODEL });
    const o = await analysisOutcome(async () => ({ enabled: true, analysis: { status: 'failed', error: f } }));
    expect(o).toEqual({ ok: false, message: describeAnalysisFailure(f) });
    expect((o as any).message).toMatch(/^Görsel analizi başarısız: .*HTTP 400.*model /);
    expect((o as any).message).not.toMatch(/istek kimliği/);
    expect((o as any).message).not.toMatch(/Analiz isteği sunucuda/);
  });

  it('sunucu isteği reddedildi (HTTP 500/503): "Analiz isteği sunucuda reddedildi (HTTP …)"; kapalı/yapılandırma hatası fatal', async () => {
    const o = await analysisOutcome(async () => { throw Object.assign(new Error('Analiz yapılamadı'), { status: 500 }); });
    expect(o).toEqual({ ok: false, message: 'Analiz isteği sunucuda reddedildi (HTTP 500): Analiz yapılamadı', fatal: false });
    for (const code of ['feature_disabled', 'model_config_invalid']) {
      const f = await analysisOutcome(async () => { throw Object.assign(new Error('kapalı'), { status: 503, code }); });
      expect(f).toMatchObject({ ok: false, fatal: true });
    }
  });

  it('kayıt sağlayıcı ayrıntısı taşımıyorsa / sahte alan içeriyorsa genel güvenli ileti; başarı ok', async () => {
    expect(await analysisOutcome(async () => ({ analysis: { status: 'done' } }))).toEqual({ ok: true });
    expect(await analysisOutcome(async () => ({}))).toMatchObject({ ok: false, message: expect.stringContaining('kayıt döndürülmedi') });
    const o = await analysisOutcome(async () => ({ analysis: { status: 'failed', error: { code: 'customer_secret_abc', message: SECRET, model: 'account/private-key', requestId: SECRET } } }));
    noLeak((o as any).message);
  });
});

describe('TAM Error nesnesi: enumerable alanlar (status, code, failure) dahil hiçbir çıktıda ham sağlayıcı kodu/metni yok', () => {
  const HUGE = 'Z'.repeat(200_000);
  const hostileCodes: unknown[] = [
    `sekret_${SECRET}`, SECRET, PII, URLQ, HUGE, { nested: { token: SECRET, pii: PII }, deep: [HUGE] }, [SECRET], 'ASIAABCDEFGH123456', 'AIzaSyD0123456789abcdefghijklmnopqrstu',
    1e308, -5, 99999, 4.5, true, null, '400', 'http_400; DROP', 'customer_secret_abc',
  ];
  const dumpAll = (e: any) => {
    // JSON.stringify(error) yalnız enumerable alanları yazar; ek olarak message/stack/name/failure ve tüm own property değerleri taranır
    const own = Object.getOwnPropertyNames(e).map((k) => { try { return String(typeof e[k] === 'object' ? JSON.stringify(e[k]) : e[k]); } catch { return ''; } });
    return [JSON.stringify(e), e.message, String(e), ...own].join('\n');
  };
  const hostileTexts = [SECRET, PII, URLQ, 'GIZLI123', 'ZZZZZZZZZZ', 'ASIAABCDEFGH123456', 'AIzaSyD0123456789abcdefghijklmnopqrstu', 'customer_secret_abc', 'DROP', 'nested', 'ham-metadata'];
  const check = (e: any) => {
    const t = dumpAll(e);
    for (const l of hostileTexts) expect(t, `sızıntı: ${l.slice(0, 20)}`).not.toContain(l);
    expect(t.length).toBeLessThan(2500);
    // alan şekilleri sınırlı/exact
    expect(e.status === null || (Number.isInteger(e.status) && e.status >= 100 && e.status <= 599)).toBe(true);
    expect(e.code === null || safeErrorCode(e.code) !== null).toBe(true);
    expect(Object.keys(e).sort()).toEqual(['code', 'failure', 'status']);
  };

  it.each(hostileCodes.map((c, i) => [i, c] as const))('HTTP hata dalı: error.code = hostile #%s', async (_i, code) => {
    const e = await failure(callWith(reply(400, { error: { code, message: `${PII} json_schema`, metadata: { raw: SECRET } } })));
    check(e);
    expect(e.code).toBe('http_400');
    expect(e.failure?.code).toBe('http_400');
  });

  it.each(hostileCodes.map((c, i) => [i, c] as const))('gövde-içi (HTTP 200) hata dalı: error.code = hostile #%s', async (_i, code) => {
    const e = await failure(callWith(reply(200, { error: { code, message: `${PII} schema`, metadata: { raw: SECRET } } })));
    check(e);
    // yalnız doğrulanmış 100..599 sayısal/üç haneli kod durum olur; diğer her şey provider_error
    const ok = typeof code === 'number' ? Number.isInteger(code) && code >= 100 && code <= 599 : typeof code === 'string' && /^\d{3}$/.test(code) && Number(code) >= 100 && Number(code) <= 599;
    expect(e.code).toBe(ok ? `http_${Number(code)}` : 'provider_error');
  });

  it('hata HTTP durumları (ham status alanı da bounded): 429/502/600/0', async () => {
    for (const s of [429, 502, 600, 0]) {
      const e = await failure(callWith(reply(s, { error: { code: SECRET, message: PII } })));
      expect(dumpAll(e)).not.toContain(SECRET);
      expect(dumpAll(e)).not.toContain(PII);
      expect(e.status === null || (e.status >= 100 && e.status <= 599)).toBe(true);
    }
  });

  it('Copy adaptörü davranışı DEĞİŞMEDİ: ham sağlayıcı kodu orada eskisi gibi code alanına gider (bu görevin kapsamı dışı)', async () => {
    const { openrouterCopyCall } = await import('@/api/_lib/planCopy/openrouterCopyCall');
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(reply(400, { error: { code: 'invalid_request_error', message: 'x' } }));
    const call = openrouterCopyCall({ apiKey: 'or-test', fetchImpl: fetchMock as any });
    let err: any;
    try { await call({ system: 's', user: 'u', model: CATALOG_MODEL } as any); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(OpenRouterError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('invalid_request_error');
    expect(err.failure).toBeUndefined();
  });
});

import { decideClaim, MAX_ANALYSIS_ATTEMPTS } from '@/api/_lib/mediaAnalysis/runner';

describe('tanılama öncesi (kategorisiz) 400 kayıtları: ayrıntı görünsün diye TEK kez yeniden denenir, döngü yok', () => {
  const rec = (over: Partial<AnalysisRecord>) => ({ status: 'failed', retryable: false, attempts: 1, error: { code: 'http_400', message: 'OpenRouter isteği başarısız (400)' }, ...over }) as AnalysisRecord;
  it('eski http_NNN kaydı (kategori yok) → retry; kategorili yeni kayıt / diğer kalıcı hatalar / deneme sınırı → skip', () => {
    expect(decideClaim(rec({}), 1)).toBe('retry');
    expect(decideClaim(rec({ error: { code: 'http_402', message: 'OpenRouter isteği başarısız (402)' } }), 1)).toBe('retry');
    expect(decideClaim(rec({ error: { code: 'http_400', message: CATEGORY_MESSAGES.schema_unsupported, category: 'schema_unsupported', status: 400 } }), 1)).toBe('skip');
    for (const code of ['refusal', 'schema_invalid', 'no_api_key', 'unsupported', 'attempts_exhausted', 'network']) expect(decideClaim(rec({ error: { code, message: 'x' } }), 1), code).toBe('skip');
    expect(decideClaim(rec({ attempts: MAX_ANALYSIS_ATTEMPTS }), 1)).toBe('skip');
    expect(decideClaim(rec({ status: 'done' }), 1)).toBe('skip');
  });

  it('uçtan uca: eski 400 kaydı bir sonraki analizde yeniden denenir, yeni hata ayrıntı taşır; ardından tekrar çağrı YAPILMAZ', async () => {
    const m = new Map<string, AnalysisRecord>();
    const store = {
      get: async (k: string) => m.get(k) ?? null,
      claim: async (k: string, init: AnalysisRecord, now: number) => {
        const ex = m.get(k) ?? null; const d = decideClaim(ex, now);
        if (d === 'skip') return { claimed: false, record: ex! };
        const r = d === 'new' ? init : { ...ex!, status: 'running' as const, attempts: ex!.attempts + 1, leaseUntil: init.leaseUntil, leaseOwner: init.leaseOwner, error: null };
        m.set(k, r); return { claimed: true, record: r };
      },
      update: async (k: string, _o: string, p: Partial<AnalysisRecord>) => { m.set(k, { ...m.get(k)!, ...p }); return true; },
      setLatest: async () => {},
    };
    const a = { id: 'a1', tenantId: T, projectId: P, kind: 'photo' as const, status: 'active', storage: { path: 'x', contentType: 'image/jpeg', size: 10, width: 800, height: 1000 } };
    // 1) eski sürüm gibi: tanılamasız kalıcı 400
    const legacyCall = vi.fn(async () => { throw Object.assign(new Error('OpenRouter isteği başarısız (400)'), { status: 400 }); });
    const first = await analyzeBrandMedia(a, { store, readBytes: async () => Buffer.from('x'), callModel: legacyCall as any, now: () => 1 });
    m.set(first.key, { ...first, error: { code: 'http_400', message: 'OpenRouter isteği başarısız (400)' } }); // kategori yok (eski biçim)
    expect(describeAnalysisFailure(m.get(first.key)!.error)).toMatch(/tanılama eklenmeden önce/);
    // 2) yeni sürüm: yeniden denenir, ayrıntı kaydedilir
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(reply(400, { error: { message: 'Provider does not support response_format json_schema' } }));
    const second = await analyzeBrandMedia(a, { store, readBytes: async () => Buffer.from('x'), callModel: openrouterVisionCall({ apiKey: 'or-test', fetchImpl: fetchMock as any }), now: () => 2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ status: 'failed', attempts: 2, error: { code: 'http_400', category: 'schema_unsupported', status: 400, model: CATALOG_MODEL } });
    expect(describeAnalysisFailure(second.error)).toMatch(/Olası neden: sağlayıcı yapılandırılmış/);
    // 3) üçüncü istek: kategori var → skip, yeni çağrı yok
    const third = await analyzeBrandMedia(a, { store, readBytes: async () => Buffer.from('x'), callModel: openrouterVisionCall({ apiKey: 'or-test', fetchImpl: fetchMock as any }), now: () => 3 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(third.attempts).toBe(2);
  });
});

describe('OpenRouter 400 sarmalayıcısı: gerçek neden metadata içinde — yalnız SINIFLANDIRMAYA girer, asla saklanmaz', () => {
  const wrapped = (metadata: Record<string, unknown>) => ({ error: { code: 400, message: 'Provider returned error', metadata } });
  it('metadata.raw içindeki bilinen upstream ifadesi kategoriye eşlenir; raw metni (PII/sır/URL/base64 dahil) çıktıda YOK', async () => {
    const raw = `{"type":"error","error":{"type":"invalid_request_error","message":"messages.0.content.1.image.source.base64: image exceeds 5 MB maximum: 9.3 MB > 5 MB"}} user=${PII} ${URLQ} Bearer ${SECRET}`;
    const e = await failure(callWith(reply(400, wrapped({ raw, provider_name: 'Azure' }))));
    expect(e.failure).toMatchObject({ code: 'http_400', category: 'image_rejected', status: 400, model: CATALOG_MODEL });
    noLeak(e.failure); noLeak(e.message); noLeak(JSON.stringify(e));
    const obj = await failure(callWith(reply(400, wrapped({ raw: { error: { message: 'Schema is too complex for compilation', who: PII } } }))));
    expect(obj.failure?.category).toBe('schema_too_complex');
    noLeak(obj.failure);
  });

  it('belgeli metadata.error_type değerleri EXACT tabloyla eşlenir (görsel / bağlam); bilinmeyen değer yok sayılır ve sızmaz', () => {
    const t = (error_type: unknown) => classifyProviderFailure(400, wrapped({ error_type }));
    for (const v of ['image_too_large', 'invalid_image', 'unsupported_image_format', 'image_download_failed', 'image_too_small']) expect(t(v), v).toBe('image_rejected');
    for (const v of ['context_length_exceeded', 'max_tokens_exceeded', 'token_limit_exceeded', 'string_too_long']) expect(t(v), v).toBe('input_too_large');
    for (const v of ['invalid_request', 'invalid_prompt', 'ozel_sir_' + SECRET, { x: PII }, null]) expect(t(v as any)).toBe('bad_request');
  });

  it('raw içinde birden çok kategori çağrışımı varsa kesin neden iddia edilmez (bad_request)', () => {
    expect(classifyProviderFailure(400, wrapped({ raw: 'unexpected image in response_format' }))).toBe('bad_request');
    expect(classifyProviderFailure(400, wrapped({ raw: 'Provider returned error' }))).toBe('bad_request');
  });
});
