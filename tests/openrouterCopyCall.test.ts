// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fakeFirestore } from './helpers/fakeFirestore';
import { openrouterCopyCall, copyJsonSchema, normalizeUsage, OpenRouterError, OPENROUTER_URL, COPY_SCHEMA_NAME, COPY_MAX_TOKENS } from '@/api/_lib/planCopy/openrouterCopyCall';
import { generateCopy, CopyError, CopyOutputSchema, COPY_ISSUED, copyIssuedDocId, BRAND_VOICE_COLLECTION, brandVoiceDocId, resolveCopyModel, DEFAULT_OPENROUTER_COPY_MODEL, OPENROUTER_MODEL_RE } from '@/api/_lib/planCopy/planCopy';
import { copySuggestState } from '@/api/_lib/integrations/config';
import { ANALYSES, ANALYSIS_LATEST } from '@/api/_lib/mediaAnalysis/correctionStore';
import { seedAsset, POLICY, T, P } from './feedPlanner/integration/liveFixtures';
import { bundle, feedItem, req } from './planner/helpers';

const KEY = 'or-test-anahtar-gercek-degil';
const GOOD = 'Sofrada kuralları biz koyarız; siz sadece tabağa bakın ve masanın sakinliğini hissedin.';
const output = (items: unknown[]) => ({ items, notes: [] });
const item = (slotKey: string, caption: string | null, evidenceBasis = 'katalog_gozlem') => ({ slotKey, caption, headline: null, body: null, evidenceBasis, rationale: 'test' });

interface Seen { url: string; init: any; body: any }
const fakeFetch = (reply: { status?: number; body?: unknown; headers?: Record<string, string>; text?: string } | (() => Promise<never>)) => {
  const seen: Seen[] = [];
  const fn = vi.fn(async (url: any, init: any) => {
    seen.push({ url: String(url), init, body: JSON.parse(init.body) });
    if (typeof reply === 'function') return reply();
    const status = reply.status ?? 200;
    return { ok: status < 400, status, headers: { get: (k: string) => reply.headers?.[k.toLowerCase()] ?? null }, json: async () => { if (reply.text !== undefined) throw new Error('json yok'); return reply.body; } } as any;
  });
  return { fn: fn as any, seen };
};
const okBody = (content: unknown, extra: Record<string, unknown> = {}) => ({
  id: 'gen-abc123', model: 'anthropic/claude-sonnet-5.5-20261001',
  choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) } }],
  usage: { prompt_tokens: 1200, completion_tokens: 300, total_tokens: 1500, cost: 0.0063, prompt_tokens_details: { cached_tokens: 100 }, completion_tokens_details: { reasoning_tokens: 0 } },
  ...extra,
});
const call = (f: ReturnType<typeof fakeFetch>, opts: Record<string, unknown> = {}) => openrouterCopyCall({ fetchImpl: f.fn, apiKey: KEY, ...opts })({ model: 'anthropic/claude-sonnet-5.5', system: 'SİSTEM', user: 'KULLANICI' });
const fails = async (p: Promise<unknown>): Promise<OpenRouterError> => { try { await p; } catch (e) { return e as OpenRouterError; } throw new Error('hata beklendi'); };

describe('istek: yalnız OpenRouter, yapılandırılmış çıktı, sessiz yedekleme yok', () => {
  it('sabit OpenRouter adresine tek POST; model, mesajlar, strict json_schema, sağlayıcı yedeği kapalı, usage istenir', async () => {
    const f = fakeFetch({ body: okBody(output([item('feed:0', GOOD)])) });
    await call(f);
    expect(f.fn).toHaveBeenCalledTimes(1); // yeniden deneme yok (çift faturalama)
    const { url, init, body } = f.seen[0];
    expect(url).toBe(OPENROUTER_URL);
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(body.model).toBe('anthropic/claude-sonnet-5.5');
    expect(body.max_tokens).toBe(COPY_MAX_TOKENS);
    expect(body.messages).toEqual([{ role: 'system', content: 'SİSTEM' }, { role: 'user', content: 'KULLANICI' }]);
    expect(body.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: COPY_SCHEMA_NAME, strict: true } });
    expect(body.provider).toEqual({ allow_fallbacks: false, require_parameters: true });
    expect(body.usage).toEqual({ include: true });
    expect(body).not.toHaveProperty('models'); // OpenRouter model yedek listesi yok
    expect(body).not.toHaveProperty('route');
    expect(JSON.stringify(body)).not.toContain(KEY); // anahtar gövdeye girmez
  });

  it('anahtar yoksa ağa HİÇ çıkılmaz (açık hata); ortam değişkeni çağrı anında okunur', async () => {
    const f = fakeFetch({ body: okBody(output([])) });
    const e = await fails(openrouterCopyCall({ fetchImpl: f.fn, apiKey: '  ' })({ model: 'a/b', system: 's', user: 'u' }));
    expect(e).toMatchObject({ code: 'no_api_key', status: null });
    expect(f.fn).not.toHaveBeenCalled();
    const saved = process.env.OPENROUTER_API_KEY;
    try {
      process.env.OPENROUTER_API_KEY = KEY;
      const g = fakeFetch({ body: okBody(output([])) });
      await openrouterCopyCall({ fetchImpl: g.fn })({ model: 'a/b', system: 's', user: 'u' });
      expect(g.seen[0].init.headers.Authorization).toBe(`Bearer ${KEY}`);
    } finally {
      if (saved === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = saved;
    }
  });

  it('JSON şeması zod şemasından türer: strict (additionalProperties:false, tüm alanlar zorunlu) ve geçerli bir çıktıyı tanımlar', () => {
    const s: any = copyJsonSchema();
    expect(s.$schema).toBeUndefined();
    expect(s.type).toBe('object');
    expect(s.additionalProperties).toBe(false);
    expect(s.required.sort()).toEqual(['items', 'notes']);
    const it = s.properties.items.items;
    expect(it.additionalProperties).toBe(false);
    expect(it.required.sort()).toEqual(['body', 'caption', 'evidenceBasis', 'headline', 'rationale', 'slotKey']);
    expect(it.properties.evidenceBasis.enum).toEqual(['dogrulanmis_urun', 'katalog_gozlem', 'persona_kanaat', 'hesap_ornegi', 'olculen_gorsel', 'marka_rehberi', 'yok_metinsiz']);
    expect(CopyOutputSchema.safeParse(output([item('feed:0', GOOD)])).success).toBe(true);
  });
});

describe('yanıt: kimlik, model, usage ve maliyet KAYBOLMAZ', () => {
  it('yanıt kimliği, çalışan model, istek başlığı kimliği, normalleştirilmiş usage ve sağlayıcı maliyeti', async () => {
    const f = fakeFetch({ body: okBody(output([item('feed:0', GOOD)])), headers: { 'x-request-id': 'req-77' } });
    const r = await call(f);
    expect(r).toMatchObject({
      id: 'gen-abc123', provider: 'openrouter', modelUsed: 'anthropic/claude-sonnet-5.5-20261001', requestId: 'req-77', stopReason: 'end_turn',
      usageDetail: { inputTokens: 1200, outputTokens: 300, totalTokens: 1500, cachedTokens: 100, reasoningTokens: 0, costUsd: 0.0063 },
      usage: { input_tokens: 1200, output_tokens: 300 },
    });
    expect(r.parsed).toEqual(output([item('feed:0', GOOD)]));
  });
  it('maliyet bildirilmediyse null kalır (yerel tahmin/uydurma yok); başlık yoksa requestId null', async () => {
    const f = fakeFetch({ body: okBody(output([]), { usage: { prompt_tokens: 10, completion_tokens: 5 } }) });
    const r = await call(f);
    expect(r.requestId).toBeNull();
    expect(r.usageDetail).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15, cachedTokens: null, reasoningTokens: null, costUsd: null });
    expect(normalizeUsage(undefined)).toEqual({ inputTokens: null, outputTokens: null, totalTokens: null, cachedTokens: null, reasoningTokens: null, costUsd: null });
    expect(normalizeUsage({ cost: '0.1', prompt_tokens: NaN }).costUsd).toBeNull();
  });
  it('sağlayıcı sunucuda DOĞRULANIR: bozuk JSON / şemaya uymayan içerik / boş içerik → parsed null (güvenilmez)', async () => {
    for (const content of ['{ bozuk', JSON.stringify({ items: [{ slotKey: 'feed:0' }], notes: [] }), JSON.stringify({ items: 'x' }), '', JSON.stringify(output([item('feed:0', GOOD, 'uydurma_temel')]))]) {
      const r = await call(fakeFetch({ body: okBody(content) }));
      expect(r.parsed, content).toBeNull();
    }
  });
  it('durdurma nedenleri eşlenir: stop→end_turn, length→max_tokens, content_filter ve refusal→refusal', async () => {
    const mk = (finish: string, refusal?: string) => okBody(output([]), { choices: [{ finish_reason: finish, message: { content: '{}', ...(refusal ? { refusal } : {}) } }] });
    expect((await call(fakeFetch({ body: mk('length') }))).stopReason).toBe('max_tokens');
    expect((await call(fakeFetch({ body: mk('content_filter') }))).stopReason).toBe('refusal');
    expect((await call(fakeFetch({ body: mk('stop', 'Yapamam') }))).stopReason).toBe('refusal');
  });
});

describe('hatalar: durum korunur, gövde/anahtar sızmaz, yeniden deneme yok', () => {
  it.each([[401], [402], [404], [429], [500], [502]])('%s → OpenRouterError(status); mesaj gövdeyi ve anahtarı içermez; tek çağrı', async (status) => {
    const f = fakeFetch({ status, body: { error: { code: status, message: `SIR-GOVDE ${KEY} kullanıcı metni` } } });
    const e = await fails(call(f));
    expect(e).toBeInstanceOf(OpenRouterError);
    expect(e.status).toBe(status);
    expect(e.code).toBe(String(status));
    expect(e.message).toBe(`OpenRouter isteği başarısız (${status})`);
    expect(JSON.stringify([e.message, e.code])).not.toMatch(/SIR-GOVDE|or-test-anahtar/);
    expect(f.fn).toHaveBeenCalledTimes(1);
  });
  it('200 ama gövdede error (sağlayıcı arızası) ve JSON olmayan gövde de açık hata', async () => {
    expect(await fails(call(fakeFetch({ body: { error: { code: 503, message: 'x' } } })))).toMatchObject({ message: 'OpenRouter hata döndürdü', status: 503 });
    expect(await fails(call(fakeFetch({ status: 502, text: '<html>' })))).toMatchObject({ status: 502 });
  });
  it('zaman aşımı: istek iptal edilir ve hata yükselir', async () => {
    const f = { fn: vi.fn((_u: any, init: any) => new Promise((_res, rej) => { init.signal.addEventListener('abort', () => rej(Object.assign(new Error('abort'), { name: 'AbortError' }))); })) as any };
    const e = await fails(openrouterCopyCall({ fetchImpl: f.fn, apiKey: KEY, timeoutMs: 20 })({ model: 'a/b', system: 's', user: 'u' }));
    expect(e.name).toBe('AbortError');
  });
});

describe('uçtan uca (generateCopy + OpenRouter adaptörü + sahte fetch)', () => {
  const CAT = { subject: 'masada makarna tabağı', description: 'Beyaz örtülü masada porselen tabakta makarna.', tags: ['makarna', 'tabak'], visibleObjects: ['tabak', 'kadeh'], foodCategories: ['makarna'], composition: { shotType: 'yakın_çekim', orientation: 'dikey', hasTextOverlay: false, subjectPlacement: 'merkez', negativeSpace: true }, productIdentity: { status: 'genel_kategori', note: '' }, usageSuggestions: ['story'], peoplePresent: false, uncertainties: [], planningNotes: [], overallConfidence: 'orta' };
  const setup = () => {
    const db = fakeFirestore();
    seedAsset(db, 'a1');
    db.data.set(`${ANALYSIS_LATEST}/${T}_${P}_a1`, { key: 'k-a1' });
    db.data.set(`${ANALYSES}/k-a1`, { tenantId: T, projectId: P, sourceId: 'a1', status: 'done', result: CAT, sourceQuality: 'original' });
    db.data.set(`${BRAND_VOICE_COLLECTION}/${brandVoiceDocId(T, P)}`, { tenantId: T, projectId: P, bundle: bundle(), updatedBy: 'admin1', updatedAt: 1 });
    return db;
  };
  const run = (db: any, f: ReturnType<typeof fakeFetch>, model = DEFAULT_OPENROUTER_COPY_MODEL) =>
    generateCopy(db, { callModel: openrouterCopyCall({ fetchImpl: f.fn, apiKey: KEY }), policy: POLICY, model }, { tenantId: T, projectId: P, req: req([feedItem(0, 'a1')]), issuedBy: { uid: 'u1', now: 5 } });

  it('marka bağlamı (hesap captionları + 3 kılavuz) istemde; yanıt kimliği, model, istek kimliği, usage ve maliyet sonuçta VE sunucu kaydında', async () => {
    const db = setup();
    const f = fakeFetch({ body: okBody(output([item('feed:0', GOOD)])), headers: { 'x-request-id': 'req-5' } });
    const r = await run(db, f);
    const sys = f.seen[0].body.messages[0].content as string;
    expect(sys).toMatch(/<guides>[\s\S]*Dieci Marka Personası[\s\S]*Dil Rehberi[\s\S]*Paylaşım Stilleri[\s\S]*<\/guides>/);
    expect(f.seen[0].body.messages[1].content).toMatch(/<account_posts>[\s\S]*P01/);
    expect(f.seen[0].body.model).toBe(DEFAULT_OPENROUTER_COPY_MODEL);
    expect(r.accepted).toHaveLength(1);
    expect(r).toMatchObject({
      provider: 'openrouter', requestedModel: DEFAULT_OPENROUTER_COPY_MODEL, modelUsed: 'anthropic/claude-sonnet-5.5-20261001', model: 'anthropic/claude-sonnet-5.5-20261001',
      responseId: 'gen-abc123', requestId: 'req-5', promptVersion: 'plan-copy-v1', usage: { inputTokens: 1200, outputTokens: 300, costUsd: 0.0063 },
    });
    const rec = db.data.get(`${COPY_ISSUED}/${copyIssuedDocId(T, P, 'gen-abc123')}`);
    expect(rec).toMatchObject({ provider: 'openrouter', requestId: 'req-5', modelUsed: 'anthropic/claude-sonnet-5.5-20261001', usage: { costUsd: 0.0063, totalTokens: 1500 }, hashes: { [r.accepted[0].contentHash]: 'a1' } });
    expect(JSON.stringify([r, rec])).not.toContain(KEY);
  });
  it('kabul edilmeyen çıktı (İngilizce) şablonla DOLDURULMAZ: reddedilir, maliyet yine bildirilir', async () => {
    const db = setup();
    const r = await run(db, fakeFetch({ body: okBody(output([item('feed:0', 'We already chose. You just take a seat at the table, please.')])) }));
    expect(r.accepted).toEqual([]);
    expect(r.rejected[0].slotKey).toBe('feed:0');
    expect(r.usage.costUsd).toBe(0.0063);
  });
  it('sağlayıcı hatası 502 model_error (metin yok); yapılandırılmış çıktı gelmezse 422 model_no_output; ret 422 model_refusal; hiçbirinde istek kaydı yazılmaz', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = setup();
    const e1 = await run(db, fakeFetch({ status: 429, body: { error: { code: 429 } } })).catch((e: CopyError) => e);
    expect(e1).toMatchObject({ status: 502, code: 'model_error' });
    const e2 = await run(db, fakeFetch({ body: okBody('{ bozuk') })).catch((e: CopyError) => e);
    expect(e2).toMatchObject({ status: 422, code: 'model_no_output' });
    const e3 = await run(db, fakeFetch({ body: okBody(output([]), { choices: [{ finish_reason: 'stop', message: { content: '{}', refusal: 'hayır' } }] }) })).catch((e: CopyError) => e);
    expect(e3).toMatchObject({ status: 422, code: 'model_refusal' });
    expect([...db.data.keys()].some((k: string) => k.startsWith(`${COPY_ISSUED}/`))).toBe(false);
    expect(spy.mock.calls.flat().join(' ')).not.toMatch(/or-test-anahtar|SIR/);
    spy.mockRestore();
  });
});

describe('yapılandırma kapısı ve Anthropic yedeği YOK', () => {
  const run = (env: Record<string, string | undefined>) => {
    const saved = { ...process.env };
    try {
      for (const k of ['PLAN_COPY_AI_ENABLED', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'PLAN_COPY_MODEL']) delete process.env[k];
      Object.assign(process.env, Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined)));
      return copySuggestState();
    } finally {
      process.env = saved;
    }
  };
  it('kapalı varsayılan; açıkken yalnız OPENROUTER_API_KEY gerekir; ANTHROPIC_API_KEY ne gerekir ne yeterlidir', () => {
    expect(run({})).toMatchObject({ enabled: false });
    expect(run({ PLAN_COPY_AI_ENABLED: 'true' })).toEqual({ enabled: false, reason: 'AI yapılandırması eksik.', missing: ['OPENROUTER_API_KEY'] });
    expect(run({ PLAN_COPY_AI_ENABLED: 'true', ANTHROPIC_API_KEY: 'x' })).toMatchObject({ enabled: false, missing: ['OPENROUTER_API_KEY'] });
    expect(run({ PLAN_COPY_AI_ENABLED: 'true', OPENROUTER_API_KEY: KEY })).toEqual({ enabled: true });
    expect(run({ PLAN_COPY_AI_ENABLED: 'true', OPENROUTER_API_KEY: KEY, PLAN_COPY_MODEL: 'claude-sonnet-5-5' })).toMatchObject({ enabled: false, reason: expect.stringMatching(/PLAN_COPY_MODEL geçersiz/) });
    expect(run({ PLAN_COPY_AI_ENABLED: 'true', OPENROUTER_API_KEY: KEY, PLAN_COPY_MODEL: 'openai/gpt-5-mini' })).toEqual({ enabled: true });
  });
  it('model kimliği çözümü: varsayılan, geçerli geçersiz kılma, çıplak Anthropic kimliği ve kötü biçimler reddedilir', () => {
    expect(resolveCopyModel({})).toEqual({ ok: true, model: DEFAULT_OPENROUTER_COPY_MODEL });
    expect(resolveCopyModel({ PLAN_COPY_MODEL: ' openai/gpt-5-mini ' })).toEqual({ ok: true, model: 'openai/gpt-5-mini' });
    for (const bad of ['claude-sonnet-5-5', 'anthropic/', '/m', 'a b/c', 'https://x/y', 'a/b c']) {
      expect(OPENROUTER_MODEL_RE.test(bad), bad).toBe(false);
      expect(resolveCopyModel({ PLAN_COPY_MODEL: bad }).ok, bad).toBe(false);
    }
  });
  it('kaynak taraması: plan-copy akışı Anthropic SDK/adresi/anahtarını içermez; yalnız openrouter.ai çağrılır; anahtar log/yanıta yazılmaz', () => {
    const dir = path.join(process.cwd(), 'api/_lib/planCopy');
    const files = [...fs.readdirSync(dir).map((f) => path.join(dir, f)), path.join(process.cwd(), 'api/studio/plan-copy.ts')];
    expect(files.some((f) => /anthropicCopyCall/.test(f))).toBe(false);
    for (const f of files) {
      const t = fs.readFileSync(f, 'utf8');
      expect(t, f).not.toMatch(/@anthropic-ai\/sdk|api\.anthropic\.com|ANTHROPIC_API_KEY|anthropicCopyCall/);
      expect(t, f).not.toMatch(/console\.\w+\([^)]*(apiKey|OPENROUTER_API_KEY|Authorization)/);
    }
    const urls = [...fs.readFileSync(path.join(dir, 'openrouterCopyCall.ts'), 'utf8').matchAll(/https?:\/\/[^'"`\s)]+/g)].map((m) => m[0]);
    expect(urls.filter((u) => !/^https:\/\/(openrouter\.ai|intiba\.co)/.test(u))).toEqual([]);
    expect(fs.readFileSync('api/studio/plan-copy.ts', 'utf8')).toMatch(/openrouterCopyCall\(\)/);
  });
});
