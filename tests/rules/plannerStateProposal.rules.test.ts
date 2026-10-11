/**
 * ÖNERİLEN kalıcı Kalsın/Ele durumu kuralı (docs/proposals/planner-state.rules) — YEREL EMÜLATÖR (demo-*), canlı değil.
 * Öneri, mevcut firestore.rules ile BELLEKTE birleştirilir; firestore.rules dosyası değişmez ve öneri dağıtılmamıştır.
 * Çalıştırma: firebase emulators:exec --only firestore --project demo-planner-state "node ./node_modules/vitest/vitest.mjs run tests/rules/plannerStateProposal.rules.test.ts"
 */
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { validatePlannerStateShape, type PlannerStateDoc } from '@/studio/feedPlanner/integration/plannerState';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const COL = 'content_plan_planner_state';
let env: RulesTestEnvironment;

const composeRules = () => {
  const live = readFileSync('firestore.rules', 'utf8');
  const proposal = readFileSync('docs/proposals/planner-state.rules', 'utf8');
  const idx = live.lastIndexOf('\n  }\n}');
  if (idx < 0) throw new Error('firestore.rules sonu beklenen biçimde değil');
  return live.slice(0, idx + 1) + proposal + live.slice(idx + 1);
};

const HASH = 'a'.repeat(32);
const lock = (slot: number) => ({ lane: 'feed', slot, mediaId: `m${slot}`, suggestionHash: HASH });
const doc = (uid: string, o: Record<string, any> = {}) => ({
  tenantId: 't1', projectId: 'p1', planId: 'plan1', version: 1, locks: [lock(0)], dismissed: [{ lane: 'feed', mediaId: 'x1' }], updatedBy: uid, updatedAt: 1_000, ...o,
});
const ID = 't1_p1_plan1';
const ref = (uid: string | null) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore().doc(`${COL}/${ID}`);

describe.skipIf(!HAS_EMULATOR)('önerilen planner state kuralı (dağıtılmadı)', () => {
  beforeAll(async () => {
    const [h, p] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    env = await initializeTestEnvironment({ projectId: 'demo-planner-state', firestore: { rules: composeRules(), host: h, port: Number(p) } });
  });
  afterAll(async () => { await env?.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc('users/admin1').set({ tenantId: 't1', role: 'admin', profile: {} });
      await db.doc('users/editor1').set({ tenantId: 't1', role: 'editor', profile: {} });
      await db.doc('users/admin2').set({ tenantId: 't2', role: 'admin', profile: {} });
      await db.doc('users/bm1').set({ tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['p1'] } });
      await db.doc('users/bm2').set({ tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['p2'] } });
      await db.doc('users/fl1').set({ tenantId: 't1', role: 'freelancer', profile: { assignedProjectIds: ['p1'] } });
      await db.doc('users/client1').set({ tenantId: 't1', role: 'client', profile: {} });
      await db.doc('projects/p1').set({ tenantId: 't1' });
      await db.doc('projects/p2').set({ tenantId: 't1' });
      await db.doc('content_plans/plan1').set({ tenantId: 't1', projectId: 'p1', status: 'draft' });
      await db.doc('content_plans/plan2').set({ tenantId: 't1', projectId: 'p2', status: 'draft' });
    });
  });
  const seed = async (o: Record<string, any> = {}) => env.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`${COL}/${ID}`).set(doc('admin1', o)); });

  it('OLUŞTURMA: tenant geneli roller ve atanmış marka yöneticisi/freelancer; başka tenant, atanmamış proje, müşteri ve anonim yapamaz', async () => {
    for (const uid of ['admin1', 'editor1', 'bm1', 'fl1']) {
      await env.clearFirestore(); // her rol için temiz başla
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        for (const [u, d] of Object.entries({ admin1: { tenantId: 't1', role: 'admin', profile: {} }, editor1: { tenantId: 't1', role: 'editor', profile: {} }, bm1: { tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['p1'] } }, fl1: { tenantId: 't1', role: 'freelancer', profile: { assignedProjectIds: ['p1'] } } })) await db.doc(`users/${u}`).set(d);
        await db.doc('projects/p1').set({ tenantId: 't1' });
        await db.doc('content_plans/plan1').set({ tenantId: 't1', projectId: 'p1', status: 'draft' });
      });
      await assertSucceeds(ref(uid).set(doc(uid)));
    }
    for (const uid of ['admin2', 'bm2', 'client1', null]) await assertFails(ref(uid).set(doc(uid ?? 'x')));
  });

  it('OLUŞTURMA ŞEKİL: updatedBy oturumla aynı, ilk sürüm 1, bilinmeyen alan yok, belge kimliği tenant_proje_plan, plan aynı tenant/projeye ait, boyut sınırları', async () => {
    await assertFails(ref('admin1').set(doc('bm1'))); // başkası adına
    await assertFails(ref('admin1').set(doc('admin1', { version: 2 })));
    await assertFails(ref('admin1').set(doc('admin1', { extra: true })));
    await assertFails(ref('admin1').set(doc('admin1', { planId: 'plan2' }))); // plan2 projesi p2; doc p1 + kimlik uyuşmaz
    await assertFails(env.authenticatedContext('admin1').firestore().doc(`${COL}/t1_p1_plan2`).set(doc('admin1', { planId: 'plan2' }))); // plan başka projeye ait
    await assertFails(env.authenticatedContext('admin1').firestore().doc(`${COL}/t1_p1_yok`).set(doc('admin1', { planId: 'yok' }))); // plan yok
    await assertFails(ref('admin1').set(doc('admin1', { locks: Array.from({ length: 19 }, (_, i) => lock(i)) })));
    await assertSucceeds(ref('admin1').set(doc('admin1', { locks: Array.from({ length: 18 }, (_, i) => lock(i % 9)) })));
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('users/admin1').set({ tenantId: 't1', role: 'admin', profile: {} }); await ctx.firestore().doc('content_plans/plan1').set({ tenantId: 't1', projectId: 'p1' }); });
    await assertFails(ref('admin1').set(doc('admin1', { dismissed: Array.from({ length: 201 }, (_, i) => ({ lane: 'feed', mediaId: `x${i}` })) })));
    await assertFails(ref('admin1').set(doc('admin1', { locks: 'kilit' })));
    await assertFails(env.authenticatedContext('admin1').firestore().doc(`${COL}/baska_kimlik`).set(doc('admin1')));
  });

  it('OKUMA: aynı tenant/proje erişimi; başka tenant, atanmamış proje, müşteri ve anonim okuyamaz', async () => {
    await seed();
    for (const uid of ['admin1', 'editor1', 'bm1', 'fl1']) await assertSucceeds(ref(uid).get());
    for (const uid of ['admin2', 'bm2', 'client1', null]) await assertFails(ref(uid).get());
  });

  it('GÜNCELLEME: yalnız sürüm + 1; eski/tekrarlı sürüm ve atlama reddedilir; kimlik alanları değişmez', async () => {
    await seed();
    await assertFails(ref('admin1').update({ updatedBy: 'admin1', version: 1 })); // tekrarlı (eski) yazım
    await assertFails(ref('admin1').update({ version: 3 })); // atlama
    await assertSucceeds(ref('admin1').update({ version: 2, locks: [] }));
    await assertFails(ref('admin1').update({ version: 2 })); // aynı sürüm tekrar (artık eski)
    await assertSucceeds(ref('bm1').update({ version: 3, updatedBy: 'bm1' }));
    await assertFails(ref('admin1').update({ version: 4, planId: 'plan2' }));
    await assertFails(ref('admin1').update({ version: 4, projectId: 'p2' }));
    await assertFails(ref('admin1').update({ version: 4, tenantId: 't2' }));
    await assertFails(ref('admin1').update({ version: 4, updatedBy: 'bm1' }));
    for (const uid of ['admin2', 'bm2', 'client1', null]) await assertFails(ref(uid).update({ version: 4, updatedBy: uid ?? 'x' }));
  });

  it('SİLME: yalnız tenant geneli roller; marka yöneticisi, müşteri ve anonim silemez', async () => {
    await seed();
    for (const uid of ['bm1', 'fl1', 'client1', 'admin2', null]) await assertFails(ref(uid).delete());
    await assertSucceeds(ref('admin1').delete());
  });

  it('SINIR (kanıt): kurallar liste ELEMANLARINI doğrulamaz — null, eksik, yanlış tipli ve çöp elemanlar kuraldan GEÇER; sözleşme doğrulayıcısı hepsini fırlatmadan reddeder', async () => {
    const garbage: Array<[string, Record<string, any>]> = [
      ['locks:[null]', { locks: [null] }],
      ['dismissed:[null]', { dismissed: [null] }],
      ['locks:[{}] eksik alanlar', { locks: [{}] }],
      ['locks:[42,"x",true] yanlış tipler', { locks: [42, 'x', true] }],
      ['dismissed çöp', { dismissed: ['x', 7, { foo: 'bar' }] }],
      ['kilit slot/lane geçersiz', { locks: [{ lane: 'x', slot: 99, mediaId: 5, suggestionHash: 'k' }] }],
    ];
    for (const [name, o] of garbage) {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('users/admin1').set({ tenantId: 't1', role: 'admin', profile: {} }); await ctx.firestore().doc('content_plans/plan1').set({ tenantId: 't1', projectId: 'p1' }); });
      const d = doc('admin1', o);
      await assertSucceeds(ref('admin1').set(d)); // KURAL KABUL EDER: eleman denetimi yok
      let errors: string[] = [];
      expect(() => { errors = validatePlannerStateShape(d); }, name).not.toThrow();
      expect(errors.length, name).toBeGreaterThan(0); // sözleşme reddeder
    }
    // güncellemede de aynı sınır
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('users/admin1').set({ tenantId: 't1', role: 'admin', profile: {} }); await ctx.firestore().doc('content_plans/plan1').set({ tenantId: 't1', projectId: 'p1' }); await ctx.firestore().doc(`${COL}/${ID}`).set(doc('admin1')); });
    await assertSucceeds(ref('admin1').update({ version: 2, locks: [null], dismissed: [null] }));
    // Doğrulanabilir tek şey boyut ve şekil: kural bunu yine reddeder
    await assertFails(ref('admin1').update({ version: 3, locks: Array.from({ length: 19 }, () => null) }));
  });

  it('SONUÇ: bu kural üretime hazır veya tam güvenli kalıcılık DEĞİLDİR (dosya ve kod bunu açıkça yazar)', () => {
    const proposal = readFileSync('docs/proposals/planner-state.rules', 'utf8');
    expect(proposal).toMatch(/ÜRETİME HAZIR DEĞİL/);
    expect(proposal).toMatch(/liste ELEMANLARINI doğrulayamaz/);
    expect(readFileSync('firestore.rules', 'utf8')).not.toMatch(/content_plan_planner_state/); // canlı kurallara EKLENMEDİ
  });
});
