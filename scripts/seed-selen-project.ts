/**
 * Seed Selen Magazacioglu project
 *
 * Run with: DOTENV_CONFIG_PATH=.env.local npx tsx scripts/seed-selen-project.ts
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

async function seedSelenProject() {
  console.log('Initializing Firebase...');
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('Signing in...');
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('Authenticated.');

  const now = Timestamp.now();

  const projectData = {
    name: 'Selen Magazacioglu - Dijital Pazarlama & Sosyal Medya',
    description: 'Selen Magazacioglu icin kapsamli dijital pazarlama ve sosyal medya yonetimi projesi. Meta ve Google Ads kampanyalari, Instagram ve TikTok icerik yonetimi.',
    status: 'active',

    // Musteri bilgileri
    clientName: 'Selen Magazacioglu',
    clientEmail: 'selen@selenmagazacioglu.com',
    clientCompany: 'Selen Magazacioglu',

    // Hizmetler
    services: [
      {
        category: 'digital_marketing',
        status: 'active',
        activatedAt: now,
        notes: 'Meta ve Google Ads kampanyalari',
      },
      {
        category: 'social_media',
        status: 'active',
        activatedAt: now,
        notes: 'Instagram ve TikTok icerik yonetimi - haftada 5 post',
      },
      {
        category: 'photography',
        status: 'not_started',
        notes: 'Urun cekimleri planlanacak',
      },
    ],

    // Finansal
    totalBudget: 150000,
    monthlyFee: 25000,
    currency: 'TRY',

    // Tarihler
    startDate: now,

    // Timeline
    timeline: [
      {
        id: `evt-${Date.now()}`,
        type: 'created',
        title: 'Proje olusturuldu',
        description: 'Selen Magazacioglu projesi olusturuldu.',
        createdAt: now,
        createdBy: 'system',
        createdByName: 'Sistem',
      },
      {
        id: `evt-${Date.now() + 1}`,
        type: 'service_activated',
        title: 'Digital Marketing aktive edildi',
        description: 'Meta ve Google Ads kampanya yonetimi basladi',
        createdAt: now,
        createdBy: 'system',
        createdByName: 'Sistem',
      },
      {
        id: `evt-${Date.now() + 2}`,
        type: 'service_activated',
        title: 'Sosyal Medya Yonetimi aktive edildi',
        description: 'Instagram ve TikTok icerik planlama ve paylasim basladi',
        createdAt: now,
        createdBy: 'system',
        createdByName: 'Sistem',
      },
    ],

    // Etiketler
    tags: ['retail', 'e-commerce', 'premium', 'sosyal-medya'],

    // Timestamps
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
    createdByName: 'Seed Script',
  };

  console.log('Creating Selen Magazacioglu project...');
  const docRef = await addDoc(collection(db, 'projects'), projectData);
  console.log(`Project created with ID: ${docRef.id}`);
  console.log('Done!');

  process.exit(0);
}

seedSelenProject().catch((error) => {
  console.error('Seed error:', error);
  process.exit(1);
});
