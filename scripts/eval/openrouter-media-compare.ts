/**
 * OpenRouter üzerinden Haiku 5.5 vs Sonnet 5.5 görsel kataloglama — AYRI test düzeneği (entegrasyon kodu değil).
 *
 *   npx tsx scripts/eval/openrouter-media-compare.ts --dry-run
 *   npx tsx scripts/eval/openrouter-media-compare.ts --confirm-openrouter-calls=4
 *
 * - Tam 4 çıkarım isteği (2 fotoğraf × 2 model); yeniden deneme YOK; sağlayıcı/model fallback KAPALI.
 * - Mevcut deterministik türevler ve prompt-and-schema.json; hash'ler kayıtlı değerlerle eşleşmezse durur.
 * - Anahtar .env.local'dan bellekte okunur; hiçbir yere yazdırılmaz.
 * - Başarılı çağrı sonrası /api/v1/generation (çıkarım değil, salt okuma) en fazla 3 kez sorgulanır.
 */

import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { ImageCatalogSchema } from '../../api/_lib/mediaAnalysis/spec';

const BASE = resolve('private-reports/media-model-compare/2026-10-10');
const OUT = resolve(BASE, 'openrouter');
const MODELS = ['anthropic/claude-haiku-5.5', 'anthropic/claude-sonnet-5.5'] as const;
const PHOTOS = [
  { id: 'WEDD5280', sha: 'b74ef04dfcb131d035621fae834bacc91aa595d944b45dfd75427359d806c3a5', originalSha: 'f3f97b1cb3c0b7944359e3f652a34c63996e83f6a4fcfd44381d40f3fa1c3caf' },
  { id: 'WEDD5335', sha: 'e3c1bcafb62e0d3bb5884cfcb0b2af346a7fbf68b05f3878497899fc60a263ec', originalSha: '920814a38ccf8839014fe0bdbde7067c542bd1c459d1b3c21ea40f61a492212b' },
];
const MAX_TOKENS = 8000;
const EFFORT = 'medium';
const MAX_CALLS = 4;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const confirmed = args.includes('--confirm-openrouter-calls=4');
const fail = (m: string): never => {
  console.error(`DURDU: ${m}`);
  process.exit(1);
};
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadKey(): string {
  const line = readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith('OPENROUTER_API_KEY='));
  const key = line?.slice('OPENROUTER_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
  if (!key) fail('OPENROUTER_API_KEY .env.local içinde yok');
  return key!;
}

async function main() {
  if (!dryRun && !confirmed) fail('Çağrı için --confirm-openrouter-calls=4 gerekli (veya --dry-run)');
  const spec = JSON.parse(readFileSync(resolve(BASE, 'prompt-and-schema.json'), 'utf8'));
  const specSha = sha256(readFileSync(resolve(BASE, 'prompt-and-schema.json')));
  const inputs = PHOTOS.map((p) => {
    const path = resolve(BASE, 'derived', `${p.id}.2576-q90.jpg`);
    const buf = readFileSync(path);
    if (sha256(buf) !== p.sha) fail(`${p.id} türev hash'i kayıtlı değerle eşleşmiyor`);
    return { ...p, path, bytes: buf.length, width: 1717, height: 2576, dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}` };
  });
  console.log(`prompt ${spec.promptVersion} (sha ${specSha.slice(0, 12)}) · effort ${EFFORT} · max_tokens ${MAX_TOKENS} · modeller ${MODELS.join(', ')}`);
  for (const i of inputs) console.log(`${i.id}: türev ${i.width}x${i.height} ${i.bytes} B sha ${i.sha.slice(0, 12)} (orijinal sha ${i.originalSha.slice(0, 12)})`);
  if (dryRun) return console.log('KURU ÇALIŞTIRMA: çağrı yapılmadı.');

  const key = loadKey();
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'intiba media catalog eval' };
  mkdirSync(OUT, { recursive: true });
  let calls = 0;
  const summary: any[] = [];

  for (const input of inputs) {
    for (const model of MODELS) {
      if (calls >= MAX_CALLS) fail('çağrı sınırı');
      calls++;
      const body = {
        model,
        max_tokens: MAX_TOKENS,
        reasoning: { effort: EFFORT },
        provider: { allow_fallbacks: false, require_parameters: true },
        response_format: { type: 'json_schema', json_schema: { name: 'image_catalog', strict: true, schema: spec.schema } },
        messages: [
          { role: 'system', content: spec.system },
          { role: 'user', content: [{ type: 'image_url', image_url: { url: input.dataUrl } }, { type: 'text', text: spec.user }] },
        ],
      };
      const rec: any = { photo: input.id, requestedModel: model, source: { derivedPath: `derived/${input.id}.2576-q90.jpg`, derivedSha256: input.sha, bytes: input.bytes, width: input.width, height: input.height, originalSha256: input.originalSha }, promptVersion: spec.promptVersion, promptAndSchemaSha256: specSha, request: { max_tokens: MAX_TOKENS, reasoning: { effort: EFFORT }, provider: body.provider, response_format: 'json_schema strict' }, startedAt: new Date().toISOString() };
      const t0 = Date.now();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 180_000);
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal }).finally(() => clearTimeout(timer));
        rec.durationMs = Date.now() - t0;
        rec.httpStatus = res.status;
        const json: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          rec.error = { status: res.status, message: String(json?.error?.message || 'hata').slice(0, 500), code: json?.error?.code ?? null };
        } else {
          const choice = json.choices?.[0];
          rec.generationId = json.id;
          rec.resolvedModel = json.model;
          rec.provider = json.provider ?? null;
          rec.finishReason = choice?.finish_reason ?? null;
          rec.nativeFinishReason = choice?.native_finish_reason ?? null;
          rec.usage = json.usage ?? null;
          const text: string = choice?.message?.content ?? '';
          try {
            const parsed = JSON.parse(text);
            const v = ImageCatalogSchema.safeParse(parsed);
            rec.schemaValid = v.success;
            rec.output = parsed;
            if (!v.success) rec.schemaErrors = v.error.issues;
          } catch {
            rec.schemaValid = false;
            rec.rawText = text.slice(0, 4000);
          }
          // Generation istatistikleri (salt okuma, çıkarım değil)
          for (let i = 0; i < 3 && json.id; i++) {
            await sleep(1500 * (i + 1));
            const g = await fetch(`https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(json.id)}`, { headers: { Authorization: headers.Authorization } });
            if (g.ok) {
              const gd: any = (await g.json()).data || {};
              rec.generationStats = {
                model: gd.model, provider_name: gd.provider_name, total_cost: gd.total_cost, usage: gd.usage, cache_discount: gd.cache_discount,
                tokens_prompt: gd.tokens_prompt, tokens_completion: gd.tokens_completion,
                native_tokens_prompt: gd.native_tokens_prompt, native_tokens_completion: gd.native_tokens_completion,
                native_tokens_reasoning: gd.native_tokens_reasoning, native_tokens_cached: gd.native_tokens_cached,
                latency: gd.latency, generation_time: gd.generation_time, finish_reason: gd.finish_reason, native_finish_reason: gd.native_finish_reason,
                is_byok: gd.is_byok,
              };
              break;
            }
            rec.generationStatsStatus = g.status;
          }
        }
      } catch (e: any) {
        rec.durationMs = Date.now() - t0;
        rec.error = { status: null, message: e?.name === 'AbortError' ? 'zaman aşımı (180 sn)' : String(e?.message || e).slice(0, 300) };
      }
      writeFileSync(resolve(OUT, `${input.id}.${model.split('/')[1]}.json`), JSON.stringify(rec, null, 2));
      summary.push({ photo: rec.photo, requested: model, resolved: rec.resolvedModel ?? null, provider: rec.provider ?? null, ok: !rec.error, schemaValid: rec.schemaValid ?? null, ms: rec.durationMs, finish: rec.finishReason ?? null, usage: rec.usage ?? null, genCost: rec.generationStats?.total_cost ?? null, error: rec.error ?? null });
      console.log(`${input.id} · ${model}: ${rec.error ? `HATA ${rec.error.status ?? ''} ${rec.error.message}` : `${rec.finishReason} ${rec.durationMs} ms şema:${rec.schemaValid}`}`);
    }
  }
  writeFileSync(resolve(OUT, 'summary.json'), JSON.stringify({ calls, at: new Date().toISOString(), summary }, null, 2));
  console.log(`Toplam çıkarım isteği: ${calls}`);
}

main().catch((e) => fail(String(e?.message || e)));
