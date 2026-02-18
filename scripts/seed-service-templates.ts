/**
 * Seed Service Templates to Firestore
 *
 * Yeni hizmet sablonlarini Firebase'e yazar.
 * Mevcut sablonlara dokunmaz, sadece yenileri ekler.
 *
 * Run with: DOTENV_CONFIG_PATH=.env.local npx tsx scripts/seed-service-templates.ts
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
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

// ============================================
// TEMPLATE DEFINITIONS
// ============================================

const NEW_TEMPLATES = [
  {
    name: 'Drone Cekimi',
    description: 'Profesyonel drone ile hava cekimi. Gayrimenkul, etkinlik, insaat takip veya sinematik goruntu icin.',
    shortDescription: 'Profesyonel hava cekimi',
    category: 'drone_shooting',
    subType: 'aerial_shooting',
    tags: ['drone', 'hava-cekimi', 'aerial', 'gayrimenkul', 'sinematik'],
    components: [
      {
        id: 'drone_cekim',
        name: 'Drone Cekim',
        description: 'Profesyonel drone cekimi (yarim gun)',
        type: 'per_unit',
        costRefs: [
          { source: 'staff', roleType: 'owner', timeUnit: 'hours', timeAmount: 4 },
          { source: 'equipment', category: 'drone', days: 1 },
          { source: 'overhead', allocationType: 'per_hour' },
        ],
        unitLabel: 'Cekim',
        baseQuantity: 1,
        isOptional: false,
        isEditable: true,
        sortOrder: 1,
      },
      {
        id: 'drone_kurgu',
        name: 'Kurgu & Renk Duzeltme',
        description: 'Hava goruntusu kurgu ve color grading',
        type: 'fixed',
        costRefs: [
          { source: 'staff', roleType: 'junior', timeUnit: 'hours', timeAmount: 3 },
          { source: 'overhead', allocationType: 'per_hour' },
        ],
        isOptional: false,
        isEditable: true,
        sortOrder: 2,
      },
      {
        id: 'ulasim',
        name: 'Ulasim',
        description: 'Lokasyona ulasim masrafi',
        type: 'fixed',
        costRefs: [
          { source: 'manual', amount: 500, description: 'Ulasim' },
        ],
        isOptional: true,
        isEditable: true,
        sortOrder: 3,
      },
    ],
    minimumPrice: 8000,
    defaultMargin: 0.35,
    complexityMultiplier: 1.0,
    allowQuickQuote: true,
    quickQuoteDefaults: { quantity: 1 },
    icon: 'Plane',
    color: '#0EA5E9',
    isPopular: true,
    isActive: true,
    sortOrder: 3,
    version: 1,
  },
  {
    name: 'Senaryo & Brief Yazimi',
    description: 'Video senaryo, proje brief, sosyal medya metin yazarligi ve reklam kopya hizmetleri.',
    shortDescription: 'Metin yazarligi & senaryo',
    category: 'scriptwriting',
    subType: 'video_script',
    tags: ['senaryo', 'brief', 'metin', 'copywriting', 'script'],
    components: [
      {
        id: 'arastirma_brief',
        name: 'Arastirma & Brief Hazirlama',
        description: 'Konu arastirmasi, hedef kitle analizi ve brief yazimi',
        type: 'fixed',
        costRefs: [
          { source: 'staff', roleType: 'senior', timeUnit: 'hours', timeAmount: 3 },
          { source: 'overhead', allocationType: 'per_hour' },
        ],
        isOptional: false,
        isEditable: true,
        sortOrder: 1,
      },
      {
        id: 'senaryo_yazim',
        name: 'Senaryo / Metin Yazimi',
        description: 'Senaryo veya metin yazimi (adet bazli)',
        type: 'per_unit',
        costRefs: [
          { source: 'staff', roleType: 'senior', timeUnit: 'hours', timeAmount: 2 },
          { source: 'overhead', allocationType: 'per_hour' },
        ],
        unitLabel: 'Metin',
        baseQuantity: 1,
        isOptional: false,
        isEditable: true,
        sortOrder: 2,
      },
      {
        id: 'revizyon',
        name: 'Revizyon',
        description: '2 tur revizyon dahil',
        type: 'fixed',
        costRefs: [
          { source: 'staff', roleType: 'senior', timeUnit: 'hours', timeAmount: 2 },
        ],
        isOptional: false,
        isEditable: false,
        sortOrder: 3,
      },
    ],
    minimumPrice: 5000,
    defaultMargin: 0.40,
    complexityMultiplier: 1.0,
    allowQuickQuote: true,
    quickQuoteDefaults: { quantity: 1 },
    icon: 'FileEdit',
    color: '#78716C',
    isPopular: false,
    isActive: true,
    sortOrder: 4,
    version: 1,
  },
  {
    name: 'E-Ticaret Urun Cekimi',
    description: 'Profesyonel urun fotografi ve video. Beyaz fon, lifestyle, katalog ve marketplace icerik uretimi.',
    shortDescription: 'Urun foto & video paketi',
    category: 'ecommerce_content',
    subType: 'product_photo',
    tags: ['urun', 'e-ticaret', 'fotograf', 'trendyol', 'amazon', 'katalog', 'marketplace'],
    components: [
      {
        id: 'urun_cekim',
        name: 'Urun Cekim Gunu',
        description: 'Studyoda veya lokasyonda urun cekimi (1 tam gun)',
        type: 'per_unit',
        costRefs: [
          { source: 'staff', roleType: 'owner', timeUnit: 'days', timeAmount: 1 },
          { source: 'equipment', category: 'camera', days: 1 },
          { source: 'equipment', category: 'lighting', days: 1 },
          { source: 'overhead', allocationType: 'per_day' },
        ],
        unitLabel: 'Gun',
        baseQuantity: 1,
        isOptional: false,
        isEditable: true,
        sortOrder: 1,
      },
      {
        id: 'urun_retush',
        name: 'Urun Retush & Islem',
        description: 'Fotograf retush, beyaz fon, renk duzeltme (adet bazli)',
        type: 'tiered',
        costRefs: [
          { source: 'staff', roleType: 'junior', timeUnit: 'hours', timeAmount: 0.5 },
          { source: 'overhead', allocationType: 'per_hour' },
        ],
        unitLabel: 'Foto',
        baseQuantity: 20,
        quantityTiers: [
          { minQuantity: 1, maxQuantity: 19, unitPriceModifier: 1.0, label: '1-19 adet' },
          { minQuantity: 20, maxQuantity: 49, unitPriceModifier: 0.85, label: '20-49 adet' },
          { minQuantity: 50, maxQuantity: null, unitPriceModifier: 0.70, label: '50+ adet' },
        ],
        isOptional: false,
        isEditable: true,
        sortOrder: 2,
      },
      {
        id: 'urun_video',
        name: 'Urun Tanitim Videosu',
        description: 'Kisa urun tanitim videosu (15-30sn)',
        type: 'per_unit',
        costRefs: [
          { source: 'staff', roleType: 'junior', timeUnit: 'hours', timeAmount: 3 },
          { source: 'overhead', allocationType: 'per_hour' },
        ],
        unitLabel: 'Video',
        baseQuantity: 0,
        isOptional: true,
        isEditable: true,
        sortOrder: 3,
      },
      {
        id: 'studyo_malzeme',
        name: 'Studyo & Malzeme',
        description: 'Fon, prop ve studyo masrafi',
        type: 'fixed',
        costRefs: [
          { source: 'manual', amount: 750, description: 'Studyo & Malzeme' },
        ],
        isOptional: true,
        isEditable: true,
        sortOrder: 4,
      },
    ],
    minimumPrice: 12000,
    defaultMargin: 0.30,
    complexityMultiplier: 1.0,
    allowQuickQuote: true,
    quickQuoteDefaults: { quantity: 20 },
    icon: 'ShoppingBag',
    color: '#F97316',
    isPopular: true,
    isActive: true,
    sortOrder: 5,
    version: 1,
  },
  {
    name: 'Sosyal Medya Yonetimi',
    description: 'Aylik sosyal medya icerik uretimi, takvim planlama, topluluk yonetimi ve raporlama.',
    shortDescription: 'Aylik sosyal medya paketi',
    category: 'social_media',
    subType: 'full_management',
    tags: ['sosyal-medya', 'instagram', 'icerik', 'yonetim', 'aylik', 'topluluk'],
    components: [
      {
        id: 'icerik_planlama',
        name: 'Icerik Planlama & Strateji',
        description: 'Aylik icerik takvimi ve strateji belirleme',
        type: 'fixed',
        costRefs: [
          { source: 'staff', roleType: 'senior', timeUnit: 'hours', timeAmount: 4 },
          { source: 'overhead', allocationType: 'per_hour' },
        ],
        isOptional: false,
        isEditable: true,
        sortOrder: 1,
      },
      {
        id: 'post_tasarim',
        name: 'Post Tasarimi',
        description: 'Gorsel tasarim ve icerik uretimi (adet bazli)',
        type: 'per_unit',
        costRefs: [
          { source: 'staff', roleType: 'junior', timeUnit: 'hours', timeAmount: 1.5 },
          { source: 'overhead', allocationType: 'per_hour' },
        ],
        unitLabel: 'Post',
        baseQuantity: 12,
        isOptional: false,
        isEditable: true,
        sortOrder: 2,
      },
      {
        id: 'reels_uretimi',
        name: 'Reels / Video Icerik',
        description: 'Kisa video icerik uretimi (adet bazli)',
        type: 'per_unit',
        costRefs: [
          { source: 'staff', roleType: 'junior', timeUnit: 'hours', timeAmount: 2.5 },
          { source: 'overhead', allocationType: 'per_hour' },
        ],
        unitLabel: 'Reels',
        baseQuantity: 4,
        isOptional: true,
        isEditable: true,
        sortOrder: 3,
      },
      {
        id: 'topluluk_yonetimi',
        name: 'Topluluk Yonetimi',
        description: 'Yorum/mesaj yonetimi ve etkilesim (aylik)',
        type: 'fixed',
        costRefs: [
          { source: 'staff', roleType: 'junior', timeUnit: 'hours', timeAmount: 8 },
          { source: 'overhead', allocationType: 'per_hour' },
        ],
        isOptional: false,
        isEditable: true,
        sortOrder: 4,
      },
      {
        id: 'raporlama',
        name: 'Aylik Rapor',
        description: 'Performans raporu ve analiz',
        type: 'fixed',
        costRefs: [
          { source: 'staff', roleType: 'senior', timeUnit: 'hours', timeAmount: 2 },
          { source: 'overhead', allocationType: 'per_hour' },
        ],
        isOptional: false,
        isEditable: false,
        sortOrder: 5,
      },
      {
        id: 'araclar',
        name: 'Tasarim & Planlama Araclari',
        description: 'Canva Pro, planlama araci vb. aylik lisans',
        type: 'fixed',
        costRefs: [
          { source: 'manual', amount: 500, description: 'Yazilim Lisanslari' },
        ],
        isOptional: true,
        isEditable: true,
        sortOrder: 6,
      },
    ],
    minimumPrice: 15000,
    defaultMargin: 0.35,
    complexityMultiplier: 1.0,
    allowQuickQuote: true,
    quickQuoteDefaults: {
      quantity: 12,
      componentOverrides: { reels_uretimi: 4 },
    },
    icon: 'Share2',
    color: '#EC4899',
    isPopular: true,
    isActive: true,
    sortOrder: 6,
    version: 1,
  },
];

// ============================================
// SEED FUNCTION
// ============================================

async function seedServiceTemplates() {
  console.log('Initializing Firebase...');
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('Signing in...');
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('Authenticated.\n');

  const catalogRef = collection(db, 'pricing', 'data', 'serviceCatalog');

  // Check existing templates
  const existingSnapshot = await getDocs(catalogRef);
  const existingNames = new Set(
    existingSnapshot.docs.map((doc) => doc.data().name)
  );

  console.log(`Mevcut sablon sayisi: ${existingSnapshot.size}`);
  if (existingNames.size > 0) {
    console.log('Mevcut sablonlar:', [...existingNames].join(', '));
  }
  console.log('');

  const now = Timestamp.now();
  let added = 0;
  let skipped = 0;

  for (const template of NEW_TEMPLATES) {
    if (existingNames.has(template.name)) {
      console.log(`  [SKIP] "${template.name}" zaten mevcut`);
      skipped++;
      continue;
    }

    const docRef = await addDoc(catalogRef, {
      ...template,
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed-script',
    });

    console.log(`  [OK]   "${template.name}" -> ${docRef.id}`);
    added++;
  }

  console.log(`\nTamamlandi: ${added} eklendi, ${skipped} atlandi.`);
  process.exit(0);
}

seedServiceTemplates().catch((err) => {
  console.error('Hata:', err);
  process.exit(1);
});
