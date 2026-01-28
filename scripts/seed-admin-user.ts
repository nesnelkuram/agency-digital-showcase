/**
 * Seed Admin User Script
 *
 * This script creates the admin user document in Firestore.
 * Run with: npx tsx scripts/seed-admin-user.ts
 *
 * Prerequisites:
 * - Firebase Auth user must already exist (created via Firebase Console)
 * - VITE_FIREBASE_* environment variables must be set in .env.local
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Admin user credentials
const ADMIN_EMAIL = 'info@intiba.co.uk';
const ADMIN_PASSWORD = 'Abdus;28800';

async function seedAdminUser() {
  console.log('🔧 Initializing Firebase...');

  if (!firebaseConfig.apiKey) {
    console.error('❌ Firebase config not found. Make sure .env.local has VITE_FIREBASE_* variables.');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    console.log('🔐 Signing in to get user UID...');
    const userCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    const uid = userCredential.user.uid;

    console.log(`✅ User authenticated. UID: ${uid}`);

    console.log('📝 Creating Firestore user document...');

    const userData = {
      email: ADMIN_EMAIL,
      displayName: 'Intiba Admin',
      role: 'admin',
      permissions: [
        'users:read', 'users:write', 'users:delete',
        'content:read', 'content:write', 'content:delete',
        'leads:read', 'leads:write', 'leads:delete',
        'settings:read', 'settings:write',
        'analytics:read',
        'wizard:read', 'wizard:write',
      ],
      status: 'active',
      metadata: {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      profile: {
        title: 'Administrator',
        department: 'Management',
      },
      settings: {
        notifications: {
          email: true,
          push: true,
          approvalReminders: true,
        },
      },
    };

    await setDoc(doc(db, 'users', uid), userData);

    console.log('✅ Admin user document created successfully!');
    console.log('\n📋 User Details:');
    console.log(`   UID: ${uid}`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Role: admin`);
    console.log('\n🎉 You can now log in to the admin panel.');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedAdminUser();
