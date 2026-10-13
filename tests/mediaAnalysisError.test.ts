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
  error: { code: 400, message: `${message} | Authorization: Bearer ${SECRET} | ${PII} | ${URLQ} | PROMPT_PARCASI`, metadata: { raw: `data:image/jpeg;base64,${B64} ham-metadata`, provider_name: 'Azure' }, ...extra },
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
  ];
  it.each(cases)('upstream 400 ailesi — %s', async (_n, status, msg, cat) => {
    const e = await failure(callWith(reply(status, evil(msg))));
    expect(e.failure).toEqual({ code: `http_${status}`, message: CATEGORY_MESSAGES[cat as keyof typeof CATEGORY_MESSAGES], category: cat, status, requestId: 'req-abc12345', model: CATALOG_MODEL });
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

  it('bozuk / JSON olmayan gövde: ayrıştırma hatası metni sızmaz, genel güvenli açıklama + durum + requestId', async () => {
    const e = await failure(callWith(reply(400, '__throw__')));
    expect(e.failure).toMatchObject({ code: 'http_400', category: 'bad_request', status: 400, requestId: 'req-abc12345' });
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
  it('requestId: opak güvenli kimlik geçer; JWT/Bearer/anahtar/trim/uzun/kısa/bozuk atılır', () => {
    for (const ok of ['req-abc12345', 'gen-1a2b3c4d5e', '0f8fad5b-d9cb-469f-a165-70867728950e', 'abc123.def_456:x']) expect(safeRequestId(ok)).toBe(ok);
    const bad = [
      ' req-abc12345', 'req-abc12345 ', 'req-abc12345\n', SECRET, 'sk-abc1234567', 'Bearer abc123456', 'bearer-abc123', 'or-v1-abcdef1234', 'key_abcdef1234',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl', 'aaaaaaaaaa.bbbbbbbbbb.cccccccccc', 'ghp_abcdef123456', 'AKIAABCDEFGH1234', 'x'.repeat(65), 'abc12',
      'a'.repeat(48), 'req token=abc', 'req/abc123', '', null, undefined, 12345, {},
    ];
    for (const b of bad) expect(safeRequestId(b as any), String(b)).toBeNull();
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
    expect(good).toEqual({ code: 'http_400', message: CATEGORY_MESSAGES.schema_unsupported, category: 'schema_unsupported', status: 400, requestId: 'req-abc12345', model: CATALOG_MODEL });
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
    expect(describeAnalysisFailure(f)).toBe(`Görsel analizi başarısız: ${CATEGORY_MESSAGES.schema_unsupported} (HTTP 400 · model ${CATALOG_MODEL} · istek kimliği req-abc12345).`);
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

  it('upstream 400: kayıt kodu http_400 (geriye uyumlu) + kategori/durum/requestId/model; yeniden denenmez; sızıntı yok', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(reply(400, evil('Provider does not support response_format json_schema')));
    const rec = await run(openrouterVisionCall({ apiKey: 'or-test', fetchImpl: fetchMock as any }));
    expect(rec).toMatchObject({ status: 'failed', retryable: false, error: { code: 'http_400', category: 'schema_unsupported', status: 400, requestId: 'req-abc12345', model: CATALOG_MODEL } });
    noLeak(rec.error); noLeak(rec);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it('POST: sağlayıcı 400 → endpoint HTTP 200 + başarısız kayıt; istemci mesajı görsel analizi hatası olarak ayrışır, model/HTTP/istek kimliği görünür', async () => {
    fetchMock.mockResolvedValue(reply(400, evil('Provider does not support response_format json_schema')));
    const r = await call('POST');
    expect(r.statusCode).toBe(200);
    expect(r.body.analysis).toMatchObject({ status: 'failed', error: { code: 'http_400', category: 'schema_unsupported', status: 400, requestId: 'req-abc12345', model: CATALOG_MODEL } });
    noLeak(r.body);
    const msg = describeAnalysisFailure(r.body.analysis.error);
    expect(msg).toMatch(/^Görsel analizi başarısız: Olası neden:.*HTTP 400.*istek kimliği req-abc12345/);
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
    expect(docs[0][1].error).toEqual({ code: 'http_400', message: CATEGORY_MESSAGES.parameter_unsupported, category: 'parameter_unsupported', status: 400, requestId: 'req-abc12345', model: CATALOG_MODEL });
    void firestoreAnalysisStore; void analysisOutput;
  });
});

import { analysisOutcome } from '@/studio/mediaAnalysisOutcome';

describe('istemci mesajı: sunucu isteği hatası ≠ görsel analizi (sağlayıcı) hatası; ham metin gösterilmez', () => {
  it('sunucu 200 + başarısız kayıt (upstream 400): "Görsel analizi başarısız" + HTTP/model/istek kimliği; fatal değil', async () => {
    const f = buildProviderFailure({ status: 400, body: { error: { message: 'response_format json_schema' } }, requestId: 'req-abc12345', model: CATALOG_MODEL });
    const o = await analysisOutcome(async () => ({ enabled: true, analysis: { status: 'failed', error: f } }));
    expect(o).toEqual({ ok: false, message: describeAnalysisFailure(f) });
    expect((o as any).message).toMatch(/^Görsel analizi başarısız: .*HTTP 400.*req-abc12345/);
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
