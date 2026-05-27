/**
 * Teşhis scripti: Seray'ın portal'da neden plan göremediğini Firestore'dan kontrol et.
 * Çalıştır: node scripts/diagnose-client.mjs
 *
 * ADC (Application Default Credentials) kullanır — `gcloud auth application-default login` gereklidir.
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'intiba-ab4bd';
const CLIENT_EMAIL = 'seraydemirag@gmail.com';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: PROJECT_ID,
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function main() {
  console.log('─────────────────────────────────────────────────────');
  console.log('  TEŞHIS: ', CLIENT_EMAIL);
  console.log('─────────────────────────────────────────────────────\n');

  // 1. User doc
  const userSnap = await db.collection('users').where('email', '==', CLIENT_EMAIL).get();
  if (userSnap.empty) {
    console.log('❌ User doc BULUNAMADI — Seray sisteme kaydolmamış!');
    return;
  }
  const userDoc = userSnap.docs[0];
  const user = userDoc.data();
  console.log('✓ User doc var:');
  console.log('  uid:', userDoc.id);
  console.log('  email:', user.email);
  console.log('  role:', user.role);
  console.log('  tenantId:', user.tenantId);
  console.log('  status:', user.status);
  console.log('  profile.assignedProjectIds:', user.profile?.assignedProjectIds);
  console.log('');

  const uid = userDoc.id;
  const tenantId = user.tenantId;
  const email = (user.email || '').toLowerCase();
  const assignedProjects = user.profile?.assignedProjectIds || [];

  // 2. Content plans — tenant içindeki tümü
  const plansSnap = await db.collection('content_plans').where('tenantId', '==', tenantId).get();
  console.log(`📋 Tenant'taki plan sayısı: ${plansSnap.size}\n`);

  const visibleStatuses = new Set([
    'pending_approval',
    'partially_approved',
    'approved',
    'revision_requested',
  ]);

  const visiblePlans = [];
  plansSnap.forEach((d) => {
    const p = d.data();
    const statusVisible = visibleStatuses.has(p.status);
    const byUid = p.assignedClientId === uid;
    const byEmail = (p.assignedClientEmail || '').toLowerCase() === email;
    const byProject = p.projectId && assignedProjects.includes(p.projectId);
    const visible = statusVisible && (byUid || byEmail || byProject);

    console.log(`  📄 ${d.id}`);
    console.log(`     title: ${p.title}`);
    console.log(`     status: ${p.status} ${statusVisible ? '✓' : '❌'}`);
    console.log(`     assignedClientId: ${p.assignedClientId || '—'} ${byUid ? '✓' : '—'}`);
    console.log(`     assignedClientEmail: ${p.assignedClientEmail || '—'} ${byEmail ? '✓' : '—'}`);
    console.log(`     projectId: ${p.projectId || '—'} ${byProject ? '✓' : '—'}`);
    console.log(`     postIds (kaç post?): ${p.postIds?.length || 0}`);
    console.log(`     VISIBLE: ${visible ? '✅' : '❌'}`);
    console.log('');

    if (visible) visiblePlans.push({ id: d.id, ...p });
  });

  console.log(`🔍 Görünür plan sayısı: ${visiblePlans.length}\n`);

  // 3. Her görünür plan için post'ları kontrol et
  for (const plan of visiblePlans) {
    console.log(`─── Plan '${plan.title}' için post'lar ───`);
    const postsSnap = await db
      .collection('social_media_posts')
      .where('tenantId', '==', tenantId)
      .where('contentPlanId', '==', plan.id)
      .get();
    console.log(`  Post sayısı (contentPlanId query): ${postsSnap.size}`);

    if (postsSnap.size === 0 && plan.postIds?.length > 0) {
      console.log(`  ⚠ plan.postIds[] ${plan.postIds.length} post ID içeriyor ama query 0 döndürdü!`);
      console.log('  postIds:', plan.postIds);

      // Teker teker getir
      console.log('  → Doğrudan ID ile getir:');
      for (const pid of plan.postIds.slice(0, 3)) {
        const doc = await db.collection('social_media_posts').doc(pid).get();
        if (doc.exists) {
          const pd = doc.data();
          console.log(`    ${pid}: tenantId=${pd.tenantId} contentPlanId=${pd.contentPlanId} status=${pd.status}`);
        } else {
          console.log(`    ${pid}: DOKÜMAN YOK`);
        }
      }
    } else if (postsSnap.size > 0) {
      postsSnap.forEach((d) => {
        const p = d.data();
        console.log(`    ${d.id}: type=${p.postType} status=${p.status} scheduledAt=${p.scheduledAt?.toDate?.().toISOString() || '—'}`);
      });
    }
    console.log('');
  }

  console.log('─────────────────────────────────────────────────────');
  console.log('  ÖZET');
  console.log('─────────────────────────────────────────────────────');
  console.log(`  Seray (${email})`);
  console.log(`  Tenant plan: ${plansSnap.size}`);
  console.log(`  Görünür plan: ${visiblePlans.length}`);
  console.log('');
}

main().catch((e) => {
  console.error('Hata:', e);
  process.exit(1);
});
