/**
 * Kiralık Kamera 7/24 — Ekipman Kataloğu Seeder
 * Tüm kategorilerdeki ürünleri Firestore rental_catalog'a yazar
 * Çalıştır: node scripts/seed-kiralikkamera724.mjs
 */

import https from 'https';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Firebase Admin init ───────────────────────────────────────────────────────
const PROJECT_ID = 'intiba-ab4bd';

// 1) Service account dosyası varsa kullan
const saFiles = ['./firebase-service-account.json', './service-account.json'];
const saFile = saFiles.find(f => existsSync(f));

if (saFile) {
  const sa = JSON.parse(readFileSync(saFile, 'utf8'));
  initializeApp({ credential: cert(sa) });
  console.log(`✓ Service account ile auth: ${saFile}`);
} else {
  // 2) Firebase CLI ADC credentials (~/.config/firebase/*_application_default_credentials.json)
  const adcDir = `${homedir()}/.config/firebase`;
  let adcFile;
  if (existsSync(adcDir)) {
    const { readdirSync } = await import('fs');
    adcFile = readdirSync(adcDir).find(f => f.endsWith('_application_default_credentials.json'));
    if (adcFile) adcFile = `${adcDir}/${adcFile}`;
  }

  if (adcFile && existsSync(adcFile)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = adcFile;
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
    console.log(`✓ Firebase CLI ADC ile auth: ${adcFile}`);
  } else {
    console.error('Auth credentials bulunamadı. Şunu çalıştır: firebase login');
    process.exit(1);
  }
}
const db = getFirestore();
const COLLECTION = 'rental_catalog';
const BASE_URL = 'https://kiralikkamera724.com';
const SOURCE = 'kiralikkamera724';

// ── Kategoriler ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { slug: 'kameralar',      label: 'Kameralar' },
  { slug: 'lensler',        label: 'Lensler' },
  { slug: 'filtreler',      label: 'Filtreler' },
  { slug: 'wirelesslar',    label: 'Wireless' },
  { slug: 'isiklar',        label: 'Işıklar' },
  { slug: 'sesler',         label: 'Ses' },
  { slug: 'aksesuarlar',    label: 'Aksesuarlar' },
  { slug: 'monitorler',     label: 'Monitörler' },
  { slug: 'destekleyiciler',label: 'Destekleyiciler' },
  { slug: 'stabilizerler',  label: 'Stabilizerler' },
  { slug: 'dronelar',       label: 'Dronelar' },
];

// ── HTTP helper ───────────────────────────────────────────────────────────────
function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchHTML(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── HTML Parser ───────────────────────────────────────────────────────────────
function parseProducts(html, category, categoryLabel) {
  const products = [];

  // 1) Deduplicated product detail hrefs
  const hrefSet = new Set();
  for (const m of html.matchAll(/href="(\/(?:kameralar|lensler|filtreler|wirelesslar|isiklar|sesler|aksesuarlar|monitorler|destekleyiciler|stabilizerler|dronelar)\/[^"]+)"/g)) {
    hrefSet.add(m[1]);
  }
  const hrefs = [...hrefSet];

  // 2) Unique product images from /dimg/urun/ (preserves order of first appearance)
  const imgSet = new Set();
  for (const m of html.matchAll(/src="(\/dimg\/urun\/[^"]+)"/g)) imgSet.add(m[1]);
  const imgs = [...imgSet];

  // 3) Names from alt attributes on urun images (same count as imgs)
  const names = [];
  for (const m of html.matchAll(/src="\/dimg\/urun\/[^"]+" alt="([^"]+)"/g)) names.push(m[1]);

  // 4) "1 gün" prices only — avoids 3-gün / haftalık prices
  const prices = [];
  for (const m of html.matchAll(/1 gün:<br>\s*([\d\.]+)\s*<span/g)) {
    prices.push(parseInt(m[1].replace(/\./g, ''), 10));
  }

  for (let i = 0; i < hrefs.length && i < prices.length; i++) {
    const href = hrefs[i];
    const slug = href.split('/').pop();
    const price = prices[i];
    const imgSrc = imgs[i] || '';

    let name = names[i] || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    products.push({
      id: `kk724_${slug}`,
      name,
      slug,
      category: category.slug,
      categoryLabel,
      dailyPrice: price,
      imageUrl: imgSrc ? `${BASE_URL}${imgSrc}` : '',
      sourceUrl: `${BASE_URL}${href}`,
      source: SOURCE,
      isActive: true,
    });
  }

  return products;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Check existing source items to avoid duplicates
  const existingSnap = await db.collection(COLLECTION).where('source', '==', SOURCE).get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));
  console.log(`Mevcut kiralikkamera724 kayıtları: ${existingIds.size}`);

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const cat of CATEGORIES) {
    console.log(`\n[${cat.label}] çekiliyor...`);
    const url = `${BASE_URL}/kiralik/${cat.slug}`;

    let html;
    try {
      html = await fetchHTML(url);
    } catch (e) {
      console.warn(`  ⚠ Hata: ${e.message}`);
      await sleep(500);
      continue;
    }

    const products = parseProducts(html, cat, cat.label);
    console.log(`  ${products.length} ürün bulundu`);

    // Batch write
    let batch = db.batch();
    let batchCount = 0;

    for (const product of products) {
      if (existingIds.has(product.id)) {
        totalSkipped++;
        continue;
      }
      const ref = db.collection(COLLECTION).doc(product.id);
      batch.set(ref, { ...product, createdAt: new Date() });
      batchCount++;
      totalAdded++;

      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) await batch.commit();
    console.log(`  ✓ ${products.length - totalSkipped % products.length} yeni eklendi`);

    await sleep(300);
  }

  console.log(`\n✅ Tamamlandı: ${totalAdded} yeni eklendi, ${totalSkipped} zaten mevcuttu`);
  process.exit(0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
