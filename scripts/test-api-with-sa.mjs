/**
 * Service account ile Seray olarak login olup API'yi test et.
 */

import admin from 'firebase-admin';
import fs from 'fs';

const API_URL = 'https://www.intiba.co.uk/api/social-media/client-review-post';
const CLIENT_EMAIL = 'seraydemirag@gmail.com';
const WEB_API_KEY = 'AIzaSyDS7k90BRfkRKeUKS8yNNO-l-m6fqR1SNs';

// Vercel env dosyasını RAW oku (dotenv escape'leri bozuyor)
const raw = fs.readFileSync('/tmp/vercel-env.txt', 'utf-8');
const match = raw.match(/FIREBASE_SERVICE_ACCOUNT="((?:[^"\\]|\\.)*)"/);
if (!match) throw new Error('FIREBASE_SERVICE_ACCOUNT bulunamadı');
// match[1] — escape'lenmiş JSON (özetinde \\n ve \\" var). Önce escape'leri çözelim.
// Bu bir JSON string olmuştur, JSON.parse("\"" + match[1] + "\"") ile çözülür.
const jsonStr = JSON.parse('"' + match[1] + '"');
const serviceAccount = JSON.parse(jsonStr);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const auth = admin.auth();

async function main() {
  // 1. Seray'ı bul
  const userSnap = await db.collection('users').where('email', '==', CLIENT_EMAIL).get();
  if (userSnap.empty) throw new Error('User yok');
  const uid = userSnap.docs[0].id;
  const userData = userSnap.docs[0].data();
  console.log(`✓ UID: ${uid} | tenant: ${userData.tenantId} | role: ${userData.role}`);

  // 2. Custom token → ID token
  const customToken = await auth.createCustomToken(uid);
  const exchangeRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  if (!exchangeRes.ok) {
    const body = await exchangeRes.text();
    throw new Error(`Token exchange failed: ${exchangeRes.status} — ${body}`);
  }
  const { idToken } = await exchangeRes.json();
  console.log(`✓ ID token alındı (${idToken.length} char)`);

  // 3. Atanmış planı + post'u bul
  const plansSnap = await db
    .collection('content_plans')
    .where('tenantId', '==', userData.tenantId)
    .where('assignedClientEmail', '==', CLIENT_EMAIL.toLowerCase())
    .get();
  console.log(`✓ Seray'a atanmış ${plansSnap.size} plan bulundu`);
  if (plansSnap.empty) throw new Error('Hiç plan yok');

  const plan = plansSnap.docs[0].data();
  const postIds = plan.postIds || [];
  if (postIds.length === 0) throw new Error('Postlar yok');
  const testPostId = postIds[0];
  console.log(`✓ Test post: ${testPostId}`);

  // 4. API çağrısı
  console.log(`\n→ POST ${API_URL}\n  action: revise (TEST YORUMU)\n`);
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      postId: testPostId,
      action: 'revise',
      comment: '[TEST] Bu otomatik test yorumu. Yoksayın.',
    }),
  });

  console.log(`← HTTP ${res.status}`);
  const text = await res.text();
  try {
    console.log('← Body:', JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log('← Raw:', text);
  }
}

main().catch((e) => {
  console.error('\n❌', e.message);
  console.error(e.stack);
  process.exit(1);
});
