// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomBytes } from 'crypto';
import { getAccessToken, saveConnection, secretDocId } from '@/api/_lib/canva/firestoreStores';
import { open } from '@/api/_lib/integrations/secretBox';
import { TOKEN_REQUEST_TIMEOUT_MS } from '@/api/_lib/canva/oauth';
import { fakeFirestore } from './helpers/fakeFirestore';

const fakeDb = fakeFirestore;

const PATH = `integration_secrets/${secretDocId('t1')}`;
const okFetch = (a = 'A2', r = 'R2') => vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ access_token: a, refresh_token: r, expires_in: 14400 }) }));

beforeEach(() => {
  process.env.INTEGRATION_TOKEN_KEY = randomBytes(32).toString('base64');
});

async function connected(db: any, now: number, expiresAt: number) {
  await saveConnection(db, { tenantId: 't1', uid: 'admin1', tokens: { accessToken: 'A1', refreshToken: 'R1', expiresAt }, now });
}

describe('Canva token yenileme (tek kullanımlık refresh, fencing)', () => {
  it('geçerli token: yenileme yok', async () => {
    const db = fakeDb();
    await connected(db, 1, 10_000_000);
    const f = okFetch();
    expect(await getAccessToken(db, 't1', { clientId: 'c', clientSecret: 's', fetchImpl: f, now: () => 1000 })).toBe('A1');
    expect(f).not.toHaveBeenCalled();
  });

  it('süresi dolmuş: yenilenir, YENİ refresh token şifreli saklanır, kilit bırakılır', async () => {
    const db = fakeDb();
    await connected(db, 1, 0);
    expect(await getAccessToken(db, 't1', { clientId: 'c', clientSecret: 's', fetchImpl: okFetch(), now: () => 1000 })).toBe('A2');
    const c = db.data.get(PATH);
    expect(JSON.parse(open(c.tokens))).toEqual({ a: 'A2', r: 'R2' });
    expect(c.refreshLockOwner).toBeNull();
    expect(JSON.stringify(c)).not.toContain('R2');
  });

  it('kilit başkasındayken ikinci yenileme yapılmaz (busy)', async () => {
    const db = fakeDb();
    await connected(db, 1, 0);
    db.data.set(PATH, { ...db.data.get(PATH), refreshLockUntil: 5000, refreshLockOwner: 'other' });
    const f = okFetch();
    await expect(getAccessToken(db, 't1', { clientId: 'c', clientSecret: 's', fetchImpl: f, now: () => 1000 })).rejects.toMatchObject({ code: 'refresh_in_progress' });
    expect(f).not.toHaveBeenCalled();
  });

  it('FENCING: yenileme sürerken kilit başka sahibe geçtiyse eski sonuç yazılmaz', async () => {
    const db = fakeDb();
    await connected(db, 1, 0);
    const f = vi.fn(async () => {
      db.data.set(PATH, { ...db.data.get(PATH), refreshLockOwner: 'new-owner', tokens: db.data.get(PATH).tokens });
      return { ok: true, status: 200, json: async () => ({ access_token: 'OLD-A', refresh_token: 'OLD-R', expires_in: 100 }) };
    });
    await expect(getAccessToken(db, 't1', { clientId: 'c', clientSecret: 's', fetchImpl: f, now: () => 1000, lockOwner: 'me' })).rejects.toMatchObject({ code: 'lock_lost' });
    expect(JSON.parse(open(db.data.get(PATH).tokens)).r).toBe('R1'); // ezilmedi
    expect(db.data.get(PATH).refreshLockOwner).toBe('new-owner');
  });

  it('FENCING: yenileme sürerken yeniden bağlanıldıysa (yeni connectionId) eski sonuç yazılmaz', async () => {
    const db = fakeDb();
    await connected(db, 1, 0);
    const f = vi.fn(async () => {
      await connected(db, 2, 99_999_999); // yönetici yeniden bağladı
      return { ok: true, status: 200, json: async () => ({ access_token: 'OLD-A', refresh_token: 'OLD-R', expires_in: 100 }) };
    });
    await expect(getAccessToken(db, 't1', { clientId: 'c', clientSecret: 's', fetchImpl: f, now: () => 1000, lockOwner: 'me' })).rejects.toMatchObject({ code: 'lock_lost' });
    const c = db.data.get(PATH);
    expect(c.connectionId).toBe('t1:2');
    expect(JSON.parse(open(c.tokens))).toEqual({ a: 'A1', r: 'R1' });
    expect(c.status).toBe('connected');
  });

  it('yanıtsız/zaman aşımı: bağlantı reauth_required olur (yalnız kilit sahibi işaretler)', async () => {
    const db = fakeDb();
    await connected(db, 1, 0);
    const f = vi.fn(async (_u: string, init: any) => {
      expect(init.signal).toBeInstanceOf(AbortSignal); // zaman aşımı sinyali iletilir
      throw new Error('aborted');
    });
    await expect(getAccessToken(db, 't1', { clientId: 'c', clientSecret: 's', fetchImpl: f, now: () => 1000 })).rejects.toMatchObject({ noResponse: true });
    expect(db.data.get(PATH).status).toBe('reauth_required');
    expect(TOKEN_REQUEST_TIMEOUT_MS).toBeLessThan(30_000);
  });

  it('kilit kaybedildikten sonra gelen hata, yeni sahibin bağlantısını reauth_required yapmaz', async () => {
    const db = fakeDb();
    await connected(db, 1, 0);
    const f = vi.fn(async () => {
      db.data.set(PATH, { ...db.data.get(PATH), refreshLockOwner: 'new-owner' });
      throw new Error('timeout');
    });
    await expect(getAccessToken(db, 't1', { clientId: 'c', clientSecret: 's', fetchImpl: f, now: () => 1000, lockOwner: 'me' })).rejects.toBeTruthy();
    expect(db.data.get(PATH).status).toBe('connected');
  });
});
