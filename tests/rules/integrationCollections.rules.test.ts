/**
 * Canva/AI entegrasyon koleksiyonları yalnız sunucuya ait: istemciden (super_admin dahil) okuma/yazma yok.
 * firestore.rules bu koleksiyonları tanımlamaz → varsayılan red. Emülatör (demo-*), gerçek Firebase yok.
 */
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
let env: RulesTestEnvironment;

const COLLECTIONS = [
  'integration_secrets',
  'canva_oauth_states',
  'canva_folder_mappings',
  'canva_sync_jobs',
  'canva_content_index',
  'canva_reconcile_cursors',
  'media_ai_queue',
  'media_ai_queue_cursor',
  'media_catalog_corrections',
  'content_feedback',
  'plan_suggestions',
  'media_ai_analyses',
  'media_ai_analysis_latest',
];

describe.skipIf(!HAS_EMULATOR)('entegrasyon koleksiyonları istemciye kapalı', () => {
  beforeAll(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-integration-collections',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    });
  });
  afterAll(async () => {
    await env?.cleanup();
  });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc('users/sa1').set({ tenantId: 't1', role: 'super_admin', profile: {} });
      await db.doc('users/admin1').set({ tenantId: 't1', role: 'admin', profile: {} });
      await db.doc('users/bm1').set({ tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['p1'] } });
      for (const c of COLLECTIONS) await db.doc(`${c}/t1_p1`).set({ tenantId: 't1', projectId: 'p1' });
    });
  });

  it('super_admin, admin, marka yöneticisi ve anonim okuyamaz/yazamaz', async () => {
    for (const uid of ['sa1', 'admin1', 'bm1', null]) {
      const db = uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
      for (const c of COLLECTIONS) {
        await assertFails(db.doc(`${c}/t1_p1`).get());
        await assertFails(db.collection(c).where('tenantId', '==', 't1').get());
        await assertFails(db.doc(`${c}/new`).set({ tenantId: 't1' }));
      }
    }
  });
});
