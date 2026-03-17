import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'intiba-ab4bd' });
}
const db = admin.firestore();

async function main() {
  // Find DesignFloor lead
  const snap = await db.collection('brand_leads')
    .where('tenantId', '==', 'intiba')
    .where('contact.businessName', '==', 'DesignFloor')
    .limit(1)
    .get();

  if (snap.empty) {
    console.error('DesignFloor lead not found!');
    process.exit(1);
  }

  const doc = snap.docs[0];
  console.log('Found lead:', doc.id);
  console.log('Current businessContext:', JSON.stringify(doc.data().wizard?.businessContext, null, 2));

  // Update businessContext with websiteUrl and instagramHandle
  await doc.ref.update({
    'wizard.businessContext.websiteUrl': 'https://designfloor.com.tr/',
    'wizard.businessContext.instagramHandle': 'designfloor',
  });

  // Verify
  const updated = await doc.ref.get();
  const bc = updated.data().wizard?.businessContext;
  console.log('\n=== UPDATED ===');
  console.log('websiteUrl:', bc.websiteUrl);
  console.log('instagramHandle:', bc.instagramHandle);
  console.log('Lead ID:', doc.id);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
