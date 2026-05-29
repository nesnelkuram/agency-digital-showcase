/**
 * GET /api/cron/task-reminders
 *
 * Vercel Cron — her 30 dakikada bir çalışır.
 * Deadline'ı yaklaşan görevler için sabit milestone'larda hatırlatma:
 *   - 2 gün, 1 gün, 12 saat, 6 saat, 3 saat, 1 saat kala
 *   - deadline geçince: "GECİKTİ" hatırlatması (bir kez)
 *
 * Her milestone bir kez tetiklenir; `reminderConfig.sentLeadTimes` array'inde tutulur.
 * Tamamlanmış görevler atlanır (status filtresi). Hatırlatma kapalıysa atlanır.
 * Default: reminderConfig yoksa "enabled" kabul edilir.
 *
 * Auth: CRON_SECRET Bearer token
 */
import '../_lib/env';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { sendTelegramMessage, formatTaskForTelegram } from '../_lib/telegram.js';

export const config = { maxDuration: 60 };

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = process.env.RESEND_FROM || 'intiba <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'https://www.intiba.co.uk';

// Lead times (dakika) — büyükten küçüğe sıralı. Deadline'a bu kadar kala tetiklenir.
const LEAD_TIMES_MINUTES = [2880, 1440, 720, 360, 180, 60] as const;
const OVERDUE_MARKER = -1;

function leadTimeLabel(minutes: number): string {
  if (minutes === OVERDUE_MARKER) return 'GECİKTİ';
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} gün kaldı`;
  if (minutes >= 60) return `${Math.round(minutes / 60)} saat kaldı`;
  return `${minutes} dakika kaldı`;
}

function taskReminderEmail(task: any, leadMinutes: number, dueDate: Date): { subject: string; html: string } {
  const dueLabel = dueDate.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
  const isOverdue = leadMinutes === OVERDUE_MARKER;
  const header = isOverdue ? '⚠️ Görev Gecikti' : `⏰ ${leadTimeLabel(leadMinutes)}`;
  const headerColor = isOverdue ? '#dc2626' : '#171717';
  const subject = isOverdue
    ? `[GECİKMİŞ] ${task.title || 'Görev'}`
    : `${leadTimeLabel(leadMinutes)}: ${task.title || 'Görev'}`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: ${headerColor}; font-size: 18px; margin: 0 0 16px;">${header}</h2>
      <p style="font-size: 16px; font-weight: 600; color: #171717; margin: 0 0 8px;">${task.title || 'Görev'}</p>
      ${task.projectName ? `<p style="color: #737373; font-size: 13px; margin: 0 0 12px;">${task.projectName}</p>` : ''}
      <table style="font-size: 13px; color: #525252; margin: 16px 0;">
        <tr><td style="padding-right: 12px;">Deadline:</td><td style="font-weight: 600;">${dueLabel}</td></tr>
        ${task.aiPriorityScore ? `<tr><td style="padding-right: 12px;">Öncelik:</td><td>${task.aiPriorityScore}/100</td></tr>` : ''}
      </table>
      ${task.description ? `<p style="color: #404040; font-size: 14px; line-height: 1.5; margin: 12px 0;">${String(task.description).slice(0, 300)}</p>` : ''}
      <a href="${APP_URL}/admin/now" style="display: inline-block; margin-top: 16px; padding: 10px 18px; background: #171717; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px;">Göreve Git</a>
    </div>
  `;
  return { subject, html };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getAdminDb();
  const now = new Date();
  const nowMs = now.getTime();

  try {
    // Aktif görevlerden deadline'ı olanlar (max 2 gün ileride veya geçmişte 1 gün)
    // Index sınırı için iki ayrı sorgu yerine tek sorgu: status filtresi yeter,
    // dueDate yokları kodda atlayacağız.
    const tasksSnap = await db.collection('tasks')
      .where('status', 'in', ['open', 'in_progress', 'paused', 'awaiting_review', 'blocked'])
      .limit(500)
      .get();

    if (tasksSnap.empty) {
      return res.status(200).json({ message: 'No active tasks', count: 0 });
    }

    let telegramSent = 0;
    let emailSent = 0;
    let emailFailed = 0;
    let processed = 0;

    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data();
      if (!task.dueDate) continue;

      const reminderConfig = task.reminderConfig || {};
      // Default: enabled (sadece açıkça false ise atla)
      if (reminderConfig.enabled === false) continue;

      const dueDate: Date = task.dueDate.toDate
        ? task.dueDate.toDate()
        : new Date(task.dueDate);
      const minutesLeft = (dueDate.getTime() - nowMs) / 60000;

      const sentLeadTimes: number[] = Array.isArray(reminderConfig.sentLeadTimes)
        ? reminderConfig.sentLeadTimes
        : [];

      // İlk görüş: zaten geçilmiş milestone'ları "gönderildi" işaretle (retroactive spam'i önler)
      const initialMissedLeads = LEAD_TIMES_MINUTES.filter((L) => L > minutesLeft);
      const effectiveSent = new Set<number>([...sentLeadTimes, ...initialMissedLeads]);

      let toFire: number | null = null;

      // Henüz gönderilmemiş ve "şu an aşılmış" milestone var mı?
      // Aday: L ∈ LEAD_TIMES, L >= minutesLeft, ve daha önce gönderilmemiş
      // En küçüğü = en yakın (en kritik) reminder
      const candidates = LEAD_TIMES_MINUTES.filter(
        (L) => minutesLeft <= L && !effectiveSent.has(L)
      );
      if (candidates.length > 0) {
        toFire = Math.min(...candidates);
      } else if (minutesLeft < 0 && !sentLeadTimes.includes(OVERDUE_MARKER)) {
        // Deadline geçmiş, henüz "gecikti" gönderilmemiş
        toFire = OVERDUE_MARKER;
      }

      // İlk-görüş initialization farkı varsa Firestore'a yaz (toFire null bile olsa)
      const newSentSet = new Set<number>(effectiveSent);
      let didSend = false;

      if (toFire !== null) {
        const channels: string[] = reminderConfig.channels || ['telegram', 'email'];
        const targetUserId = task.assigneeId || task.createdBy;

        // Telegram
        if (channels.includes('telegram') && targetUserId) {
          try {
            const linkSnap = await db.collection('telegram_user_links')
              .where('userId', '==', targetUserId)
              .where('isActive', '==', true)
              .limit(1)
              .get();
            if (!linkSnap.empty) {
              const chatId = linkSnap.docs[0].data().telegramChatId;
              const header = toFire === OVERDUE_MARKER
                ? '🚨 <b>Görev GECİKTİ</b>'
                : `⏰ <b>${leadTimeLabel(toFire)}</b>`;
              await sendTelegramMessage(chatId,
                `${header}\n\n${formatTaskForTelegram(task as any)}\n\n` +
                `💡 /tamam ${task.id.slice(0, 6)} — Tamamla`
              );
              telegramSent++;
            }
          } catch (err: any) {
            console.error('[cron/task-reminders] telegram failed:', err?.message);
          }
        }

        // Email
        if (channels.includes('email') && targetUserId && process.env.RESEND_API_KEY) {
          try {
            const userDoc = await db.collection('users').doc(targetUserId).get();
            const userData = userDoc.exists ? userDoc.data() : null;
            const email = userData?.email;
            if (email) {
              const { subject, html } = taskReminderEmail(task, toFire, dueDate);
              const { error } = await resend.emails.send({
                from: FROM_ADDRESS,
                to: email,
                subject,
                html,
              });
              if (error) {
                console.error('[cron/task-reminders] email error:', error);
                emailFailed++;
              } else {
                emailSent++;
              }
            }
          } catch (err: any) {
            console.error('[cron/task-reminders] email failed:', err?.message);
            emailFailed++;
          }
        }

        newSentSet.add(toFire);
        didSend = true;
      }

      // sentLeadTimes değiştiyse güncelle (initial-miss veya yeni gönderim)
      const newSent = Array.from(newSentSet);
      const changed =
        didSend ||
        newSent.length !== sentLeadTimes.length ||
        newSent.some((x) => !sentLeadTimes.includes(x));
      if (changed) {
        await taskDoc.ref.update({
          'reminderConfig.enabled': reminderConfig.enabled !== false,
          'reminderConfig.channels': reminderConfig.channels || ['telegram', 'email'],
          'reminderConfig.sentLeadTimes': newSent,
          'reminderConfig.lastRemindedAt': didSend ? nowMs : reminderConfig.lastRemindedAt || null,
        });
      }
      processed++;
    }

    return res.status(200).json({
      success: true,
      processed,
      telegramSent,
      emailSent,
      emailFailed,
    });
  } catch (error: any) {
    console.error('[cron/task-reminders] Error:', error);
    return res.status(500).json({ error: String(error?.message || 'Reminders failed') });
  }
}
