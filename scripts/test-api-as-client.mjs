/**
 * Seray'ın API çağrısını simüle eder: custom token oluşturup /api/social-media/client-review-post endpoint'ini çağırır.
 *
 * Not: Custom token'dan ID token'a çevirmek için Firebase Auth REST API kullanıyoruz.
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'intiba-ab4bd';
const API_URL = 'https://www.intiba.co.uk/api/social-media/client-review-post';
const CLIENT_EMAIL = 'seraydemirag@gmail.com';
const WEB_API_KEY = 'AIzaSyDS7k90BRfkRKeUKS8yNNO-l-m6fqR1SNs'; // public, safe to use

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: PROJECT_ID,
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function exchangeCustomTokenForIdToken(customToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data.idToken;
}

async function main() {
  // 1. Seray'ın UID'sini bul
  const userSnap = await db.collection('users').where('email', '==', CLIENT_EMAIL).get();
  if (userSnap.empty) {
    console.error('Kullanıcı bulunamadı');
    return;
  }
  const uid = userSnap.docs[0].id;
  const userData = userSnap.docs[0].data();
  console.log(`✓ Seray bulundu: ${uid}`);
  console.log(`  role: ${userData.role}, tenantId: ${userData.tenantId}`);

  // 2. Custom token üret
  const customToken = await auth.createCustomToken(uid);
  console.log(`✓ Custom token üretildi (uzunluk: ${customToken.length})`);

  // 3. ID token'a çevir
  const idToken = await exchangeCustomTokenForIdToken(customToken);
  console.log(`✓ ID token alındı (uzunluk: ${idToken.length})`);

  // 4. Seray'ın görebileceği bir post seç
  const plansSnap = await db
    .collection('content_plans')
    .where('tenantId', '==', userData.tenantId)
    .where('assignedClientEmail', '==', CLIENT_EMAIL.toLowerCase())
    .get();
  if (plansSnap.empty) {
    console.error('Seray\'a atanmış plan bulunamadı');
    return;
  }
  const plan = plansSnap.docs[0].data();
  const planId = plansSnap.docs[0].id;
  const postIds = plan.postIds || [];
  if (postIds.length === 0) {
    console.error('Planda post yok');
    return;
  }
  const testPostId = postIds[0];
  console.log(`✓ Test post: ${testPostId} (plan: ${planId})`);

  // 5. API'yi çağır — test amacıyla 'revise' gönderelim, state bozmasın
  console.log(`\n→ ${API_URL} çağrılıyor...`);
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      postId: testPostId,
      action: 'revise',
      comment: 'TEST — bu yorum script tarafından oluşturuldu, yoksayın',
    }),
  });

  console.log(`\n← HTTP ${res.status}`);
  const respText = await res.text();
  try {
    const body = JSON.parse(respText);
    console.log('← Body:', JSON.stringify(body, null, 2));
  } catch {
    console.log('← Raw:', respText);
  }
}

main().catch((e) => {
  console.error('\n❌ Hata:', e.message);
  process.exit(1);
});
