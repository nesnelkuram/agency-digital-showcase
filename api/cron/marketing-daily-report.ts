import '../_lib/env';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 300 };

/**
 * GET /api/cron/marketing-daily-report
 *
 * Vercel Cron: daily at 07:00 UTC (10:00 Istanbul) — runs AFTER marketing-optimize
 * 1. Reads active campaigns + today's suggestions + alerts from Firestore
 * 2. Creates approval tokens for actionable items (pause, budget changes)
 * 3. Sends a daily email report with action plan to admin users
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();

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

    // ── Recipient emails ───────────────────────────────────────────────────────
    // Priority: MARKETING_REPORT_EMAIL env var → Firestore admin users
    const recipientEmails: Array<{ email: string; name: string }> = [];

    if (process.env.MARKETING_REPORT_EMAIL) {
      recipientEmails.push({ email: process.env.MARKETING_REPORT_EMAIL, name: 'Admin' });
    } else {
      const usersSnap = await db.collection('users').where('role', '==', 'admin').get();
      for (const doc of usersSnap.docs) {
        const u = doc.data();
        if (u.email) recipientEmails.push({ email: u.email, name: u.displayName || 'Admin' });
      }
    }

    if (recipientEmails.length === 0) {
      console.warn('[daily-report] No recipients found. Set MARKETING_REPORT_EMAIL env var.');
      return res.status(200).json({ success: true, message: 'No recipients configured', duration: Date.now() - startTime });
    }

    // ── Campaigns ─────────────────────────────────────────────────────────────
    const campaignsSnap = await db.collection('marketing_campaigns')
      .where('status', '==', 'active')
      .get();

    const campaigns = campaignsSnap.docs.map((d) => {
      const c = d.data() as any;
      const perf = c.performance || {};
      return {
        id: d.id,
        name: c.name || 'İsimsiz',
        status: c.status || 'active',
        spend: perf.totalSpend,
        impressions: perf.totalImpressions,
        clicks: perf.totalClicks,
        ctr: perf.averageCTR,
        roas: perf.averageROAS,
        budgetTotal: c.budget?.totalBudget,
        metaCampaignId: c.metaCampaignId,
      };
    });

    // ── Today's alerts ─────────────────────────────────────────────────────────
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    const campaignIds = campaigns.map((c) => c.id);

    // Get unread alerts (filter by campaignId in memory — alerts lack tenantId)
    const alertsSnap = await db.collection('marketing_alerts')
      .where('status', '==', 'unread')
      .where('createdAt', '>=', todayStart)
      .get();

    const alerts = alertsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((a) => !campaignIds.length || campaignIds.includes(a.campaignId));

    // ── Today's optimization suggestions ──────────────────────────────────────
    const suggestionsSnap = await db.collection('optimization_suggestions')
      .where('status', '==', 'pending')
      .where('createdAt', '>=', todayStart)
      .get();

    const suggestions = suggestionsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((s) => !campaignIds.length || campaignIds.includes(s.campaignId));

    // ── Build action items + approval tokens ──────────────────────────────────
    type ActionItem = {
      title: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
      campaignName?: string;
      token?: string;
      actionLabel?: string;
    };
    const actionItems: ActionItem[] = [];
    const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 48);

    // 1) Budget alerts ≥90% → offer pause
    for (const alert of alerts.filter((a) => a.severity === 'critical' && a.metric === 'budget_utilization').slice(0, 3)) {
      const token = generateToken();
      await db.collection('marketing_approval_tokens').doc(token).set({
        token,
        actionType: 'pause_campaign',
        actionLabel: 'Kampanyayı Duraklat',
        payload: { campaignId: alert.campaignId },
        campaignId: alert.campaignId,
        campaignName: alert.campaignName,
        status: 'pending',
        expiresAt,
        createdAt: new Date(),
      });
      actionItems.push({
        title: alert.title,
        description: alert.message + ' — Kampanyayı durdurmak veya bütçeyi manuel artırmak ister misiniz?',
        impact: 'high',
        campaignName: alert.campaignName,
        token,
        actionLabel: 'Kampanyayı Duraklat',
      });
    }

    // 2) Low CTR alerts → offer pause
    for (const alert of alerts.filter((a) => a.metric === 'ctr' && a.currentValue < 1).slice(0, 2)) {
      const token = generateToken();
      await db.collection('marketing_approval_tokens').doc(token).set({
        token,
        actionType: 'pause_campaign',
        actionLabel: 'Kampanyayı Duraklat',
        payload: { campaignId: alert.campaignId },
        campaignId: alert.campaignId,
        campaignName: alert.campaignName,
        status: 'pending',
        expiresAt,
        createdAt: new Date(),
      });
      actionItems.push({
        title: alert.title,
        description: alert.message + ' Reklam içeriği veya hedefleme güncellemesi gerekebilir.',
        impact: 'medium',
        campaignName: alert.campaignName,
        token,
        actionLabel: 'Kampanyayı Duraklat',
      });
    }

    // 3) Budget warning alerts (80-90%) → informational
    for (const alert of alerts.filter((a) => a.severity === 'warning' && a.metric === 'budget_utilization').slice(0, 2)) {
      actionItems.push({
        title: alert.title,
        description: alert.message + ' Bütçe takibini manuel olarak sürdürün.',
        impact: 'medium',
        campaignName: alert.campaignName,
      });
    }

    // 4) Optimization suggestions → informational
    for (const s of suggestions.slice(0, 4 - actionItems.filter((a) => !a.token).length)) {
      actionItems.push({
        title: s.title || 'Optimizasyon Önerisi',
        description: s.description || '',
        impact: s.impact === 'high' ? 'high' : s.impact === 'medium' ? 'medium' : 'low',
        campaignName: s.campaignName,
      });
    }

    // ── Send email ─────────────────────────────────────────────────────────────
    const { marketingDailyReportEmail } = await import('../_lib/emailTemplates.js');
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://app.intiba.co');

    const reportDate = new Date().toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    let emailsSent = 0;
    for (const recipient of recipientEmails) {
      const { subject, html } = marketingDailyReportEmail({
        recipientName: recipient.name,
        reportDate,
        campaigns: campaigns.slice(0, 10),
        alerts,
        actionItems: actionItems.slice(0, 6),
        baseUrl,
      });

      await resend.emails.send({
        from: process.env.RESEND_FROM || 'intiba <onboarding@resend.dev>',
        to: recipient.email,
        subject,
        html,
      });
      emailsSent++;
    }

    console.log(`[daily-report] Done in ${Date.now() - startTime}ms — ${campaigns.length} campaigns, ${alerts.length} alerts, ${actionItems.length} actions, ${emailsSent} emails sent`);

    return res.status(200).json({
      success: true,
      summary: {
        campaigns: campaigns.length,
        alerts: alerts.length,
        suggestions: suggestions.length,
        actionItems: actionItems.length,
        emailsSent,
      },
      duration: Date.now() - startTime,
    });

  } catch (err: any) {
    console.error('[daily-report] Fatal error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
