// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CLEF_FLASH_MODEL, CLEF_LIMITS, DecisionAdapterError, clefFlashAdapter, jevDecisionAdapter, JEV_DECISION_MODEL, JEV_LIMITS, JEV_ROUTER_ID, validateDecisionRequest, type DecisionRequest } from '@/shared/planner/decisionAdapter';

const img = (i: number, over: Record<string, unknown> = {}) => ({ mediaId: `m${i}`, mime: 'image/jpeg', bytes: 500_000, width: 1080, height: 1350, ...over });
const q = (id: string, type: any = 'noul', options?: string[]) => ({ id, type, ...(options ? { options } : {}) });
const reqOf = (over: Partial<DecisionRequest> = {}): DecisionRequest => ({ state: 'plan', images: [img(1)], questions: [q('q1')], ...over });

describe('Clef-flash adaptör arayüzü (BAĞLI DEĞİL; sınırlar resmi Cloudflare sayfasından)', () => {
  it('resmi sınırlar: en fazla 4 görsel, PNG/JPEG/WebP, 4 MiB, 16 MP, 8 MiB toplam, 64 soru, kimlik ≤100', () => {
    expect(CLEF_FLASH_MODEL).toBe('@cf/cloudflare/clef-flash');
    expect(CLEF_LIMITS).toMatchObject({ maxImages: 4, maxImageBytes: 4 * 1024 * 1024, maxImagePixels: 16_000_000, maxTotalDecodedBytes: 8 * 1024 * 1024, maxBodyBytes: 13 * 1024 * 1024, maxQuestions: 64, maxQuestionIdLength: 100, contextTokens: 24_576 });
    expect([...CLEF_LIMITS.imageTypes]).toEqual(['image/png', 'image/jpeg', 'image/webp']);
  });

  it('geçerli istek kabul; 5 görsel, uzak URL, GIF, büyük bayt/piksel, toplam aşımı, kötü soru kimliği/tip/seçenek reddedilir', () => {
    expect(validateDecisionRequest(reqOf({ images: [img(1), img(2), img(3), img(4)] }))).toEqual({ ok: true });
    const bad = (r: DecisionRequest) => { const v = validateDecisionRequest(r); return v.ok ? [] : v.errors.join(' | '); };
    expect(bad(reqOf({ images: [1, 2, 3, 4, 5].map((i) => img(i)) }))).toMatch(/en fazla 4 görsel/);
    expect(bad(reqOf({ images: [img(1, { remoteUrl: 'https://x/y.jpg' })] }))).toMatch(/uzak URL kabul edilmez/);
    expect(bad(reqOf({ images: [img(1, { mime: 'image/gif' })] }))).toMatch(/desteklenmiyor/);
    expect(bad(reqOf({ images: [img(1, { bytes: 5 * 1024 * 1024 })] }))).toMatch(/4 MiB/);
    expect(bad(reqOf({ images: [img(1, { width: 5000, height: 4000 })] }))).toMatch(/16 megapiksel/);
    expect(bad(reqOf({ images: [img(1, { bytes: 3.5 * 1024 * 1024 }), img(2, { bytes: 3.5 * 1024 * 1024 }), img(3, { bytes: 3.5 * 1024 * 1024 })] }))).toMatch(/8 MiB/);
    expect(bad(reqOf({ questions: [] }))).toMatch(/soru sayısı 1-64/);
    expect(bad(reqOf({ questions: Array.from({ length: 65 }, (_, i) => q(`q${i}`)) }))).toMatch(/soru sayısı 1-64/);
    expect(bad(reqOf({ questions: [q('a b')] }))).toMatch(/soru kimliği geçersiz/);
    expect(bad(reqOf({ questions: [q('x'.repeat(101))] }))).toMatch(/soru kimliği geçersiz/);
    expect(bad(reqOf({ questions: [q('a'), q('a')] }))).toMatch(/yinelenmiş/);
    expect(bad(reqOf({ questions: [q('c', 'choice', ['tek'])] }))).toMatch(/en az 2 seçenek/);
    expect(bad(reqOf({ questions: [q('c', 'metin' as any)] }))).toMatch(/soru tipi geçersiz/);
  });

  it('adaptör BAĞLI DEĞİL: çalışıyor gibi sunulmaz — geçerli istek bile "not_connected" ile reddedilir; geçersiz istek "invalid_request"', async () => {
    expect(clefFlashAdapter).toMatchObject({ connected: false, kind: 'vision_decision', maxImages: 4 });
    await expect(clefFlashAdapter.decide(reqOf())).rejects.toMatchObject({ code: 'not_connected' });
    await expect(clefFlashAdapter.decide(reqOf({ images: [1, 2, 3, 4, 5].map((i) => img(i)) }))).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(clefFlashAdapter.decide(reqOf())).rejects.toBeInstanceOf(DecisionAdapterError);
  });

  it('JEV = typesafe/jev-1.13 (metin girişli YAPILANDIRILMIŞ KARAR modeli); yönlendirici (typesafe/jev-router) AYRI ürün ve metin-only diye tanıtılmaz', async () => {
    // Resmi kaynak: openrouter.ai/api/v1/models/typesafe/jev-1.13/endpoints → modality text->decisions, giriş [text], bağlam 64.000, istem ≤32.000
    expect(JEV_DECISION_MODEL).toBe('typesafe/jev-1.13');
    expect(JEV_ROUTER_ID).toBe('typesafe/jev-router');
    expect(jevDecisionAdapter.id).toBe(JEV_DECISION_MODEL);
    expect(jevDecisionAdapter.id).not.toBe(JEV_ROUTER_ID);
    expect(JEV_LIMITS).toMatchObject({ contextTokens: 64_000, maxPromptTokens: 32_000, outputModality: 'decisions' });
    expect([...JEV_LIMITS.inputModalities]).toEqual(['text']);
    expect(jevDecisionAdapter).toMatchObject({ kind: 'text_decision', connected: false, maxImages: 0 });
    await expect(jevDecisionAdapter.decide(reqOf())).rejects.toMatchObject({ code: 'text_only' }); // görsel girişli istek reddedilir
    await expect(jevDecisionAdapter.decide(reqOf({ images: [] }))).rejects.toMatchObject({ code: 'not_connected' }); // bağlı DEĞİL: çalışıyor gibi sunulmaz
  });
});
