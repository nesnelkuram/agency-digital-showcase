// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { openrouterVisionCall, ANALYSIS_SYSTEM_PROMPT, CATALOG_MAX_TOKENS, CATALOG_TIMEOUT_MS } from '@/api/_lib/mediaAnalysis/openrouterVisionCall';
import { OPENROUTER_URL, OpenRouterError } from '@/api/_lib/planCopy/openrouterCopyCall';
import { ALLOWED_MEDIA_MODELS, CATALOG_MODEL, resolveMediaModel } from '@/api/_lib/mediaAnalysis/spec';
import { MEDIA_AI_ALLOWED_MODELS, MEDIA_AI_REQUIRED_ENV, mediaAnalysisState } from '@/api/_lib/integrations/config';
import { isRetryableModelError } from '@/api/_lib/mediaAnalysis/runner';
import { analysisOutput } from './helpers/visualFixture';

const KEY = 'or-test-anahtar-gercek-degil';
const catalog = {
  subject: 's', description: 'd', tags: [], visibleObjects: [], foodCategories: [],
  composition: { shotType: 'yakın_çekim', orientation: 'dikey', hasTextOverlay: false, subjectPlacement: 'merkez', negativeSpace: true },
  productIdentity: { status: 'belirsiz', note: 'n' }, usageSuggestions: [], peoplePresent: false, uncertainties: [], planningNotes: [], overallConfidence: 'orta',
};
interface Seen { url: string; init: any; body: any }
const fakeFetch = (reply: { status?: number; body?: unknown; headers?: Record<string, string> } | (() => Promise<never>)) => {
  const seen: Seen[] = [];
  const fn = vi.fn(async (url: any, init: any) => {
    seen.push({ url: String(url), init, body: JSON.parse(init.body) });
    if (typeof reply === 'function') return reply();
    const status = reply.status ?? 200;
    return { ok: status < 400, status, headers: { get: (k: string) => reply.headers?.[k.toLowerCase()] ?? null }, json: async () => reply.body } as any;
  });
  return { fn: fn as any, seen };
};
const okBody = (content: unknown, extra: Record<string, unknown> = {}) => ({
  id: 'gen-vis-1', model: 'anthropic/claude-haiku-5.5-20261007',
  choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) } }],
  usage: { prompt_tokens: 2100, completion_tokens: 900, total_tokens: 3000, cost: 0.0027, prompt_tokens_details: { cached_tokens: 0 }, completion_tokens_details: { reasoning_tokens: 300 } },
  ...extra,
});
const run = (f: ReturnType<typeof fakeFetch>, opts: Record<string, unknown> = {}, p: { mediaType?: string; model?: string } = {}) =>
  openrouterVisionCall({ fetchImpl: f.fn, apiKey: KEY, ...opts })({ model: p.model ?? CATALOG_MODEL, imageBase64: 'QUJD', mediaType: p.mediaType ?? 'image/jpeg' });
const fails = async (p: Promise<unknown>): Promise<OpenRouterError> => { try { await p; } catch (e) { return e as OpenRouterError; } throw new Error('hata beklendi'); };

describe('OpenRouter görsel girişi + yapılandırılmış yanıt (sahte fetch; gerçek çağrı YOK)', () => {
  it('tek POST: sabit adres, doğrulanmış model kimliği, METİN önce GÖRSEL sonra, base64 data URL, strict json_schema, yedek yok, usage istenir', async () => {
    const f = fakeFetch({ body: okBody(analysisOutput(catalog)) });
    await run(f);
    expect(f.fn).toHaveBeenCalledTimes(1);
    const { url, init, body } = f.seen[0];
    expect(url).toBe(OPENROUTER_URL);
    expect(init.method).toBe('POST');
    expect(body.model).toBe('anthropic/claude-haiku-5.5');
    expect(body.max_tokens).toBe(CATALOG_MAX_TOKENS);
    expect(body.reasoning).toEqual({ effort: 'medium' });
    expect(body.messages[0]).toEqual({ role: 'system', content: ANALYSIS_SYSTEM_PROMPT });
    const parts = body.messages[1].content;
    expect(parts.map((p: any) => p.type)).toEqual(['text', 'image_url']); // resmi öneri: önce metin, sonra görsel
    expect(parts[1].image_url.url).toBe('data:image/jpeg;base64,QUJD');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema).toMatchObject({ name: 'media_analysis_output', strict: true });
    expect(Object.keys(body.response_format.json_schema.schema.properties).sort()).toEqual(['catalog', 'visual']);
    expect(body.provider).toEqual({ allow_fallbacks: false, require_parameters: true });
    expect(body.usage).toEqual({ include: true });
    expect(body.models).toBeUndefined(); // model yedek listesi YOK
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it('anahtar yalnız Authorization başlığında: gövdede, URL\'de, sonuçta ve hata mesajında GEÇMEZ', async () => {
    const f = fakeFetch({ body: okBody(analysisOutput(catalog)) });
    const r = await run(f);
    expect(f.seen[0].init.body).not.toContain(KEY);
    expect(f.seen[0].url).not.toContain(KEY);
    expect(JSON.stringify(r)).not.toContain(KEY);
    const bad = fakeFetch({ status: 401, body: { error: { code: 401, message: `Bearer ${KEY} geçersiz` } } });
    const e = await fails(run(bad));
    expect(e.message).not.toContain(KEY);
    expect(e).toMatchObject({ status: 401 });
  });

  it('yanıt: ham JSON iki alanıyla döner; yanıt kimliği, çalışan model, istek kimliği, usage ve SAĞLAYICI maliyeti korunur', async () => {
    const f = fakeFetch({ body: okBody(analysisOutput(catalog)), headers: { 'x-request-id': 'rq-9' } });
    const r = await run(f);
    expect(r).toMatchObject({ id: 'gen-vis-1', stopReason: 'end_turn', provider: 'openrouter', modelUsed: 'anthropic/claude-haiku-5.5-20261007', requestId: 'rq-9' });
    expect((r.parsed as any).catalog.subject).toBe('s');
    expect(Object.keys(r.parsed as any).sort()).toEqual(['catalog', 'visual']);
    expect(r.usageDetail).toEqual({ inputTokens: 2100, outputTokens: 900, totalTokens: 3000, cachedTokens: 0, reasoningTokens: 300, costUsd: 0.0027 });
  });

  it('anahtar yoksa fetch HİÇ çağrılmaz ve yeniden denenmez; desteklenmeyen tür çağrı yapmadan reddedilir', async () => {
    const f = fakeFetch({ body: okBody(analysisOutput(catalog)) });
    const saved = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const e = await fails(openrouterVisionCall({ fetchImpl: f.fn })({ model: CATALOG_MODEL, imageBase64: 'x', mediaType: 'image/jpeg' }));
    if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
    expect(e).toMatchObject({ code: 'no_api_key' });
    expect(isRetryableModelError(e)).toBe(false);
    const t = await fails(run(f, {}, { mediaType: 'image/tiff' }));
    expect(t).toMatchObject({ code: 'bad_media_type', status: 400 });
    expect(f.fn).not.toHaveBeenCalled();
  });

  it('hata eşlemesi: 402/400 yeniden denenmez; 408/429/5xx ve ağ hatası denenebilir; gövde mesaja kopyalanmaz', async () => {
    for (const [status, retry] of [[400, false], [401, false], [402, false], [408, true], [429, true], [500, true], [529, true]] as const) {
      const e = await fails(run(fakeFetch({ status, body: { error: { code: status, message: 'GİZLİ İÇERİK' } } })));
      expect(e.status, String(status)).toBe(status);
      expect(e.message).not.toContain('GİZLİ');
      expect(isRetryableModelError(e), String(status)).toBe(retry);
    }
    const net = await fails(run(fakeFetch(async () => { throw new Error('ECONNRESET'); })));
    expect(isRetryableModelError(net)).toBe(true);
  });

  it('refusal / kesilmiş / şema dışı çıktı: parsed=null veya stopReason ile işaretlenir (runner ayrı kodlar verir)', async () => {
    const refusal = await run(fakeFetch({ body: okBody('', { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: null, refusal: 'reddetti' } }] }) }));
    expect(refusal).toMatchObject({ stopReason: 'refusal', parsed: null });
    const cut = await run(fakeFetch({ body: okBody('{"catalog":', { choices: [{ finish_reason: 'length', message: { role: 'assistant', content: '{"catalog":' } }] }) }));
    expect(cut).toMatchObject({ stopReason: 'max_tokens', parsed: null });
    const garbage = await run(fakeFetch({ body: okBody('düz metin') }));
    expect(garbage.parsed).toBeNull();
  });

  it('zaman aşımı: istek iptal sinyaliyle gönderilir (120 sn üst sınır sabiti)', async () => {
    expect(CATALOG_TIMEOUT_MS).toBe(120_000);
    const f = fakeFetch({ body: okBody(analysisOutput(catalog)) });
    await run(f);
    expect(f.seen[0].init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('yapılandırma: eksikse DÜRÜSTÇE kapalı; sessiz sağlayıcı/model değişimi yok', () => {
  const ENV = ['MEDIA_AI_ANALYSIS_ENABLED', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'FIREBASE_STORAGE_BUCKET', 'MEDIA_AI_MODEL'];
  const saved: Record<string, string | undefined> = {};
  afterEach(() => { for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
  const withEnv = (e: Record<string, string>) => { for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; } Object.assign(process.env, e); return mediaAnalysisState(); };

  it('OpenRouter anahtarı gerekir; ANTHROPIC_API_KEY ne gerekir ne yeterlidir (yedek yok)', () => {
    expect([...MEDIA_AI_REQUIRED_ENV]).toEqual(['OPENROUTER_API_KEY', 'FIREBASE_STORAGE_BUCKET']);
    expect(withEnv({})).toMatchObject({ enabled: false });
    expect(withEnv({ MEDIA_AI_ANALYSIS_ENABLED: 'true', ANTHROPIC_API_KEY: 'x', FIREBASE_STORAGE_BUCKET: 'b' })).toMatchObject({ enabled: false, missing: ['OPENROUTER_API_KEY'] });
    expect(withEnv({ MEDIA_AI_ANALYSIS_ENABLED: 'true', OPENROUTER_API_KEY: 'x', FIREBASE_STORAGE_BUCKET: 'b' })).toEqual({ enabled: true });
  });

  it('model: varsayılan doğrulanmış Haiku 5.5; yalnız izinli iki OpenRouter kimliği; tireli/sağlayıcısız/alias reddedilir', () => {
    expect(CATALOG_MODEL).toBe('anthropic/claude-haiku-5.5');
    expect([...ALLOWED_MEDIA_MODELS]).toEqual(['anthropic/claude-haiku-5.5', 'anthropic/claude-sonnet-5.5']);
    expect(MEDIA_AI_ALLOWED_MODELS).toEqual([...ALLOWED_MEDIA_MODELS]);
    expect(resolveMediaModel({})).toEqual({ ok: true, model: 'anthropic/claude-haiku-5.5' });
    expect(resolveMediaModel({ MEDIA_AI_MODEL: 'anthropic/claude-sonnet-5.5' })).toEqual({ ok: true, model: 'anthropic/claude-sonnet-5.5' });
    for (const bad of ['claude-haiku-5-5', 'claude-sonnet-5-5', 'haiku', '~anthropic/claude-haiku-latest', 'anthropic/claude-opus-5.5', 'openai/gpt-6-astra']) {
      expect(resolveMediaModel({ MEDIA_AI_MODEL: bad }), bad).toMatchObject({ ok: false });
    }
    const st = withEnv({ MEDIA_AI_ANALYSIS_ENABLED: 'true', OPENROUTER_API_KEY: 'x', FIREBASE_STORAGE_BUCKET: 'b', MEDIA_AI_MODEL: 'claude-haiku-5-5' });
    expect(st).toMatchObject({ enabled: false });
  });
});
