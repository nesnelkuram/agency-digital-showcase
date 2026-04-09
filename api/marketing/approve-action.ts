import '../_lib/env';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/marketing/approve-action?token=XXX&decision=approve|reject
 *
 * Public endpoint — accessed via email link. Token is the authentication.
 * - approve: executes the stored action via executeApprovedAction()
 * - reject: marks token as rejected (no action taken)
 *
 * Returns an HTML confirmation page.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const { token, decision } = req.query as { token?: string; decision?: string };

  if (!token || !['approve', 'reject'].includes(decision || '')) {
    return res.status(400).send(renderPage('Geçersiz İstek', 'Token veya karar parametresi eksik.', 'error'));
  }

  try {
    // ── Firebase Admin ─────────────────────────────────────────────────────────
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
      const sa = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : undefined;
      initializeApp(
        sa
          ? { credential: cert(sa) }
          : { projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID }
      );
    }
    const db = getFirestore();

    // ── Look up token ──────────────────────────────────────────────────────────
    const tokenRef = db.collection('marketing_approval_tokens').doc(token);
    const tokenDoc = await tokenRef.get();

    if (!tokenDoc.exists) {
      return res.status(404).send(renderPage('Token Bulunamadı', 'Bu onay bağlantısı geçersiz veya zaten kullanılmış.', 'error'));
    }

    const tokenData = tokenDoc.data()!;

    // Check status
    if (tokenData.status !== 'pending') {
      const statusLabel = tokenData.status === 'approved' ? 'daha önce onaylandı' : tokenData.status === 'rejected' ? 'daha önce reddedildi' : 'süresi doldu';
      return res.status(400).send(renderPage('Zaten İşlendi', `Bu aksiyon ${statusLabel}.`, 'info'));
    }

    // Check expiry
    const expiresAt = tokenData.expiresAt?.toDate?.() || new Date(tokenData.expiresAt);
    if (new Date() > expiresAt) {
      await tokenRef.update({ status: 'expired' });
      return res.status(400).send(renderPage('Süresi Doldu', 'Bu onay bağlantısının süresi (48 saat) dolmuştur.', 'error'));
    }

    // ── Handle decision ────────────────────────────────────────────────────────
    if (decision === 'reject') {
      await tokenRef.update({ status: 'rejected', decidedAt: new Date() });
      return res.status(200).send(renderPage(
        'Aksiyon Reddedildi',
        `"${tokenData.actionLabel || tokenData.actionType}" aksiyonu iptal edildi. Herhangi bir değişiklik yapılmadı.`,
        'info',
        tokenData.campaignName
      ));
    }

    // ── Approve: execute the action ────────────────────────────────────────────
    const { executeApprovedAction } = await import('./_lib/approvalFlow.js');

    const ctx = {
      db,
      tenantId: tokenData.tenantId || '',
      sessionId: token,
      userId: tokenData.createdBy || '',
    };

    const { message } = await executeApprovedAction(ctx, tokenData.actionType, tokenData.payload);

    await tokenRef.update({ status: 'approved', decidedAt: new Date() });

    // Log to audit
    await db.collection('marketing_action_log').add({
      actionType: tokenData.actionType,
      actionLabel: tokenData.actionLabel,
      campaignId: tokenData.campaignId,
      campaignName: tokenData.campaignName,
      payload: tokenData.payload,
      approvedVia: 'email_link',
      approvedAt: new Date(),
      tenantId: tokenData.tenantId || '',
    });

    return res.status(200).send(renderPage(
      '✅ Aksiyon Onaylandı',
      message || `"${tokenData.actionLabel || tokenData.actionType}" başarıyla uygulandı.`,
      'success',
      tokenData.campaignName
    ));

  } catch (err: any) {
    console.error('[approve-action] Error:', err.message);
    return res.status(500).send(renderPage('Hata', `Aksiyon uygulanırken bir sorun oluştu: ${err.message}`, 'error'));
  }
}

function renderPage(title: string, message: string, type: 'success' | 'error' | 'info', campaignName?: string): string {
  const colors = {
    success: { bg: '#d1fae5', text: '#065f46', icon: '✅' },
    error:   { bg: '#fee2e2', text: '#991b1b', icon: '❌' },
    info:    { bg: '#dbeafe', text: '#1e40af', icon: 'ℹ️' },
  };
  const c = colors[type];
  const adminUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/marketing`
    : '/admin/marketing';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — intiba</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Helvetica Neue', sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: white; border-radius: 16px; padding: 40px 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .header { background: #171717; color: white; padding: 10px 20px; border-radius: 100px; font-weight: 800; font-size: 18px; display: inline-block; margin-bottom: 28px; }
    .badge { background: ${c.bg}; color: ${c.text}; padding: 12px 20px; border-radius: 12px; font-size: 15px; font-weight: 600; margin-bottom: 16px; display: inline-block; }
    h1 { font-size: 20px; font-weight: 700; color: #171717; margin-bottom: 8px; }
    p { font-size: 14px; color: #737373; line-height: 1.6; margin-bottom: 8px; }
    .campaign { font-size: 12px; color: #a3a3a3; margin-bottom: 24px; }
    a { display: inline-block; background: #171717; color: white; text-decoration: none; padding: 12px 24px; border-radius: 100px; font-size: 14px; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">intiba.</div>
    <br>
    <span class="badge">${c.icon} ${title}</span>
    <h1>${title}</h1>
    <p>${message}</p>
    ${campaignName ? `<p class="campaign">📍 ${campaignName}</p>` : ''}
    <a href="${adminUrl}">Marketing Paneline Git →</a>
  </div>
</body>
</html>`;
}
