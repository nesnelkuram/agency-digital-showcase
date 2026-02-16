// Migration Script: Add tenantId to all existing Firestore documents
// Run with: node scripts/migrate-add-tenant-id.mjs
//
// This script:
// 1. Creates a 'default' tenant document in the tenants collection
// 2. Adds tenantId: 'default' to all existing documents in tenant-scoped collections
// 3. Updates existing user documents with tenantId: 'default'
//
// Safe to run multiple times (idempotent) - skips documents that already have tenantId

import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';

// Load .env.local file manually
const envFile = readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach((line) => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

// Firebase config
const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID,
};

const DEFAULT_TENANT_ID = 'default';

// All collections that need tenantId
const TENANT_SCOPED_COLLECTIONS = [
  'users',
  'invitations',
  'brand_leads',
  'projects',
  'marketing_campaigns',
  'campaign_proposals',
  'platform_accounts',
  'performance_data',
  'marketing_optimizations',
  'campaign_breakdowns',
  'campaign_ai_analyses',
  'feedback_videos',
  'feedback_comments',
  'feedback_reactions',
  'competitors',
  'competitor_analyses',
  'marketing_reports',
  'utm_links',
  'automation_rules',
  'rule_execution_logs',
  'campaign_templates',
  'ab_tests',
  'marketing_alerts',
  'budget_forecasts',
  'social_media_posts',
  'creatives',
  'approvals',
  'activityLog',
  'assets',
  'assetFolders',
];

async function migrate() {
  console.log('='.repeat(60));
  console.log('  Multi-Tenant Migration: Add tenantId to existing data');
  console.log('='.repeat(60));
  console.log();

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // Step 1: Create default tenant
  console.log('[1/3] Creating default tenant...');
  const tenantRef = doc(db, 'tenants', DEFAULT_TENANT_ID);
  const tenantSnap = await getDoc(tenantRef);

  if (tenantSnap.exists()) {
    console.log('  -> Default tenant already exists, skipping.');
  } else {
    await setDoc(tenantRef, {
      name: 'intiba',
      slug: 'default',
      status: 'active',
      settings: {
        maxUsers: 50,
        allowedFeatures: ['all'],
        branding: {
          companyName: 'intiba',
        },
        timezone: 'Europe/Istanbul',
        currency: 'TRY',
      },
      metadata: {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'migration-script',
      },
    });
    console.log('  -> Default tenant created successfully.');
  }

  // Step 2: Migrate collections
  console.log();
  console.log('[2/3] Migrating collections...');
  console.log();

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const collectionName of TENANT_SCOPED_COLLECTIONS) {
    process.stdout.write(`  ${collectionName.padEnd(30)}`);

    try {
      const snapshot = await getDocs(collection(db, collectionName));

      if (snapshot.empty) {
        console.log('(empty)');
        continue;
      }

      let updated = 0;
      let skipped = 0;

      // Process in batches of 500 (Firestore batch limit)
      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += 500) {
        const batchDocs = docs.slice(i, i + 500);
        const batch = writeBatch(db);
        let batchCount = 0;

        for (const docSnap of batchDocs) {
          const data = docSnap.data();

          // Skip if already has tenantId
          if (data.tenantId) {
            skipped++;
            continue;
          }

          batch.update(doc(db, collectionName, docSnap.id), {
            tenantId: DEFAULT_TENANT_ID,
          });
          batchCount++;
          updated++;
        }

        if (batchCount > 0) {
          await batch.commit();
        }
      }

      console.log(
        `${docs.length} docs | ${updated} updated | ${skipped} skipped`
      );
      totalUpdated += updated;
      totalSkipped += skipped;
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      totalErrors++;
    }
  }

  // Step 3: Summary
  console.log();
  console.log('[3/3] Migration complete!');
  console.log('='.repeat(60));
  console.log(`  Total documents updated:  ${totalUpdated}`);
  console.log(`  Total documents skipped:  ${totalSkipped}`);
  console.log(`  Total collection errors:  ${totalErrors}`);
  console.log(`  Default tenant ID:        ${DEFAULT_TENANT_ID}`);
  console.log('='.repeat(60));

  process.exit(totalErrors > 0 ? 1 : 0);
}

migrate().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
