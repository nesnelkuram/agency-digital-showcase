import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { canvaSyncState } from '../_lib/integrations/config.js';
import { INTEGRATION_ADMIN_ROLES } from '../_lib/integrations/libraryAccess.js';
import { open, seal } from '../_lib/integrations/secretBox.js';
import { buildAuthorizeUrl, createPkcePair, createState, exchangeCode, OAUTH_STATE_TTL_MS, stateKey, validateOAuthState } from '../_lib/canva/oauth.js';
import { COL, saveConnection } from '../_lib/canva/firestoreStores.js';

/**
 * Canva bağlantısı (tenant başına bir; yalnız admin/super_admin başlatır). Varsayılan KAPALI.
 * POST            → { authorizeUrl } (PKCE verifier sunucuda şifreli; state'in yalnız hash'i saklanır)
 * GET ?code&state → Canva dönüşü: state tek kullanımlık doğrulanır, token'lar şifreli saklanır, Studio'ya yönlenir
 * Token/secret hiçbir yanıtta dönmez.
 */
const start = withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const feature = canvaSyncState();
  if (!feature.enabled) return res.status(503).json({ error: feature.reason, code: 'feature_disabled' });
  if (!INTEGRATION_ADMIN_ROLES.has(req.userRole)) return res.status(403).json({ error: 'Canva bağlantısını yalnız yönetici kurabilir' });
  const { verifier, challenge } = createPkcePair();
  const state = createState();
  const now = Date.now();
  await getAdminDb()
    .collection(COL.states)
    .doc(stateKey(state))
    .set({ tenantId: req.tenantId, uid: req.userId, verifier: seal(verifier), createdAt: now, expiresAt: now + OAUTH_STATE_TTL_MS, used: false });
  const authorizeUrl = buildAuthorizeUrl({ clientId: process.env.CANVA_CLIENT_ID!, redirectUri: process.env.CANVA_REDIRECT_URI!, challenge, state });
  return res.status(200).json({ authorizeUrl });
});

async function callback(req: VercelRequest, res: VercelResponse) {
  const done = (result: string) => {
    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(302, { Location: `/studio?canva=${encodeURIComponent(result)}` });
    res.end();
  };
  const feature = canvaSyncState();
  if (!feature.enabled) return done('disabled');
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (!code || !state) return done(typeof req.query.error === 'string' ? 'denied' : 'invalid');
  const db = getAdminDb();
  const ref = db.collection(COL.states).doc(stateKey(state));
  // Tek kullanımlık: transaction içinde doğrula ve "used" işaretle
  const claimed = await db.runTransaction(async (tx: any) => {
    const s = await tx.get(ref);
    const data = s.exists ? s.data() : null;
    const v = validateOAuthState(data, Date.now());
    if (!v.ok) return { ok: false as const, reason: v.reason };
    tx.update(ref, { used: true, usedAt: Date.now() });
    return { ok: true as const, data };
  });
  if (!claimed.ok) return done(claimed.reason);
  try {
    const tokens = await exchangeCode(
      { code, verifier: open(claimed.data.verifier), redirectUri: process.env.CANVA_REDIRECT_URI!, clientId: process.env.CANVA_CLIENT_ID!, clientSecret: process.env.CANVA_CLIENT_SECRET! },
      fetch as any
    );
    await saveConnection(db, { tenantId: claimed.data.tenantId, uid: claimed.data.uid, tokens, now: Date.now() });
    return done('connected');
  } catch (e: any) {
    console.error('canva oauth callback error:', e?.code || 'error');
    return done('error');
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') return start(req, res);
  if (req.method === 'GET') return callback(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}
