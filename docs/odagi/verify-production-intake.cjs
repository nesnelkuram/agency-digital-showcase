// Explicit opt-in only. Submits one synthetic application, verifies persistence,
// and deletes only that exact test record and its unique email quota afterward.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { parse } = require('dotenv');
const { initializeApp, cert, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { chromium } = require('/Users/intiba/Documents/AIprojects/dome/node_modules/playwright');

if (process.env.ODAGI_REAL_SUBMISSION_TEST !== '1') throw new Error('Requires explicit ODAGI_REAL_SUBMISSION_TEST=1.');
if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error('This check is for the deployed production database.');
const base = process.env.ODAGI_TEST_BASE;
if (!base || !/^https:\/\/(www\.intiba\.co\.uk|v0-intiba-website-[a-z0-9]+-info-intibacouks-projects\.vercel\.app)$/.test(base)) throw new Error('An explicit Intiba deployment URL is required.');
const root = path.resolve(__dirname, '../..');
const env = parse(fs.readFileSync(path.join(root, '.env.vercel-pulled')));
let serviceAccount;
try { serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT); }
catch { serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT.replace(/("private_key"\s*:\s*")([\s\S]*?)(")/, (_, a, b, c) => a + b.replace(/\r/g, '').replace(/\n/g, '\\n') + c)); }
assert.equal(serviceAccount.project_id, 'intiba-ab4bd');
const app = initializeApp({ credential: cert(serviceAccount) }, 'odagi-live-check');
const db = getFirestore(app);
const email = `odagi-verification-${randomUUID()}@example.invalid`;
const report = { base, checkedAt: new Date().toISOString(), checks: [], syntheticApplicationCount: 0, cleanupVerified: false, realEmailsSent: 0 };
const check = name => report.checks.push({ name, passed: true });
let submitted;
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && request.url() === base + '/api/odagi/applications') submitted = request.postDataJSON();
  });
  try {
    assert.equal((await page.goto(base + '/odagi/', { waitUntil: 'networkidle' })).status(), 200);
    const initialURL = page.url();
    for (const [id, value] of Object.entries({ city: 'İstanbul', district: 'Kadıköy', area: '12.5' })) await page.locator('#' + id).fill(value);
    await page.locator('#continue-application').click();
    for (const [name, value] of Object.entries({ name: 'Odağı Teknik Doğrulama', email, neighborhood: 'Teknik test alanı', occupation: 'Yazılım doğrulama' })) await page.locator(`[name="${name}"]`).fill(value);
    await page.locator('[name="employed"][value="yes"]').check();
    await page.locator('[name="company"][value="none"]').check();
    await page.locator('#application-next').click();
    for (const name of ['ownsSpace', 'packingSpace']) await page.locator(`[name="${name}"][value="yes"]`).check();
    for (const name of ['petSmoke', 'roomConditions']) await page.locator(`[name="${name}"][value="clear"]`).check();
    await page.locator('[name="roomInfo"]').fill('Otomatik teknik doğrulama kaydı; işlem sonunda silinir. Gerçek başvuru değildir.');
    await page.locator('#application-next').click();
    await page.locator('[name="daytimeAvailable"][value="yes"]').check();
    await page.locator('[name="couriers"]').fill('Teknik test; gerçek kargo teslimatı talep edilmez.');
    await page.locator('[name="investment"][value="no"]').check();
    await page.locator('[name="income"][value="5-25"]').check();
    await page.locator('#application-next').click();
    await page.locator('[name="applicationConsent"]').check();
    const pending = page.waitForResponse(response => response.url() === base + '/api/odagi/applications' && response.request().method() === 'POST');
    await page.locator('#application-next').click();
    const response = await pending;
    const body = await response.json();
    assert.equal(response.status(), 201, 'The server must commit the synthetic application.');
    assert.match(body.reference, /^ODG-[A-F0-9]{12}$/);
    await page.locator('#application-success').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#application-reference').textContent(), body.reference);
    assert.equal(page.url(), initialURL);
    assert.equal(context.pages().length, 1);
    report.syntheticApplicationCount = 1;
    check('live_mobile_form_completes_inside_site_with_server_receipt');
    const ref = db.collection('odagi_applications').doc(submitted.requestId);
    const data = (await ref.get()).data();
    assert.ok(data, 'The application must exist in Firestore.');
    assert.equal(data.email, email);
    assert.equal(data.reference, body.reference);
    assert.equal(data.area, 12.5);
    assert.equal(data.tenantId, 'intiba');
    assert.equal(data.source, 'odagi-web');
    assert.equal(data.applicationConsent, true);
    assert.equal(data.noticeVersion, '2026-09-12-v2');
    assert.equal(data.ip, undefined);
    assert.equal(data.website, undefined);
    check('complete_application_and_consent_are_durably_stored');
    const duplicate = await page.evaluate(async payload => {
      const r = await fetch('/api/odagi/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return { status: r.status, body: await r.json() };
    }, submitted);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.reference, body.reference);
    assert.equal((await db.collection('odagi_applications').where('email', '==', email).get()).size, 1);
    check('live_retry_returns_same_reference_without_duplicate_record');
    const unauthorized = await context.request.get(base + '/api/odagi/applications');
    assert.equal(unauthorized.status(), 401);
    const denied = await fetch(`https://firestore.googleapis.com/v1/projects/intiba-ab4bd/databases/(default)/documents/odagi_applications/${submitted.requestId}`);
    assert.equal(denied.status, 403);
    check('anonymous_api_and_direct_database_reads_are_denied');
    assert.deepEqual(errors, []);
    check('no_javascript_exceptions');
  } finally {
    if (submitted?.requestId) {
      const ref = db.collection('odagi_applications').doc(submitted.requestId);
      const snapshot = await ref.get();
      if (snapshot.exists) {
        assert.equal(snapshot.data().email, email, 'Cleanup must only remove this exact synthetic record.');
        await ref.delete();
      }
      const day = Math.floor(Date.now() / 86400000);
      for (const date of [day - 1, day, day + 1]) {
        const hash = createHash('sha256').update(`${date}:${email}`).digest('hex');
        await db.collection('odagi_intake_limits').doc(`email-${hash}-${date}`).delete();
      }
      report.cleanupVerified = !(await ref.get()).exists;
      assert.equal(report.cleanupVerified, true);
    }
    fs.writeFileSync('/tmp/odagi-native-runtime.json', JSON.stringify(report, null, 2));
    await browser.close();
    await db.terminate();
    await deleteApp(app);
  }
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
