/**
 * GET /api/cron/task-digest
 *
 * Vercel Cron — runs weekdays at 05:00 UTC (08:00 Istanbul).
 * Sends a daily task digest via Telegram + email.
 *
 * Auth: CRON_SECRET Bearer token
 */
import '../_lib/env';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { sendTelegramMessage, formatTaskForTelegram } from '../_lib/telegram.js';
import { taskDigestEmail } from '../_lib/emailTemplates.js';

export const config = { maxDuration: 120 };

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = process.env.RESEND_FROM || 'intiba <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'https://intiba.com';

// Bir görev listesini email HTML'i için kompakt liste'ye dönüştür
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

interface CategoryGroups {
  overdue: any[];
  dueToday: any[];
  blocked: any[];
  delegatable: any[];
  rest: any[];
}

function categorizeTasks(tasks: any[]): CategoryGroups {
  const now = new Date();
  const overdue: any[] = [];
  const dueToday: any[] = [];
  const blocked: any[] = [];
  const delegatable: any[] = [];
  const rest: any[] = [];
  for (const t of tasks) {
    if (t.status === 'blocked') {
      blocked.push(t);
      continue;
    }
    if (t.dueDate) {
      const due = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      if (due < now && due.toDateString() !== now.toDateString()) {
        overdue.push(t);
        continue;
      }
      if (due.toDateString() === now.toDateString()) {
        dueToday.push(t);
        continue;
      }
    }
    if ((t.delegationScore ?? 0) >= 60) {
      delegatable.push(t);
      continue;
    }
    rest.push(t);
  }
  return { overdue, dueToday, blocked, delegatable, rest };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel cron auth
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getAdminDb();

  try {
    // Get all active Telegram links
    const linksSnap = await db.collection('telegram_user_links')
      .where('isActive', '==', true)
      .get();

    if (linksSnap.empty) {
      return res.status(200).json({ message: 'No active Telegram links' });
    }

    let sentCount = 0;

    for (const linkDoc of linksSnap.docs) {
      const link = linkDoc.data();
      const { tenantId, telegramChatId } = link;

      // Fetch active tasks for this tenant
      const tasksSnap = await db.collection('tasks')
        .where('tenantId', '==', tenantId)
        .where('status', 'in', ['open', 'in_progress', 'awaiting_review', 'blocked'])
        .orderBy('aiPriorityScore', 'desc')
        .limit(20)
        .get();

      if (tasksSnap.empty) {
        await sendTelegramMessage(telegramChatId,
          '☀️ <b>Günaydın!</b>\n\nBugün aktif görev yok. İyi bir gün!'
        );
        sentCount++;
        continue;
      }

      const tasks = tasksSnap.docs.map(d => d.data());
      const now = new Date();

      // Categorize
      const overdue: any[] = [];
      const dueToday: any[] = [];
      const blocked: any[] = [];
      const delegatable: any[] = [];
      const rest: any[] = [];

      for (const t of tasks) {
        if (t.status === 'blocked') {
          blocked.push(t);
          continue;
        }

        if (t.dueDate) {
          const due = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
          if (due < now) {
            overdue.push(t);
            continue;
          }
          // Due today
          if (due.toDateString() === now.toDateString()) {
            dueToday.push(t);
            continue;
          }
        }

        if ((t.delegationScore ?? 0) >= 60) {
          delegatable.push(t);
          continue;
        }

        rest.push(t);
      }

      // Build message
      const sections: string[] = [];
      sections.push(`☀️ <b>Günaydın! Günlük Görev Özeti</b>`);
      sections.push(`📊 Toplam aktif: ${tasks.length}`);

      if (overdue.length > 0) {
        sections.push(`\n🚨 <b>GECİKMİŞ (${overdue.length})</b>`);
        overdue.forEach(t => sections.push(formatTaskForTelegram(t)));
      }

      if (dueToday.length > 0) {
        sections.push(`\n⏰ <b>BUGÜN BİTMELİ (${dueToday.length})</b>`);
        dueToday.forEach(t => sections.push(formatTaskForTelegram(t)));
      }

      if (blocked.length > 0) {
        sections.push(`\n🚫 <b>ENGELLENMİŞ (${blocked.length})</b>`);
        blocked.forEach(t => sections.push(formatTaskForTelegram(t)));
      }

      if (delegatable.length > 0) {
        sections.push(`\n🤝 <b>DELEGE EDİLEBİLİR</b>`);
        delegatable.slice(0, 5).forEach(t => {
          sections.push(
            formatTaskForTelegram(t) +
            `\n   🤝 Delegasyon: ${t.delegationScore}/100`
          );
        });
      }

      if (rest.length > 0 && sections.length < 10) {
        sections.push(`\n📋 <b>DİĞER GÖREVLER (${rest.length})</b>`);
        rest.slice(0, 5).forEach(t => sections.push(formatTaskForTelegram(t)));
      }

      sections.push('\n💡 /liste — Tüm görevleri gör\n💡 /gorev — Yeni görev ekle');

      await sendTelegramMessage(telegramChatId, sections.join('\n'));
      sentCount++;
    }

    // ─── Email digest ────────────────────────────────────────────────────
    // Aktif tüm tenant user'larına günlük email gönder. Admin → tenant'ın tümünü,
    // diğerleri → sadece kendine atanmış görevleri görür.
    let emailSentCount = 0;
    let emailFailedCount = 0;

    if (process.env.RESEND_API_KEY) {
      // Tüm aktif user'lar (tüm tenant'larda)
      const usersSnap = await db
        .collection('users')
        .where('status', '==', 'active')
        .get();

      for (const userDoc of usersSnap.docs) {
        const user = userDoc.data();
        if (!user.email || !user.tenantId) continue;
        // Email bildirim opt-out (settings.notifications.email === false)
        // VE dailyDigest opt-out (settings.notifications.dailyDigest === false)
        const notifs = user.settings?.notifications || {};
        if (notifs.email === false) continue;
        if (notifs.dailyDigest === false) continue;

        const isAdmin =
          user.role === 'admin' || user.role === 'owner' || user.role === 'super_admin';

        // Görevleri çek — admin tenant'ın tümünü, diğerleri sadece kendine atanmış
        let q = db
          .collection('tasks')
          .where('tenantId', '==', user.tenantId)
          .where('status', 'in', ['open', 'in_progress', 'paused', 'awaiting_review', 'blocked']);
        if (!isAdmin) {
          q = q.where('assigneeId', '==', userDoc.id);
        }
        const tasksSnap = await q.orderBy('aiPriorityScore', 'desc').limit(20).get();

        if (tasksSnap.empty) continue;
        const tasks = tasksSnap.docs.map((d) => d.data());
        // Parent task'ları çıkar — child'lar yeterli (tek tek listelenecek)
        const visibleTasks = tasks.filter((t: any) => !t.subTaskCount || t.subTaskCount === 0);
        if (visibleTasks.length === 0) continue;

        const { overdue, dueToday, blocked: blockedList, delegatable, rest } =
          categorizeTasks(visibleTasks);

        const sections: string[] = [];
        if (overdue.length > 0) {
          sections.push(
            `<h3 style="color:#dc2626; margin: 16px 0 4px;">🚨 Gecikmiş (${overdue.length})</h3>${tasksToHtmlList(overdue)}`
          );
        }
        if (dueToday.length > 0) {
          sections.push(
            `<h3 style="color:#171717; margin: 16px 0 4px;">⏰ Bugün Bitmeli (${dueToday.length})</h3>${tasksToHtmlList(dueToday)}`
          );
        }
        if (blockedList.length > 0) {
          sections.push(
            `<h3 style="color:#a16207; margin: 16px 0 4px;">🚫 Engellenmiş (${blockedList.length})</h3>${tasksToHtmlList(blockedList)}`
          );
        }
        if (delegatable.length > 0 && isAdmin) {
          sections.push(
            `<h3 style="color:#0369a1; margin: 16px 0 4px;">🤝 Delege Edilebilir (${delegatable.length})</h3>${tasksToHtmlList(delegatable.slice(0, 5))}`
          );
        }
        if (rest.length > 0) {
          sections.push(
            `<h3 style="color:#525252; margin: 16px 0 4px;">📋 Sıradaki (${rest.length})</h3>${tasksToHtmlList(rest.slice(0, 8))}`
          );
        }

        const taskSummaryHtml = sections.join('');
        const { subject, html } = taskDigestEmail({
          recipientName: user.displayName || user.email.split('@')[0],
          totalActive: visibleTasks.length,
          overdueCount: overdue.length,
          dueTodayCount: dueToday.length,
          blockedCount: blockedList.length,
          delegatableCount: delegatable.length,
          taskSummaryHtml,
          adminUrl: `${APP_URL}/admin/now`,
        });

        try {
          await resend.emails.send({
            from: FROM_ADDRESS,
            to: user.email,
            subject,
            html,
          });
          emailSentCount++;
        } catch (err: any) {
          console.error('[cron/task-digest] email failed for', user.email, err?.message);
          emailFailedCount++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      telegramSent: sentCount,
      emailSent: emailSentCount,
      emailFailed: emailFailedCount,
    });
  } catch (error: any) {
    console.error('[cron/task-digest] Error:', error);
    return res.status(500).json({ error: String(error?.message || 'Digest failed') });
  }
}
