/**
 * Kiralacek.co Ekipman Katalog Seeder
 *
 * kiralacek.co sitesindeki tum urunleri cekip Firestore'a yazar.
 * Calistirmak icin: DOTENV_CONFIG_PATH=.env.local npx tsx scripts/seed-rental-catalog.ts
 *
 * Gerekli env: FIREBASE_SERVICE_ACCOUNT (JSON string) veya .env.local
 */

import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import * as https from 'https';

config({ path: '.env.local' });

// ─── Firebase Admin ────────────────────────────────────────────────────────────

function initAdmin() {
  if (getApps().length > 0) return;
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saJson) {
    const sa = JSON.parse(saJson) as ServiceAccount;
    initializeApp({ credential: cert(sa) });
  } else {
    // Fallback: try GOOGLE_APPLICATION_CREDENTIALS or default
    initializeApp();
  }
}

initAdmin();
const db = getFirestore();

// ─── Kategori haritasi ────────────────────────────────────────────────────────

const CATEGORIES: Record<string, string> = {
  kamera: 'Kamera',
  lens: 'Lens',
  isik: 'Işık',
  'isik-aksesuari': 'Işık Aksesuarı',
  ses: 'Ses',
  filtre: 'Filtre',
  monitor: 'Monitör',
  kurgu: 'Görüntü Aktarıcı',
  drone: 'Drone',
  produksiyon: 'Prodüksiyon',
  sabitleyiciler: 'Sabitleyici',
  batarya: 'Batarya',
  depolama: 'Depolama',
  yayin: 'Yayın',
  eglence: 'Eğlence',
  ekip: 'Ekip',
  cevirici: 'Çevirici',
  focus: 'Kamera Aksesuarı',
  'diger-aksesuar': 'Diğer',
};

// ─── HTTP fetch ───────────────────────────────────────────────────────────────

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      },
      agent,
    };
    const req = https.get(url, options, (res) => {
      let data = '';
      res.setTimeout(8000, () => { res.destroy(); reject(new Error(`Read timeout: ${url}`)); });
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.setTimeout(8000, () => { req.destroy(); reject(new Error(`Connect timeout: ${url}`)); });
    req.on('error', reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function extractSlugName(html: string): [string, string][] {
  const pairs: [string, string][] = [];
  const regex = /<a[^>]+href="\/products\/([a-z0-9\-]+)"[^>]*>\s*([^<]{3,120})\s*<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const name = m[2].trim();
    if (name && !name.startsWith('http')) {
      pairs.push([m[1], name]);
    }
  }
  return pairs;
}

function extractPrice(html: string): number {
  const m = html.match(/price:\s*([\d.]+)/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

function extractImage(html: string): string {
  const m = html.match(/src="(https:\/\/images\.booqablecdn\.com\/(?!w\d)[^"]+(?:jpg|jpeg|png|webp)[^"]*)"/i);
  if (m) return m[1];
  const m2 = html.match(/src="(https:\/\/images\.booqablecdn\.com\/[^"]+)"/i);
  return m2 ? m2[1] : '';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Kiralacek.co katalog taranıyor...\n');

  // Step 1: Kategori → slug map
  const slugToCategory: Record<string, { slug: string; label: string }> = {};
  for (const [catSlug, catLabel] of Object.entries(CATEGORIES)) {
    const url = `https://kiralacek.co/collections/${catSlug}`;
    try {
      const html = await fetchUrl(url);
      const pairs = extractSlugName(html);
      for (const [slug] of pairs) {
        if (!slugToCategory[slug]) slugToCategory[slug] = { slug: catSlug, label: catLabel };
      }
      console.log(`  ✓ ${catLabel}: ${pairs.length} ürün`);
    } catch (e) {
      console.error(`  ✗ ${catLabel}: ${e}`);
    }
    await sleep(200);
  }

  // Step 2: Tüm ürünler
  const allProducts: Map<string, string> = new Map();
  for (let page = 1; page <= 8; page++) {
    const url = page === 1
      ? 'https://kiralacek.co/collections/all'
      : `https://kiralacek.co/collections/all?page=${page}`;
    try {
      const html = await fetchUrl(url);
      const pairs = extractSlugName(html);
      if (pairs.length < 5) break;
      for (const [slug, name] of pairs) {
        if (!allProducts.has(slug)) allProducts.set(slug, name);
      }
      console.log(`  Sayfa ${page}: ${pairs.length} ürün (toplam: ${allProducts.size})`);
    } catch (e) {
      console.error(`  Sayfa ${page}: ${e}`);
      break;
    }
    await sleep(200);
  }

  console.log(`\n📦 Toplam ${allProducts.size} ürün bulundu. Fiyat ve görsel çekiliyor...\n`);

  // Step 3: Ürün detayları
  interface ProductData {
    slug: string;
    name: string;
    category: string;
    categoryLabel: string;
    dailyPrice: number;
    imageUrl: string;
    sourceUrl: string;
    isActive: boolean;
    createdAt: Timestamp;
  }

  const products: ProductData[] = [];
  let i = 0;

  for (const [slug, name] of allProducts.entries()) {
    i++;
    const catInfo = slugToCategory[slug] || { slug: 'diger-aksesuar', label: 'Diğer' };
    const url = `https://kiralacek.co/products/${slug}`;
    try {
      const html = await fetchUrl(url);
      const price = extractPrice(html);
      const image = extractImage(html);
      products.push({
        slug, name,
        category: catInfo.slug,
        categoryLabel: catInfo.label,
        dailyPrice: price,
        imageUrl: image,
        sourceUrl: url,
        isActive: true,
        createdAt: Timestamp.now(),
      });
      console.log(`  [${i}/${allProducts.size}] ${name} — ${price} TL/gün`);
    } catch (e) {
      console.error(`  ✗ [${i}] ${slug}: ${e}`);
      // Add with 0 price so it still appears in catalog
      products.push({
        slug, name,
        category: catInfo.slug,
        categoryLabel: catInfo.label,
        dailyPrice: 0,
        imageUrl: '',
        sourceUrl: url,
        isActive: true,
        createdAt: Timestamp.now(),
      });
    }
    await sleep(200);
  }

  console.log(`\n💾 Firestore'a yazılıyor...`);

  // Step 4: Mevcut kayıtları temizle
  const existing = await db.collection('rental_catalog').get();
  console.log(`  Mevcut ${existing.size} kayıt siliniyor...`);
  const batch1 = db.batch();
  for (const d of existing.docs) batch1.delete(d.ref);
  if (existing.size > 0) await batch1.commit();

  // Step 5: Yeni kayıtlar (batch yazma, 500'lük gruplar)
  const BATCH_SIZE = 400;
  let written = 0;
  for (let start = 0; start < products.length; start += BATCH_SIZE) {
    const chunk = products.slice(start, start + BATCH_SIZE);
    const batch = db.batch();
    for (const p of chunk) {
      const ref = db.collection('rental_catalog').doc();
      batch.set(ref, p);
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  ${written}/${products.length} yazıldı`);
  }

  console.log(`\n✅ Tamamlandı! ${written} ürün Firestore'a yazıldı.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Hata:', e);
  process.exit(1);
});
