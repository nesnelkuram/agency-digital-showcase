import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseAuth } from '../_lib/firebaseAdmin.js';
import { provisionUserFromInvitation } from '../_lib/invitationProvisioning.js';

/**
 * Davet kabulü (sunucu). İstemci önce Firebase Auth hesabını oluşturur (veya yarım kalan akışta
 * giriş yapar), ardından bu endpoint'i ID token ile çağırır. Kullanıcı dokümanı; rol, tenant ve
 * proje atamaları yalnızca davet kaydından, sunucuda yazılır.
 *
 * Body: { invitationId, displayName }
 * Header: Authorization: Bearer <idToken>  (users dokümanı henüz olmadığından withAuth kullanılmaz)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const header = req.headers['authorization'];
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Oturum gerekli' });

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token);
    const { invitationId, displayName } = req.body || {};
    const result = await provisionUserFromInvitation({
      invitationId,
      uid: decoded.uid,
      email: decoded.email || '',
      displayName: typeof displayName === 'string' ? displayName : '',
    });
    if (!result.ok) return res.status(result.httpStatus).json({ error: result.error });
    return res.status(200).json({ success: true, role: result.role, alreadyProvisioned: !!result.alreadyProvisioned });
  } catch (err: any) {
    console.error('[invitations/accept] Error:', err?.message || err);
    return res.status(401).json({ error: 'Oturum doğrulanamadı' });
  }
}
