/**
 * Update Firestore with digital presence analysis
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load env files
const envFiles = ['.env.local', '.env.vercel-pulled', '.env.vercel'];
for (const envFile of envFiles) {
  try {
    const content = readFileSync(path.join(ROOT, envFile), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      // Keep full value including embedded quotes (don't strip outer quotes)
      const val = trimmed.slice(eqIdx + 1);
      if (key && !process.env[key]) process.env[key] = val;
    }
    console.log(`[env] Loaded ${envFile}`);
  } catch { }
}

// Load analysis result
const analysis = JSON.parse(readFileSync(path.join(ROOT, 'designfloor-digital-analysis.json'), 'utf-8'));
console.log('[data] Loaded analysis — score:', analysis.overallDigitalScore, ', maturity:', analysis.digitalMaturityLevel);

// Get service account
const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!saRaw) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON not found in env');
  process.exit(1);
}

// Parse service account: strip outer quotes, then replace \n outside strings
function parseServiceAccount(raw) {
  const s = raw.trim().startsWith('"') ? raw.trim().slice(1, -1) : raw.trim();
  // State machine: replace \n (backslash+n) outside JSON strings with real newlines
  let result = '';
  let inStr = false;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') { result += c + s[i+1]; i += 2; continue; }
      if (c === '"') inStr = false;
      result += c;
    } else {
      if (c === '"') { inStr = true; result += c; }
      else if (c === '\\' && s[i+1] === 'n') { result += '\n'; i += 2; continue; }
      else result += c;
    }
    i++;
  }
  return JSON.parse(result);
}

let serviceAccount;
try {
  serviceAccount = parseServiceAccount(saRaw);
  console.log('[sa] Service account loaded for project:', serviceAccount.project_id);
} catch (e) {
  console.error('❌ Failed to parse service account:', e.message);
  process.exit(1);
}

const { initializeApp, cert, getApps } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

const LEAD_ID = 'XRACiFwJgI0j72SeYFtO';
const docRef = db.collection('brand_leads').doc(LEAD_ID);

// Check current state
const snap = await docRef.get();
if (!snap.exists) {
  console.error('❌ Document not found:', LEAD_ID);
  process.exit(1);
}

const current = snap.data();
console.log('[firestore] Current digitalPresence score:', current?.aiAnalysis?.digitalPresence?.overallDigitalScore ?? 'none');

// Update
await docRef.update({
  'aiAnalysis.digitalPresence': analysis,
  'aiAnalysis._websiteAnalysisRunAt': new Date().toISOString(),
  'aiAnalysis._pagesScraped': 10,
});

console.log('[firestore] ✅ Updated brand_leads/' + LEAD_ID);
console.log('[firestore] New score:', analysis.overallDigitalScore, '| Maturity:', analysis.digitalMaturityLevel);
console.log('[firestore] Website impression:', analysis.website?.overallImpression?.slice(0, 100));
process.exit(0);
