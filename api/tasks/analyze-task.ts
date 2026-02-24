import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { generateJSON } from '../_lib/gemini-bundle.mjs';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

const PROMPT_TEMPLATE = (title: string, description: string) => `
Bir dijital ajans görevi için analiz yap. Aşağıdaki görevi değerlendir ve JSON döndür.

Görev: ${title}
${description ? `Açıklama: ${description}` : ''}

Kurallar:
- projectName: Metinden çıkar. "Rakle", "ABC Ajans", "XYZ" gibi özel isimler. Yoksa null.
- clientName: Müşteri adı. Yoksa null.
- suggestedAssigneeRole: Sadece birini seç → videographer | designer | social_media_manager | project_manager | editor | admin | account_manager
  * Video kurgu, çekim, prodüksiyon → videographer
  * Grafik, illüstrasyon, tasarım, görsel → designer
  * Instagram, TikTok, post, story, içerik → social_media_manager
  * Koordinasyon, toplantı, sunum, müşteri → project_manager
  * Metin, kopya, blog, yazı → editor
  * Teknik, geliştirme, web → admin
  * Müşteri görüşmesi, teklif → account_manager
- aiPriorityScore: 0-100
  * Başlangıç: 50
  * "acil", "urgent", "asap" → +30
  * "bugün", "today" → +35
  * "yarın", "tomorrow" → +25
  * "bu hafta", "this week" → +15
  * "sunum", "müşteri" → +10
  * "revizyon", "düzeltme" → +10
- priority: critical (≥85) | high (≥65) | medium (≥45) | low (<45)
- aiRiskLevel: high (≥80) | medium (≥60) | low (≥40) | none (<40)
- aiRiskFlags: Kısa risk açıklamaları dizisi. Max 3 madde.
- tags: Kısa etiketler dizisi. Max 5 madde.
- aiScoreRationale: 1 cümle Türkçe açıklama.

SADECE geçerli JSON döndür, başka hiçbir şey yazma:
{
  "projectName": string | null,
  "clientName": string | null,
  "suggestedAssigneeRole": string,
  "priority": "critical" | "high" | "medium" | "low",
  "aiPriorityScore": number,
  "aiRiskLevel": "none" | "low" | "medium" | "high",
  "aiRiskFlags": string[],
  "tags": string[],
  "aiScoreRationale": string
}`;

interface AnalysisResult {
  projectName: string | null;
  clientName: string | null;
  suggestedAssigneeRole: string;
  priority: string;
  aiPriorityScore: number;
  aiRiskLevel: string;
  aiRiskFlags: string[];
  tags: string[];
  aiScoreRationale: string;
}

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId } = req.body || {};
    if (!taskId) {
      return res.status(400).json({ error: 'Missing taskId' });
    }

    const db = getAdminDb();
    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskData = taskDoc.data()!;
    if (taskData.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const title = taskData.title || '';
    const description = taskData.description || '';

    const result = await generateJSON<AnalysisResult>(
      'flash',
      PROMPT_TEMPLATE(title, description),
      'task-analyze',
      { maxOutputTokens: 1024, temperature: 0.3 }
    );

    // Resolve suggestedAssigneeRole → actual user
    let suggestedAssigneeId: string | undefined;
    let suggestedAssigneeName: string | undefined;

    if (result.suggestedAssigneeRole) {
      try {
        const usersSnap = await db
          .collection('users')
          .where('tenantId', '==', req.tenantId)
          .where('role', '==', result.suggestedAssigneeRole)
          .limit(1)
          .get();

        if (!usersSnap.empty) {
          const u = usersSnap.docs[0];
          suggestedAssigneeId = u.id;
          suggestedAssigneeName = u.data().displayName || u.data().name || '';
        }
      } catch {
        // non-fatal
      }
    }

    const updates: Record<string, any> = {
      priority: result.priority || 'medium',
      aiPriorityScore: result.aiPriorityScore ?? 50,
      aiRiskLevel: result.aiRiskLevel || 'none',
      aiRiskFlags: result.aiRiskFlags || [],
      tags: result.tags || [],
      aiScoreRationale: result.aiScoreRationale || '',
      suggestedAssigneeRole: result.suggestedAssigneeRole || '',
      aiAnalyzed: true,
      updatedAt: new Date(),
    };

    if (result.projectName) updates.projectName = result.projectName;
    if (result.clientName) updates.clientName = result.clientName;
    if (suggestedAssigneeId) updates.suggestedAssigneeId = suggestedAssigneeId;
    if (suggestedAssigneeName) updates.suggestedAssigneeName = suggestedAssigneeName;

    await taskRef.update(updates);

    // Notify suggested assignee
    if (suggestedAssigneeId && suggestedAssigneeId !== req.userId) {
      try {
        const notifRef = db.collection('notifications').doc();
        await notifRef.set({
          id: notifRef.id,
          tenantId: req.tenantId,
          userId: suggestedAssigneeId,
          type: 'workflow_step',
          title: 'Yeni Görev Önerisi',
          message: `"${title}" görevi için delegasyon önerisi var.`,
          link: `/admin/tasks?task=${taskId}`,
          read: false,
          createdAt: new Date(),
        });
      } catch {
        // non-fatal
      }
    }

    return res.status(200).json({ success: true, taskId, analysis: updates });
  } catch (error: any) {
    console.error('tasks/analyze-task error:', error);
    // Mark task as analyzed even on error (don't leave it stuck)
    try {
      const { taskId } = req.body || {};
      if (taskId) {
        await getAdminDb().collection('tasks').doc(taskId).update({
          aiAnalyzed: true,
          updatedAt: new Date(),
        });
      }
    } catch {/* ignore */}
    return res.status(500).json({ error: String(error?.message || 'Analysis failed') });
  }
});
