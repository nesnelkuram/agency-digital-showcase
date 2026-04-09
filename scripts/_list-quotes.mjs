import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';

const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => { const [k,...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// Try reading firebase config from the app
const configFile = readFileSync('src/lib/firebase/config.ts', 'utf-8').toString();
const projectIdMatch = configFile.match(/projectId.*?['"](.*?)['"]/);
console.log('Project:', projectIdMatch?.[1] || firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const EMAIL = process.argv[2];
const PASS = process.argv[3];
if (!EMAIL || !PASS) { console.log('Usage: node scripts/_list-quotes.mjs <email> <password>'); process.exit(1); }

const auth = getAuth(app);
await signInWithEmailAndPassword(auth, EMAIL, PASS);
console.log('Authenticated ✓\n');

const snap = await getDocs(collection(db, 'quotes'));
console.log(`Toplam ${snap.size} teklif:\n`);
snap.docs
  .sort((a,b) => (b.data().createdAt?.seconds||0) - (a.data().createdAt?.seconds||0))
  .forEach(d => {
    const data = d.data();
    const date = data.createdAt?.toDate?.()?.toLocaleDateString('tr-TR') || '-';
    const lines = data.serviceLines?.length ?? 0;
    console.log(`[${d.id.slice(0,8)}] ${data.clientName || '?'} | ${data.projectTitle || '-'} | ${data.sellPrice?.toLocaleString('tr-TR') || '?'} TL | ${data.status} | ${lines} kalem | ${date}`);
  });

process.exit(0);
