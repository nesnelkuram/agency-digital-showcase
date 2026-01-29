/**
 * Reset AI Analysis for a specific lead
 *
 * Run with: npx tsx scripts/reset-ai-analysis.ts
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, updateDoc, deleteField } from 'firebase/firestore';
import { config } from 'dotenv';

config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const ADMIN_EMAIL = 'info@intiba.co.uk';
const ADMIN_PASSWORD = 'Abdus;28800';
const BUSINESS_NAME = 'Dost Findik';

async function resetAIAnalysis() {
  console.log('Initializing Firebase...');
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('Authenticated.');

    // First list all leads to find the right one
    const allLeads = await getDocs(collection(db, 'brand_leads'));
    console.log(`Found ${allLeads.size} total leads:`);
    for (const d of allLeads.docs) {
      const data = d.data();
      console.log(`  - ${d.id}: ${data.contact?.businessName || data.contact?.name || 'unknown'} (hasAI: ${!!data.aiAnalysis})`);
    }

    // Reset all leads that have AI analysis
    let resetCount = 0;
    for (const docSnap of allLeads.docs) {
      const data = docSnap.data();
      if (data.aiAnalysis) {
        console.log(`Resetting AI analysis for: ${docSnap.id} (${data.contact?.businessName})`);
        await updateDoc(docSnap.ref, {
          aiAnalysis: deleteField(),
          analyzedAt: deleteField(),
          analyzedBy: deleteField(),
        });
        console.log('AI analysis fields removed.');
        resetCount++;
      }
    }
    console.log(`Reset ${resetCount} lead(s).`);

    console.log('Done.');
    process.exit(0);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

resetAIAnalysis();
