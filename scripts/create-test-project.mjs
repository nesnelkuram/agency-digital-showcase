// Test Script: Create sample projects for testing (authenticated)
// Run with: node scripts/create-test-project.mjs

import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  Timestamp,
} from 'firebase/firestore';

// Load .env.local
const envFile = readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach((line) => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const USER_EMAIL = 'info@intiba.co.uk';
const USER_PASSWORD = 'Abdus;28800';

async function createProjects() {
  console.log('🔐 Oturum aciliyor...');
  const cred = await signInWithEmailAndPassword(auth, USER_EMAIL, USER_PASSWORD);
  const uid = cred.user.uid;
  console.log('✅ Oturum acildi:', uid);

  const now = Timestamp.now();

  const projects = [
    {
      tenantId: 'default',
      name: 'ACME Corp - Kurumsal Tanitim Filmi',
      description: 'ACME Corp icin kurumsal tanitim filmi produksiyonu, fotograf cekimi ve sosyal medya yonetimi projesi.',
      status: 'active',
      clientName: 'Ahmet Yilmaz',
      clientEmail: 'ahmet@acmecorp.com',
      clientPhone: '+90 532 123 45 67',
      clientCompany: 'ACME Corporation',
      services: [
        { category: 'video_production', status: 'active', activatedAt: now },
        { category: 'photography', status: 'not_started' },
        { category: 'social_media', status: 'active', activatedAt: now },
        { category: 'digital_marketing', status: 'not_started' },
      ],
      totalBudget: 150000,
      monthlyFee: 25000,
      currency: 'TRY',
      startDate: now,
      timeline: [{
        id: `evt-${Date.now()}`,
        type: 'created',
        title: 'Proje olusturuldu',
        description: 'ACME Corp - Kurumsal Tanitim Filmi projesi olusturuldu',
        createdAt: now,
        createdBy: uid,
        createdByName: 'Intiba Admin',
      }],
      tags: ['kurumsal', 'video', 'premium'],
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      createdByName: 'Intiba Admin',
    },
    {
      tenantId: 'default',
      name: 'Lezzet Cafe - Sosyal Medya Paketi',
      description: 'Lezzet Cafe icin aylik sosyal medya yonetimi, icerik uretimi ve dijital reklam kampanyasi.',
      status: 'active',
      clientName: 'Elif Demir',
      clientEmail: 'elif@lezzetcafe.com',
      clientPhone: '+90 541 987 65 43',
      clientCompany: 'Lezzet Cafe',
      services: [
        { category: 'social_media', status: 'active', activatedAt: now },
        { category: 'photography', status: 'active', activatedAt: now },
        { category: 'digital_marketing', status: 'active', activatedAt: now },
      ],
      totalBudget: 80000,
      monthlyFee: 12000,
      currency: 'TRY',
      startDate: now,
      timeline: [{
        id: `evt-${Date.now() + 1}`,
        type: 'created',
        title: 'Proje olusturuldu',
        description: 'Lezzet Cafe - Sosyal Medya Paketi projesi olusturuldu',
        createdAt: now,
        createdBy: uid,
        createdByName: 'Intiba Admin',
      }],
      tags: ['cafe', 'sosyal-medya', 'aylik'],
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      createdByName: 'Intiba Admin',
    },
    {
      tenantId: 'default',
      name: 'TechStart - Urun Lansman Etkinligi',
      description: 'TechStart firmasinin yeni urun lansman etkinliginin tum produksiyon sureci.',
      status: 'active',
      clientName: 'Can Ozturk',
      clientEmail: 'can@techstart.io',
      clientPhone: '+90 555 234 56 78',
      clientCompany: 'TechStart Teknoloji',
      services: [
        { category: 'video_production', status: 'active', activatedAt: now },
        { category: 'photography', status: 'active', activatedAt: now },
        { category: 'event_coverage', status: 'not_started' },
        { category: 'graphic_design', status: 'not_started' },
      ],
      totalBudget: 220000,
      currency: 'TRY',
      startDate: now,
      timeline: [{
        id: `evt-${Date.now() + 2}`,
        type: 'created',
        title: 'Proje olusturuldu',
        description: 'TechStart - Urun Lansman Etkinligi projesi olusturuldu',
        createdAt: now,
        createdBy: uid,
        createdByName: 'Intiba Admin',
      }],
      tags: ['teknoloji', 'lansman', 'etkinlik', 'premium'],
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      createdByName: 'Intiba Admin',
    },
  ];

  console.log('\n📁 Test projeleri olusturuluyor...\n');

  for (const project of projects) {
    try {
      const docRef = await addDoc(collection(db, 'projects'), project);
      console.log(`✅ "${project.name}" → ID: ${docRef.id}`);
    } catch (error) {
      console.error(`❌ "${project.name}":`, error.message);
    }
  }

  console.log('\n🎉 Tamamlandi! Tarayiciyi yenileyerek projeleri gorebilirsiniz.\n');
  process.exit(0);
}

createProjects().catch((err) => {
  console.error('❌ Hata:', err.message);
  process.exit(1);
});
