import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';

interface BulkInvitePayload {
  email: string;
  displayName: string;
  role: string;
  extraFields?: Record<string, any>;
  expiresInDays?: number;
  forceTwoFactor?: boolean;
}

const VALID_ROLES = new Set([
  'admin',
  'account_manager',
  'editor',
  'staff',
  'client',
  'freelancer',
]);

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ) as Partial<T>;
}

async function sendInvitationEmail(params: {
  invitationId: string;
  email: string;
  displayName: string;
  role: string;
  invitedByName: string;
  expiresInDays: number;
  appUrl: string;
  apiKey: string;
}) {
  const { Resend } = await import('resend');
  const resend = new Resend(params.apiKey);
  const inviteLink = `${params.appUrl}/join?token=${params.invitationId}`;

  return resend.emails.send({
    from: 'intiba <info@intiba.co.uk>',
    to: [params.email],
    subject: `${params.invitedByName} sizi intiba platformuna davet etti`,
    html: `
      <!DOCTYPE html>
      <html><body style="font-family:Arial,sans-serif;color:#333;">
      <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
        <div style="background:#171717;color:white;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="margin:0;font-size:28px;font-weight:800;">intiba.</h1>
        </div>
        <div style="background:#fafafa;padding:32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;">
          <p>Merhaba <strong>${params.displayName || params.email}</strong>,</p>
          <p>${params.invitedByName} sizi <strong>intiba</strong> platformuna davet etti.</p>
          <div style="text-align:center;"><a href="${inviteLink}" style="display:inline-block;background:#171717;color:white;padding:14px 28px;border-radius:100px;text-decoration:none;font-weight:bold;margin:24px 0;">Daveti Kabul Et</a></div>
          <p style="color:#737373;font-size:13px;">Bu davet linki <strong>${params.expiresInDays} gun</strong> icerisinde gecerliliğini yitirir.</p>
        </div>
      </div>
      </body></html>
    `,
  });
}

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!['admin', 'super_admin'].includes(req.userRole)) {
    return res.status(403).json({ error: 'Yeterli yetki yok' });
  }

  // Rate limit per tenant
  if (!applyRateLimit(res, `invite-bulk:${req.tenantId}`, LIMITS.INVITE_BULK)) return;

  const { invitations } = req.body as { invitations?: BulkInvitePayload[] };
  if (!Array.isArray(invitations) || invitations.length === 0) {
    return res.status(400).json({ error: 'invitations dizisi boş olamaz' });
  }
  if (invitations.length > 100) {
    return res.status(400).json({ error: 'Tek seferde en fazla 100 davet' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY yapılandırılmamış' });
  }

  const appUrl = process.env.APP_URL
    ? process.env.APP_URL
    : process.env.VERCEL_URL
      ? (process.env.VERCEL_URL.includes('localhost') ? `http://${process.env.VERCEL_URL}` : `https://${process.env.VERCEL_URL}`)
      : 'http://localhost:5173';

  const adminDb = getAdminDb();
  const FieldValue = getFieldValue();
  const senderName = req.userDisplayName || 'intiba ekibi';

  const successes: string[] = [];
  const failures: Array<{ email: string; error: string }> = [];

  // Mevcut davet/kullanıcı kontrolü için bir kerede çek
  const usersSnapshot = await adminDb
    .collection('users')
    .where('tenantId', '==', req.tenantId)
    .get();
  const pendingInvSnapshot = await adminDb
    .collection('invitations')
    .where('tenantId', '==', req.tenantId)
    .where('status', '==', 'pending')
    .get();

  const existingEmails = new Set<string>();
  usersSnapshot.forEach((d: any) => {
    const e = (d.data().email || '').toLowerCase();
    if (e) existingEmails.add(e);
  });
  pendingInvSnapshot.forEach((d: any) => {
    const e = (d.data().email || '').toLowerCase();
    if (e) existingEmails.add(e);
  });

  for (const payload of invitations) {
    const email = (payload.email || '').toLowerCase().trim();
    try {
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        throw new Error('Geçersiz e-posta');
      }
      if (!payload.displayName) throw new Error('Ad soyad eksik');
      if (!VALID_ROLES.has(payload.role)) throw new Error(`Geçersiz rol: ${payload.role}`);
      if (existingEmails.has(email)) throw new Error('Bu e-posta zaten kayıtlı veya davet edildi');

      const expiresInDays = payload.expiresInDays && payload.expiresInDays > 0 ? payload.expiresInDays : 7;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const docData: Record<string, any> = {
        tenantId: req.tenantId,
        email,
        displayName: payload.displayName,
        role: payload.role,
        status: 'pending',
        invitedBy: req.userUid,
        invitedByName: senderName,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt,
        expiresInDays,
      };
      if (payload.extraFields) {
        const clean = stripUndefined(payload.extraFields);
        if (Object.keys(clean).length > 0) docData.extraFields = clean;
      }
      if (payload.forceTwoFactor) docData.forceTwoFactor = true;

      const ref = await adminDb.collection('invitations').add(docData);

      try {
        await sendInvitationEmail({
          invitationId: ref.id,
          email,
          displayName: payload.displayName,
          role: payload.role,
          invitedByName: senderName,
          expiresInDays,
          appUrl,
          apiKey,
        });
      } catch (emailErr: any) {
        console.warn('[bulk-invite] email send failed for', email, emailErr?.message);
      }

      existingEmails.add(email);
      successes.push(email);
    } catch (err: any) {
      failures.push({ email, error: err?.message || 'Bilinmeyen hata' });
    }
  }

  return res.status(200).json({
    successes: successes.length,
    successEmails: successes,
    failures,
  });
});
