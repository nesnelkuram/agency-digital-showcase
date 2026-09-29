/**
 * Firestore güvenlik kuralları — emülatör testleri.
 * Çalıştırma: npm run test:rules  (firebase emulators:exec ile; emülatör yoksa atlanır)
 */
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;

let env: RulesTestEnvironment;

const USERS: Record<string, Record<string, unknown>> = {
  admin1: { tenantId: 't1', role: 'admin', email: 'admin1@x.com', displayName: 'A1', status: 'active', profile: {} },
  editor1: { tenantId: 't1', role: 'editor', email: 'editor1@x.com', displayName: 'E1', status: 'active', profile: { phone: '1' }, metadata: { createdAt: 1 } },
  client1: { tenantId: 't1', role: 'client', email: 'client1@x.com', displayName: 'C1', status: 'active', profile: { assignedProjectIds: ['projA'] } },
  bm1: { tenantId: 't1', role: 'brand_manager', email: 'bm1@x.com', displayName: 'Şeyma', status: 'active', profile: { assignedProjectIds: ['projA'] } },
  fl1: { tenantId: 't1', role: 'freelancer', email: 'fl1@x.com', displayName: 'F1', status: 'active', profile: { assignedProjectIds: ['projA'] } },
  admin2: { tenantId: 't2', role: 'admin', email: 'admin2@x.com', displayName: 'A2', status: 'active', profile: {} },
};

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, data] of Object.entries(USERS)) await db.doc(`users/${uid}`).set(data);
    await db.doc('projects/projA').set({ tenantId: 't1', name: 'Rakle' });
    await db.doc('projects/projB').set({ tenantId: 't1', name: 'Diğer' });
    await db.doc('projects/projC').set({ tenantId: 't2', name: 'Başka ajans' });
    await db.doc('content_plans/planA').set({ tenantId: 't1', projectId: 'projA', status: 'draft', title: 'A', shareToken: 'tokA', postIds: [] });
    await db.doc('content_plans/planB').set({ tenantId: 't1', projectId: 'projB', status: 'pending_approval', title: 'B', shareToken: 'tokB', postIds: [] });
    await db.doc('content_plans/planC').set({ tenantId: 't2', projectId: 'projC', status: 'pending_approval', title: 'C', shareToken: 'tokC', postIds: [] });
    await db.doc('content_plans/planA/approval_events/e1').set({ action: 'x' });
    await db.doc('social_media_posts/postA').set({ tenantId: 't1', projectId: 'projA', contentPlanId: 'planA', status: 'draft', caption: 'a' });
    await db.doc('social_media_posts/postA2').set({ tenantId: 't1', projectId: 'projA', contentPlanId: 'planA', status: 'pending_approval', caption: 'b' });
    await db.doc('social_media_posts/postB').set({ tenantId: 't1', projectId: 'projB', status: 'draft', caption: 'c' });
    await db.doc('brand_leads/lead1').set({ tenantId: 't1', name: 'Lead' });
    await db.doc('tasks/task1').set({ tenantId: 't1', title: 'Görev' });
    await db.doc('invoices/inv1').set({ tenantId: 't1', amount: 1 });
    await db.doc('invitations/invite1').set({ tenantId: 't1', email: 'new@x.com', role: 'editor', status: 'pending' });
    await db.doc('operational_briefs/brief2').set({ tenantId: 't2', title: 'x' });
  });
}

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe.skipIf(!HAS_EMULATOR)('firestore.rules', () => {
  beforeAll(async () => {
    const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-rules-test',
      firestore: { rules: readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8'), host, port: Number(port) },
    });
  });
  afterAll(async () => {
    await env?.cleanup();
  });
  beforeEach(async () => {
    await env.clearFirestore();
    await seed();
  });

  // ── Kullanıcı kaydı: rol/tenant/atama değiştirilemez ──
  describe('users', () => {
    it('kullanıcı kendi rolünü değiştiremez', async () => {
      await assertFails(as('editor1').doc('users/editor1').update({ role: 'super_admin' }));
      await assertFails(as('client1').doc('users/client1').update({ role: 'admin' }));
    });
    it('kullanıcı tenant veya izinlerini değiştiremez', async () => {
      await assertFails(as('editor1').doc('users/editor1').update({ tenantId: 't2' }));
      await assertFails(as('editor1').doc('users/editor1').update({ permissions: ['*'] }));
      await assertFails(as('editor1').doc('users/editor1').update({ status: 'active' , role: 'admin'}));
    });
    it('kullanıcı proje atamasını değiştiremez (iç map kontrolü)', async () => {
      await assertFails(as('client1').doc('users/client1').update({ 'profile.assignedProjectIds': ['projA', 'projB'] }));
      await assertFails(as('bm1').doc('users/bm1').update({ profile: { assignedProjectIds: ['projB'] } }));
    });
    it('kullanıcı zararsız alanları güncelleyebilir', async () => {
      await assertSucceeds(
        as('editor1').doc('users/editor1').update({
          displayName: 'Yeni',
          'profile.phone': '555',
          'profile.title': 'Tasarımcı',
          'metadata.lastLoginAt': new Date(),
          'settings.notifications.email': false,
        })
      );
    });
    it('metadata içinde başka alan değiştirilemez', async () => {
      await assertFails(as('editor1').doc('users/editor1').update({ 'metadata.invitedBy': 'x' }));
    });
    it('kimse kendi kullanıcı kaydını oluşturamaz (davet kabulü sunucuda)', async () => {
      await assertFails(as('newbie').doc('users/newbie').set({ tenantId: 't1', role: 'admin' }));
    });
    it('yönetici kendi tenant\'ındaki kullanıcının rolünü değiştirebilir, super_admin yapamaz', async () => {
      await assertSucceeds(as('admin1').doc('users/editor1').update({ role: 'account_manager' }));
      await assertFails(as('admin1').doc('users/editor1').update({ role: 'super_admin' }));
      await assertFails(as('admin1').doc('users/editor1').update({ tenantId: 't2' }));
    });
    it('yönetici başka tenant\'ın kullanıcısını değiştiremez', async () => {
      await assertFails(as('admin2').doc('users/editor1').update({ role: 'client' }));
    });
    it('müşteri ve marka yöneticisi diğer kullanıcıları okuyamaz', async () => {
      await assertFails(as('client1').doc('users/admin1').get());
      await assertFails(as('bm1').doc('users/admin1').get());
      await assertSucceeds(as('bm1').doc('users/bm1').get());
    });
  });

  // ── Davetler ──
  describe('invitations', () => {
    it('yönetici olmayan davet oluşturamaz', async () => {
      await assertFails(as('editor1').collection('invitations').add({ tenantId: 't1', email: 'a@x.com', role: 'admin', status: 'pending' }));
    });
    it('yönetici pending davet oluşturabilir, super_admin daveti oluşturamaz', async () => {
      await assertSucceeds(as('admin1').collection('invitations').add({ tenantId: 't1', email: 'a@x.com', role: 'brand_manager', status: 'pending' }));
      await assertFails(as('admin1').collection('invitations').add({ tenantId: 't1', email: 'b@x.com', role: 'super_admin', status: 'pending' }));
      await assertFails(as('admin1').collection('invitations').add({ tenantId: 't2', email: 'c@x.com', role: 'editor', status: 'pending' }));
    });
    it('davet istemciden kabul edilemez / rolü değiştirilemez', async () => {
      await assertFails(as('newbie').doc('invitations/invite1').update({ status: 'accepted', acceptedByUid: 'newbie' }));
      await assertFails(as('admin1').doc('invitations/invite1').update({ role: 'admin' }));
      await assertFails(as('admin1').doc('invitations/invite1').update({ status: 'accepted' }));
      await assertSucceeds(as('admin1').doc('invitations/invite1').update({ status: 'cancelled' }));
    });
    it('davet listesi yalnızca aynı tenant yöneticisine açık', async () => {
      await assertFails(as('editor1').collection('invitations').where('tenantId', '==', 't1').get());
      await assertFails(as('admin2').collection('invitations').where('tenantId', '==', 't1').get());
      await assertSucceeds(as('admin1').collection('invitations').where('tenantId', '==', 't1').get());
    });
    it('davet linki tekil okunabilir', async () => {
      await assertSucceeds(anon().doc('invitations/invite1').get());
    });
  });

  // ── Müşteri: doğrudan okuma yok (portal API) ──
  describe('client rolü', () => {
    it('tenant verilerini okuyamaz', async () => {
      for (const path of ['projects/projA', 'content_plans/planA', 'social_media_posts/postA2', 'brand_leads/lead1', 'tasks/task1', 'invoices/inv1']) {
        await assertFails(as('client1').doc(path).get());
      }
    });
    it('başka tenant\'ın plan ve brief\'ini okuyamaz', async () => {
      await assertFails(as('client1').doc('content_plans/planC').get());
      await assertFails(as('client1').doc('operational_briefs/brief2').get());
    });
    it('plan durumunu değiştiremez', async () => {
      await assertFails(as('client1').doc('content_plans/planB').update({ status: 'approved' }));
      await assertFails(as('client1').doc('social_media_posts/postA2').update({ status: 'approved' }));
    });
  });

  // ── Paylaşım linki: doğrudan okuma yok (share API) ──
  describe('anonim', () => {
    it('token taşıyan planı bile doğrudan okuyamaz', async () => {
      await assertFails(anon().doc('content_plans/planB').get());
      await assertFails(anon().doc('social_media_posts/postA2').get());
    });
  });

  // ── Marka yöneticisi: yalnızca atanmış proje ──
  describe('brand_manager rolü', () => {
    it('atanmış projeyi, planı ve post\'u okur', async () => {
      await assertSucceeds(as('bm1').doc('projects/projA').get());
      await assertSucceeds(as('bm1').doc('content_plans/planA').get());
      await assertSucceeds(as('bm1').doc('social_media_posts/postA').get());
      await assertSucceeds(as('bm1').doc('content_plans/planA/approval_events/e1').get());
    });
    it('atanmamış projeye erişemez', async () => {
      await assertFails(as('bm1').doc('projects/projB').get());
      await assertFails(as('bm1').doc('content_plans/planB').get());
      await assertFails(as('bm1').doc('social_media_posts/postB').get());
    });
    it('proje kapsamlı sorgu çalışır, kapsamsız sorgu reddedilir', async () => {
      await assertSucceeds(
        as('bm1').collection('social_media_posts').where('tenantId', '==', 't1').where('projectId', '==', 'projA').get()
      );
      await assertFails(as('bm1').collection('social_media_posts').where('tenantId', '==', 't1').get());
    });
    it('tenant genelindeki diğer verileri okuyamaz', async () => {
      await assertFails(as('bm1').doc('brand_leads/lead1').get());
      await assertFails(as('bm1').doc('tasks/task1').get());
      await assertFails(as('bm1').doc('invoices/inv1').get());
    });
    it('atanmış projede taslak post oluşturur; onaylı post oluşturamaz', async () => {
      await assertSucceeds(as('bm1').collection('social_media_posts').add({ tenantId: 't1', projectId: 'projA', status: 'draft', caption: 'x' }));
      await assertFails(as('bm1').collection('social_media_posts').add({ tenantId: 't1', projectId: 'projA', status: 'approved', caption: 'x' }));
      await assertFails(as('bm1').collection('social_media_posts').add({ tenantId: 't1', projectId: 'projB', status: 'draft', caption: 'x' }));
    });
    it('müşteriye gönderilmiş içeriği düzenleyemez, takvim yerini değiştirebilir', async () => {
      await assertSucceeds(as('bm1').doc('social_media_posts/postA').update({ caption: 'yeni' }));
      await assertFails(as('bm1').doc('social_media_posts/postA2').update({ caption: 'gizlice' }));
      await assertSucceeds(as('bm1').doc('social_media_posts/postA2').update({ scheduledAt: new Date() }));
    });
  });

  // ── Freelancer: proje verisinde yalnızca atanmış proje (Codex ara inceleme 5) ──
  describe('freelancer rolü', () => {
    it('atanmış projeyi okur, diğer projeyi okuyamaz/düzenleyemez', async () => {
      await assertSucceeds(as('fl1').doc('social_media_posts/postA').get());
      await assertFails(as('fl1').doc('projects/projB').get());
      await assertFails(as('fl1').doc('social_media_posts/postB').get());
      await assertFails(as('fl1').doc('social_media_posts/postB').update({ caption: 'x' }));
      await assertFails(as('fl1').doc('content_plans/planB').get());
    });
  });

  // ── Post–plan bağı (Codex ara inceleme 5) ──
  describe('post–plan bağı', () => {
    it('post başka projenin planına bağlanamaz', async () => {
      await assertFails(as('bm1').doc('social_media_posts/postA').update({ contentPlanId: 'planB' }));
      await assertFails(as('admin1').doc('social_media_posts/postA').update({ contentPlanId: 'planC' }));
      await assertFails(as('bm1').collection('social_media_posts').add({ tenantId: 't1', projectId: 'projA', status: 'draft', contentPlanId: 'planB' }));
      await assertFails(as('bm1').collection('social_media_posts').add({ tenantId: 't1', projectId: 'projA', status: 'draft', contentPlanId: 'yok' }));
    });
    it('aynı projenin planına bağlanabilir', async () => {
      await assertSucceeds(as('bm1').collection('social_media_posts').add({ tenantId: 't1', projectId: 'projA', status: 'draft', contentPlanId: 'planA' }));
      await assertSucceeds(as('admin1').doc('social_media_posts/postB').update({ contentPlanId: 'planB' }));
    });
  });

  // ── Studio akışı (marka yöneticisinin gerçek sorgu/yazma biçimleri) ──
  describe('Studio akışı', () => {
    it('plan ve post sorguları (tenant + proje filtresi) çalışır', async () => {
      const db = as('bm1');
      await assertSucceeds(db.collection('content_plans').where('tenantId', '==', 't1').where('projectId', '==', 'projA').get());
      await assertSucceeds(db.collection('social_media_posts').where('tenantId', '==', 't1').where('projectId', '==', 'projA').get());
      await assertSucceeds(db.collection('content_plans/planA/approval_events').get());
      await assertFails(db.collection('content_plans').where('tenantId', '==', 't1').where('projectId', '==', 'projB').get());
      // Plan üyeleri (getPlanPosts)
      await assertSucceeds(
        db.collection('social_media_posts').where('tenantId', '==', 't1').where('projectId', '==', 'projA').where('contentPlanId', '==', 'planA').get()
      );
    });
    it('düzenlenebilir post\'ta medya ve etiketler güncellenir (post detayı)', async () => {
      await assertSucceeds(
        as('bm1').doc('social_media_posts/postA').update({ caption: 'x', hashtags: ['#a'], media: [], mediaUrls: [], updatedAt: new Date() })
      );
      await assertFails(as('bm1').doc('social_media_posts/postA2').update({ media: [], mediaUrls: [] }));
    });
    it('haftalık plan oluşturma: önce plan, sonra post bağı (createContentPlan sırası)', async () => {
      const db = as('bm1');
      const ref = await assertSucceeds(
        db.collection('content_plans').add({
          tenantId: 't1', projectId: 'projA', status: 'draft', title: 'Hafta', postIds: ['postA'],
          shareToken: 'abc123def456', clientComments: [], approvalConfig: { requireInternalReview: false, autoScheduleOnApproval: true, allowPartialApproval: true },
        })
      );
      const batch = db.batch();
      batch.update(db.doc('social_media_posts/postA'), { contentPlanId: (ref as any).id, updatedAt: new Date() });
      await assertSucceeds(batch.commit());
    });
    it('kendi bildirimlerini okur', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('notifications/n1').set({ tenantId: 't1', userId: 'bm1', title: 'x', read: false });
        await ctx.firestore().doc('notifications/n2').set({ tenantId: 't1', userId: 'admin1', title: 'y', read: false });
      });
      await assertSucceeds(as('bm1').collection('notifications').where('tenantId', '==', 't1').where('userId', '==', 'bm1').get());
      await assertFails(as('bm1').doc('notifications/n2').get());
    });
  });

  // ── Durum ve kimlik alanları: yalnızca sunucu ──
  describe('onay alanları', () => {
    it('iç ekip post durumunu ve onay alanlarını değiştiremez', async () => {
      await assertFails(as('admin1').doc('social_media_posts/postA').update({ status: 'approved' }));
      await assertFails(as('editor1').doc('social_media_posts/postA').update({ approvedBy: 'x' }));
    });
    it('post başka projeye/tenant\'a taşınamaz', async () => {
      await assertFails(as('admin1').doc('social_media_posts/postA').update({ projectId: 'projB' }));
      await assertFails(as('admin1').doc('social_media_posts/postA').update({ tenantId: 't2' }));
    });
    it('plan başlığı değişir; durum/tur/ayar/atama değişmez', async () => {
      await assertSucceeds(as('admin1').doc('content_plans/planA').update({ title: 'Yeni' }));
      for (const patch of [
        { status: 'approved' },
        { reviewRequestId: 'x' },
        { approvalConfig: { requireInternalReview: false } },
        { assignedClientId: 'client1' },
        { shareToken: 'yeni' },
      ]) {
        await assertFails(as('admin1').doc('content_plans/planA').update(patch));
      }
    });
    it('yeni plan yalnızca taslak ve turu olmadan oluşturulur', async () => {
      await assertSucceeds(as('admin1').collection('content_plans').add({ tenantId: 't1', projectId: 'projA', status: 'draft', title: 'x' }));
      await assertFails(as('admin1').collection('content_plans').add({ tenantId: 't1', projectId: 'projA', status: 'approved', title: 'x' }));
      await assertFails(as('admin1').collection('content_plans').add({ tenantId: 't1', projectId: 'projA', status: 'draft', reviewRequestId: 'r' }));
    });
    it('onay geçmişine istemci yazamaz', async () => {
      await assertFails(as('admin1').collection('content_plans/planA/approval_events').add({ action: 'client_approve' }));
    });
    it('iç ekip kendi tenant verisine erişmeye devam eder', async () => {
      await assertSucceeds(as('editor1').doc('content_plans/planB').get());
      await assertSucceeds(as('editor1').doc('brand_leads/lead1').get());
      await assertFails(as('admin2').doc('content_plans/planB').get());
    });
  });
});
