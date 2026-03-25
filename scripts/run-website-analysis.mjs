/**
 * Run actual pipeline website analysis on designfloor.com.tr
 * Uses fetchAndParseWebsite + runDigitalPresenceAnalyzer from pipeline bundle
 * Crawls homepage + all navigation sub-pages
 * Updates Firestore with real agent output
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// --- Load .env.local ---
try {
  const envContent = readFileSync(path.join(ROOT, '.env.local'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  }
  console.log('[env] Loaded .env.local');
} catch (e) {
  // also try .env.vercel-pulled
  try {
    const envContent = readFileSync(path.join(ROOT, '.env.vercel-pulled'), 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
    console.log('[env] Loaded .env.vercel-pulled');
  } catch (e2) {
    console.warn('[env] Could not load env files:', e2.message);
  }
}

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not set');
  process.exit(1);
}
console.log('[env] GEMINI_API_KEY:', process.env.GEMINI_API_KEY.slice(0, 8) + '...');

// --- Import pipeline bundle ---
console.log('[pipeline] Importing pipeline bundle...');
const bundle = await import(path.join(ROOT, 'api/_bundles/pipeline-bundle.mjs') + '?t=' + Date.now());
const { fetchAndParseWebsite, runDigitalPresenceAnalyzer } = bundle;
console.log('[pipeline] Bundle loaded ✓');

// --- Website URL and business info ---
const WEBSITE_URL = 'https://designfloor.com.tr/';
const BUSINESS_NAME = 'Design Floor';
const SECTOR = 'showroom';
const LEAD_ID = 'XRACiFwJgI0j72SeYFtO';

// --- Agent crawls all pages automatically ---
console.log('\n[scraper] Running fetchAndParseWebsite agent (multi-page crawl)...');
const enrichedWebsiteData = await fetchAndParseWebsite(WEBSITE_URL);

if (!enrichedWebsiteData) {
  console.error('❌ fetchAndParseWebsite returned null');
  process.exit(1);
}

console.log('\n[analysis] Agent crawl summary:');
console.log(`  Pages scraped: ${enrichedWebsiteData.pagesScraped?.length || 1}`);
console.log(`  Pages: ${enrichedWebsiteData.pagesScraped?.join(', ')}`);
console.log(`  Products found: ${enrichedWebsiteData.productListings.length}`);
console.log(`  Products with price: ${enrichedWebsiteData.productListings.filter(p => p.price).length}`);
console.log(`  Headings found: ${enrichedWebsiteData.headings.length}`);
console.log(`  CTAs found: ${enrichedWebsiteData.ctaButtons.length}`);
console.log(`  Text content: ${enrichedWebsiteData.textContent.length} chars`);
console.log('  Sample priced products:');
enrichedWebsiteData.productListings.filter(p => p.price).slice(0, 5).forEach(p =>
  console.log(`    - ${p.name.slice(0, 50)} | ${p.price}`)
);

writeFileSync(path.join(ROOT, 'designfloor-scrape-raw.json'), JSON.stringify(enrichedWebsiteData, null, 2));
console.log('\n[io] Raw scrape saved to designfloor-scrape-raw.json');

// --- Run digital presence analyzer ---
console.log('\n[analyzer] Running runDigitalPresenceAnalyzer...');

const normalizedData = {
  businessName: BUSINESS_NAME,
  sector: SECTOR,
  brandName: BUSINESS_NAME,
  contactName: 'Aslan Yapı',
  email: '',
  phone: '',
  description: 'Premium zemin kaplama ve parke showroom',
};

const businessContext = {
  websiteUrl: WEBSITE_URL,
  instagramHandle: 'designfloorcemilay',
  instagramFollowers: '1000-5000',
  digitalPresence: ['instagram', 'website'],
};

const researchFindings = null; // Will rely on grounding

try {
  const digitalPresence = await runDigitalPresenceAnalyzer(
    normalizedData,
    researchFindings,
    businessContext,
    enrichedWebsiteData,
  );

  console.log('\n[analyzer] ✅ Analysis complete!');
  console.log('  Overall digital score:', digitalPresence.overallDigitalScore);
  console.log('  Digital maturity:', digitalPresence.digitalMaturityLevel);
  console.log('  Website status:', digitalPresence.website?.status);
  console.log('  Website designQuality:', digitalPresence.website?.designQuality);
  console.log('  Products found:', digitalPresence.website?.products?.length);
  console.log('  Critical gaps:', digitalPresence.criticalGaps?.slice(0, 3));
  console.log('  Quick wins:', digitalPresence.quickWins?.slice(0, 3));

  // Save analysis result
  const outPath = path.join(ROOT, 'designfloor-digital-analysis.json');
  writeFileSync(outPath, JSON.stringify(digitalPresence, null, 2));
  console.log(`\n[io] Analysis saved to designfloor-digital-analysis.json`);

  // --- Update Firestore ---
  console.log('\n[firestore] Updating Firestore...');

  // Try to load Firebase Admin
  let serviceAccount = null;
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    try {
      const unescaped = saJson.replace(/\\n/g, '\n');
      serviceAccount = JSON.parse(unescaped);
      console.log('[firestore] Service account loaded from env var');
    } catch (e) {
      console.warn('[firestore] Failed to parse service account JSON:', e.message);
    }
  }

  if (serviceAccount) {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    const db = getFirestore();

    // Update the aiAnalysis.digitalPresence field
    const docRef = db.collection('brand_leads').doc(LEAD_ID);
    await docRef.update({
      'aiAnalysis.digitalPresence': digitalPresence,
      'aiAnalysis._websiteAnalysisRunAt': new Date().toISOString(),
      'aiAnalysis._pagesScraped': enrichedWebsiteData._pagesScraped,
    });

    console.log(`[firestore] ✅ Updated brand_leads/${LEAD_ID}`);
    console.log(`[firestore] Set digitalPresence.overallDigitalScore = ${digitalPresence.overallDigitalScore}`);
  } else {
    console.warn('[firestore] ⚠️  No service account — skipping Firestore update');
    console.warn('[firestore] Run manually: copy designfloor-digital-analysis.json content to Firestore');
  }

  console.log('\n✅ Done!');
} catch (error) {
  console.error('\n❌ Analysis failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
