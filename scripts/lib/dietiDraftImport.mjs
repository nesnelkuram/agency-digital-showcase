/**
 * Dieci taslak import'u — saf mantık (IO yok). Native şema:
 *   content_plans/{planId}            — status 'draft', shareToken '' (paylaşım linki üretilmez), postIds
 *   social_media_posts/{postId}       — status 'draft', contentPlanId, media[].storagePath (token yok)
 *   Storage: social-media-drafts/{tenantId}/{projectId}/{planKey}/{assetId}.jpg (+ .web.jpg önizleme)
 * Kimlikler deterministiktir (idempotent). scheduledAt yazılmaz: plan saat bilgisi içermez.
 */

export const PLAN_COLLECTION = 'content_plans';
export const POST_COLLECTION = 'social_media_posts';
export const DRAFT_STORAGE_ROOT = 'social-media-drafts';
const FORBIDDEN = [
  ['fiyat/para', /(?:\bTL\b|₺|\$|€|£|%|\bfiyat\b)/i],
  ['saat', /\b\d{1,2}[:.]\d{2}\b/],
  ['etkinlik/rezervasyon', /\b(etkinlik|rezervasyon)\b/i],
  ['menü adı', /\b(Ghosting|Lovebombing|Mixed Signals|Red Flag|Diavola|Quattro|Michelin)\b/i],
];
const URLISH = /(https?:\/\/|csig=|osig=|signer=|token=|x-canva)/i;

/** Saf JS SHA-256 (tarayıcı ve Node'da aynı sonuç). Girdi: string (UTF-8) veya Uint8Array. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
export const sha256Hex = (input) => {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const len = data.length;
  const total = (((len + 9 + 63) >> 6) << 6);
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor((len * 8) / 0x100000000), false);
  view.setUint32(total - 4, (len * 8) >>> 0, false);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
};
const hash = (s) => sha256Hex(s).slice(0, 24);

export const parseWeek = (range) => {
  const m = /(\d{4}-\d{2}-\d{2})\s*—\s*(\d{4}-\d{2}-\d{2})/.exec(range || '');
  if (!m) throw new Error('tarih_araligi okunamadı');
  return { weekStart: m[1], weekEnd: m[2] };
};
export const planKeyOf = (weekStart) => `dieci-${weekStart}`;
export const planDocId = ({ tenantId, projectId, planKey }) => 'dsp_' + hash(['v1', 'plan', tenantId, projectId, planKey].join('|'));
export const postDocId = ({ tenantId, projectId, planKey, dayOrder, frame, assetId }) =>
  'dsp_' + hash(['v1', 'post', tenantId, projectId, planKey, dayOrder, frame, assetId].join('|'));

/** İçerik parmak izi: zaman damgası ve parmak izinin kendisi hariç */
export const contentHashOf = (obj) => {
  const { contentHash, createdAt, createdBy, createdByName, ...content } = obj;
  return sha256Hex(JSON.stringify(content, Object.keys(content).sort()));
};

/** Plan + manifest → native plan ve post kayıtları + depolama eşlemesi (IO yok). */
export const buildNativeRecords = ({ plan, manifest, tenantId, projectId, createdBy = 'dieci-import-betik', thumbnails = {} }) => {
  if (!tenantId || !projectId) throw new Error('tenantId ve projectId zorunlu');
  const { weekStart, weekEnd } = parseWeek(plan.tarih_araligi);
  const planKey = planKeyOf(weekStart);
  const planId = planDocId({ tenantId, projectId, planKey });
  const byAsset = new Map(manifest.items.map((m) => [m.asset_id, m]));
  const posts = [];
  const storage = [];
  plan.days.forEach((day, dIdx) => {
    day.items.forEach((it) => {
      const m = byAsset.get(it.asset_id);
      if (!m) throw new Error(`manifest'te yok: ${it.asset_id}`);
      const dayOrder = dIdx + 1;
      const postId = postDocId({ tenantId, projectId, planKey, dayOrder, frame: it.frame, assetId: it.asset_id });
      const origPath = `${DRAFT_STORAGE_ROOT}/${tenantId}/${projectId}/${planKey}/${it.asset_id}.jpg`;
      const prevPath = `${DRAFT_STORAGE_ROOT}/${tenantId}/${projectId}/${planKey}/${it.asset_id}.web.jpg`;
      const post = {
        id: postId,
        tenantId,
        projectId,
        title: `${day.gun} · kare ${it.frame} · ${day.seri}`,
        caption: it.cover_text_tr || '',
        hashtags: [],
        mediaUrls: [],
        libraryAssetIds: [],
        media: [{
          id: it.asset_id,
          url: '',
          type: 'image',
          mimeType: 'image/jpeg',
          size: m.file_size_bytes,
          width: m.width_px,
          height: m.height_px,
          order: 0,
          ...(thumbnails[it.asset_id] ? { thumbnailUrl: thumbnails[it.asset_id] } : {}),
          storagePath: origPath,
          previewStoragePath: prevPath,
        }],
        postType: 'story',
        platforms: ['instagram'],
        status: 'draft',
        contentPlanId: planId,
        internalNotes: [
          `Kanıt: ${it.note_tr}`,
          `Seçim: ${it.secim_gerekcesi}`,
          `Belirsizlik/onay: ${it.belirsizlik_onay}`,
          `Dokuz kapı (öneri): ${(it.dokuz_kapi_oneri || []).join('; ')}`,
          `Register: ${it.register}`,
        ].join('\n'),
        importRef: { planKey, dayOrder, frame: it.frame, assetId: it.asset_id, origName: m.filename, origSha256: m.sha256 },
        createdBy,
      };
      post.contentHash = contentHashOf(post);
      posts.push(post);
      storage.push({ assetId: it.asset_id, origName: m.filename, origSha256: m.sha256, origPath, prevPath });
    });
  });
  const planDoc = {
    id: planId,
    tenantId,
    projectId,
    title: 'Dieci · 12–18 Ekim 2026 · İngilizce pilot (taslak)',
    description: 'Taslak; yayınlanmadı, zamanlanmadı, müşteriye gönderilmedi. Sahip onayı bekliyor. Saat bilgisi yoktur.',
    platform: 'instagram',
    postIds: posts.map((p) => p.id),
    weekStartISO: `${weekStart}T00:00:00+03:00`,
    weekEndISO: `${weekEnd}T23:59:59+03:00`,
    status: 'draft',
    shareToken: '',
    clientComments: [],
    createdBy,
    createdByName: 'Dieci import (betik)',
    importRef: { planKey, source: 'plan-2026-10-12-18.json' },
  };
  planDoc.contentHash = contentHashOf(planDoc);
  return { planId, planKey, planDoc, posts, storage };
};

/** Dry-run doğrulaması. */
export const validateNative = ({ plan, manifest, planDoc, posts }) => {
  const problems = [];
  const info = { days: plan.days.length, posts: posts.length, uniqueAssets: new Set(posts.map((p) => p.media[0].id)).size };
  if (plan.days.length !== 7) problems.push(`gün sayısı 7 değil: ${plan.days.length}`);
  if (posts.length !== 9) problems.push(`kare sayısı 9 değil: ${posts.length}`);
  if (info.uniqueAssets !== posts.length) problems.push('asset tekrarı var');
  if (new Set(posts.map((p) => p.id)).size !== posts.length) problems.push('post kimliği çakışması');
  for (const p of posts) {
    for (const [name, rx] of FORBIDDEN) if (rx.test(p.caption)) problems.push(`${name} kalıbı: ${p.media[0].id}`);
    if (p.status !== 'draft') problems.push('post status draft değil');
    if ('scheduledAt' in p) problems.push('scheduledAt yazılmamalı');
    if (p.media[0].url !== '') problems.push('media.url boş olmalı (token yok)');
    if (p.media[0].thumbnailUrl && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.media[0].thumbnailUrl)) problems.push(`thumbnailUrl yalnız gömülü JPEG olabilir: ${p.media[0].id}`);
    if (p.media[0].thumbnailUrl && p.media[0].thumbnailUrl.length > 400000) problems.push(`thumbnailUrl çok büyük: ${p.media[0].id}`);
    if (!manifest.items.find((m) => m.asset_id === p.media[0].id)) problems.push(`manifest eşleşmesi yok: ${p.media[0].id}`);
    if (URLISH.test(JSON.stringify({ ...p, media: p.media.map(({ thumbnailUrl, ...m }) => m) }))) problems.push(`URL/token benzeri içerik: ${p.media[0].id}`);
  }
  if (planDoc.status !== 'draft') problems.push('plan status draft değil');
  if (planDoc.shareToken !== '') problems.push('paylaşım tokenı üretilmemeli');
  if (URLISH.test(JSON.stringify(planDoc))) problems.push('plan URL/token benzeri içerik');
  return { ok: problems.length === 0, problems, info };
};

/** Dosya sha256 doğrulaması (okuyucu enjekte edilir). */
export const verifyFiles = ({ manifest, readFile, hashFn = sha256Hex }) => {
  const mismatches = [];
  for (const m of manifest.items) {
    const buf = readFile(m.filename);
    if (!buf) { mismatches.push({ asset_id: m.asset_id, reason: 'dosya yok' }); continue; }
    if (hashFn(buf) !== m.sha256) mismatches.push({ asset_id: m.asset_id, reason: 'sha256 uyuşmuyor' });
  }
  return { ok: mismatches.length === 0, mismatches };
};
