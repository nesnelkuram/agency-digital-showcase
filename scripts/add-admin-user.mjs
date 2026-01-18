// Script to add admin user to Firestore
// Run with: node scripts/add-admin-user.mjs

import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Load .env.local file manually
const envFile = readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

// Firebase config - same as in lib/firebase/config.ts
const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID,
};

// User to add
const USER_EMAIL = 'info@intiba.co.uk';
const USER_PASSWORD = 'Abdus;28800';

async function addAdminUser() {
  console.log('Initializing Firebase...');

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    console.log('Signing in user:', USER_EMAIL);
    const userCredential = await signInWithEmailAndPassword(auth, USER_EMAIL, USER_PASSWORD);
    const user = userCredential.user;

    console.log('User authenticated! UID:', user.uid);

    // Create user document in Firestore
    const userDoc = {
      email: user.email,
      displayName: 'Intiba Admin',
      role: 'admin',
      status: 'active',
      permissions: [],
      metadata: {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    };

    console.log('Creating Firestore document...');
    await setDoc(doc(db, 'users', user.uid), userDoc);

    console.log('✅ User added successfully!');
    console.log('   UID:', user.uid);
    console.log('   Email:', user.email);
    console.log('   Role: admin');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addAdminUser();
