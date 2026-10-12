// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { expandBraces, resolveFunctionConfig } from './helpers/vercelFunctions';

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const fns: Record<string, any> = vercel.functions;

describe('vercel.json functions: Vercel şema sınırları ve çözümleme', () => {
  it('en fazla 50 desen; her desen 1-256 karakter (dağıtımı engelleyen sınırlar)', () => {
    const keys = Object.keys(fns);
    expect(keys.length).toBeLessThanOrEqual(50);
    for (const k of keys) {
      expect(k.length, k.slice(0, 40)).toBeGreaterThanOrEqual(1);
      expect(k.length, k.slice(0, 40)).toBeLessThanOrEqual(256);
    }
  });

  it('her deseni açılmış her yol gerçek bir dosyaya çözülür (eşleşmeyen desen yok), süreler beklenen değer', () => {
    for (const [pattern, cfg] of Object.entries(fns)) {
      const paths = expandBraces(pattern).filter((x) => !x.includes('*'));
      for (const f of paths) expect(existsSync(f), `${f} (${cfg.maxDuration}s)`).toBe(true);
    }
    const dur = (f: string) => resolveFunctionConfig(fns, f)?.maxDuration;
    expect(dur('api/studio/plan-copy.ts')).toBe(120);
    expect(dur('api/studio/brand-guide.ts')).toBe(120);
    expect(dur('api/studio/plan-suggest.ts')).toBe(180);
    expect(dur('api/media/analyze.ts')).toBe(180);
    expect(dur('api/cron/media-analysis.ts')).toBe(300);
    expect(dur('api/analyze-continue.ts')).toBe(300);
    expect(dur('api/telegram/link.ts')).toBe(10);
    expect(dur('api/social-media/client-review-post.ts')).toBe(15);
    expect(resolveFunctionConfig(fns, 'api/export-research/x.ts')).toMatchObject({ maxDuration: 30, includeFiles: 'private-reports/abd-tekne-aksesuarlari.pdf' });
    // listede olmayan uç nokta varsayılana düşer (desen sızıntısı yok)
    expect(resolveFunctionConfig(fns, 'api/studio/planner-draft.ts')).toBeUndefined();
    expect(resolveFunctionConfig(fns, 'api/studio/brand-voice.ts')).toBeUndefined();
  });

  it('plan-copy ve brand-guide modeli zaman aşımı (100 sn) maxDuration altında', async () => {
    const { COPY_TIMEOUT_MS } = await import('@/api/_lib/planCopy/openrouterCopyCall');
    expect(COPY_TIMEOUT_MS / 1000).toBeLessThan(resolveFunctionConfig(fns, 'api/studio/brand-guide.ts').maxDuration);
  });

  it('.vercelignore: model karşılaştırma çıktıları hariç; export-research\'ün çalışma anında okuduğu PDF HARİÇ DEĞİL (includeFiles ile aynı dosya)', () => {
    const lines = readFileSync('.vercelignore', 'utf8').split('\n').map((l) => l.trim());
    expect(lines).toContain('private-reports/media-model-compare');
    expect(lines).not.toContain('private-reports');
    expect(lines.some((l) => l === 'private-reports/*' || l.endsWith('.pdf') || l.includes('abd-tekne'))).toBe(false);
    const pdf = resolveFunctionConfig(fns, 'api/export-research/x.ts').includeFiles;
    expect(pdf).toBe('private-reports/abd-tekne-aksesuarlari.pdf');
    expect(readFileSync('api/export-research/[action].ts', 'utf8')).toContain('abd-tekne-aksesuarlari.pdf');
  });
});
