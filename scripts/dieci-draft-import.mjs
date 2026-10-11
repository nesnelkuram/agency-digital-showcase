#!/usr/bin/env node
/**
 * Dieci 12–18 Ekim taslağını native Studio kayıtları olarak idempotent aktarır.
 *   Dry-run (varsayılan; kimlik gerekmez, hiçbir şey yazılmaz):
 *     node scripts/dieci-draft-import.mjs --tenant <id> --project <id> --originals-dir <dir>
 *   Yazma (yalnız --apply; kimlik ortamdan GOOGLE_APPLICATION_CREDENTIALS ile; .env okunmaz):
 *     GOOGLE_APPLICATION_CREDENTIALS=<json> node scripts/dieci-draft-import.mjs --apply --tenant ... --project ... --originals-dir ...
 * Yazılanlar: content_plans (1, draft) + social_media_posts (9, draft) + Storage social-media-drafts/... (token'sız, özel).
 * Mevcut farklı içerikli kayıt varsa hiçbir şey yazılmaz/ezilmez. Aynı içerik varsa atlanır.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { buildNativeRecords, validateNative, verifyFiles, sha256Hex, PLAN_COLLECTION, POST_COLLECTION } from './lib/dietiDraftImport.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const DELIVERY = '/Users/intiba/Documents/Codex/2026-10-09/task/dieci-weekly-pilot-2026-10-12';
const planPath = args.plan || path.join(DELIVERY, 'plan-2026-10-12-18.json');
const manifestPath = args.manifest || path.join(DELIVERY, 'dieci-selected-originals', 'manifest.json');
const previewsDir = args['previews-dir'] || path.join(DELIVERY, 'web-previews');
const originalsDir = args['originals-dir'];
const reportPath = args.report || path.join(DELIVERY, 'import-dryrun-report.json');
const tenantId = args.tenant;
const projectId = args.project;
const apply = args.apply === true;

const fail = (msg) => { console.error(msg); process.exit(1); };
if (!tenantId || !projectId) fail('--tenant ve --project zorunlu.');
if (!originalsDir) fail('--originals-dir zorunlu.');

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const thumbnails = {};
for (const m of manifest.items) {
  const pp = path.join(previewsDir, `${m.asset_id}.jpg`);
  if (fs.existsSync(pp)) thumbnails[m.asset_id] = `data:image/jpeg;base64,${fs.readFileSync(pp).toString('base64')}`;
}
const { planId, planKey, planDoc, posts, storage } = buildNativeRecords({ plan, manifest, tenantId, projectId, thumbnails });
const validation = validateNative({ plan, manifest, planDoc, posts });
const nodeSha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const files = verifyFiles({ manifest, hashFn: nodeSha, readFile: (n) => (fs.existsSync(path.join(originalsDir, n)) ? fs.readFileSync(path.join(originalsDir, n)) : null) });
const previewsOk = storage.every((s) => fs.existsSync(path.join(previewsDir, `${s.assetId}.jpg`)));

const report = {
  mode: apply ? 'apply-requested' : 'dry-run',
  generatedAt: new Date().toISOString(),
  target: { tenantId, projectId, planKey, planCollection: PLAN_COLLECTION, postCollection: POST_COLLECTION, planId },
  validation,
  originalsVerified: files.ok,
  originalsMismatches: files.mismatches,
  previewsVerified: previewsOk,
  plan: { id: planDoc.id, title: planDoc.title, status: planDoc.status, shareToken: planDoc.shareToken, postCount: planDoc.postIds.length },
  posts: posts.map((p) => ({
    id: p.id, day: p.title.split(' · ')[0], frame: p.importRef.frame, assetId: p.media[0].id, origName: p.importRef.origName,
    caption: p.caption, postType: p.postType, status: p.status, storagePath: p.media[0].storagePath,
    previewStoragePath: p.media[0].previewStoragePath, contentHash: p.contentHash,
  })),
  notes: ['Dry-run: hiçbir canlı yazım yapılmadı, kimlik bilgisi okunmadı.', 'scheduledAt yazılmaz; saat uydurulmaz.', 'Paylaşım tokenı üretilmez.'],
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`rapor: ${reportPath}`);
console.log(`plan: ${planId} (draft) · post: ${posts.length} · doğrulama: ${validation.ok ? 'tamam' : 'SORUN VAR'} · orijinal sha256: ${files.ok ? 'tamam' : 'uyuşmazlık'} · önizleme: ${previewsOk ? 'tamam' : 'eksik'}`);
if (!validation.ok) console.log('sorunlar:', validation.problems);
if (!apply) process.exit(validation.ok && files.ok && previewsOk ? 0 : 2);
if (!validation.ok || !files.ok || !previewsOk) fail('Doğrulama geçmedi; yazma yapılmadı.');

// ---- Yazma yolu (yalnız --apply). Kimlik ortamdan; dosya okunmaz.
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) fail('GOOGLE_APPLICATION_CREDENTIALS ayarlı değil; yazma yapılmadı.');
const admin = createRequire(import.meta.url)('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();
const bucket = admin.storage().bucket();
const Timestamp = admin.firestore.Timestamp;

const projSnap = await db.doc(`projects/${projectId}`).get();
if (!projSnap.exists || projSnap.data().tenantId !== tenantId) fail('Proje yok veya tenant eşleşmiyor; yazma yapılmadı.');

// Önce tüm çakışmalar: farklı içerik varsa hiçbir şey yazılmaz.
const planRef = db.collection(PLAN_COLLECTION).doc(planId);
const postRefs = posts.map((p) => db.collection(POST_COLLECTION).doc(p.id));
const snaps = await db.getAll(planRef, ...postRefs);
const conflicts = [];
const toCreate = [];
snaps.forEach((snap, i) => {
  const rec = i === 0 ? planDoc : posts[i - 1];
  if (!snap.exists) toCreate.push({ ref: i === 0 ? planRef : postRefs[i - 1], rec });
  else if (snap.data().contentHash !== rec.contentHash) conflicts.push(snap.ref.path);
});
if (conflicts.length) fail(`Farklı içerikli mevcut kayıtlar var; hiçbiri ezilmedi: ${conflicts.join(', ')}`);

const toTs = (rec) => {
  const { weekStartISO, weekEndISO, contentHash, ...rest } = rec;
  const out = { ...rest, contentHash };
  if (weekStartISO) { out.weekStartDate = Timestamp.fromDate(new Date(weekStartISO)); out.weekEndDate = Timestamp.fromDate(new Date(weekEndISO)); }
  return out;
};
const now = admin.firestore.FieldValue.serverTimestamp();

// Depolama: token'sız, write-once (ifGenerationMatch 0); herkese açık ACL yok.
for (const s of storage) {
  const orig = fs.readFileSync(path.join(originalsDir, s.origName));
  const prev = fs.readFileSync(path.join(previewsDir, `${s.assetId}.jpg`));
  for (const [dest, buf] of [[s.origPath, orig], [s.prevPath, prev]]) {
    await bucket.file(dest).save(buf, { resumable: false, contentType: 'image/jpeg', metadata: { cacheControl: 'private, no-store' }, preconditionOpts: { ifGenerationMatch: 0 } })
      .catch((e) => { if (e.code !== 412) throw e; });
  }
}
const batch = db.batch();
for (const { ref, rec } of toCreate) batch.create(ref, { ...toTs(rec), createdAt: now, updatedAt: now });
await batch.commit();
const done = { plan: planId, createdPlan: toCreate.some((c) => c.ref.path === planRef.path), createdPosts: toCreate.filter((c) => c.ref.path !== planRef.path).map((c) => c.ref.id), alreadyPresent: snaps.length - toCreate.length };
fs.writeFileSync(reportPath.replace(/\.json$/, '.apply.json'), JSON.stringify(done, null, 2));
console.log(`yazıldı: plan ${done.createdPlan ? 1 : 0}, post ${done.createdPosts.length}; zaten aynı olan: ${done.alreadyPresent}`);
