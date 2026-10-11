import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { checkLibraryAccess } from '../_lib/integrations/libraryAccess.js';
import { validateBrandVoiceBundle } from '../../shared/planner/brandVoice.js';
import { sha256Hex } from '../../shared/planner/sha256.js';
import { BRAND_VOICE_COLLECTION, brandVoiceDocId } from '../_lib/planCopy/planCopy.js';

/**
 * Marka sesi paketi (metin üretim bağlamı).
 *   GET ?projectId            → durum (rehber METNİ dönmez): { exists, account, captionCount, excluded, guideHashes, verifiedProducts, updatedAt }
 *   PUT { projectId, bundle } → YALNIZ yönetici; paket doğrulanır (hesap sahipliği, rehber özetleri, boyut) ve saklanır.
 * scripts/build-brand-voice-bundle.mjs paketi yerelde üretir; bu uç nokta onu depolar. Koleksiyon istemci kuralsızdır (yalnız sunucu).
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  const src: any = req.method === 'GET' ? req.query : req.body || {};
  try {
    const db = getAdminDb();
    const access = await checkLibraryAccess(db, req.userId, src.projectId, { adminOnly: req.method === 'PUT' });
    if (!access.ok) return res.status(access.httpStatus).json({ error: access.error });
    const ref = db.collection(BRAND_VOICE_COLLECTION).doc(brandVoiceDocId(req.tenantId, src.projectId));
    if (req.method === 'GET') {
      const s = await ref.get();
      const d = s.exists ? s.data() : null;
      if (!d || d.tenantId !== req.tenantId || d.projectId !== src.projectId) return res.status(200).json({ exists: false });
      const v = validateBrandVoiceBundle(d.bundle, sha256Hex);
      if (!v.ok) return res.status(200).json({ exists: true, valid: false, errors: v.errors.slice(0, 5) });
      const b = v.bundle;
      return res.status(200).json({
        exists: true, valid: true, account: b.brand.account, captionCount: b.captions.length, excluded: b.builtFrom.excluded,
        guideHashes: b.guideHashes, verifiedProducts: b.verifiedProducts, updatedAt: d.updatedAt,
      });
    }
    const v = validateBrandVoiceBundle(src.bundle, sha256Hex);
    if (!v.ok) return res.status(422).json({ error: 'Marka sesi paketi geçersiz', code: 'bundle_invalid', details: v.errors.slice(0, 10) });
    await ref.set({ tenantId: req.tenantId, projectId: src.projectId, bundle: v.bundle, updatedBy: req.userId, updatedAt: Date.now() });
    return res.status(200).json({ ok: true, captionCount: v.bundle.captions.length, excluded: v.bundle.builtFrom.excluded });
  } catch (error: any) {
    console.error('studio/brand-voice error:', error?.message);
    return res.status(500).json({ error: 'Marka sesi paketi işlenemedi', code: 'internal' });
  }
});
