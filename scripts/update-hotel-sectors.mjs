import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'intiba-ab4bd' });
}
const db = admin.firestore();

async function main() {
  // Find hotel leads and update sector to 'hospitality'
  const snapshot = await db.collection('brand_leads')
    .where('tenantId', '==', 'intiba')
    .get();

  let updated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const biz = data.contact?.businessName || '';
    if (biz.includes('Innova') || biz.includes('Innvista')) {
      await doc.ref.update({ sector: 'hospitality' });
      console.log(`Updated: ${biz} -> hospitality (${doc.id})`);
      updated++;
    }
  }

  console.log(`\nDone. Updated ${updated} leads to hospitality sector.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
