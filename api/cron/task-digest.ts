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
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { sendTelegramMessage, formatTaskForTelegram } from '../_lib/telegram.js';

export const config = { maxDuration: 60 };

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

    return res.status(200).json({ success: true, sentCount });
  } catch (error: any) {
    console.error('[cron/task-digest] Error:', error);
    return res.status(500).json({ error: String(error?.message || 'Digest failed') });
  }
}
