/**
 * Storage güvenlik kuralları — emülatör testleri (Firestore + Storage emülatörü birlikte).
 * Yetki Firestore'daki kullanıcı dokümanından okunur (cross-service rules).
 */
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;
let env: RulesTestEnvironment;

const USERS: Record<string, Record<string, unknown>> = {
  admin1: { tenantId: 't1', role: 'admin', profile: {} },
  editor1: { tenantId: 't1', role: 'editor', profile: {} },
  bm1: { tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['projA'] } },
  client1: { tenantId: 't1', role: 'client', profile: { assignedProjectIds: ['projA'] } },
  admin2: { tenantId: 't2', role: 'admin', profile: {} },
};

const IMG = new Uint8Array([137, 80, 78, 71]);
// Emülatör çalıştırmalar arasında nesneleri tutabildiği için yeni dosyalar benzersiz adla yüklenir (write-once)
const RUN = Math.random().toString(36).slice(2, 8);
const img = { contentType: 'image/png' };
const up = (uid: string | null, path: string, meta = img) => {
  const ctx = uid ? env.authenticatedContext(uid) : env.unauthenticatedContext();
  return ctx.storage().ref(path).put(IMG, meta);
};

describe.skipIf(!HAS_EMULATOR)('storage.rules', () => {
  beforeAll(async () => {
    const [fHost, fPort] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    const [sHost, sPort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST!.split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-rules-storage',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: fHost, port: Number(fPort) },
      storage: { rules: readFileSync(process.env.STORAGE_RULES_FILE || 'storage.rules', 'utf8'), host: sHost, port: Number(sPort) },
    });
  });
  afterAll(async () => {
    await env?.cleanup();
  });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.clearStorage();
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (const [uid, data] of Object.entries(USERS)) await ctx.firestore().doc(`users/${uid}`).set(data);
      await ctx.storage().ref('social-media-drafts/t1/projA/existing.png').put(IMG, img);
      for (const f of ['r-editor', 'r-anon', 'r-client', 'r-admin2', 'list-bm/a', 'list-anon/a']) {
        await ctx.storage().ref(`social-media-drafts/t1/projA/${f}.png`).put(IMG, img);
      }
      await ctx.storage().ref('social-media-drafts/t1/projB/list-bm/a.png').put(IMG, img);
      await ctx.storage().ref('social-media/t1/projA/legacy.png').put(IMG, img);
    });
  });

  it('iç ekip kendi tenant\'ının proje medyasını yükler', async () => {
    await assertSucceeds(up('editor1', `social-media-drafts/t1/projB/new-${RUN}.png`));
  });
  it('başka tenant\'a yükleme reddedilir (claim yokken de)', async () => {
    await assertFails(up('admin2', 'social-media-drafts/t1/projA/x.png'));
    await assertFails(up('admin2', 'assets/t1/admin2/x.png'));
  });
  it('marka yöneticisi yalnızca atanmış projeye yükler', async () => {
    await assertSucceeds(up('bm1', `social-media-drafts/t1/projA/bm-${RUN}.png`));
    await assertFails(up('bm1', 'social-media-drafts/t1/projB/bm.png'));
  });
  it('müşteri ve anonim medya yükleyemez', async () => {
    await assertFails(up('client1', 'social-media-drafts/t1/projA/c.png'));
    await assertFails(up(null, 'social-media-drafts/t1/projA/anon.png'));
  });
  it('mevcut dosyanın üzerine yazılamaz ve silinemez (write-once)', async () => {
    await assertFails(up('admin1', 'social-media-drafts/t1/projA/existing.png'));
    await assertFails(env.authenticatedContext('admin1').storage().ref('social-media-drafts/t1/projA/existing.png').delete());
  });
  it('medya dışı içerik türü reddedilir', async () => {
    await assertFails(up('editor1', 'social-media-drafts/t1/projA/x.html', { contentType: 'text/html' }));
  });
  it('müşteri ve marka yöneticisi tenant geneli dosya yollarına yazamaz', async () => {
    await assertFails(up('client1', `projects/t1/x-${RUN}.png`));
    await assertFails(up('bm1', 'campaigns/t1/x.png'));
    await assertSucceeds(up('editor1', `projects/t1/x-${RUN}.png`));
  });

  // Emülatör notu: aynı nesne/önek için ilk okuma kararı, sonraki farklı kullanıcıların isteklerine de
  // yansıyabiliyor (kuraldan bağımsız). Bu yüzden her okuma kontrolü ayrı nesne/önek kullanır.
  it('yetkili ekip taslağı okur ve listeler', async () => {
    await assertSucceeds(env.authenticatedContext('editor1').storage().ref('social-media-drafts/t1/projA/r-editor.png').getMetadata());
    await assertSucceeds(env.authenticatedContext('bm1').storage().ref('social-media-drafts/t1/projA/list-bm').listAll());
  });
  it('taslak medya anonim/müşteri/atanmamış kişi tarafından okunamaz ve listelenemez', async () => {
    await assertFails(env.unauthenticatedContext().storage().ref('social-media-drafts/t1/projA/r-anon.png').getMetadata());
    await assertFails(env.authenticatedContext('client1').storage().ref('social-media-drafts/t1/projA/r-client.png').getMetadata());
    await assertFails(env.authenticatedContext('admin2').storage().ref('social-media-drafts/t1/projA/r-admin2.png').getMetadata());
    await assertFails(env.unauthenticatedContext().storage().ref('social-media-drafts/t1/projA/list-anon').listAll());
    await assertFails(env.authenticatedContext('bm1').storage().ref('social-media-drafts/t1/projB/list-bm').listAll());
  });
  it('eski yol: mevcut dosya okunur, listeleme ve yeni yazma kapalı', async () => {
    await assertSucceeds(env.unauthenticatedContext().storage().ref('social-media/t1/projA/legacy.png').getMetadata());
    await assertFails(env.unauthenticatedContext().storage().ref('social-media/t1/projA').listAll());
    await assertFails(up('admin1', `social-media/t1/projA/new-${RUN}.png`));
  });
});
