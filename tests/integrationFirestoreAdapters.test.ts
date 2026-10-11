// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { fakeFirestore } from './helpers/fakeFirestore';
import { firestoreSyncStore } from '@/api/_lib/canva/firestoreStores';
import { newSyncJob } from '@/api/_lib/canva/syncEngine';
import { firestoreAnalysisStore, type AnalysisRecord } from '@/api/_lib/mediaAnalysis/runner';

describe('Firestore bağdaştırıcıları (gerçek uygulama, sahte Firestore)', () => {
  it('sync: lease ikinci çalıştırıcıya verilmez; lease sahibi olmayan yazamaz', async () => {
    const db = fakeFirestore();
    const store = firestoreSyncStore(db);
    const job = newSyncJob({ tenantId: 't', projectId: 'p', connectionId: 'c', assetId: 'a', fileName: 'x.jpg', canvaFolderId: null }, 1);
    await store.createIfAbsent(job);
    expect(await store.claim(job.id, 'w1', 10, 1000)).toBeTruthy();
    expect(await store.claim(job.id, 'w2', 20, 1000)).toBeNull();
    await expect(store.update(job.id, 'w2', { state: 'done' })).rejects.toThrow('lease_lost');
    expect(await store.claim(job.id, 'w2', 5000, 1000)).toBeTruthy(); // süre doldu
    await expect(store.update(job.id, 'w1', { state: 'done' })).rejects.toThrow('lease_lost');
  });

  it('içerik rezervasyonu: ikinci iş busy; hold süresiz; yalnız sahibi bırakır; asset sonrası dedupe', async () => {
    const db = fakeFirestore();
    const s = firestoreSyncStore(db);
    expect(await s.reserveContent('k', 'jobA', 0, 100)).toEqual({ kind: 'reserved' });
    expect(await s.reserveContent('k', 'jobB', 50, 100)).toEqual({ kind: 'busy', jobId: 'jobA' });
    await s.markContent('k', 'jobA', 'hold');
    expect(await s.reserveContent('k', 'jobB', 1_000_000, 100)).toEqual({ kind: 'busy', jobId: 'jobA' });
    await s.markContent('k', 'jobB', 'release'); // sahibi değil → etkisiz
    expect(await s.reserveContent('k', 'jobB', 1_000_000, 100)).toEqual({ kind: 'busy', jobId: 'jobA' });
    await s.setContentIndex('k', { canvaAssetId: 'CA', jobId: 'jobA', at: 1 });
    expect(await s.reserveContent('k', 'jobB', 1_000_001, 100)).toEqual({ kind: 'asset', canvaAssetId: 'CA' });
  });

  it('analiz: claim tekrar çağrıyı engeller, süresi dolan yarım kayıt sınırdaysa failed olur, update fenced', async () => {
    const db = fakeFirestore();
    const st = firestoreAnalysisStore(db);
    const init = { key: 'K', status: 'running', attempts: 1, leaseUntil: 100, leaseOwner: 'o1' } as AnalysisRecord;
    expect((await st.claim('K', init, 0)).claimed).toBe(true);
    expect((await st.claim('K', { ...init, leaseOwner: 'o2' }, 50)).claimed).toBe(false);
    const second = await st.claim('K', { ...init, leaseOwner: 'o2', leaseUntil: 1000 }, 200);
    expect(second).toMatchObject({ claimed: true, record: { attempts: 2, leaseOwner: 'o2' } });
    expect(await st.update('K', 'o1', { status: 'done' })).toBe(false);
    expect(db.data.get('media_ai_analyses/K').status).toBe('running');
    expect(await st.update('K', 'o2', { status: 'failed', retryable: true, leaseOwner: null })).toBe(true);
    db.data.set('media_ai_analyses/K', { ...db.data.get('media_ai_analyses/K'), status: 'running', attempts: 3, leaseUntil: 1 });
    const ex = await st.claim('K', { ...init, leaseOwner: 'o3' }, 5000);
    expect(ex.claimed).toBe(false);
    expect(ex.record).toMatchObject({ status: 'failed', error: { code: 'attempts_exhausted' } });
  });
});
