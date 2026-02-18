import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'intiba-ab4bd' });
const db = admin.firestore();

async function main() {
  // 1. Check users
  console.log('=== USERS ===');
  const usersSnap = await db.collection('users').get();
  console.log('Total users:', usersSnap.size);
  usersSnap.forEach(doc => {
    const d = doc.data();
    console.log(`  ${doc.id}: role=${d.role || 'MISSING'}, tenantId=${d.tenantId || 'MISSING'}, email=${d.email || 'N/A'}, status=${d.status || 'N/A'}`);
  });

  // 2. Check brand_leads
  console.log('\n=== BRAND_LEADS ===');
  const allLeads = await db.collection('brand_leads').get();
  console.log('Total brand_leads:', allLeads.size);
  const tenantMap = {};
  allLeads.forEach(doc => {
    const tid = doc.data().tenantId || 'NO_TENANT';
    tenantMap[tid] = (tenantMap[tid] || 0) + 1;
  });
  console.log('tenantId distribution:', JSON.stringify(tenantMap, null, 2));

  // Show first 3 leads
  let count = 0;
  allLeads.forEach(doc => {
    if (count >= 3) return;
    const d = doc.data();
    console.log(`  [${doc.id}] tenant=${d.tenantId || 'MISSING'}, biz=${d.contact?.businessName || 'N/A'}, status=${d.status}, hasAI=${!!d.aiAnalysis}`);
    count++;
  });

  // 3. Check training-related collections
  console.log('\n=== TRAINING / SOP RELATED ===');
  const topCols = await db.listCollections();
  for (const col of topCols) {
    if (col.id.includes('training') || col.id.includes('sop') || col.id.includes('resource')) {
      const snap = await col.limit(3).get();
      console.log(`  ${col.id}: ${snap.size} docs (showing limit 3)`);
      snap.forEach(doc => console.log(`    ${doc.id}:`, JSON.stringify(doc.data()).slice(0, 200)));
    }
  }

  // 4. Check pricing subcollections
  console.log('\n=== PRICING SUBCOLLECTIONS ===');
  const pricingDoc = db.collection('pricing').doc('data');
  const subCols = await pricingDoc.listCollections();
  for (const col of subCols) {
    const snap = await col.get();
    console.log(`  pricing/data/${col.id}: ${snap.size} docs`);
  }

  // 5. Check settings
  console.log('\n=== SETTINGS ===');
  const settingsSnap = await db.collection('settings').get();
  settingsSnap.forEach(doc => {
    console.log(`  ${doc.id}:`, JSON.stringify(doc.data()).slice(0, 300));
  });

  // 6. Check tenants collection
  console.log('\n=== TENANTS ===');
  try {
    const tenantsSnap = await db.collection('tenants').get();
    console.log('Total tenants:', tenantsSnap.size);
    tenantsSnap.forEach(doc => {
      console.log(`  ${doc.id}:`, JSON.stringify(doc.data()).slice(0, 300));
    });
  } catch (e) {
    console.log('No tenants collection found');
  }

  // 7. Check filing_templates (all, ignoring tenantId filter)
  console.log('\n=== FILING_TEMPLATES (ALL) ===');
  const filingTemplatesSnap = await db.collection('filing_templates').get();
  console.log('Total filing_templates:', filingTemplatesSnap.size);
  filingTemplatesSnap.forEach(doc => {
    const d = doc.data();
    console.log(`  [${doc.id}] name="${d.name}" tenantId="${d.tenantId || 'MISSING'}" folders=${d.folders?.length || 0} createdAt=${d.createdAt?.toDate?.()?.toISOString?.() || 'N/A'}`);
  });

  // 8. Check filing_projects (all)
  console.log('\n=== FILING_PROJECTS (ALL) ===');
  const filingProjectsSnap = await db.collection('filing_projects').get();
  console.log('Total filing_projects:', filingProjectsSnap.size);
  filingProjectsSnap.forEach(doc => {
    const d = doc.data();
    console.log(`  [${doc.id}] #${d.projectNumber} client="${d.clientName}" tenantId="${d.tenantId || 'MISSING'}"`);
  });

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
