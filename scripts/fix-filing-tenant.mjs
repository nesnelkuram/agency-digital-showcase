import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'intiba-ab4bd' });
const db = admin.firestore();

async function main() {
  const TARGET_TENANT = 'intiba';

  // Fix filing_templates
  console.log('=== Fixing filing_templates ===');
  const templatesSnap = await db.collection('filing_templates').get();
  for (const doc of templatesSnap.docs) {
    const d = doc.data();
    if (d.tenantId !== TARGET_TENANT) {
      console.log(`  Updating ${doc.id} (name="${d.name}"): tenantId "${d.tenantId}" -> "${TARGET_TENANT}"`);
      await doc.ref.update({ tenantId: TARGET_TENANT });
    } else {
      console.log(`  OK: ${doc.id} already has tenantId="${TARGET_TENANT}"`);
    }
  }

  // Fix filing_projects
  console.log('\n=== Fixing filing_projects ===');
  const projectsSnap = await db.collection('filing_projects').get();
  for (const doc of projectsSnap.docs) {
    const d = doc.data();
    if (d.tenantId !== TARGET_TENANT) {
      console.log(`  Updating ${doc.id} (#${d.projectNumber} "${d.clientName}"): tenantId "${d.tenantId}" -> "${TARGET_TENANT}"`);
      await doc.ref.update({ tenantId: TARGET_TENANT });
    } else {
      console.log(`  OK: ${doc.id} already has tenantId="${TARGET_TENANT}"`);
    }
  }

  // Fix filing_counters
  console.log('\n=== Fixing filing_counters ===');
  const countersSnap = await db.collection('filing_counters').get();
  for (const doc of countersSnap.docs) {
    const d = doc.data();
    console.log(`  Counter ${doc.id}: lastNumber=${d.lastNumber}`);
    if (doc.id === 'default') {
      console.log(`  Copying counter to "${TARGET_TENANT}"`);
      await db.collection('filing_counters').doc(TARGET_TENANT).set(d, { merge: true });
    }
  }

  console.log('\nDone!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
