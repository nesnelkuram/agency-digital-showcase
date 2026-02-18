import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'intiba-ab4bd' });
}
const db = admin.firestore();

const TENANT_ID = 'intiba';
const ADMIN_UID = '5GEpIakgzxciA5xBCLP9OEb8Vq23';

async function main() {
  const batch = db.batch();
  let opCount = 0;

  // 1. Create tenant document
  console.log('1. Creating tenant document...');
  const tenantRef = db.collection('tenants').doc(TENANT_ID);
  batch.set(tenantRef, {
    id: TENANT_ID,
    name: 'intiba',
    displayName: 'intiba Digital Agency',
    slug: 'intiba',
    status: 'active',
    plan: 'pro',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: ADMIN_UID,
    settings: {
      currency: 'TRY',
      language: 'tr',
      timezone: 'Europe/Istanbul',
    },
  });
  opCount++;

  // 2. Fix admin user - add tenantId
  console.log('2. Fixing admin user (adding tenantId)...');
  const adminRef = db.collection('users').doc(ADMIN_UID);
  batch.update(adminRef, {
    tenantId: TENANT_ID,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  opCount++;

  // 3. Fix brand_leads - add tenantId to all
  console.log('3. Fixing brand_leads (adding tenantId)...');
  const leadsSnap = await db.collection('brand_leads').get();
  for (const doc of leadsSnap.docs) {
    if (!doc.data().tenantId) {
      batch.update(doc.ref, { tenantId: TENANT_ID });
      opCount++;
      console.log(`   Fixed lead: ${doc.id} (${doc.data().contact?.businessName || 'N/A'})`);
    }
  }

  // 4. Fix pricing subcollections - add tenantId where missing
  console.log('4. Fixing pricing subcollections...');
  const pricingSubcols = ['staff', 'equipment', 'overhead', 'software', 'marketing', 'customers', 'serviceCatalog'];
  for (const subCol of pricingSubcols) {
    const snap = await db.collection('pricing').doc('data').collection(subCol).get();
    for (const doc of snap.docs) {
      if (!doc.data().tenantId) {
        batch.update(doc.ref, { tenantId: TENANT_ID });
        opCount++;
        console.log(`   Fixed pricing/data/${subCol}/${doc.id}`);
      }
    }
  }

  // 5. Fix projects
  console.log('5. Fixing projects...');
  const projectsSnap = await db.collection('projects').get();
  for (const doc of projectsSnap.docs) {
    if (!doc.data().tenantId) {
      batch.update(doc.ref, { tenantId: TENANT_ID });
      opCount++;
      console.log(`   Fixed project: ${doc.id}`);
    }
  }

  // 6. Fix workflow_templates
  console.log('6. Fixing workflow_templates...');
  const wfSnap = await db.collection('workflow_templates').get();
  for (const doc of wfSnap.docs) {
    if (!doc.data().tenantId) {
      batch.update(doc.ref, { tenantId: TENANT_ID });
      opCount++;
      console.log(`   Fixed workflow_template: ${doc.id}`);
    }
  }

  // 7. Fix quotes
  console.log('7. Fixing quotes...');
  const quotesSnap = await db.collection('quotes').get();
  for (const doc of quotesSnap.docs) {
    if (!doc.data().tenantId) {
      batch.update(doc.ref, { tenantId: TENANT_ID });
      opCount++;
      console.log(`   Fixed quote: ${doc.id}`);
    }
  }

  // 8. Fix feedback_videos
  console.log('8. Fixing feedback_videos...');
  const fbSnap = await db.collection('feedback_videos').get();
  for (const doc of fbSnap.docs) {
    if (!doc.data().tenantId) {
      batch.update(doc.ref, { tenantId: TENANT_ID });
      opCount++;
      console.log(`   Fixed feedback: ${doc.id}`);
    }
  }

  // 9. Fix marketing_campaigns
  console.log('9. Fixing marketing_campaigns...');
  const mcSnap = await db.collection('marketing_campaigns').get();
  for (const doc of mcSnap.docs) {
    if (!doc.data().tenantId) {
      batch.update(doc.ref, { tenantId: TENANT_ID });
      opCount++;
      console.log(`   Fixed campaign: ${doc.id}`);
    }
  }

  // 10. Fix filing collections
  console.log('10. Fixing filing collections...');
  for (const colName of ['filing_projects', 'filing_templates', 'filing_counters']) {
    const snap = await db.collection(colName).get();
    for (const doc of snap.docs) {
      if (!doc.data().tenantId) {
        batch.update(doc.ref, { tenantId: TENANT_ID });
        opCount++;
        console.log(`   Fixed ${colName}/${doc.id}`);
      }
    }
  }

  // Commit
  console.log(`\nCommitting ${opCount} operations...`);
  await batch.commit();
  console.log('Done! All documents updated with tenantId:', TENANT_ID);

  // Verify
  console.log('\n=== VERIFICATION ===');
  const verifyUser = await db.collection('users').doc(ADMIN_UID).get();
  console.log('User tenantId:', verifyUser.data()?.tenantId);

  const verifyLeads = await db.collection('brand_leads').where('tenantId', '==', TENANT_ID).get();
  console.log('Leads with tenantId:', verifyLeads.size);

  const verifyTenant = await db.collection('tenants').doc(TENANT_ID).get();
  console.log('Tenant exists:', verifyTenant.exists);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
