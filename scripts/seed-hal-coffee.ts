/**
 * Seed Hal Coffee project
 *
 * Run with: DOTENV_CONFIG_PATH=.env.local npx tsx scripts/seed-hal-coffee.ts
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
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

async function seedHalCoffee() {
  console.log('Initializing Firebase...');
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('Signing in...');
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('Authenticated.');

  const now = Timestamp.now();

  const projectData = {
    name: 'Hal Coffee - Dijital Pazarlama & Sosyal Medya',
    description: 'Hal Coffee icin dijital pazarlama ve sosyal medya yonetimi. Instagram icerik uretimi, Meta Ads kampanyalari ve marka bilinirlik calismalari.',
    status: 'active',

    clientName: 'Hal Coffee',
    clientEmail: 'info@halcoffee.com',
    clientCompany: 'Hal Coffee',

    services: [
      {
        category: 'digital_marketing',
        status: 'active',
        activatedAt: now,
        notes: 'Meta Ads - yerel hedefleme ve marka bilinirlik kampanyalari',
      },
      {
        category: 'social_media',
        status: 'active',
        activatedAt: now,
        notes: 'Instagram icerik yonetimi - haftada 4 post, Reels ve Story',
      },
      {
        category: 'photography',
        status: 'active',
        activatedAt: now,
        notes: 'Urun ve mekan fotograf cekimleri - ayda 1 seans',
      },
    ],

    totalBudget: 80000,
    monthlyFee: 15000,
    currency: 'TRY',

    startDate: now,

    timeline: [
      {
        id: `evt-${Date.now()}`,
        type: 'created',
        title: 'Proje olusturuldu',
        description: 'Hal Coffee projesi olusturuldu.',
        createdAt: now,
        createdBy: 'system',
        createdByName: 'Sistem',
      },
      {
        id: `evt-${Date.now() + 1}`,
        type: 'service_activated',
        title: 'Digital Marketing aktive edildi',
        description: 'Meta Ads kampanyalari basladi',
        createdAt: now,
        createdBy: 'system',
        createdByName: 'Sistem',
      },
      {
        id: `evt-${Date.now() + 2}`,
        type: 'service_activated',
        title: 'Sosyal Medya Yonetimi aktive edildi',
        description: 'Instagram icerik planlama ve paylasim basladi',
        createdAt: now,
        createdBy: 'system',
        createdByName: 'Sistem',
      },
      {
        id: `evt-${Date.now() + 3}`,
        type: 'service_activated',
        title: 'Fotograf Cekimi aktive edildi',
        description: 'Urun ve mekan fotograf cekimleri planlanmaya baslandi',
        createdAt: now,
        createdBy: 'system',
        createdByName: 'Sistem',
      },
    ],

    tags: ['cafe', 'food-beverage', 'local', 'sosyal-medya'],

    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
    createdByName: 'Seed Script',
  };

  console.log('Creating Hal Coffee project...');
  const docRef = await addDoc(collection(db, 'projects'), projectData);
  console.log(`Project created with ID: ${docRef.id}`);
  console.log('Done!');

  process.exit(0);
}

seedHalCoffee().catch((error) => {
  console.error('Seed error:', error);
  process.exit(1);
});
