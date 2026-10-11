// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { fakeFirestore } from '../../helpers/fakeFirestore';
import { buildInventory, INVENTORY_LIMIT, PLAN_MODEL, PLAN_PROMPT_VERSION } from '@/api/_lib/planSuggest/planSuggest';
import { PRICING, estimateCostUsd, CATALOG_MODEL } from '@/api/_lib/mediaAnalysis/spec';
import { candidatesFromBrandMedia, catalogCoverageNotice, LIVE_INVENTORY_LIMIT } from '@/studio/feedPlanner/integration/fromBrandMedia';
import { POLICY, T, P, assetsOf, seedAsset, dlUrl } from './liveFixtures';

const seed = (n: number) => {
  const db = fakeFirestore();
  // createdAt artan: a0 en eski, a{n-1} en yeni
  for (let i = 0; i < n; i++) seedAsset(db, `a${i}`, { createdAt: 1_000 + i });
  return db;
};

describe('GERÇEK KATALOG: 447 kayıt, 200 sınırı, sayfalama yok', () => {
  it('canlı envanter yalnız EN YENİ 200 medyayı görür; en eski 247 plana giremez; truncated=true', async () => {
    const db = seed(447);
    const inv = await buildInventory(db, { tenantId: T, projectId: P, policy: POLICY });
    expect(INVENTORY_LIMIT).toBe(200);
    expect(LIVE_INVENTORY_LIMIT).toBe(INVENTORY_LIMIT);
    expect(inv.items).toHaveLength(200);
    expect(inv.truncated).toBe(true);
    const ids = new Set(inv.items.map((i) => i.mediaId));
    for (let i = 247; i < 447; i++) expect(ids.has(`a${i}`), `a${i}`).toBe(true); // en yeni 200
    for (let i = 0; i < 247; i++) expect(ids.has(`a${i}`), `a${i}`).toBe(false); // en eski 247 görünmez
    expect(inv.items[0].mediaId).toBe('a446'); // yeni önce
    expect(catalogCoverageNotice({ eligible: inv.items.length, truncated: inv.truncated })).toMatch(/yalnız en yeni 200/);
  });

  it('tam 200 ve altında kırpma yok; 201 kırpılır', async () => {
    const at200 = await buildInventory(seed(200), { tenantId: T, projectId: P, policy: POLICY });
    expect(at200).toMatchObject({ truncated: false });
    expect(at200.items).toHaveLength(200);
    const at201 = await buildInventory(seed(201), { tenantId: T, projectId: P, policy: POLICY });
    expect(at201.truncated).toBe(true);
    expect(at201.items).toHaveLength(200);
  });

  it('tenant/proje izolasyonu: başka marka/tenant medyası envantere girmez', async () => {
    const db = seed(5);
    seedAsset(db, 'other-project', { projectId: 'p2' });
    seedAsset(db, 'other-tenant', { tenantId: 't2' });
    const inv = await buildInventory(db, { tenantId: T, projectId: P, policy: POLICY });
    expect(inv.items.map((i) => i.mediaId).sort()).toEqual(['a0', 'a1', 'a2', 'a3', 'a4']);
    const conv = candidatesFromBrandMedia(assetsOf(db), { tenantId: T, projectId: P }, { policy: POLICY });
    expect(conv.candidates).toHaveLength(5);
    expect(conv.excluded.map((e) => e.reason).sort()).toEqual(['scope_mismatch', 'scope_mismatch']);
  });

  it('arşivlenmiş ve depolama tutarsız kayıtlar sunucuda da dışlanır (adaptörle aynı karar)', async () => {
    const db = seed(3);
    seedAsset(db, 'arch', { status: 'archived' });
    const bad = db.data.get('brand_media/a1');
    const emptyName = 'brand-media/t1/p1/a1/';
    db.data.set('brand_media/a1', { ...bad, storage: { ...bad.storage, path: emptyName, downloadUrl: dlUrl(emptyName) } }); // boş dosya adı (URL tutarlı)
    const inv = await buildInventory(db, { tenantId: T, projectId: P, policy: POLICY });
    expect(inv.excluded.find((e) => e.mediaId === 'arch')).toBeUndefined(); // arşiv sorguda zaten yok
    // BULGU: gerçek sunucu boş dosya adlı yolu envantere ALIR (isConsistentAsset kabul eder); adaptör reddeder
    expect(inv.items.map((i) => i.mediaId)).toContain('a1');
    const conv = candidatesFromBrandMedia(assetsOf(db), { tenantId: T, projectId: P }, { policy: POLICY });
    expect(conv.excluded).toContainEqual({ id: 'a1', reason: 'inconsistent_storage' });
  });
});

describe('model erişimi ve maliyet (kod sabitlerinden; çağrı yok)', () => {
  it('fiyat sabitleri ve model adları (doküman bunlara dayanır; değişirse test kırılır)', () => {
    expect(PLAN_MODEL).toBe('claude-sonnet-5-5');
    expect(CATALOG_MODEL).toBe('claude-haiku-5-5');
    expect(PLAN_PROMPT_VERSION).toBe('weekly-draft-v2');
    expect(PRICING['claude-sonnet-5-5'].base).toMatchObject({ input: 2, output: 10 });
    expect(PRICING['claude-haiku-5-5'].base).toMatchObject({ input: 0.1, output: 0.5 });
  });

  it('TAHMİN (varsayımlı): 200 satırlık envanter ≈ 24K giriş + en çok 8K çıkış tokenı → plan çağrısı başına üst sınır ≈ 0,13 USD', () => {
    // Varsayım: satır başına ~120 token (gerçek usage ölçülmedi). Çıkış üst sınırı PLAN_MAX_TOKENS = 8000.
    const e = estimateCostUsd('claude-sonnet-5-5', { input_tokens: 24_000, output_tokens: 8_000 });
    expect(e.usd).toBeCloseTo(0.128, 3);
    // Katalog (Haiku 5.5): fiyat katmanı İSTEK başınadır, bu yüzden görsel başına hesaplanır.
    // VARSAYIM: görsel başına ~1.600 giriş + ~600 çıkış token; 447 görsel.
    const perImage = estimateCostUsd('claude-haiku-5-5', { input_tokens: 1_600, output_tokens: 600 });
    expect(perImage.tier).toBe('base');
    const total = perImage.usd * 447;
    expect(total).toBeGreaterThan(0.15);
    expect(total).toBeLessThan(0.25);
  });
});
