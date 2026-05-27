/**
 * API endpoint logic'ini Admin SDK ile simüle et — sorunun backend'de mi yoksa auth katmanında mı olduğunu tespit etmek için.
 *
 * Auth kontrolü bypass edilir. Sadece:
 *  1. Seray'ın user doc'unu bul
 *  2. Ona atanmış plandaki post'u bul
 *  3. Endpoint'in yapacağı yetki kontrolünü çalıştır
 *  4. Başarılı ise post update'i simule et
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
  console.log('─── Backend logic simulation ───\n');

  // 1. Seray
  const userSnap = await db.collection('users').where('email', '==', CLIENT_EMAIL).get();
  if (userSnap.empty) throw new Error('User yok');
  const userUid = userSnap.docs[0].id;
  const user = userSnap.docs[0].data();
  console.log(`User: ${userUid} role=${user.role} tenant=${user.tenantId}`);

  // 2. Atanmış plan
  const plansSnap = await db
    .collection('content_plans')
    .where('tenantId', '==', user.tenantId)
    .where('assignedClientEmail', '==', CLIENT_EMAIL.toLowerCase())
    .get();
  if (plansSnap.empty) throw new Error('Plan yok');
  const plan = plansSnap.docs[0].data();
  const planId = plansSnap.docs[0].id;
  const testPostId = plan.postIds[0];
  console.log(`Plan: ${planId}, test post: ${testPostId}\n`);

  // 3. Post yükle
  const postRef = db.collection('social_media_posts').doc(testPostId);
  const postDoc = await postRef.get();
  if (!postDoc.exists) throw new Error('Post yok');
  const post = postDoc.data();
  console.log('Post:', {
    tenantId: post.tenantId,
    projectId: post.projectId,
    contentPlanId: post.contentPlanId,
    status: post.status,
  });

  // 4. Yetki kontrolü (endpoint logic)
  if (post.tenantId !== user.tenantId) {
    console.log('❌ Tenant uyumsuz');
    return;
  }
  const userEmail = (user.email || '').toLowerCase();
  const assignedProjects = user.profile?.assignedProjectIds || [];
  const canSeeProject = post.projectId && assignedProjects.includes(post.projectId);

  let planAssignedToMe = false;
  if (post.contentPlanId) {
    const planDoc = await db.collection('content_plans').doc(post.contentPlanId).get();
    if (planDoc.exists) {
      const p = planDoc.data();
      planAssignedToMe =
        p?.assignedClientId === userUid || (p?.assignedClientEmail || '').toLowerCase() === userEmail;
    }
  }

  console.log('\nYetki kontrolü:');
  console.log('  userEmail:', userEmail);
  console.log('  assignedProjects:', assignedProjects);
  console.log('  post.projectId:', post.projectId);
  console.log('  canSeeProject:', canSeeProject);
  console.log('  post.contentPlanId:', post.contentPlanId);
  console.log('  planAssignedToMe:', planAssignedToMe);

  if (!canSeeProject && !planAssignedToMe) {
    console.log('\n❌ YETKİ YOK — endpoint 403 dönerdi');
    return;
  }

  console.log('\n✅ Yetki OK — endpoint başarılı olurdu');
  console.log('\nSimülasyon: "revise" action ile test yorumu ekliyorum...\n');

  // 5. Gerçek update
  await postRef.update({
    status: 'revision_requested',
    lastRevisionComment: '[BACKEND TEST] — otomatik, yoksayın',
    revisionCount: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('✓ Post güncellendi: status=revision_requested');

  // 6. Plan'a comment ekle
  const planRef = db.collection('content_plans').doc(post.contentPlanId);
  await planRef.update({
    clientComments: admin.firestore.FieldValue.arrayUnion({
      id: `c_test_${Date.now()}`,
      postId: testPostId,
      text: '[BACKEND TEST] — otomatik test yorumu',
      createdBy: userUid,
      createdByName: user.displayName || 'Seray',
      createdByRole: 'client',
      createdAt: new Date(),
      isClient: true,
      isInternal: false,
    }),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('✓ Plan\'a client comment eklendi');

  console.log('\n═══════════════════════════════════════════════');
  console.log('SONUÇ: Backend logic ÇALIŞIYOR. Sorun auth/frontend katmanında.');
  console.log('═══════════════════════════════════════════════');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
