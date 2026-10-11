/**
 * Marka medya kütüphanesi hotfix — İZOLE dağıtım dosyalarına karşı (deploy/firebase-brand-media-hotfix/).
 * Taban: canlıdaki kurallar (987ed92) + yalnız kütüphane yükleme/listeleme blokları.
 * Emülatör: demo-* proje; gerçek Firebase'e bağlanmaz.
 */
import { readFileSync } from 'fs';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const DIR = 'deploy/firebase-brand-media-hotfix';
let env: RulesTestEnvironment;

const T = 'intiba';
const P = 'Pfm2X1qSZG5oIfdN0XtR'; // Dieci (kimlik biçimi canlıdakiyle aynı)
const OTHER_P = 'OtherBrandProject01';
const USERS: Record<string, Record<string, unknown>> = {
  admin1: { tenantId: T, role: 'admin', profile: {} },
  bmDieci: { tenantId: T, role: 'brand_manager', profile: { assignedProjectIds: [P] } },
  bmOther: { tenantId: T, role: 'brand_manager', profile: { assignedProjectIds: [OTHER_P] } },
  client1: { tenantId: T, role: 'client', profile: { assignedProjectIds: [P] } },
  fl1: { tenantId: T, role: 'freelancer', profile: { assignedProjectIds: [P] } },
  adminT2: { tenantId: 't2', role: 'admin', profile: {} },
};

const PNG = new Uint8Array(1_200_000); // ~1,2 MB, içerik önemsiz (yalnız boyut/tür kuralı)
PNG.set([137, 80, 78, 71, 13, 10, 26, 10]);
const RUN = Math.random().toString(36).slice(2, 8);
const ts = () => firebase.firestore.FieldValue.serverTimestamp();
const dl = (p: string) => `https://firebasestorage.googleapis.com/v0/b/intiba-ab4bd.firebasestorage.app/o/${encodeURIComponent(p)}?alt=media&token=tok`;
const put = (uid: string | null, path: string, data: Uint8Array = PNG, contentType = 'image/png') =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).storage().ref(path).put(data, { contentType });
const fs = (uid: string | null) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const record = (uid: string, assetId: string, projectId = P, tenantId = T) => {
  const path = `brand-media/${tenantId}/${projectId}/${assetId}/2.png`;
  return {
    tenantId, projectId, kind: 'photo', title: '2', fileName: '2.png', tags: [], status: 'active',
    storage: { path, downloadUrl: dl(path), contentType: 'image/png', size: 1_200_000 },
    createdBy: uid, createdAt: ts(), updatedAt: ts(),
  };
};

describe.skipIf(!HAS_EMULATOR)('hotfix: medya kütüphanesi yükleme + listeleme (izole dosyalar)', () => {
  beforeAll(async () => {
    const [fHost, fPort] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    const [sHost, sPort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST!.split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-brand-media-hotfix',
      firestore: { rules: readFileSync(`${DIR}/firestore.rules`, 'utf8'), host: fHost, port: Number(fPort) },
      storage: { rules: readFileSync(`${DIR}/storage.rules`, 'utf8'), host: sHost, port: Number(sPort) },
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
      await db.doc(`projects/${P}`).set({ tenantId: T, name: 'Dieci' });
      await db.doc(`projects/${OTHER_P}`).set({ tenantId: T, name: 'Diğer' });
      await db.doc('projects/projT2').set({ tenantId: 't2', name: 'Başka ajans' });
      await db.doc('brand_media/existing').set({ ...record('admin1', 'existing'), createdAt: new Date(), updatedAt: new Date() });
      // Okuma kontrolleri için ayrı nesneler (emülatör okuma kararını nesne başına önbelleğe alabiliyor)
      for (const r of ['admin1', 'bmDieci', 'bmOther', 'client1', 'anon', 'adminT2', 'fl1']) {
        await ctx.storage().ref(`brand-media/${T}/${P}/existing/read-${r}.png`).put(PNG.slice(0, 8), { contentType: 'image/png' });
      }
    });
  });

  it('admin kendi tenant\'ının markasına 1,2 MB 2.png yükler, URL alır, kayıt oluşturur ve listeler', async () => {
    const assetId = `a${RUN}`;
    const path = `brand-media/${T}/${P}/${assetId}/2.png`;
    await assertSucceeds(put('admin1', path));
    // Uygulamanın yükleme sonrası adımı: getDownloadURL (okuma izni + nesnenin indirme token'ı)
    const url: string = await assertSucceeds(env.authenticatedContext('admin1').storage().ref(path).getDownloadURL());
    expect(url).toContain(encodeURIComponent(path));
    expect(url).toMatch(/[?&]token=/);
    await assertSucceeds(env.authenticatedContext('admin1').storage().ref(`brand-media/${T}/${P}/existing/read-admin1.png`).getMetadata());
    await assertSucceeds(fs('admin1').doc(`brand_media/${assetId}`).set(record('admin1', assetId)));
    await assertSucceeds(
      fs('admin1').collection('brand_media').where('tenantId', '==', T).where('projectId', '==', P).where('status', '==', 'active').orderBy('createdAt', 'desc').limit(200).get()
    );
  });

  it('atanmış marka yöneticisi kendi markasına yükler ve listeler', async () => {
    await assertSucceeds(put('bmDieci', `brand-media/${T}/${P}/b${RUN}/2.png`));
    await assertSucceeds(fs('bmDieci').doc(`brand_media/b${RUN}`).set(record('bmDieci', `b${RUN}`)));
    await assertSucceeds(fs('bmDieci').collection('brand_media').where('tenantId', '==', T).where('projectId', '==', P).where('status', '==', 'active').get());
  });

  it('başka tenant admini, atanmamış marka yöneticisi, müşteri, freelancer ve anonim yükleyemez', async () => {
    await assertFails(put('adminT2', `brand-media/${T}/${P}/x1${RUN}/2.png`));
    await assertFails(put('bmOther', `brand-media/${T}/${P}/x2${RUN}/2.png`));
    await assertFails(put('client1', `brand-media/${T}/${P}/x3${RUN}/2.png`));
    await assertFails(put('fl1', `brand-media/${T}/${P}/x4${RUN}/2.png`));
    await assertFails(put(null, `brand-media/${T}/${P}/x5${RUN}/2.png`));
  });

  it('aynı kişiler katalog kaydı oluşturamaz, okuyamaz, listeleyemez', async () => {
    for (const uid of ['adminT2', 'bmOther', 'client1', 'fl1']) {
      await assertFails(fs(uid).doc(`brand_media/c-${uid}`).set(record(uid, `c-${uid}`)));
      await assertFails(fs(uid).doc('brand_media/existing').get());
      await assertFails(fs(uid).collection('brand_media').where('tenantId', '==', T).where('projectId', '==', P).where('status', '==', 'active').get());
    }
    await assertFails(fs(null).doc('brand_media/existing').get());
  });

  it('indirme URL\'si: atanmamış marka yöneticisi ve başka tenant alamaz', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage().ref(`brand-media/${T}/${P}/existing/url-bmOther.png`).put(PNG.slice(0, 8), { contentType: 'image/png' });
      await ctx.storage().ref(`brand-media/${T}/${P}/existing/url-adminT2.png`).put(PNG.slice(0, 8), { contentType: 'image/png' });
    });
    await assertFails(env.authenticatedContext('bmOther').storage().ref(`brand-media/${T}/${P}/existing/url-bmOther.png`).getDownloadURL());
    await assertFails(env.authenticatedContext('adminT2').storage().ref(`brand-media/${T}/${P}/existing/url-adminT2.png`).getDownloadURL());
  });

  it('dosya okuma: yetkisiz kişiler indirme bilgisine erişemez', async () => {
    const obj = (r: string) => `brand-media/${T}/${P}/existing/read-${r}.png`;
    await assertSucceeds(env.authenticatedContext('bmDieci').storage().ref(obj('bmDieci')).getMetadata());
    for (const r of ['bmOther', 'client1', 'adminT2', 'fl1']) {
      await assertFails(env.authenticatedContext(r).storage().ref(obj(r)).getMetadata());
    }
    await assertFails(env.unauthenticatedContext().storage().ref(obj('anon')).getMetadata());
  });

  it('admin başka tenant\'ın projesine veya var olmayan projeye yükleyemez; üzerine yazma/silme yok', async () => {
    await assertFails(put('admin1', `brand-media/${T}/projT2/y${RUN}/2.png`));
    await assertFails(put('admin1', `brand-media/${T}/YokProje/y${RUN}/2.png`));
    await assertFails(put('admin1', `brand-media/${T}/${P}/existing/read-admin1.png`));
    await assertFails(env.authenticatedContext('admin1').storage().ref(`brand-media/${T}/${P}/existing/read-admin1.png`).delete());
    await assertFails(fs('admin1').doc('brand_media/existing').delete());
  });

  it('medya dışı tür reddedilir; panel sınırı kaydı 1_000_000_000 bayt', async () => {
    await assertFails(put('admin1', `brand-media/${T}/${P}/h${RUN}/x.html`, PNG.slice(0, 8), 'text/html'));
    const ok = record('admin1', `s1${RUN}`);
    await assertSucceeds(fs('admin1').doc(`brand_media/s1${RUN}`).set({ ...ok, storage: { ...ok.storage, size: 1_000_000_000 } }));
    const big = record('admin1', `s2${RUN}`);
    await assertFails(fs('admin1').doc(`brand_media/s2${RUN}`).set({ ...big, storage: { ...big.storage, size: 1_000_000_001 } }));
  });
});
