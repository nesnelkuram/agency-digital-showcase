// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const authUser: { current: any } = { current: null };
vi.mock('@/api/_lib/withAuth', () => ({
  withAuth: (h: any) => (req: any, res: any) => h(Object.assign(req, authUser.current), res),
}));

const docs: Record<string, any> = {};
const fakeDb = {
  collection: (c: string) => ({
    doc: (id: string) => ({
      get: async () => ({ exists: `${c}/${id}` in docs, data: () => docs[`${c}/${id}`] }),
      set: vi.fn(async (v: any) => {
        docs[`${c}/${id}`] = v;
      }),
    }),
  }),
  runTransaction: vi.fn(),
};
vi.mock('@/api/_lib/firebaseAdmin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: async () => ({}) }));

const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);

import analyzeHandler from '@/api/media/analyze';
import syncHandler from '@/api/canva/sync';
import folderHandler from '@/api/canva/folder';
import oauthHandler from '@/api/canva/oauth';
import planSuggestHandler from '@/api/studio/plan-suggest';
import feedbackHandler from '@/api/studio/feedback';
import transitionHandler from '@/api/content-approval/transition.ts';

function res() {
  const r: any = { statusCode: 0, body: null, headers: {} };
  r.setHeader = (k: string, v: string) => ((r.headers[k] = v), r);
  r.status = (s: number) => ((r.statusCode = s), r);
  r.json = (b: any) => ((r.body = b), r);
  r.writeHead = (s: number, h: any) => ((r.statusCode = s), Object.assign(r.headers, h), r);
  r.end = () => r;
  return r;
}

const saved = { ...process.env };
beforeEach(() => {
  for (const k of Object.keys(docs)) delete docs[k];
  docs['projects/p1'] = { tenantId: 't1' };
  docs['users/admin1'] = { tenantId: 't1', role: 'admin' };
  docs['users/client1'] = { tenantId: 't1', role: 'client', profile: { assignedProjectIds: ['p1'] } };
  docs['users/fl1'] = { tenantId: 't1', role: 'freelancer', profile: { assignedProjectIds: ['p1'] } };
  docs['users/bm1'] = { tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['p1'] } };
  fetchSpy.mockReset();
  delete process.env.CANVA_SYNC_ENABLED;
  delete process.env.MEDIA_AI_ANALYSIS_ENABLED;
  delete process.env.PLAN_AI_SUGGEST_ENABLED;
});
afterEach(() => {
  process.env = { ...saved };
});

const as = (uid: string, role: string) => (authUser.current = { userId: uid, userUid: uid, tenantId: 't1', userRole: role });

describe('varsayılan kapalı (fail-closed) uç noktalar', () => {
  it('AI analizi kapalıyken POST 503 ve hiçbir dış çağrı yok', async () => {
    as('admin1', 'admin');
    const r = res();
    await analyzeHandler({ method: 'POST', body: { projectId: 'p1', assetId: 'a1' }, query: {} } as any, r);
    expect(r.statusCode).toBe(503);
    expect(r.body.code).toBe('feature_disabled');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('bayrak açık ama anahtar yoksa yine 503 (yalnız değişken adı raporlanır)', async () => {
    process.env.MEDIA_AI_ANALYSIS_ENABLED = 'true';
    delete process.env.ANTHROPIC_API_KEY;
    as('admin1', 'admin');
    const r = res();
    await analyzeHandler({ method: 'POST', body: { projectId: 'p1', assetId: 'a1' }, query: {} } as any, r);
    expect(r.statusCode).toBe(503);
  });

  it('Canva senkronu kapalıyken POST 503; GET durum döndürür (iş yok)', async () => {
    as('bm1', 'brand_manager');
    const post = res();
    await syncHandler({ method: 'POST', body: { projectId: 'p1', assetId: 'a1' }, query: {} } as any, post);
    expect(post.statusCode).toBe(503);
    const get = res();
    await syncHandler({ method: 'GET', query: { projectId: 'p1', assetId: 'a1' } } as any, get);
    expect(get.body).toEqual({ enabled: false, job: null });
  });

  it('Canva durum uç noktası token/secret içermez', async () => {
    as('admin1', 'admin');
    const r = res();
    await folderHandler({ method: 'GET', query: { projectId: 'p1' } } as any, r);
    expect(r.statusCode).toBe(200);
    expect(r.body.enabled).toBe(false);
    expect(JSON.stringify(r.body)).not.toMatch(/token|secret/i);
  });

  it('OAuth başlatma kapalıyken 503; geri dönüş Studio\'ya "disabled" ile yönlenir', async () => {
    as('admin1', 'admin');
    const r = res();
    await oauthHandler({ method: 'POST', body: {}, query: {} } as any, r);
    expect(r.statusCode).toBe(503);
    const cb = res();
    await oauthHandler({ method: 'GET', query: { code: 'c', state: 's' } } as any, cb);
    expect(cb.statusCode).toBe(302);
    expect(cb.headers.Location).toBe('/studio?canva=disabled');
  });
});

describe('rol sınırı (müşteri ve freelancer reddedilir)', () => {
  it('müşteri ve freelancer analiz/senkron/klasör uçlarına erişemez', async () => {
    for (const [uid, role] of [
      ['client1', 'client'],
      ['fl1', 'freelancer'],
    ]) {
      as(uid, role);
      for (const h of [analyzeHandler, syncHandler]) {
        const r = res();
        await h({ method: 'GET', query: { projectId: 'p1', assetId: 'a1' } } as any, r);
        expect(r.statusCode).toBe(403);
      }
      const f = res();
      await folderHandler({ method: 'GET', query: { projectId: 'p1' } } as any, f);
      expect(f.statusCode).toBe(403);
    }
  });

  it('OAuth\'u yalnız yönetici başlatır (özellik açıkken)', async () => {
    Object.assign(process.env, {
      CANVA_SYNC_ENABLED: 'true',
      CANVA_CLIENT_ID: 'cid',
      CANVA_CLIENT_SECRET: 'sec',
      CANVA_REDIRECT_URI: 'https://x.test/api/canva/oauth',
      INTEGRATION_TOKEN_KEY: Buffer.alloc(32, 7).toString('base64'),
      FIREBASE_STORAGE_BUCKET: 'b',
    });
    as('bm1', 'brand_manager');
    const denied = res();
    await oauthHandler({ method: 'POST', body: {}, query: {} } as any, denied);
    expect(denied.statusCode).toBe(403);
    as('admin1', 'admin');
    const ok = res();
    await oauthHandler({ method: 'POST', body: {}, query: {} } as any, ok);
    expect(ok.statusCode).toBe(200);
    const url = new URL(ok.body.authorizeUrl);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(JSON.stringify(ok.body)).not.toContain('sec');
    const stored = Object.entries(docs).find(([k]) => k.startsWith('canva_oauth_states/'))![1];
    expect(stored.verifier.v).toBe(1); // şifreli
    expect(stored).not.toHaveProperty('state');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('analiz otomatik tetik, insan düzeltmesi ve plan önerisi uç noktaları', () => {
  const txImpl = async (fn: any) =>
    fn({
      get: async (r: any) => r.get(),
      set: (r: any, v: any) => r.set(v),
      update: () => undefined,
    });

  it('upload_complete: analiz kapalıyken 200 queued:false; hiçbir okuma/yazma/dış çağrı yok', async () => {
    as('admin1', 'admin');
    docs['brand_media/a1'] = { tenantId: 't1', projectId: 'p1', kind: 'photo', status: 'active', storage: {} };
    const before = JSON.stringify(docs);
    const r = res();
    await analyzeHandler({ method: 'POST', body: { projectId: 'p1', assetId: 'a1', trigger: 'upload_complete' }, query: {} } as any, r);
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ queued: false, reason: 'feature_disabled' });
    expect(JSON.stringify(docs)).toBe(before);
    expect(fakeDb.runTransaction).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('insan düzeltmesi bayraktan bağımsız kaydedilir; geçersiz alan 400; müşteri 403', async () => {
    fakeDb.runTransaction.mockImplementation(txImpl);
    docs['brand_media/a1'] = { tenantId: 't1', projectId: 'p1', kind: 'photo', status: 'active', storage: {} };
    as('admin1', 'admin');
    const ok = res();
    await analyzeHandler({ method: 'POST', body: { projectId: 'p1', assetId: 'a1', correction: { overrides: { subject: 'mekan' }, verifiedProductIds: ['menu-1'] } }, query: {} } as any, ok);
    expect(ok.statusCode).toBe(200);
    expect(docs['media_catalog_corrections/t1_p1_a1']).toMatchObject({ tenantId: 't1', projectId: 'p1', assetId: 'a1', overrides: { subject: 'mekan' }, verifiedProductIds: ['menu-1'], correctedBy: 'admin1' });
    expect(docs['media_catalog_corrections/t1_p1_a1'].reviewStatus).toBeUndefined();
    const bad = res();
    await analyzeHandler({ method: 'POST', body: { projectId: 'p1', assetId: 'a1', correction: { reviewStatus: 'approved' } }, query: {} } as any, bad);
    expect(bad.statusCode).toBe(400); // medya onay alanı yok (strict şema)
    as('client1', 'client');
    const denied = res();
    await analyzeHandler({ method: 'POST', body: { projectId: 'p1', assetId: 'a1', correction: { overrides: { subject: 'x' } } }, query: {} } as any, denied);
    expect(denied.statusCode).toBe(403);
    fakeDb.runTransaction.mockReset();
  });

  it('başka projenin medyasına düzeltme yazılamaz (404)', async () => {
    fakeDb.runTransaction.mockImplementation(txImpl);
    docs['brand_media/a9'] = { tenantId: 't1', projectId: 'p-other', kind: 'photo', status: 'active', storage: {} };
    as('admin1', 'admin');
    const r = res();
    await analyzeHandler({ method: 'POST', body: { projectId: 'p1', assetId: 'a9', correction: { overrides: { subject: 'x' } } }, query: {} } as any, r);
    expect(r.statusCode).toBe(404);
    expect(docs['media_catalog_corrections/t1_p1_a9']).toBeUndefined();
    fakeDb.runTransaction.mockReset();
  });

  it('plan önerisi: kapalıyken 503 ve dış çağrı yok; müşteri/freelancer 403; geçersiz girdi 400', async () => {
    as('admin1', 'admin');
    const off = res();
    await planSuggestHandler({ method: 'POST', body: { projectId: 'p1', weekStart: '2026-10-12', count: 3 }, query: {} } as any, off);
    expect(off.statusCode).toBe(503);
    expect(off.body.code).toBe('feature_disabled');
    process.env.PLAN_AI_SUGGEST_ENABLED = 'true';
    delete process.env.ANTHROPIC_API_KEY;
    const noKey = res();
    await planSuggestHandler({ method: 'POST', body: { projectId: 'p1', weekStart: '2026-10-12', count: 3 }, query: {} } as any, noKey);
    expect(noKey.statusCode).toBe(503);
    for (const [uid, role] of [['client1', 'client'], ['fl1', 'freelancer']]) {
      as(uid, role);
      const d = res();
      await planSuggestHandler({ method: 'POST', body: { projectId: 'p1', weekStart: '2026-10-12', count: 3 }, query: {} } as any, d);
      expect(d.statusCode).toBe(403);
    }
    as('admin1', 'admin');
    const bad = res();
    await planSuggestHandler({ method: 'POST', body: { projectId: 'p1', weekStart: '12.10.2026', count: 3 }, query: {} } as any, bad);
    expect(bad.statusCode).toBe(400);
    const badCount = res();
    await planSuggestHandler({ method: 'POST', body: { projectId: 'p1', weekStart: '2026-10-12', count: 50 }, query: {} } as any, badCount);
    expect(badCount.statusCode).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('ret/revizyon sebebi uç noktaları', () => {
  const H = 'a'.repeat(32);
  const body = (o: Record<string, any> = {}) => ({ target: { kind: 'suggestion', suggestionSetId: 's1', index: 0 }, category: 'metin', note: 'n', scope: 'content_only', idempotencyKey: 'abcdefabcdef-0001', expectedContentHash: H, ...o });

  it('actor/tenant alanı gönderilirse 400 (spoof); hiçbir okuma/yazma yok', async () => {
    as('admin1', 'admin');
    for (const extra of [{ actorUid: 'evil' }, { tenantId: 't2' }, { createdAt: 1 }]) {
      const r = res();
      await feedbackHandler({ method: 'POST', body: body(extra), query: {} } as any, r);
      expect(r.statusCode).toBe(400);
    }
    expect(fakeDb.runTransaction).not.toHaveBeenCalled();
  });

  it('başka tenant\'ın öneri kümesi 404; müşteri rolü 403', async () => {
    docs['plan_suggestions/s1'] = { tenantId: 't2', projectId: 'p1', posts: [] };
    as('admin1', 'admin');
    const r = res();
    await feedbackHandler({ method: 'POST', body: body(), query: {} } as any, r);
    expect(r.statusCode).toBe(404);
    docs['plan_suggestions/s1'] = { tenantId: 't1', projectId: 'p1', posts: [] };
    as('client1', 'client');
    const c = res();
    await feedbackHandler({ method: 'POST', body: body(), query: {} } as any, c);
    expect(c.statusCode).toBe(403);
    expect(fakeDb.runTransaction).not.toHaveBeenCalled();
  });

  it('plan önerisi: geçersiz geçmiş ayarı 400', async () => {
    as('admin1', 'admin');
    const r = res();
    await planSuggestHandler({ method: 'POST', body: { projectId: 'p1', weekStart: '2026-10-12', count: 3, history: { lookbackDays: 2 } }, query: {} } as any, r);
    expect(r.statusCode).toBe(400);
  });

  it('onay geçişi: geçersiz sebep (eksik sürüm / actor alanı) 400, geçiş çalışmaz', async () => {
    as('admin1', 'admin');
    for (const feedback of [{ category: 'metin', note: '', scope: 'content_only', idempotencyKey: 'abcdefabcdef-0001' }, { category: 'metin', note: '', scope: 'content_only', idempotencyKey: 'abcdefabcdef-0001', expectedContentHash: H, actorUid: 'x' }]) {
      const r = res();
      await transitionHandler({ method: 'POST', body: { planId: 'pl1', action: 'internal_reject', postIds: ['x'], comment: 'c', feedback }, query: {} } as any, r);
      expect(r.statusCode).toBe(400);
    }
    expect(fakeDb.runTransaction).not.toHaveBeenCalled();
  });
});
