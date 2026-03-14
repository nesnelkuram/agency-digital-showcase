/**
 * POST /api/telegram/link
 *
 * Generate a one-time link code for connecting Telegram ↔ intiba account.
 * The user sends this code to the bot via /start {code}.
 *
 * Auth: withAuth (Firebase Bearer token)
 */
import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getAdminDb();

    // Check if user already has an active link
    const existingSnap = await db.collection('telegram_user_links')
      .where('userId', '==', req.userId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    const alreadyLinked = !existingSnap.empty;

    // Generate code (even if already linked — allows re-linking)
    const code = generateCode();
    const now = Date.now();

    const codeRef = db.collection('telegram_link_codes').doc();
    await codeRef.set({
      id: codeRef.id,
      tenantId: req.tenantId,
      userId: req.userId,
      code,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes
      used: false,
    });

    return res.status(200).json({
      code,
      expiresInMinutes: 10,
      alreadyLinked,
      instruction: `Telegram'da botu açıp şu mesajı gönderin: /start ${code}`,
    });
  } catch (error: any) {
    console.error('telegram/link error:', error);
    return res.status(500).json({ error: String(error?.message || 'Link code generation failed') });
  }
});
