import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from './_lib/withAuth.js';

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: 'Yonetici',
  account_manager: 'Musteri Iliskileri Yoneticisi',
  editor: 'Editör',
  staff: 'Personel',
  client: 'Musteri',
  freelancer: 'Freelancer',
};

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Only admin/super_admin can send invitations
  if (!['admin', 'super_admin'].includes(req.userRole)) {
    return res.status(403).json({ error: 'Yeterli yetki yok' });
  }

  try {
    const { invitationId, email, displayName, role, invitedByName } = req.body;

    if (!invitationId || !email || !role) {
      return res.status(400).json({ error: 'Eksik alanlar: invitationId, email, role zorunlu' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[invite-user] RESEND_API_KEY is not set');
      return res.status(500).json({ error: 'Email service not configured (missing RESEND_API_KEY)' });
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const appUrl = process.env.APP_URL
      ? process.env.APP_URL
      : process.env.VERCEL_URL
        ? (process.env.VERCEL_URL.includes('localhost') ? `http://${process.env.VERCEL_URL}` : `https://${process.env.VERCEL_URL}`)
        : 'http://localhost:5173';

    const inviteLink = `${appUrl}/join?token=${invitationId}`;
    const roleLabel = ROLE_DISPLAY_NAMES[role] || role;
    const recipientName = displayName || email;
    const senderName = invitedByName || 'intiba ekibi';

    const { data, error } = await resend.emails.send({
      from: 'intiba <info@intiba.co.uk>',
      to: [email],
      subject: `${senderName} sizi intiba platformuna davet etti`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 560px; margin: 0 auto; padding: 32px 20px; }
            .header { background: #171717; color: white; padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -1px; }
            .content { background: #fafafa; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px; }
            .role-badge { display: inline-block; background: #f5f5f5; border: 1px solid #e5e5e5; color: #525252; padding: 4px 12px; border-radius: 100px; font-size: 13px; margin-bottom: 20px; }
            .cta { display: inline-block; background: #171717; color: white; padding: 14px 28px; border-radius: 100px; text-decoration: none; font-weight: bold; font-size: 15px; margin: 24px 0; }
            .link-box { background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #737373; word-break: break-all; margin-top: 16px; }
            .footer { text-align: center; padding-top: 24px; color: #a3a3a3; font-size: 12px; }
            .expiry { color: #737373; font-size: 13px; margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>intiba.</h1>
            </div>
            <div class="content">
              <p style="font-size:16px;">Merhaba <strong>${recipientName}</strong>,</p>
              <p>${senderName} sizi <strong>intiba</strong> dijital ajans platformuna davet etti.</p>
              <div class="role-badge">Rol: ${roleLabel}</div>
              <br>
              <p>Hesabinizi olusturmak ve platforma katilmak icin asagidaki butona tiklayin:</p>
              <div style="text-align:center;">
                <a href="${inviteLink}" class="cta">Daveti Kabul Et</a>
              </div>
              <p class="expiry">Bu davet linki <strong>7 gun</strong> icerisinde gecerliliğini yitirir.</p>
              <div class="link-box">
                Link calismıyorsa bu adresi tarayicinize kopyalayin:<br>
                ${inviteLink}
              </div>
            </div>
            <div class="footer">
              <p>Bu email intiba platformu tarafindan otomatik gonderilmistir.<br>
              Eger bu daveti beklemiyor iseniz bu emaili gormezden gelebilirsiniz.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[invite-user] Resend error:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true, messageId: data?.id });
  } catch (err: any) {
    console.error('[invite-user] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});
