/**
 * Veri düzeltme: content_plans.postIds[] içindeki post'ların contentPlanId alanını güncelle.
 * Plan oluşturulurken geriye bağlantı yazılmadığı için post'lar "orphan" kalmıştı.
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'intiba-ab4bd';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: PROJECT_ID,
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function main() {
  console.log('🔧 Orphan post düzeltme başlıyor...\n');

  const plansSnap = await db.collection('content_plans').get();
  console.log(`📋 Toplam plan: ${plansSnap.size}\n`);

  let totalFixed = 0;
  let totalAlreadyOk = 0;
  let totalMissingPost = 0;

  for (const planDoc of plansSnap.docs) {
    const plan = planDoc.data();
    const postIds = plan.postIds || [];
    if (postIds.length === 0) continue;

    console.log(`─── Plan ${planDoc.id} (${plan.title}) — ${postIds.length} post ───`);

    const batch = db.batch();
    let batchCount = 0;

    for (const postId of postIds) {
      const postRef = db.collection('social_media_posts').doc(postId);
      const postDoc = await postRef.get();
      if (!postDoc.exists) {
        console.log(`  ❌ ${postId}: post yok`);
        totalMissingPost++;
        continue;
      }
      const post = postDoc.data();
      if (post.contentPlanId === planDoc.id) {
        totalAlreadyOk++;
        continue; // zaten doğru
      }
      batch.update(postRef, {
        contentPlanId: planDoc.id,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      batchCount++;
      console.log(
        `  ✓ ${postId}: contentPlanId='${post.contentPlanId || '—'}' → '${planDoc.id}'`
      );
    }

    if (batchCount > 0) {
      await batch.commit();
      totalFixed += batchCount;
      console.log(`  ✅ ${batchCount} post güncellendi\n`);
    } else {
      console.log(`  ⏭  Zaten doğru, atlandı\n`);
    }
  }

  console.log('─────────────────────────────────────────────────────');
  console.log(`  ÖZET`);
  console.log('─────────────────────────────────────────────────────');
  console.log(`  Düzeltilen post: ${totalFixed}`);
  console.log(`  Zaten doğru:      ${totalAlreadyOk}`);
  console.log(`  Bulunamayan:      ${totalMissingPost}`);
}

main().catch((e) => {
  console.error('Hata:', e);
  process.exit(1);
});
