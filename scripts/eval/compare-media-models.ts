/**
 * Haiku 5.5 vs Sonnet 5.5 — görsel kataloglama karşılaştırması (KÜÇÜK, ONAYLI TEST).
 *
 * Kullanım (depo kökünden):
 *   npx tsx scripts/eval/compare-media-models.ts --dry-run <foto1> <foto2> <foto3>
 *   npx tsx scripts/eval/compare-media-models.ts --confirm-paid-calls=6 <foto1> <foto2> <foto3>
 *
 * Garanti/sınırlar:
 *  - Tam 3 dosya × 2 model = 6 çağrı; SDK yeniden denemesi kapalı (maxRetries: 0) → gizli ek ücretli deneme yok.
 *  - Aynı bayt, aynı şema/prompt, aynı effort ve max_tokens. Server-side fallback KULLANILMAZ (başka modele
 *    yönlendirme karşılaştırmayı bozar ve onaysız çağrı olur).
 *  - Orijinal dosyaya dokunulmaz. API sınırı (base64 ≤ 10 MB, ≤ 8000 px) aşılırsa macOS `sips` ile TEK bir
 *    deterministik türev üretilir (uzun kenar 2576 px = Claude yüksek çözünürlük sınırı, JPEG kalite 90) ve
 *    iki modele de aynı türev gider; hash'leri rapora yazılır. Thumbnail ikamesi yok.
 *  - Anahtar .env.local'dan okunur, hiçbir yere yazdırılmaz.
 */

import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import { config } from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  ANALYSIS_MAX_DIMENSION,
  ANALYSIS_MAX_RAW_BYTES,
  CATALOG_SYSTEM_PROMPT,
  CATALOG_USER_PROMPT,
  ImageCatalogSchema,
  MEDIA_ANALYSIS_PROMPT_VERSION,
  MEDIA_ANALYSIS_SCHEMA_VERSION,
  estimateCostUsd,
} from '../../api/_lib/mediaAnalysis/spec';

const MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5'] as const;
const EFFORT = 'medium' as const; // iki modelde aynı (varsayılanlar farklı: Haiku medium, Sonnet high)
const MAX_TOKENS = 8000;
const DERIVED_LONG_EDGE = 2576;
const OUT_DIR = resolve('private-reports/media-model-compare');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const confirmed = args.includes('--confirm-paid-calls=6');
const files = args.filter((a) => !a.startsWith('--'));

function fail(msg: string): never {
  console.error(`DURDU: ${msg}`);
  process.exit(1);
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

function dims(path: string): { width: number; height: number } {
  const out = execFileSync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path], { encoding: 'utf8' });
  const w = Number(/pixelWidth:\s*(\d+)/.exec(out)?.[1]);
  const h = Number(/pixelHeight:\s*(\d+)/.exec(out)?.[1]);
  if (!w || !h) fail(`Boyut okunamadı: ${path}`);
  return { width: w, height: h };
}

function mimeOf(buf: Buffer): 'image/jpeg' | 'image/png' | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  return null;
}

interface Prepared {
  file: string;
  original: { sha256: string; bytes: number; width: number; height: number; mime: string };
  sent: { kind: 'original' | 'derived_resize'; path: string; sha256: string; bytes: number; width: number; height: number; mime: string; derivation?: string };
  base64: string;
}

function prepare(file: string): Prepared {
  const abs = resolve(file);
  if (!existsSync(abs)) fail(`Dosya yok: ${file}`);
  const buf = readFileSync(abs);
  const mime = mimeOf(buf);
  if (!mime) fail(`Yalnız JPEG/PNG: ${file}`);
  const d = dims(abs);
  const original = { sha256: sha256(buf), bytes: buf.length, ...d, mime };
  const fits = buf.length <= ANALYSIS_MAX_RAW_BYTES && d.width <= ANALYSIS_MAX_DIMENSION && d.height <= ANALYSIS_MAX_DIMENSION;
  if (fits) {
    return { file: abs, original, sent: { kind: 'original', path: abs, ...original }, base64: buf.toString('base64') };
  }
  // Deterministik türev: aynı girdi + aynı sips parametreleri → iki kez üretip baytların aynı olduğu doğrulanır
  mkdirSync(resolve(OUT_DIR, 'derived'), { recursive: true });
  const out = (n: number) => resolve(OUT_DIR, 'derived', `${original.sha256.slice(0, 16)}-${DERIVED_LONG_EDGE}-q90.${n}.jpg`);
  const derivation = `sips -Z ${DERIVED_LONG_EDGE} -s format jpeg -s formatOptions 90`;
  for (const n of [1, 2]) {
    execFileSync('/usr/bin/sips', ['-Z', String(DERIVED_LONG_EDGE), '-s', 'format', 'jpeg', '-s', 'formatOptions', '90', abs, '--out', out(n)], { stdio: 'ignore' });
  }
  const a = readFileSync(out(1));
  const b = readFileSync(out(2));
  if (!a.equals(b)) fail(`Türev deterministik değil (${basename(file)}); çağrı yapılmadı`);
  if (a.length > ANALYSIS_MAX_RAW_BYTES) fail(`Türev hâlâ çok büyük (${a.length} bayt): ${basename(file)}`);
  const dd = dims(out(1));
  return {
    file: abs,
    original,
    sent: { kind: 'derived_resize', path: out(1), sha256: sha256(a), bytes: a.length, ...dd, mime: 'image/jpeg', derivation },
    base64: a.toString('base64'),
  };
}

async function main() {
  if (files.length !== 3) fail(`Tam 3 dosya gerekli (verilen: ${files.length})`);
  if (!dryRun && !confirmed) fail('Ücretli çağrı için --confirm-paid-calls=6 gerekli (veya --dry-run)');
  const prepared = files.map(prepare);
  if (new Set(prepared.map((p) => p.original.sha256)).size !== 3) fail('Dosyalar birbirinden farklı olmalı');

  console.log(`Prompt ${MEDIA_ANALYSIS_PROMPT_VERSION} / şema ${MEDIA_ANALYSIS_SCHEMA_VERSION} / effort ${EFFORT} / max_tokens ${MAX_TOKENS}`);
  for (const p of prepared) {
    console.log(
      `${basename(p.file)}: orijinal ${p.original.width}x${p.original.height} ${p.original.bytes} B sha ${p.original.sha256.slice(0, 12)} → gönderilecek ${p.sent.kind} ${p.sent.width}x${p.sent.height} ${p.sent.bytes} B sha ${p.sent.sha256.slice(0, 12)}`
    );
  }
  if (dryRun) {
    console.log('KURU ÇALIŞTIRMA: API çağrısı yapılmadı.');
    return;
  }

  config({ path: resolve('.env.local'), quiet: true } as any);
  if (!process.env.ANTHROPIC_API_KEY) fail('ANTHROPIC_API_KEY .env.local içinde yok; çağrı yapılmadı');
  const client = new Anthropic({ maxRetries: 0, timeout: 180_000 });

  const results: any[] = [];
  let calls = 0;
  for (const p of prepared) {
    for (const model of MODELS) {
      if (calls >= 6) fail('Çağrı sınırı');
      calls++;
      const started = Date.now();
      const rec: any = { file: basename(p.file), model, sent: p.sent, original: p.original, startedAt: new Date(started).toISOString() };
      try {
        const res = await client.messages.parse({
          model,
          max_tokens: MAX_TOKENS,
          system: CATALOG_SYSTEM_PROMPT,
          output_config: { format: zodOutputFormat(ImageCatalogSchema), effort: EFFORT },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: p.sent.mime as 'image/jpeg' | 'image/png', data: p.base64 } },
                { type: 'text', text: CATALOG_USER_PROMPT },
              ],
            },
          ],
        });
        rec.durationMs = Date.now() - started;
        rec.responseId = res.id;
        rec.modelEchoed = res.model;
        rec.stopReason = res.stop_reason;
        rec.stopDetails = (res as any).stop_details ?? null;
        rec.usage = res.usage;
        rec.cost = estimateCostUsd(model, res.usage);
        rec.output = res.parsed_output ?? null;
        rec.rawText = res.parsed_output ? undefined : res.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('\n');
      } catch (err: any) {
        rec.durationMs = Date.now() - started;
        rec.error = { name: err?.constructor?.name, status: err?.status ?? null, message: String(err?.message || err).slice(0, 300) };
      }
      results.push(rec);
      console.log(
        `${rec.file} · ${model}: ${rec.error ? `HATA ${rec.error.status ?? ''} ${rec.error.name}` : `${rec.stopReason} ${rec.durationMs} ms in ${rec.usage.input_tokens} out ${rec.usage.output_tokens} $${rec.cost.usd}`}`
      );
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = resolve(OUT_DIR, `results-${stamp}.json`);
  writeFileSync(
    out,
    JSON.stringify({ promptVersion: MEDIA_ANALYSIS_PROMPT_VERSION, schemaVersion: MEDIA_ANALYSIS_SCHEMA_VERSION, effort: EFFORT, maxTokens: MAX_TOKENS, calls, results }, null, 2)
  );
  const total = results.reduce((s, r) => s + (r.cost?.usd || 0), 0);
  console.log(`Toplam çağrı: ${calls} · tahmini toplam maliyet: $${total.toFixed(6)} · sonuç: ${out}`);
}

main().catch((e) => fail(String(e?.message || e)));
