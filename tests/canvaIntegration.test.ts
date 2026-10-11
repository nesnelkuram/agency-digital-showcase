// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHash, randomBytes } from 'crypto';
import {
  CANVA_TOKEN_URL,
  buildAuthorizeUrl,
  createPkcePair,
  exchangeCode,
  pkceChallenge,
  refreshTokens,
  stateKey,
  validateOAuthState,
} from '@/api/_lib/canva/oauth';
import { open, seal } from '@/api/_lib/integrations/secretBox';
import { CanvaApiError, CanvaClient, canvaAssetName } from '@/api/_lib/canva/client';
import { decideLibraryAccess } from '@/api/_lib/integrations/libraryAccess';
import { canvaSyncState, mediaAnalysisState } from '@/api/_lib/integrations/config';

const KEY = randomBytes(32).toString('base64');

describe('Canva OAuth (PKCE S256, state, token)', () => {
  it('verifier 43–128 karakter, challenge = base64url(sha256(verifier))', () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    const expected = createHash('sha256').update(verifier).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(challenge).toBe(expected);
    expect(() => pkceChallenge('kisa')).toThrow();
  });

  it('yetkilendirme URL\'si: S256, açık scope listesi, state ve redirect; verifier URL\'de yok', () => {
    const { verifier, challenge } = createPkcePair();
    const url = new URL(buildAuthorizeUrl({ clientId: 'cid', redirectUri: 'https://x.test/api/canva/oauth', challenge, state: 'st' }));
    expect(url.origin + url.pathname).toBe('https://www.canva.com/api/oauth/authorize');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('folder:read folder:write asset:read asset:write');
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.toString()).not.toContain(verifier);
  });

  it('state: tek kullanımlık, süreli; yalnız hash saklanır', () => {
    const now = 1_000_000;
    const s = { tenantId: 't', uid: 'u', createdAt: now, expiresAt: now + 600_000, used: false };
    expect(validateOAuthState(s, now + 1)).toEqual({ ok: true });
    expect(validateOAuthState({ ...s, used: true }, now + 1)).toEqual({ ok: false, reason: 'state_reused' });
    expect(validateOAuthState(s, now + 600_001)).toEqual({ ok: false, reason: 'state_expired' });
    expect(validateOAuthState(null, now)).toEqual({ ok: false, reason: 'state_unknown' });
    expect(stateKey('abc')).not.toContain('abc');
  });

  it('kod değişimi: Basic auth + form gövde, secret gövdede yok', async () => {
    const fetchImpl = vi.fn(async (_u: string, _i: any) => ({ ok: true, status: 200, json: async () => ({ access_token: 'A', refresh_token: 'R', expires_in: 14400 }) }));
    const t = await exchangeCode({ code: 'C', verifier: 'V'.repeat(50), redirectUri: 'https://x.test/cb', clientId: 'cid', clientSecret: 'sec' }, fetchImpl, 0);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(CANVA_TOKEN_URL);
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('cid:sec').toString('base64')}`);
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    const body = new URLSearchParams(init.body);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toBe('V'.repeat(50));
    expect(init.body).not.toContain('sec');
    expect(t).toEqual({ accessToken: 'A', refreshToken: 'R', expiresAt: 14_400_000, scope: undefined });
  });

  it('yenileme: yeni refresh token döner (tek kullanımlık); yanıtsızlık "belirsiz" olarak işaretlenir', async () => {
    const ok = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'A2', refresh_token: 'R2', expires_in: 100 }) }));
    expect((await refreshTokens({ refreshToken: 'R1', clientId: 'c', clientSecret: 's' }, ok, 0)).refreshToken).toBe('R2');
    const down = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(refreshTokens({ refreshToken: 'R1', clientId: 'c', clientSecret: 's' }, down as any, 0)).rejects.toMatchObject({ noResponse: true });
  });
});

describe('token şifreleme (AES-256-GCM)', () => {
  it('gidiş-dönüş; değiştirilmiş veri ve yanlış/eksik anahtar reddedilir', () => {
    const s = seal('{"a":"x","r":"y"}', KEY);
    expect(JSON.stringify(s)).not.toContain('"x"');
    expect(open(s, KEY)).toBe('{"a":"x","r":"y"}');
    const tampered = { ...s, data: Buffer.from('zzzz').toString('base64') };
    expect(() => open(tampered, KEY)).toThrow();
    expect(() => open(s, randomBytes(32).toString('base64'))).toThrow();
    expect(() => seal('x', '')).toThrow();
    expect(() => seal('x', Buffer.from('short').toString('base64'))).toThrow();
  });
});

describe('Canva REST istemcisi', () => {
  const res = (status: number, body: any = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

  it('yükleme: octet-stream + Asset-Upload-Metadata (name_base64, ≤50 karakter)', async () => {
    const f = vi.fn(async () => res(200, { job: { id: 'J1', status: 'in_progress' } }));
    const c = new CanvaClient(async () => 'TOKEN', f as any);
    const long = 'Dieci-uzun-bir-dosya-adi-olsun-diye-yazilmis-cok-uzun-isim-WEDD5280.jpg';
    const job = await c.createAssetUploadJob(Buffer.from([1, 2, 3]), long);
    expect(job).toEqual({ id: 'J1', status: 'in_progress' });
    const [url, init] = (f.mock.calls[0] as any[]);
    expect(url).toBe('https://api.canva.com/rest/v1/asset-uploads');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/octet-stream');
    const meta = JSON.parse(init.headers['Asset-Upload-Metadata']);
    const name = Buffer.from(meta.name_base64, 'base64').toString('utf8');
    expect([...name].length).toBeLessThanOrEqual(50);
    expect(name.endsWith('.jpg')).toBe(true);
    expect(canvaAssetName('kısa.png')).toBe('kısa.png');
  });

  it('listeleme yalnız görselleri alır, videoyu atlar; sayfa imleci taşınır', async () => {
    const f = vi.fn(async () =>
      res(200, {
        items: [
          { type: 'image', image: { type: 'image', id: 'A1', name: 'WEDD5280.jpg', tags: [], created_at: 1, updated_at: 2, thumbnail: { url: 'https://t/x', width: 1, height: 1 } } },
          { type: 'image', image: { type: 'video', id: 'V1', name: 'v.mp4' } },
          { type: 'folder', folder: { id: 'F' } },
        ],
        continuation: 'NEXT',
      })
    );
    const c = new CanvaClient(async () => 'T', f as any);
    const page = await c.listFolderImages('FAF3jRI82Dk', 'CUR');
    expect(page.items.map((i) => i.id)).toEqual(['A1']);
    expect(page.continuation).toBe('NEXT');
    const url = new URL((f.mock.calls[0] as any[])[0]);
    expect(url.pathname).toBe('/rest/v1/folders/FAF3jRI82Dk/items');
    expect(url.searchParams.get('item_types')).toBe('image');
    expect(url.searchParams.get('continuation')).toBe('CUR');
  });

  it('hata sınıflandırması: 429 hız sınırı, yanıtsızlık belirsiz, taşıma 204', async () => {
    const c429 = new CanvaClient(async () => 'T', (async () => res(429, { code: 'too_many_requests' })) as any);
    await expect(c429.getAssetUploadJob('J')).rejects.toMatchObject({ status: 429, rateLimited: true });
    const cNet = new CanvaClient(async () => 'T', (async () => {
      throw new Error('timeout');
    }) as any);
    const e = await cNet.createAssetUploadJob(Buffer.from([1]), 'a.jpg').catch((x) => x);
    expect(e).toBeInstanceOf(CanvaApiError);
    expect(e.noResponse).toBe(true);
    const cMove = new CanvaClient(async () => 'T', (async () => res(204)) as any);
    await expect(cMove.moveFolderItem('A1', 'F1')).resolves.toBeUndefined();
    const cMulti = new CanvaClient(async () => 'T', (async () => res(400, { code: 'item_in_multiple_folders' })) as any);
    await expect(cMulti.moveFolderItem('A1', 'F1')).rejects.toMatchObject({ code: 'item_in_multiple_folders' });
  });
});

describe('kütüphane rol sınırı (Canva/AI uçları)', () => {
  const project = { tenantId: 't1' };
  const u = (role: string, assigned: string[] = []) => ({ tenantId: 't1', role, assignedProjectIds: assigned });
  it('iç roller ve atanmış marka yöneticisi; müşteri/freelancer/atanmamış/başka tenant reddedilir', () => {
    for (const r of ['super_admin', 'admin', 'account_manager', 'staff', 'editor']) expect(decideLibraryAccess(u(r), 'p1', project).ok).toBe(true);
    expect(decideLibraryAccess(u('brand_manager', ['p1']), 'p1', project).ok).toBe(true);
    expect(decideLibraryAccess(u('brand_manager', ['p2']), 'p1', project).ok).toBe(false);
    expect(decideLibraryAccess(u('client', ['p1']), 'p1', project).ok).toBe(false);
    expect(decideLibraryAccess(u('freelancer', ['p1']), 'p1', project).ok).toBe(false);
    expect(decideLibraryAccess({ tenantId: 't2', role: 'admin' }, 'p1', project).ok).toBe(false);
    expect(decideLibraryAccess(u('admin'), 'p1', null)).toMatchObject({ ok: false, httpStatus: 404 });
    expect(decideLibraryAccess(u('admin'), '../x', project)).toMatchObject({ ok: false, httpStatus: 400 });
  });
  it('bağlantı/eşleme yönetimi yalnız admin/super_admin', () => {
    expect(decideLibraryAccess(u('admin'), 'p1', project, { adminOnly: true }).ok).toBe(true);
    expect(decideLibraryAccess(u('editor'), 'p1', project, { adminOnly: true }).ok).toBe(false);
    expect(decideLibraryAccess(u('brand_manager', ['p1']), 'p1', project, { adminOnly: true }).ok).toBe(false);
  });
});

describe('fail-closed yapılandırma', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  it('bayrak kapalıysa veya değişken eksikse kapalı; eksik yalnız adlarla raporlanır', () => {
    delete process.env.CANVA_SYNC_ENABLED;
    expect(canvaSyncState().enabled).toBe(false);
    process.env.CANVA_SYNC_ENABLED = 'true';
    for (const n of ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET', 'CANVA_REDIRECT_URI', 'INTEGRATION_TOKEN_KEY', 'FIREBASE_STORAGE_BUCKET']) delete process.env[n];
    const st = canvaSyncState();
    expect(st.enabled).toBe(false);
    if (!st.enabled) expect(st.missing).toContain('CANVA_CLIENT_SECRET');
    process.env.MEDIA_AI_ANALYSIS_ENABLED = 'true';
    delete process.env.ANTHROPIC_API_KEY;
    expect(mediaAnalysisState().enabled).toBe(false);
  });
});
