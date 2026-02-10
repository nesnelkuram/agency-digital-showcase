import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.vercel-pulled') });
config({ path: resolve(process.cwd(), '.env.local') });

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const shareToken = process.argv[2] || 'f437e055d1d4';

async function main() {
  console.log(`🔍 ShareToken: ${shareToken}\n`);

  // Query by shareToken
  const snapshot = await db
    .collection('feedback_videos')
    .where('shareToken', '==', shareToken)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('❌ Bu shareToken ile video bulunamadı!');

    // Son 5 videoyu listele
    console.log('\n📋 Son 5 video:');
    const recent = await db
      .collection('feedback_videos')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    recent.docs.forEach((doc, i) => {
      const d = doc.data();
      console.log(`${i + 1}. ${d.title}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   shareToken: ${d.shareToken}`);
      console.log(`   isPublic: ${d.isPublic}`);
      console.log('');
    });
    return;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();

  console.log('✅ Video bulundu!\n');
  console.log(`ID: ${doc.id}`);
  console.log(`Title: ${data.title}`);
  console.log(`shareToken: ${data.shareToken}`);
  console.log(`isPublic: ${data.isPublic} (type: ${typeof data.isPublic})`);
  console.log(`status: ${data.status}`);
  console.log(`videoUrl: ${data.videoUrl?.substring(0, 80)}...`);
}

main().catch(console.error);
