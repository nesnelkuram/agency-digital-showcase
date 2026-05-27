/**
 * POST /api/tasks/send-test-digest
 *
 * Manual deneme: çağıran user'a günlük görev özetinin önizlemesini email atar.
 * Cron'un yaptığı işin tek-kullanıcı versiyonu.
 *
 * Auth: Firebase ID token (withAuth)
 */
import type { VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { taskDigestEmail } from '../_lib/emailTemplates.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = process.env.RESEND_FROM || 'intiba <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'https://intiba.com';

function tasksToHtmlList(tasks: any[]): string {
  if (tasks.length === 0) return '';
  return (
    '<ul style="padding-left: 16px; margin: 8px 0;">' +
    tasks
      .slice(0, 8)
      .map((t) => {
        const score = t.aiPriorityScore ?? 0;
        const proj = t.projectName ? ` <span style="color:#737373;">· ${t.projectName}</span>` : '';
        const due = t.dueDate?.toDate
          ? ` <span style="color:#737373;">· ${t.dueDate.toDate().toLocaleDateString('tr-TR')}</span>`
          : '';
        const flag = t.flagged ? '🚩 ' : '';
        return `<li style="margin: 4px 0;">${flag}<strong>${t.title || 'Görev'}</strong>${proj}${due} <span style="color:#a3a3a3; font-size:11px;">(${score})</span></li>`;
      })
      .join('') +
    '</ul>'
  );
}

function categorizeTasks(tasks: any[]) {
  const now = new Date();
  const overdue: any[] = [];
  const dueToday: any[] = [];
  const blocked: any[] = [];
  const delegatable: any[] = [];
  const rest: any[] = [];
  for (const t of tasks) {
    if (t.status === 'blocked') { blocked.push(t); continue; }
    if (t.dueDate) {
      const due = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      if (due < now && due.toDateString() !== now.toDateString()) { overdue.push(t); continue; }
      if (due.toDateString() === now.toDateString()) { dueToday.push(t); continue; }
    }
    if ((t.delegationScore ?? 0) >= 60) { delegatable.push(t); continue; }
    rest.push(t);
  }
  return { overdue, dueToday, blocked, delegatable, rest };
}

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY tanımlı değil' });
  }

  try {
    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(req.userUid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userDoc.data()!;
    if (!user.email) {
      return res.status(400).json({ error: 'Email yok — profil bilgilerini güncelle' });
    }

    const isAdmin = user.role === 'admin' || user.role === 'owner' || user.role === 'super_admin';

    let q = db
      .collection('tasks')
      .where('tenantId', '==', req.tenantId)
      .where('status', 'in', ['open', 'in_progress', 'paused', 'awaiting_review', 'blocked']);
    if (!isAdmin) {
      q = q.where('assigneeId', '==', req.userUid);
    }
    const tasksSnap = await q.orderBy('aiPriorityScore', 'desc').limit(20).get();

    const tasks = tasksSnap.docs.map((d) => d.data());
    const visibleTasks = tasks.filter((t: any) => !t.subTaskCount || t.subTaskCount === 0);

    if (visibleTasks.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'Aktif görev yok, deneme email gönderilmedi.',
      });
    }

    const { overdue, dueToday, blocked, delegatable, rest } = categorizeTasks(visibleTasks);

    const sections: string[] = [];
    sections.push('<p style="color:#dc2626;font-size:12px;font-weight:600;">[DENEME] — bu cron tarafından otomatik değil, manuel tetiklenmiş bir önizlemedir.</p>');
    if (overdue.length > 0) {
      sections.push(`<h3 style="color:#dc2626; margin: 16px 0 4px;">🚨 Gecikmiş (${overdue.length})</h3>${tasksToHtmlList(overdue)}`);
    }
    if (dueToday.length > 0) {
      sections.push(`<h3 style="color:#171717; margin: 16px 0 4px;">⏰ Bugün Bitmeli (${dueToday.length})</h3>${tasksToHtmlList(dueToday)}`);
    }
    if (blocked.length > 0) {
      sections.push(`<h3 style="color:#a16207; margin: 16px 0 4px;">🚫 Engellenmiş (${blocked.length})</h3>${tasksToHtmlList(blocked)}`);
    }
    if (delegatable.length > 0 && isAdmin) {
      sections.push(`<h3 style="color:#0369a1; margin: 16px 0 4px;">🤝 Delege Edilebilir (${delegatable.length})</h3>${tasksToHtmlList(delegatable.slice(0, 5))}`);
    }
    if (rest.length > 0) {
      sections.push(`<h3 style="color:#525252; margin: 16px 0 4px;">📋 Sıradaki (${rest.length})</h3>${tasksToHtmlList(rest.slice(0, 8))}`);
    }

    const { subject, html } = taskDigestEmail({
      recipientName: user.displayName || user.email.split('@')[0],
      totalActive: visibleTasks.length,
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      blockedCount: blocked.length,
      delegatableCount: delegatable.length,
      taskSummaryHtml: sections.join(''),
      adminUrl: `${APP_URL}/admin/now`,
    });

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: user.email,
      subject: `[Deneme] ${subject}`,
      html,
    });

    if (error) {
      console.error('[send-test-digest] Resend error:', error);
      return res.status(500).json({ error: error.message || 'Mail gönderilemedi' });
    }

    return res.status(200).json({
      success: true,
      messageId: data?.id,
      sentTo: user.email,
      taskCount: visibleTasks.length,
    });
  } catch (err: any) {
    console.error('[send-test-digest] Error:', err);
    return res.status(500).json({ error: String(err?.message || 'Failed') });
  }
});
