import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { bundle } from './planner/helpers';

// GERÇEK GET işleyicisi + GERÇEK panel; yalnız Firestore (bellek içi) ve ağ (işleyiciye köprü) taklit edilir.
const authUser: { current: any } = { current: null };
vi.mock('@/api/_lib/withAuth', () => ({ withAuth: (h: any) => (req: any, res: any) => h(Object.assign(req, authUser.current), res) }));

const docs: Record<string, any> = {};
const failReads = new Set<string>();
const writes = vi.hoisted(() => ({ n: 0 }));
const fakeDb = {
  collection: (c: string) => ({
    doc: (id: string) => ({
      get: async () => {
        if (failReads.has(c)) throw new Error('okuma hatası');
        return { exists: `${c}/${id}` in docs, data: () => docs[`${c}/${id}`] };
      },
      set: () => { writes.n++; },
      update: () => { writes.n++; },
      delete: () => { writes.n++; },
    }),
  }),
  runTransaction: () => { writes.n++; },
};
const storage = vi.fn(async () => ({}));
vi.mock('@/api/_lib/firebaseAdmin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: () => storage() }));
const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);

import analyzeHandler from '@/api/media/analyze';

/** İstemci → işleyici köprüsü: HTTP gövdesini JSON'a çevirir; hata durumunu istemcinin Error'una dönüştürür */
vi.mock('@/studio/mediaIntegrationsApi', async (orig) => ({
  ...(await orig<any>()),
  getMediaAnalysis: async (projectId: string, assetId: string) => {
    const r: any = { statusCode: 0, body: null, setHeader() {}, status(s: number) { r.statusCode = s; return r; }, json(b: any) { r.body = b; return r; } };
    await analyzeHandler({ method: 'GET', query: { projectId, assetId } } as any, r);
    if (r.statusCode >= 400) throw new Error(r.body?.error || `İstek başarısız (${r.statusCode})`);
    return JSON.parse(JSON.stringify(r.body));
  },
}));
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: vi.fn() }));

import { AssetDescription } from '@/studio/components/AssetDescription';

const NOW = Date.now();
const as = (uid: string, role: string, tenantId = 't1') => (authUser.current = { userId: uid, userUid: uid, tenantId, userRole: role });
beforeEach(() => {
  for (const k of Object.keys(docs)) delete docs[k];
  failReads.clear();
  writes.n = 0;
  fetchSpy.mockReset();
  storage.mockClear();
  docs['projects/p1'] = { tenantId: 't1' };
  docs['projects/p2'] = { tenantId: 't1' };
  docs['users/admin1'] = { tenantId: 't1', role: 'admin' };
  docs['users/client1'] = { tenantId: 't1', role: 'client', profile: { assignedProjectIds: ['p1'] } };
  docs['brand_media/a1'] = { tenantId: 't1', projectId: 'p1', kind: 'photo', status: 'active', storage: {} };
  docs['brand_media/a2'] = { tenantId: 't1', projectId: 'p2', kind: 'photo', status: 'active', storage: {} };
  as('admin1', 'admin');
});
afterEach(() => cleanup());
const panel = (p = 'p1', a = 'a1', t = 't1') => render(<AssetDescription tenantId={t} projectId={p} assetId={a} />);
const noWrites = () => {
  expect(writes.n).toBe(0);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(storage).not.toHaveBeenCalled();
};

describe('panel + GET sınırı birlikte', () => {
  it('bekleyen kuyruk, analiz kaydı yok: panel "kuyrukta" der', async () => {
    docs['media_ai_queue/t1_p1_a1'] = { id: 't1_p1_a1', tenantId: 't1', projectId: 'p1', assetId: 'a1', state: 'pending', attempts: 0, nextAttemptAt: NOW - 1, createdAt: NOW - 9, updatedAt: NOW - 9 };
    panel();
    await waitFor(() => expect(screen.getByTestId('desc-queue').getAttribute('data-state')).toBe('queued'));
    expect(screen.queryByTestId('desc-missing')).toBeNull();
    noWrites();
  });

  it('geçerli lease → "işleniyor"; süresi dolmuş lease → işleniyor DEĞİL', async () => {
    docs['media_ai_queue/t1_p1_a1'] = { tenantId: 't1', projectId: 'p1', assetId: 'a1', state: 'pending', attempts: 1, nextAttemptAt: NOW - 1, leaseOwner: 'o', leaseUntil: NOW + 120_000, updatedAt: NOW };
    const r = panel();
    await waitFor(() => expect(screen.getByTestId('desc-queue').getAttribute('data-state')).toBe('processing'));
    r.unmount();
    docs['media_ai_queue/t1_p1_a1'].leaseUntil = NOW - 120_000;
    panel();
    await waitFor(() => expect(screen.getByTestId('desc-queue').getAttribute('data-state')).toBe('queued'));
    noWrites();
  });

  it('kuyruk okuma hatası: panel "kuyruk durumu okunamadı" der; "kuyruk işi yok" DEMEZ', async () => {
    failReads.add('media_ai_queue');
    panel();
    await waitFor(() => expect(screen.getByTestId('desc-queue-unavailable')).toBeTruthy());
    expect(screen.queryByTestId('desc-missing')).toBeNull();
    noWrites();
  });

  it('AI yok, yalnız insan düzeltmesi + doğrulanmış ürün: insan açıklaması ve ÇÖZÜLEN AD görünür; uydurma AI tanımı yok', async () => {
    docs['media_catalog_corrections/t1_p1_a1'] = { tenantId: 't1', projectId: 'p1', assetId: 'a1', overrides: { subject: 'İnsan konusu', description: 'İnsan açıklaması' }, verifiedProductIds: ['lovebombing', 'yok-urun'], note: 'Şef onayı', correctedBy: 'uid-gizli', correctedAt: NOW };
    docs['brand_voice_context/t1_p1'] = { tenantId: 't1', projectId: 'p1', bundle: bundle() };
    panel();
    await waitFor(() => expect(screen.getByTestId('desc-human')).toBeTruthy());
    expect(screen.getByTestId('desc-human').textContent).toMatch(/İnsan açıklaması/);
    expect(screen.getByTestId('desc-verified').textContent).toMatch(/Lovebombing \(kimlik: lovebombing\)/);
    expect(screen.getByTestId('desc-verified').textContent).toMatch(/Ad çözülemedi \(kimlik: yok-urun\)/);
    expect(screen.queryByTestId('desc-semantic')).toBeNull();
    expect(document.body.textContent).not.toMatch(/The Ghosting|uid-gizli/); // istenmeyen ürün adı / uid sızmaz
    noWrites();
  });

  it('BAŞKA tenant paketi ad sızdırmaz: paneli "paket yüklü değil" der', async () => {
    docs['media_catalog_corrections/t1_p1_a1'] = { tenantId: 't1', projectId: 'p1', assetId: 'a1', overrides: {}, verifiedProductIds: ['lovebombing'], correctedAt: NOW };
    docs['brand_voice_context/t1_p1'] = { tenantId: 'tX', projectId: 'p1', bundle: bundle() };
    panel();
    await waitFor(() => expect(screen.getByTestId('desc-verified')).toBeTruthy());
    expect(screen.getByTestId('desc-verified').textContent).toMatch(/Ad çözülemedi \(kimlik: lovebombing\)/);
    expect(screen.getByTestId('desc-verified').textContent).toMatch(/paketi yüklü değil/);
    expect(document.body.textContent).not.toMatch(/Lovebombing\b(?! \()/);
  });

  it('AI + insan: ham AI ve insan değeri ayrı bölümlerde', async () => {
    docs['media_ai_analysis_latest/t1_p1_a1'] = { key: 'k1' };
    docs['media_ai_analyses/k1'] = { key: 'k1', tenantId: 't1', projectId: 'p1', sourceId: 'a1', status: 'done', model: 'claude-haiku-5-5', promptVersion: 'media-catalog-v2', schemaVersion: '2', sourceQuality: 'original', createdAt: NOW, result: { subject: 'AI konu', description: 'AI açıklaması', tags: [], uncertainties: [] } };
    docs['media_catalog_corrections/t1_p1_a1'] = { tenantId: 't1', projectId: 'p1', assetId: 'a1', overrides: { description: 'İnsan açıklaması' }, verifiedProductIds: [], correctedAt: NOW };
    panel();
    await waitFor(() => expect(screen.getByTestId('desc-semantic')).toBeTruthy());
    expect(screen.getByTestId('desc-semantic').textContent).toMatch(/AI açıklaması/);
    expect(screen.getByTestId('desc-semantic').textContent).toMatch(/insan düzeltmesi geçerli/);
    expect(screen.getByTestId('desc-human').textContent).toMatch(/İnsan açıklaması/);
    noWrites();
  });

  it('başka marka varlığı (404) panelde okuma hatası; metadata görünmez', async () => {
    docs['media_ai_queue/t1_p1_a2'] = { tenantId: 't1', projectId: 'p1', assetId: 'a2', state: 'pending', attempts: 0, nextAttemptAt: NOW };
    panel('p1', 'a2'); // a2, p2 projesine ait
    await waitFor(() => expect(screen.getByTestId('desc-read-error').textContent).toMatch(/Medya bulunamadı/));
    expect(screen.queryByTestId('desc-queue')).toBeNull();
    noWrites();
  });

  it('yetkisiz rol (müşteri) panelde okuma hatası; hiçbir veri gösterilmez', async () => {
    as('client1', 'client');
    docs['media_catalog_corrections/t1_p1_a1'] = { tenantId: 't1', projectId: 'p1', assetId: 'a1', overrides: { description: 'gizli' }, verifiedProductIds: [], correctedAt: NOW };
    panel();
    await waitFor(() => expect(screen.getByTestId('desc-read-error')).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/gizli/);
    noWrites();
  });
});
