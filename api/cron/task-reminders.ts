/**
 * GET /api/cron/task-reminders
 *
 * Vercel Cron — runs every 30 minutes.
 * Sends Telegram reminders for tasks with reminderConfig.nextReminderAt <= now.
 *
 * Auth: CRON_SECRET Bearer token
 */
import '../_lib/env';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { sendTelegramMessage, formatTaskForTelegram } from '../_lib/telegram.js';

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getAdminDb();
  const now = Date.now();

  try {
    // Find tasks with reminder due
    const tasksSnap = await db.collection('tasks')
      .where('reminderConfig.enabled', '==', true)
      .where('reminderConfig.nextReminderAt', '<=', now)
      .where('status', 'in', ['open', 'in_progress', 'awaiting_review', 'blocked'])
      .limit(50)
      .get();

    if (tasksSnap.empty) {
      return res.status(200).json({ message: 'No reminders due', count: 0 });
    }

    let sentCount = 0;

    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data();
      const config = task.reminderConfig;

      if (!config?.channels?.includes('telegram')) continue;

      // Find Telegram link for the task's assignee or creator
      const targetUserId = task.assigneeId || task.createdBy;
      const linkSnap = await db.collection('telegram_user_links')
        .where('userId', '==', targetUserId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (!linkSnap.empty) {
        const chatId = linkSnap.docs[0].data().telegramChatId;

        const isOverdue = task.dueDate && (
          (task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate)) < new Date()
        );

        const header = isOverdue
          ? '⏰ <b>Hatırlatma — GECİKMİŞ GÖREV</b>'
          : '⏰ <b>Görev Hatırlatması</b>';

        await sendTelegramMessage(chatId,
          `${header}\n\n${formatTaskForTelegram(task as any)}\n\n` +
          `💡 /tamam ${task.id.slice(0, 6)} — Tamamla`
        );
        sentCount++;
      }

      // Update nextReminderAt
      const nextReminderAt = now + (config.intervalMinutes || 60) * 60 * 1000;
      await taskDoc.ref.update({
        'reminderConfig.lastRemindedAt': now,
        'reminderConfig.nextReminderAt': nextReminderAt,
      });
    }

    return res.status(200).json({ success: true, sentCount, checked: tasksSnap.size });
  } catch (error: any) {
    console.error('[cron/task-reminders] Error:', error);
    return res.status(500).json({ error: String(error?.message || 'Reminders failed') });
  }
}
