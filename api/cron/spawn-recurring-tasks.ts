/**
 * GET /api/cron/spawn-recurring-tasks
 *
 * Vercel Cron — saat başı çalışır.
 * `recurring_tasks` koleksiyonunda schedule.enabled=true olan ve nextRunAt'i
 * geçmişte kalan her şablon için `tasks` koleksiyonuna yeni bir görev oluşturur,
 * ardından nextRunAt'i bir sonraki çalışmaya ileriye taşır.
 *
 * Cron schedule: 0 * * * *  (her saat :00)
 * Auth: CRON_SECRET Bearer token (Vercel otomatik enjekte eder)
 */
import '../_lib/env';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';
import { getNextRunDate } from '../../shared/utils/cron.js';

export const config = { maxDuration: 60 };

const PRIORITY_SCORE: Record<string, number> = {
  critical: 90,
  high: 75,
  medium: 50,
  low: 30,
};

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value === 'number') return new Date(value);
  if (value.toDate) return value.toDate();
  return new Date(value);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getAdminDb();
  const FieldValue = getFieldValue();
  const now = new Date();

  try {
    const snap = await db
      .collection('recurring_tasks')
      .where('schedule.enabled', '==', true)
      .get();

    const due = snap.docs.filter((d: any) => {
      const next = toDate(d.data()?.schedule?.nextRunAt);
      return !next || next <= now; // hiç çalışmamış ya da zamanı gelmiş
    });

    if (due.length === 0) {
      return res.status(200).json({ spawned: 0, message: 'Zamanı gelen periyodik görev yok.' });
    }

    const results: Array<{ templateId: string; taskId?: string; error?: string }> = [];

    for (const tmplDoc of due) {
      const tmpl = tmplDoc.data() as any;
      const templateId = tmplDoc.id;

      try {
        const taskRef = db.collection('tasks').doc();
        const priority = tmpl.priority || 'medium';

        const taskData: Record<string, any> = {
          id: taskRef.id,
          tenantId: tmpl.tenantId,
          title: tmpl.title,
          status: 'open',
          priority,
          aiPriorityScore: PRIORITY_SCORE[priority] ?? 50,
          aiRiskLevel: 'none',
          aiAnalyzed: true,
          source: 'recurring',
          recurringTemplateId: templateId,
          createdBy: 'cron',
          createdByName: 'Periyodik Görev',
          createdAt: now,
          updatedAt: now,
        };

        // Opsiyonel blueprint alanları (undefined yazma)
        if (tmpl.description) taskData.description = tmpl.description;
        if (tmpl.category) {
          taskData.category = tmpl.category;
          taskData.categorySource = 'manual';
        }
        if (typeof tmpl.estimatedMinutes === 'number') taskData.estimatedMinutes = tmpl.estimatedMinutes;
        if (tmpl.tags?.length) taskData.tags = tmpl.tags;
        if (tmpl.assigneeId) taskData.assigneeId = tmpl.assigneeId;
        if (tmpl.assigneeName) taskData.assigneeName = tmpl.assigneeName;
        if (tmpl.assigneeRole) taskData.assigneeRole = tmpl.assigneeRole;
        if (tmpl.projectId) taskData.projectId = tmpl.projectId;
        if (tmpl.projectName) taskData.projectName = tmpl.projectName;
        if (tmpl.clientId) taskData.clientId = tmpl.clientId;
        if (tmpl.clientName) taskData.clientName = tmpl.clientName;

        // Deadline = spawn anı + dueOffsetHours
        if (typeof tmpl.dueOffsetHours === 'number' && tmpl.dueOffsetHours > 0) {
          taskData.dueDate = new Date(now.getTime() + tmpl.dueOffsetHours * 3600_000);
        }

        await taskRef.set(taskData);

        // Sıradaki çalışmayı hesapla ve şablonu ilerlet
        const next = getNextRunDate(
          tmpl.schedule?.cronExpression || '0 9 * * *',
          tmpl.schedule?.timezone || 'Europe/Istanbul',
          now
        ) || new Date(now.getTime() + 24 * 3600_000); // fallback: +1 gün

        await tmplDoc.ref.update({
          'schedule.lastRunAt': now,
          'schedule.nextRunAt': next,
          'schedule.lastSpawnedTaskId': taskRef.id,
          spawnCount: FieldValue.increment(1),
          updatedAt: now,
        });

        // Atanmış kişiye bildirim
        if (tmpl.assigneeId) {
          try {
            await db.collection('notifications').add({
              tenantId: tmpl.tenantId,
              userId: tmpl.assigneeId,
              type: 'system',
              title: 'Periyodik Görev Eklendi',
              message: `"${tmpl.title}" görevi otomatik olarak listene eklendi.`,
              link: '/admin/tasks',
              read: false,
              createdAt: now,
            });
          } catch (notifErr: any) {
            console.warn(`[cron/spawn-recurring-tasks] notif error ${templateId}:`, notifErr.message);
          }
        }

        results.push({ templateId, taskId: taskRef.id });
      } catch (err: any) {
        console.error(`[cron/spawn-recurring-tasks] error ${templateId}:`, err.message);
        results.push({ templateId, error: err.message });
      }
    }

    const spawned = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;
    console.log(`[cron/spawn-recurring-tasks] ${spawned} spawned, ${failed} failed`);

    return res.status(200).json({ spawned, failed, results, timestamp: now.toISOString() });
  } catch (error: any) {
    console.error('[cron/spawn-recurring-tasks] Fatal:', error.message);
    return res.status(500).json({ error: 'Cron hatası', details: error.message });
  }
}
