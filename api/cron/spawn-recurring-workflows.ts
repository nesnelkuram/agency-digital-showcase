/**
 * GET /api/cron/spawn-recurring-workflows
 *
 * Vercel Cron endpoint — runs hourly.
 * Finds workflow templates with recurringConfig.enabled=true whose
 * nextRunAt is in the past, instantiates a new workflow_instance for each,
 * and updates nextRunAt to the next scheduled run.
 *
 * Cron schedule: every hour at :00  (0 * * * *)
 * Authorization: CRON_SECRET Bearer token (Vercel injects this automatically)
 */
import '../_lib/env';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';

export const config = { maxDuration: 60 };

// ─── Minimal cron expression parser ──────────────────────────────────────────
// Supports: minute hour dom month dow  (no step syntax required for our use case)
function getNextRunDate(cronExpr: string, timezone: string, from: Date): Date {
  // We do a simple forward-scan — advance by 1 minute until the cron matches.
  // This handles the common weekly/daily cases reliably without a heavy library.
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return new Date(from.getTime() + 3600_000); // fallback: +1h

  const [minPart, hourPart, domPart, monPart, dowPart] = parts;

  function matches(value: number, expr: string): boolean {
    if (expr === '*') return true;
    const num = parseInt(expr, 10);
    return !isNaN(num) && value === num;
  }

  // Scan up to 8 days ahead (max interval for weekly crons)
  const candidate = new Date(from.getTime() + 60_000); // start 1 minute after now
  candidate.setSeconds(0, 0);

  const maxIterations = 8 * 24 * 60; // 8 days in minutes
  for (let i = 0; i < maxIterations; i++) {
    // Convert candidate to target timezone for field comparison
    const localStr = candidate.toLocaleString('en-US', { timeZone: timezone });
    const local = new Date(localStr);

    if (
      matches(local.getMinutes(), minPart) &&
      matches(local.getHours(), hourPart) &&
      matches(local.getDate(), domPart) &&
      matches(local.getMonth() + 1, monPart) &&
      matches(local.getDay(), dowPart)
    ) {
      return candidate;
    }

    candidate.setTime(candidate.getTime() + 60_000);
  }

  // Fallback: schedule in 7 days
  return new Date(from.getTime() + 7 * 24 * 3600_000);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify Vercel cron secret
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getAdminDb();
  const FieldValue = getFieldValue();
  const now = new Date();

  try {
    // ─── 1. Find all recurring templates due to run ───────────────────────
    const templatesSnap = await db
      .collection('workflow_templates')
      .where('recurringConfig.enabled', '==', true)
      .where('status', '==', 'published')
      .where('isLatest', '==', true)
      .get();

    const dueTemplates = templatesSnap.docs.filter((d: any) => {
      const rc = d.data().recurringConfig;
      if (!rc?.nextRunAt) return true; // never run yet → run now
      const nextRun = rc.nextRunAt.toDate ? rc.nextRunAt.toDate() : new Date(rc.nextRunAt);
      return nextRun <= now;
    });

    if (dueTemplates.length === 0) {
      return res.status(200).json({ spawned: 0, message: 'Zamanı gelen şablon yok.' });
    }

    const results: Array<{ templateId: string; instanceId: string; error?: string }> = [];

    for (const templateDoc of dueTemplates) {
      const templateId = templateDoc.id;
      const template = templateDoc.data() as any;
      const rc = template.recurringConfig;

      try {
        // ─── 2. Find the latest active project for this template's tenant ─
        // Recurring workflows use the template's tenantId. The spawned instance
        // gets a synthetic projectName from the template name + date.
        const tenantId = template.tenantId;
        const runDate = now.toLocaleDateString('tr-TR', {
          timeZone: rc.timezone || 'Europe/Istanbul',
          year: 'numeric', month: '2-digit', day: '2-digit',
        });
        const projectName = `${template.name} — ${runDate}`;

        // Use real projectId if template is bound to a project
        const boundProjectId = rc.projectId || `recurring-${templateId}`;

        // ─── 3. Flatten template nodes into step instances ─────────────────
        const steps: Record<string, any> = {};
        let startNodeId: string | null = null;

        for (const node of template.nodes || []) {
          if (node.type === 'subprocess' && node.subprocessConfig?.childTemplateId) {
            steps[node.id] = { nodeId: node.id, status: 'pending', currentRevision: 0, revisions: [], isSubProcess: true };

            const childSnap = await db.collection('workflow_templates').doc(node.subprocessConfig.childTemplateId).get();
            if (childSnap.exists) {
              const child = childSnap.data();
              for (const childNode of child.nodes || []) {
                const flatKey = `${node.id}::${childNode.id}`;
                steps[flatKey] = { nodeId: flatKey, status: 'pending', currentRevision: 0, revisions: [], parentStepId: node.id, isSubStep: true };
              }
            }
          } else {
            steps[node.id] = { nodeId: node.id, status: 'pending', currentRevision: 0, revisions: [] };
            if (node.type === 'start') startNodeId = node.id;
          }
        }

        // Mark start node completed
        if (startNodeId) {
          steps[startNodeId] = { ...steps[startNodeId], status: 'completed', completedAt: now };
        }

        // ─── 4. Create the workflow instance ──────────────────────────────
        const instanceRef = db.collection('workflow_instances').doc();
        const instanceData = {
          tenantId,
          templateId,
          templateVersion: template.version,
          templateName: template.name,
          projectId: boundProjectId,
          projectName,
          clientName: 'Periyodik Görev',
          serviceCategory: template.serviceCategory,
          workflowType: 'recurring',
          status: rc.autoStartOnCreate ? 'active' : 'pending',
          progress: 0,
          steps,
          activeNodeIds: [],
          activeAssigneeIds: [],
          activeStepLabels: [],
          context: {},
          auditLog: [],
          isRecurringInstance: true,
          recurringTemplateId: templateId,
          createdBy: 'cron',
          createdAt: now,
          updatedAt: now,
          lastActivityAt: now,
        };

        await instanceRef.set(instanceData);
        await instanceRef.collection('audit_log').add({
          action: 'workflow_started',
          description: `"${template.name}" periyodik iş akışı cron tarafından başlatıldı`,
          userId: 'cron',
          timestamp: now,
        });

        // ─── 5. Update template: nextRunAt + lastRunAt ─────────────────────
        const nextRun = getNextRunDate(
          rc.cronExpression || '0 9 * * 1',
          rc.timezone || 'Europe/Istanbul',
          now
        );

        await templateDoc.ref.update({
          'recurringConfig.lastRunAt': now,
          'recurringConfig.nextRunAt': nextRun,
          'recurringConfig.lastInstanceId': instanceRef.id,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // ─── 6. Notify project team members (if bound to a project) ───────
        if (rc.projectId) {
          try {
            const projectSnap = await db.collection('projects').doc(rc.projectId).get();
            if (projectSnap.exists) {
              const projectData = projectSnap.data();
              const recipientIds: string[] = [];
              // Add assigned user
              if (projectData?.assignedTo) recipientIds.push(projectData.assignedTo);
              // Add team members
              for (const member of projectData?.teamMembers || []) {
                if (member.uid && !recipientIds.includes(member.uid)) {
                  recipientIds.push(member.uid);
                }
              }
              // Write notifications
              for (const userId of recipientIds) {
                await db.collection('notifications').add({
                  tenantId,
                  userId,
                  type: 'workflow_step',
                  title: 'Periyodik Is Akisi Baslatildi',
                  message: `"${template.name}" periyodik is akisi otomatik olarak baslatildi.`,
                  link: rc.serviceCategory
                    ? `/admin/projects/${rc.projectId}/service/${rc.serviceCategory}`
                    : `/admin/projects/${rc.projectId}`,
                  read: false,
                  createdAt: now,
                });
              }
            }
          } catch (notifErr: any) {
            console.warn(`[cron] Notification error for template ${templateId}:`, notifErr.message);
          }
        }

        results.push({ templateId, instanceId: instanceRef.id });
      } catch (templateErr: any) {
        console.error(`[cron] Error spawning for template ${templateId}:`, templateErr.message);
        results.push({ templateId, instanceId: '', error: templateErr.message });
      }
    }

    const spawned = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;

    console.log(`[cron/spawn-recurring-workflows] ${spawned} spawned, ${failed} failed`);

    return res.status(200).json({
      spawned,
      failed,
      results,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error('[cron/spawn-recurring-workflows] Fatal error:', error.message);
    return res.status(500).json({ error: 'Cron hatası', details: error.message });
  }
}
