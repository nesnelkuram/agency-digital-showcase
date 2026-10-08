/**
 * Marka medya kütüphanesi — Firestore + Storage kural testleri (emülatör; gerçek proje yok: demo-*).
 * Çalıştırma: firebase emulators:exec --only firestore,storage --project demo-rules-media "npm run test:rules"
 */
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;
let env: RulesTestEnvironment;

const USERS: Record<string, Record<string, unknown>> = {
  admin1: { tenantId: 't1', role: 'admin', profile: {} },
  editor1: { tenantId: 't1', role: 'editor', profile: {} },
  staff1: { tenantId: 't1', role: 'staff', profile: {} },
  bm1: { tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['projA'] } },
  bmB: { tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['projB'] } },
  bmGhost: { tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['projGhost'] } },
  fl1: { tenantId: 't1', role: 'freelancer', profile: { assignedProjectIds: ['projA'] } },
  client1: { tenantId: 't1', role: 'client', profile: { assignedProjectIds: ['projA'] } },
  admin2: { tenantId: 't2', role: 'admin', profile: {} },
  sa1: { tenantId: 't1', role: 'super_admin', profile: {} },
  sa2: { tenantId: 't2', role: 'super_admin', profile: {} },
};

const ts = () => firebase.firestore.FieldValue.serverTimestamp();
const enc = (p: string) => encodeURIComponent(p);
const dl = (p: string, host = 'firebasestorage.googleapis.com', proto = 'https') => `${proto}://${host}/v0/b/demo-bucket/o/${enc(p)}?alt=media&token=tok`;

function record(over: Record<string, any> = {}, storage: Record<string, any> = {}, id = 'new1', projectId = 'projA', tenantId = 't1') {
  const path = `brand-media/${tenantId}/${projectId}/${id}/final.jpg`;
  return {
    tenantId, projectId, kind: 'photo', title: 'Final', fileName: 'final.jpg', tags: ['urun'], status: 'active',
    storage: { path, downloadUrl: dl(path), contentType: 'image/jpeg', size: 1000, ...storage },
    createdBy: 'bm1', createdAt: ts(), updatedAt: ts(),
    ...over,
  };
}

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const IMG = new Uint8Array([255, 216, 255]);
const RUN = Math.random().toString(36).slice(2, 8);
const up = (uid: string | null, path: string, contentType = 'image/jpeg') => {
  const ctx = uid ? env.authenticatedContext(uid) : env.unauthenticatedContext();
  return ctx.storage().ref(path).put(IMG, { contentType });
};

describe.skipIf(!HAS_EMULATOR)('marka medya kütüphanesi kuralları', () => {
  beforeAll(async () => {
    const [fHost, fPort] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    const [sHost, sPort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST!.split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-rules-media',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: fHost, port: Number(fPort) },
      storage: { rules: readFileSync('storage.rules', 'utf8'), host: sHost, port: Number(sPort) },
    });
  });
  afterAll(async () => {
    await env?.cleanup();
  });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.clearStorage();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (const [uid, data] of Object.entries(USERS)) await db.doc(`users/${uid}`).set(data);
      await db.doc('projects/projA').set({ tenantId: 't1', name: 'Rakle' });
      await db.doc('projects/projB').set({ tenantId: 't1', name: 'Diğer' });
      await db.doc('projects/projC').set({ tenantId: 't2', name: 'Başka ajans' });
      const existing = record({ createdAt: new Date(), updatedAt: new Date() }, {}, 'a1');
      await db.doc('brand_media/a1').set(existing);
      await db.doc('brand_media/b1').set(record({ createdAt: new Date(), updatedAt: new Date() }, {}, 'b1', 'projB'));
      await db.doc('social_media_posts/draftA').set({ tenantId: 't1', projectId: 'projA', status: 'draft', caption: 'x', media: [] });
      await db.doc('social_media_posts/approvedA').set({ tenantId: 't1', projectId: 'projA', status: 'approved', caption: 'y', media: [] });
      await db.doc('social_media_posts/pendingA').set({ tenantId: 't1', projectId: 'projA', status: 'pending_approval', caption: 'z', media: [] });
      await ctx.storage().ref('brand-media/t1/projA/a1/final.jpg').put(IMG, { contentType: 'image/jpeg' });
      // Emülatör aynı nesnenin okuma kararını önbelleğe alabildiği için her okuyucu ayrı nesne kullanır
      for (const r of ['bm1', 'fl1', 'client1', 'anon', 'bmB', 'sa1', 'sa2']) {
        await ctx.storage().ref(`brand-media/t1/projA/a1/read-${r}.jpg`).put(IMG, { contentType: 'image/jpeg' });
      }
    });
  });

  describe('Firestore brand_media — erişim', () => {
    it('atanmış marka yöneticisi ve iç roller kendi markasında oluşturur', async () => {
      await assertSucceeds(as('bm1').doc('brand_media/new1').set(record()));
      await assertSucceeds(as('editor1').doc('brand_media/new2').set(record({ createdBy: 'editor1' }, {}, 'new2')));
      await assertSucceeds(as('staff1').doc('brand_media/new3').set(record({ createdBy: 'staff1' }, {}, 'new3')));
    });
    it('atanmamış marka yöneticisi, freelancer (atanmış olsa bile), müşteri, anonim ve başka tenant reddedilir', async () => {
      await assertFails(as('bmB').doc('brand_media/new1').set(record({ createdBy: 'bmB' })));
      await assertFails(as('fl1').doc('brand_media/new1').set(record({ createdBy: 'fl1' })));
      await assertFails(as('client1').doc('brand_media/new1').set(record({ createdBy: 'client1' })));
      await assertFails(env.unauthenticatedContext().firestore().doc('brand_media/new1').set(record()));
      await assertFails(as('admin2').doc('brand_media/new1').set(record({ createdBy: 'admin2' })));
    });
    it('proje var olmalı ve aynı tenant\'a ait olmalı', async () => {
      await assertFails(as('bmGhost').doc('brand_media/g1').set(record({ createdBy: 'bmGhost' }, {}, 'g1', 'projGhost')));
      await assertFails(as('admin1').doc('brand_media/g2').set(record({ createdBy: 'admin1' }, {}, 'g2', 'projGhost')));
      await assertFails(as('admin1').doc('brand_media/c1').set(record({ createdBy: 'admin1' }, {}, 'c1', 'projC')));
    });
    it('okuma: atanmış marka yöneticisi okur; diğer marka, freelancer, müşteri okuyamaz', async () => {
      await assertSucceeds(as('bm1').doc('brand_media/a1').get());
      await assertSucceeds(as('editor1').doc('brand_media/b1').get());
      await assertFails(as('bm1').doc('brand_media/b1').get());
      await assertFails(as('fl1').doc('brand_media/a1').get());
      await assertFails(as('client1').doc('brand_media/a1').get());
      await assertFails(as('admin2').doc('brand_media/a1').get());
    });
    it('super_admin yalnız kendi tenant\'ının kataloğunu okur/yazar (başka tenant kapalı)', async () => {
      await assertSucceeds(as('sa1').doc('brand_media/a1').get());
      await assertFails(as('sa2').doc('brand_media/a1').get());
      await assertFails(as('sa2').doc('brand_media/new9').set(record({ createdBy: 'sa2' }, {}, 'new9')));
      await assertFails(as('sa2').doc('brand_media/a1').update({ title: 'x', updatedAt: ts() }));
    });
    it('liste sorgusu proje filtresiyle çalışır, filtresiz reddedilir', async () => {
      await assertSucceeds(
        as('bm1').collection('brand_media').where('tenantId', '==', 't1').where('projectId', '==', 'projA').where('status', '==', 'active').get()
      );
      await assertFails(as('bm1').collection('brand_media').where('tenantId', '==', 't1').get());
    });
  });

  describe('Firestore brand_media — katalog ↔ dosya tutarlılığı ve 1 GB', () => {
    it('size: 1_000_000_000 kabul, 1_000_000_001 red', async () => {
      await assertSucceeds(as('bm1').doc('brand_media/new1').set(record({}, { size: 1_000_000_000 })));
      await assertFails(as('bm1').doc('brand_media/new2').set(record({}, { size: 1_000_000_001 }, 'new2')));
    });
    it('başka host, HTTP, başka varlık klasörü, çift nokta, tür uyuşmazlığı reddedilir', async () => {
      const p = 'brand-media/t1/projA/new1/final.jpg';
      await assertFails(as('bm1').doc('brand_media/new1').set(record({}, { downloadUrl: dl(p, 'evil.example.com') })));
      await assertFails(as('bm1').doc('brand_media/new1').set(record({}, { downloadUrl: dl(p, undefined, 'http') })));
      const other = 'brand-media/t1/projA/other/final.jpg';
      await assertFails(as('bm1').doc('brand_media/new1').set(record({}, { path: other, downloadUrl: dl(other) })));
      const dots = 'brand-media/t1/projA/new1/photo..jpg';
      await assertFails(as('bm1').doc('brand_media/new1').set(record({}, { path: dots, downloadUrl: dl(dots) })));
      await assertFails(as('bm1').doc('brand_media/new1').set(record({ kind: 'video' })));
    });
    it('önizleme: aynı klasörde thumb.jpg, yol ve URL birlikte', async () => {
      const t = 'brand-media/t1/projA/new1/thumb.jpg';
      await assertSucceeds(as('bm1').doc('brand_media/new1').set(record({}, { thumbPath: t, thumbUrl: dl(t) })));
      await assertFails(as('bm1').doc('brand_media/new2').set(record({}, { thumbPath: 'brand-media/t1/projA/new2/thumb.jpg' }, 'new2')));
      const t3 = 'brand-media/t1/projA/new3/thumb.jpg';
      await assertFails(as('bm1').doc('brand_media/new3').set(record({}, { thumbPath: t3, thumbUrl: dl(t3, 'evil.example.com') }, 'new3')));
    });
    it('durum active olmalı, başkası adına oluşturulamaz, ek alan yok', async () => {
      await assertFails(as('bm1').doc('brand_media/new1').set(record({ status: 'archived' })));
      await assertFails(as('bm1').doc('brand_media/new1').set(record({ createdBy: 'editor1' })));
      await assertFails(as('bm1').doc('brand_media/new1').set(record({ reviewStatus: 'approved' })));
    });
  });

  describe('Firestore brand_media — güncelleme', () => {
    it('başlık/etiket/arşiv değişir; dosya, proje, tenant değişmez; silme yok', async () => {
      await assertSucceeds(as('bm1').doc('brand_media/a1').update({ title: 'Yeni', tags: ['x'], updatedAt: ts() }));
      await assertSucceeds(as('bm1').doc('brand_media/a1').update({ status: 'archived', archivedAt: ts(), updatedAt: ts() }));
      await assertFails(as('bm1').doc('brand_media/a1').update({ 'storage.size': 5, updatedAt: ts() }));
      await assertFails(as('admin1').doc('brand_media/a1').update({ projectId: 'projB', updatedAt: ts() }));
      await assertFails(as('bm1').doc('brand_media/a1').delete());
      await assertFails(as('admin1').doc('brand_media/a1').delete());
      await assertFails(as('bmB').doc('brand_media/a1').update({ title: 'x', updatedAt: ts() }));
    });
  });

  describe('Firestore social_media_posts.libraryAssetIds', () => {
    it('taslakta medya ile birlikte yazılır; en fazla 10', async () => {
      await assertSucceeds(as('bm1').doc('social_media_posts/draftA').update({ media: [], mediaUrls: [], libraryAssetIds: ['a1'], updatedAt: ts() }));
      await assertFails(as('bm1').doc('social_media_posts/draftA').update({ libraryAssetIds: Array.from({ length: 11 }, (_, i) => `a${i}`), updatedAt: ts() }));
    });
    it('müşteride bekleyen veya onaylı içerikte medya/kütüphane kimlikleri değişmez (Revizyona al gerekir)', async () => {
      await assertFails(as('bm1').doc('social_media_posts/approvedA').update({ libraryAssetIds: ['a1'], updatedAt: ts() }));
      await assertFails(as('bm1').doc('social_media_posts/pendingA').update({ media: [{ id: 'x' }], libraryAssetIds: ['a1'], updatedAt: ts() }));
      await assertFails(as('admin1').doc('social_media_posts/approvedA').update({ media: [{ id: 'x' }], updatedAt: ts() }));
    });
    it('onaylı içeriğin zamanı istemciden değişmez (yeni talimat: zaman değişimi yeniden onay gerektirir)', async () => {
      await assertFails(as('bm1').doc('social_media_posts/approvedA').update({ scheduledAt: new Date(), updatedAt: ts() }));
      await assertFails(as('admin1').doc('social_media_posts/approvedA').update({ scheduledAt: new Date(), updatedAt: ts() }));
      await assertSucceeds(as('bm1').doc('social_media_posts/draftA').update({ scheduledAt: new Date(), updatedAt: ts() }));
    });
  });

  describe('super_admin: onay/zaman güvenliği (yeni talimat; diğer yetkiler aynı)', () => {
    beforeEach(async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('content_plans/planA').set({ tenantId: 't1', projectId: 'projA', status: 'approved', title: 'A', reviewRequestId: 'round-A', postIds: [] });
      });
    });
    it('onaylı/firmadaki içeriğin metni, medyası, kütüphane kimlikleri ve zamanı değişmez', async () => {
      await assertFails(as('sa1').doc('social_media_posts/approvedA').update({ caption: 'gizli' }));
      await assertFails(as('sa1').doc('social_media_posts/approvedA').update({ scheduledAt: new Date() }));
      await assertFails(as('sa1').doc('social_media_posts/pendingA').update({ media: [{ id: 'x' }], libraryAssetIds: ['a1'] }));
      await assertFails(as('sa2').doc('social_media_posts/approvedA').update({ scheduledAt: new Date() }));
    });
    it('durum ve onay alanlarını istemciden yazamaz; onaylı post oluşturamaz', async () => {
      await assertFails(as('sa1').doc('social_media_posts/draftA').update({ status: 'approved' }));
      await assertFails(as('sa1').doc('social_media_posts/draftA').update({ approvedBy: 'sa1' }));
      await assertFails(as('sa1').collection('social_media_posts').add({ tenantId: 't1', projectId: 'projA', status: 'approved', caption: 'x' }));
      await assertSucceeds(as('sa1').collection('social_media_posts').add({ tenantId: 't1', projectId: 'projA', status: 'draft', caption: 'x' }));
    });
    it('taslak içeriği ve onaylı içeriğin ızgara sırasını değiştirebilir (önceki genel yetki)', async () => {
      await assertSucceeds(as('sa1').doc('social_media_posts/draftA').update({ caption: 'yeni', scheduledAt: new Date() }));
      await assertSucceeds(as('sa1').doc('social_media_posts/approvedA').update({ gridPosition: 2 }));
    });
    it('plan: tur/durum/onay/atama alanları istemciden değişmez; başlık değişir; onaylı plan oluşturulamaz', async () => {
      await assertFails(as('sa1').doc('content_plans/planA').update({ reviewRequestId: 'round-X' }));
      await assertFails(as('sa1').doc('content_plans/planA').update({ status: 'draft' }));
      await assertFails(as('sa1').doc('content_plans/planA').update({ approvedBy: 'sa1' }));
      await assertSucceeds(as('sa1').doc('content_plans/planA').update({ title: 'Yeni başlık' }));
      await assertFails(as('sa1').collection('content_plans').add({ tenantId: 't1', projectId: 'projA', status: 'approved', title: 'x' }));
    });
  });

  describe('Storage brand-media/', () => {
    it('atanmış marka yöneticisi ve iç rol yükler; freelancer, müşteri, anonim, başka marka/tenant yükleyemez', async () => {
      await assertSucceeds(up('bm1', `brand-media/t1/projA/n-${RUN}/final.jpg`));
      await assertSucceeds(up('editor1', `brand-media/t1/projB/e-${RUN}/final.mp4`, 'video/mp4'));
      await assertFails(up('bm1', `brand-media/t1/projB/x-${RUN}/final.jpg`));
      await assertFails(up('fl1', `brand-media/t1/projA/f-${RUN}/final.jpg`));
      await assertFails(up('client1', `brand-media/t1/projA/c-${RUN}/final.jpg`));
      await assertFails(up(null, `brand-media/t1/projA/z-${RUN}/final.jpg`));
      await assertFails(up('admin2', `brand-media/t1/projA/t-${RUN}/final.jpg`));
    });
    it('var olmayan veya başka tenant\'ın projesine yüklenemez', async () => {
      await assertFails(up('bmGhost', `brand-media/t1/projGhost/g-${RUN}/final.jpg`));
      await assertFails(up('admin1', `brand-media/t1/projC/g-${RUN}/final.jpg`));
    });
    it('write-once: üzerine yazma ve silme reddedilir', async () => {
      await assertFails(up('admin1', 'brand-media/t1/projA/a1/final.jpg'));
      await assertFails(env.authenticatedContext('admin1').storage().ref('brand-media/t1/projA/a1/final.jpg').delete());
    });
    it('içerik türü: medya dışı red; önizleme yalnız image/jpeg', async () => {
      await assertFails(up('bm1', `brand-media/t1/projA/h-${RUN}/x.html`, 'text/html'));
      await assertFails(up('bm1', `brand-media/t1/projA/p-${RUN}/thumb.jpg`, 'image/png'));
      await assertSucceeds(up('bm1', `brand-media/t1/projA/p2-${RUN}/thumb.jpg`, 'image/jpeg'));
    });
    it('okuma: yetkili ekip okur; freelancer, müşteri, anonim okuyamaz', async () => {
      const obj = (r: string) => `brand-media/t1/projA/a1/read-${r}.jpg`;
      await assertSucceeds(env.authenticatedContext('bm1').storage().ref(obj('bm1')).getMetadata());
      await assertSucceeds(env.authenticatedContext('sa1').storage().ref(obj('sa1')).getMetadata());
      await assertFails(env.authenticatedContext('fl1').storage().ref(obj('fl1')).getMetadata());
      await assertFails(env.authenticatedContext('client1').storage().ref(obj('client1')).getMetadata());
      await assertFails(env.unauthenticatedContext().storage().ref(obj('anon')).getMetadata());
      await assertFails(env.authenticatedContext('bmB').storage().ref(obj('bmB')).getMetadata());
      await assertFails(env.authenticatedContext('sa2').storage().ref(obj('sa2')).getMetadata());
    });
  });
});
