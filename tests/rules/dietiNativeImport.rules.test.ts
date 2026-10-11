/**
 * Dieci native import kuralları (gerçek emülatör). Mevcut kurallar değişmez; import şekli bunları geçmeli.
 * Çalıştırma: firebase emulators:exec --only firestore,storage --project demo-dieci-import "node ./node_modules/vitest/vitest.mjs run tests/rules/dietiNativeImport.rules.test.ts"
 */
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;
let env: RulesTestEnvironment;
const PLAN = 'content_plans/dsp_plan1';
const POST = 'social_media_posts/dsp_post1';
const FILE = 'social-media-drafts/t1/p1/dieci-2026-10-12/MAG3jdKYG_8.jpg';

const planDoc = (tenantId: string, projectId: string) => ({
  id: 'dsp_plan1', tenantId, projectId, title: 'Dieci taslak', platform: 'instagram', postIds: ['dsp_post1'], status: 'draft', shareToken: '', clientComments: [], createdBy: 'x', createdByName: 'x',
});
const postDoc = (tenantId: string, projectId: string) => ({
  id: 'dsp_post1', tenantId, projectId, title: 't', caption: 'Loud outside.', hashtags: [], mediaUrls: [], libraryAssetIds: [],
  media: [{ id: 'MAG3jdKYG_8', url: '', type: 'image', mimeType: 'image/jpeg', size: 1, order: 0, storagePath: FILE }],
  postType: 'story', platforms: ['instagram'], status: 'draft', contentPlanId: 'dsp_plan1', createdBy: 'x',
});

describe.skipIf(!HAS_EMULATOR)('Dieci native import kuralları', () => {
  beforeAll(async () => {
    const [fh, fp] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    const [sh, sp] = process.env.FIREBASE_STORAGE_EMULATOR_HOST!.split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-dieci-import',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: fh, port: Number(fp) },
      storage: { rules: readFileSync('storage.rules', 'utf8'), host: sh, port: Number(sp) },
    });
  });
  afterAll(async () => { await env?.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.clearStorage();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc('users/admin1').set({ tenantId: 't1', role: 'admin', profile: {} });
      await db.doc('users/admin2').set({ tenantId: 't2', role: 'admin', profile: {} });
      await db.doc('users/bm1').set({ tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['p1'] } });
      await db.doc('users/bm2').set({ tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['p2'] } });
      await db.doc('users/client1').set({ tenantId: 't1', role: 'client', profile: {} });
      await db.doc('projects/p1').set({ tenantId: 't1', name: 'Dieci' });
      await db.doc('projects/p2').set({ tenantId: 't1', name: 'Diğer' });
      await ctx.storage().ref(FILE).putString('x', 'raw', { contentType: 'image/jpeg' });
    });
  });

  it('import şekli: yetkili iç kullanıcı plan ve postu taslak olarak oluşturabilir', async () => {
    const db = env.authenticatedContext('admin1').firestore();
    await assertSucceeds(db.doc(PLAN).set(planDoc('t1', 'p1')));
    await assertSucceeds(db.doc(POST).set(postDoc('t1', 'p1')));
  });

  it('import şekli: başka tenant admini ve müşteri oluşturamaz', async () => {
    await assertFails(env.authenticatedContext('admin2').firestore().doc(PLAN).set(planDoc('t1', 'p1')));
    await assertFails(env.authenticatedContext('client1').firestore().doc(POST).set(postDoc('t1', 'p1')));
  });

  it('istemci yayın/onay statüsü ile post oluşturamaz (draft zorunlu)', async () => {
    const db = env.authenticatedContext('admin1').firestore();
    await assertSucceeds(db.doc(PLAN).set(planDoc('t1', 'p1')));
    await assertFails(db.doc(POST).set({ ...postDoc('t1', 'p1'), status: 'approved' }));
  });

  it('plan/post okuma: atanmış marka yöneticisi kendi projesini okur, diğer projeyi okuyamaz', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(PLAN).set(planDoc('t1', 'p1'));
      await ctx.firestore().doc(POST).set(postDoc('t1', 'p1'));
    });
    await assertSucceeds(env.authenticatedContext('bm1').firestore().doc(POST).get());
    await assertFails(env.authenticatedContext('bm2').firestore().doc(POST).get());
    await assertFails(env.unauthenticatedContext().firestore().doc(POST).get());
  });

  it('Storage (mevcut kural): anonim ve müşteri dosyayı okuyamaz', async () => {
    await assertFails(env.unauthenticatedContext().storage().ref(FILE).getMetadata());
    await assertFails(env.authenticatedContext('client1').storage().ref(FILE).getMetadata());
  });

  it('Storage: istemci güncelleme/silme yapamaz (write-once)', async () => {
    await assertFails(env.authenticatedContext('admin1').storage().ref(FILE).delete());
    await assertFails(env.authenticatedContext('admin1').storage().ref(FILE).updateMetadata({ contentType: 'image/png' }));
  });

  // ---- İçe aktarma akışı (tarayıcıdaki importer ile aynı sıra): olmayan dokümanı doğrudan okumak reddedilir; sorgu geçer ----
  it('olmayan plan dokümanını doğrudan okumak reddedilir; tenant+proje filtreli sorgu geçer (admin ve atanmış marka yöneticisi)', async () => {
    for (const uid of ['admin1', 'bm1']) {
      const db = env.authenticatedContext(uid).firestore();
      await assertFails(db.doc(PLAN).get());
      await assertSucceeds(db.collection('content_plans').where('tenantId', '==', 't1').where('projectId', '==', 'p1').limit(500).get());
      await assertSucceeds(db.collection('social_media_posts').where('tenantId', '==', 't1').where('projectId', '==', 'p1').where('contentPlanId', '==', 'dsp_plan1').limit(500).get());
    }
  });

  it('importer sırası: plan → postlar (gömülü önizleme dahil) → eksik önizleme için yalnız media güncellemesi; atanmış marka yöneticisi de yapabilir', async () => {
    for (const [uid, planId, postId] of [['admin1', 'dsp_planA', 'dsp_postA'], ['bm1', 'dsp_planB', 'dsp_postB']] as const) {
      const db = env.authenticatedContext(uid).firestore();
      await assertSucceeds(db.doc(`content_plans/${planId}`).set({ ...planDoc('t1', 'p1'), id: planId, postIds: [postId], createdAt: new Date(), updatedAt: new Date(), weekStartDate: new Date('2026-10-11T21:00:00Z'), weekEndDate: new Date('2026-10-18T20:59:59Z') }));
      const post = { ...postDoc('t1', 'p1'), id: postId, contentPlanId: planId, createdAt: new Date(), updatedAt: new Date() };
      post.media = [{ ...post.media[0], thumbnailUrl: 'data:image/jpeg;base64,/9j/4AAQ' } as any];
      await assertSucceeds(db.doc(`social_media_posts/${postId}`).set(post));
      await assertSucceeds(db.doc(`social_media_posts/${postId}`).update({ media: post.media, updatedAt: new Date() }));
    }
  });

  it('başka projeye atanmış marka yöneticisi bu projeye plan/post yazamaz', async () => {
    const db = env.authenticatedContext('bm2').firestore();
    await assertFails(db.doc('content_plans/dsp_planX').set({ ...planDoc('t1', 'p1'), id: 'dsp_planX' }));
  });
});
