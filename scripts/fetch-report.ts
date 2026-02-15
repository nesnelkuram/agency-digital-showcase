import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { config } from 'dotenv';
config({ path: '.env.local' });

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

async function main() {
  const q = query(collection(db, 'brand_leads'), where('shareToken', '==', '253cf16efb5f'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) { console.log('NOT FOUND'); process.exit(0); }

  const data = snap.docs[0].data();

  // Wizard input data
  console.log('=== CONTACT ===');
  console.log(JSON.stringify(data.contact, null, 2));

  console.log('\n=== WIZARD ANSWERS ===');
  console.log(JSON.stringify(data.wizard?.answers, null, 2));

  console.log('\n=== WIZARD SCORES ===');
  console.log(JSON.stringify(data.wizard?.scores, null, 2));

  console.log('\n=== STAGE RESULTS ===');
  console.log(JSON.stringify(data.wizard?.stageResults, null, 2));

  console.log('\n=== BUSINESS CONTEXT ===');
  console.log(JSON.stringify(data.wizard?.businessContext, null, 2));

  console.log('\n=== REQUESTED SERVICES ===');
  console.log(JSON.stringify(data.requestedServices, null, 2));

  console.log('\n=== SECTOR ===');
  console.log(data.sector);

  console.log('\n=== TAGS ===');
  console.log(JSON.stringify(data.tags));

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
