/**
 * Seed Rakle Cam lead entry
 *
 * Run with: DOTENV_CONFIG_PATH=.env.local npx tsx scripts/seed-rakle-cam.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
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

async function seedRakleCam() {
  console.log('Initializing Firebase...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const leadData = {
    sector: 'retail',

    contact: {
      name: 'Rakle Cam Yetkili',
      email: 'info@rakle.com.tr',
      phone: '0542 289 49 69',
      businessName: 'Rakle',
      website: 'https://www.rakle.com.tr',
      instagram: '@rakleglass',
      location: 'Arnavutkoy, Istanbul',
    },

    status: 'new',
    priority: 'medium',

    wizard: {
      answers: {
        // Stage 0 — Operasyonel Gerceklik
        3: 'unified',       // Kanal Tutarliligi: Butunlesik deneyim
        4: 'mostly_holds',  // Yogun Donem: Cogunlukla dayanikli
        5: 'ready',         // Talep Artisi: 10x buyumeye hazir (60 yil deneyim, uretim altyapisi var)

        // Stage 1 — Marka Ruhu
        9: 'discovery',     // Kaybolsa: Kesfetme duygusu kaybolurdu
        10: 'product_experience', // Deneyim: Urun + deneyim (tasarim odakli marka)
        11: 'premium',      // Fiyat-Deger: Premium konumlandirma

        // Stage 2 — Marka Karakteri
        15: 'explain',      // Kriz Tepkisi: Seffaf aciklama
        16: 'emotion',      // Ikna Yontemi: Duygusal baglanti (renk, tasarim, estetik)
        17: 'warm',         // Iletisim Tonu: Sicak ve samimi

        // Stage 3 — Kim Degiliz
        21: 'discount_only', // En Zararli Musteri: Sadece indirimde alan
        22: 'profitability', // Sorun Tipi: Karlilik problemi
        23: 'barrier',       // Yaklasim: Dogal bariyerler olustur

        // Stage 4 — Hedef ve Basari
        27: 'awareness',     // Birincil Hedef: Marka bilinirligini artirma
        28: 'balanced',      // Buyume Hizi: Dengeli buyume
        29: 'brand_recognition', // Basari Gostergesi: Marka taninirlik
      },

      scores: {
        // Stage 0 (max 9)
        3: 3,  // unified = en yuksek
        4: 2,  // mostly_holds
        5: 2,  // ready

        // Stage 1
        9: 1,  // discovery
        10: 2, // product_experience
        11: 2, // premium

        // Stage 2
        15: 2, // explain
        16: 3, // emotion = en yuksek
        17: 1, // warm

        // Stage 3
        21: 1, // discount_only
        22: 0, // profitability
        23: 1, // barrier

        // Stage 4
        27: 0, // awareness
        28: 1, // balanced
        29: 3, // brand_recognition = en yuksek
      },

      stageResults: [
        {
          stage: 0,
          title: 'Operasyonel Gerceklik',
          description: 'Guclu operasyonel altyapi. 60 yillik uretim deneyimi ile olceklenmeye hazir.',
          score: 7,
        },
        {
          stage: 1,
          title: 'Marka Ruhu',
          description: 'Premium tasarim odakli marka kimligine sahip. Kesfetme duygusu ve estetik deneyim on planda.',
          score: 5,
        },
        {
          stage: 2,
          title: 'Marka Karakteri',
          description: 'Sicak, duygusal ve seffaf iletisim tarzina sahip. Estetik ve tasarim uzerinden ikna ediyor.',
          score: 6,
        },
        {
          stage: 3,
          title: 'Kim Degiliz',
          description: 'Indirim odakli musteri profilinden uzak duruyor. Marka degerini koruma oncelikli.',
          score: 2,
        },
        {
          stage: 4,
          title: 'Hedef ve Basari',
          description: 'Marka bilinirligini artirmayi hedefliyor. Dengeli buyume stratejisi ile marka taninirlik odakli.',
          score: 4,
        },
      ],

      wizardVersion: '2.0',
      completionTime: 180000, // ~3 dakika

      businessContext: {
        businessDescription: '60 yillik cam zanaati mirasini modern tasarimla bulusturan, renkli ve sanatsal cam sofra urunleri markasi. Kupa, bardak, kadeh, tabak ve dekoratif cam urunler tasarlayip online magazamiz uzerinden satiyoruz. Rapsodi Dekor Sanayi A.S. kurulsu olan Rakle, Avrupa\'nin oncu cam dekorlama firmalarindan birinin tescilli markasidir.',
        competitors: 'Pasabahce, Lav, Karaca, Madame Coco',
        geoScope: 'national',
        digitalPresence: ['instagram', 'website'],
        instagramFollowers: '50k_plus',
        monthlyBudget: 'scale',
        businessStage: 'established',
        triggerReason: 'competition',
      },
    },

    requestedServices: [
      { id: 'social-media', title: 'Sosyal Medya Yonetimi' },
      { id: 'content-creation', title: 'Icerik Uretimi' },
      { id: 'digital-marketing', title: 'Dijital Pazarlama' },
    ],

    timeline: [
      {
        id: `evt_${Date.now()}`,
        type: 'created',
        title: 'Basvuru alindi',
        description: 'Web sitesi uzerinden marka strateji formu dolduruldu.',
        createdAt: new Date(),
        createdBy: 'system',
        createdByName: 'Sistem',
      },
    ],

    tags: ['cam', 'tasarim', 'premium', 'e-ticaret'],
    source: 'website_wizard',
    submissionId: `BS-${Date.now()}`,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  console.log('Adding Rakle Cam lead to Firestore...');
  const docRef = await addDoc(collection(db, 'brand_leads'), leadData);
  console.log(`Lead created with ID: ${docRef.id}`);
  console.log('Done!');
  process.exit(0);
}

seedRakleCam().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
