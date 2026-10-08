// @vitest-environment node
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { OdagiApplicationService, ODAGI_COLLECTION, ODAGI_LIMITS, odagiApplicationSchema } from '../api/_lib/odagiApplications.js';

if (process.env.ODAGI_REQUIRE_EMULATOR && !process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Odağı integration tests require a local emulator.');
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
if (enabled && !/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST!)) throw new Error('Only a local Firestore emulator is allowed.');
describe.skipIf(!enabled)('Odağı persistence using a local Firestore emulator', () => {
  const app = initializeApp({ projectId: 'demo-odagi' }, 'odagi-integration');
  let db: Firestore, service: OdagiApplicationService;
  const input = () => odagiApplicationSchema.parse({
    requestId: randomUUID(), name: 'Test Başvurusu', email: 'test@example.invalid', city:'İstanbul', district:'Kadıköy', neighborhood:'Caferağa', area:12,
    occupation:'Tasarımcı', employed:'yes', ownsSpace:'yes', company:'none', daytimeAvailable:'yes', couriers:'Şubeye kendim teslim ederim.',
    petSmoke:['clear'], roomConditions:['clear'], packingSpace:'yes', investment:'no', roomInfo:'Kuru ve ayrı bir alan.', income:'5-25', applicationConsent:true, website:'',
  });
  beforeAll(() => { db = getFirestore(app); service = new OdagiApplicationService(db); });
  beforeEach(async () => { await db.recursiveDelete(db.collection(ODAGI_COLLECTION)); await db.recursiveDelete(db.collection(ODAGI_LIMITS)); });
  afterAll(async () => { await db.recursiveDelete(db.collection(ODAGI_COLLECTION)); await db.recursiveDelete(db.collection(ODAGI_LIMITS)); await db.terminate(); await deleteApp(app); });
  it('stores the complete application and only then returns a reference', async () => {
    const data = input(); const result = await service.submit(data,'test-ip');
    const stored = (await db.collection(ODAGI_COLLECTION).doc(data.requestId).get()).data()!;
    expect(stored.email).toBe(data.email); expect(stored.area).toBe(12); expect(stored.reference).toBe(result.reference);
    expect(stored.applicationConsent).toBe(true); expect(stored.noticeVersion).toBe('2026-09-12-v2');
    expect(stored.ip).toBeUndefined(); expect(stored.requestId).toBeUndefined(); expect(stored.website).toBeUndefined();
  });
  it('concurrent retries produce one record and the same reference', async () => {
    const data = input(); const results = await Promise.all([1,2,3].map(() => service.submit(data,'retry-ip')));
    expect(new Set(results.map(result => result.reference)).size).toBe(1);
    expect((await db.collection(ODAGI_COLLECTION).get()).size).toBe(1);
    const limits = await db.collection(ODAGI_LIMITS).get(); expect(limits.docs.every(doc => doc.data().count === 1)).toBe(true);
  });
  it('a reused request ID cannot overwrite an existing application', async () => {
    const data = input(); await service.submit(data,'test-ip');
    await expect(service.submit({...data,name:'Farklı kişi'},'test-ip')).rejects.toMatchObject({status:409});
    expect((await db.collection(ODAGI_COLLECTION).doc(data.requestId).get()).data()!.name).toBe(data.name);
  });
  it('enforces the email quota across service instances without creating another record', async () => {
    for (let i=0;i<5;i++) await new OdagiApplicationService(db).submit(input(),`ip-${i}`);
    await expect(new OdagiApplicationService(db).submit(input(),'another-ip')).rejects.toMatchObject({status:429});
    expect((await db.collection(ODAGI_COLLECTION).get()).size).toBe(5);
  });
  it('rejects the honeypot and never persists it', async () => {
    await expect(service.submit({...input(),website:'bot.example'},'test-ip')).rejects.toMatchObject({status:400});
    expect((await db.collection(ODAGI_COLLECTION).get()).empty).toBe(true);
  });
  it('lists records for the admin without exposing internal hashes', async () => {
    await service.submit(input(),'test-ip');
    const listed = await service.list();
    expect(listed.applications).toHaveLength(1); expect(listed.nextCursor).toBeNull();
    expect(listed.applications[0]).not.toHaveProperty('payloadHash'); expect(listed.applications[0]).not.toHaveProperty('consentText');
    await expect(service.list('invalid-cursor')).rejects.toMatchObject({status:400});
  });
});
