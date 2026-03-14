/**
 * POST /api/tasks/score-delegation
 *
 * AI-powered delegation scoring for a specific task.
 * Uses Gemini Flash to evaluate delegability (0–100).
 *
 * Auth: withAuth
 */
import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
// @ts-ignore — pre-bundled
import { generateJSON } from '../_lib/gemini-bundle.mjs';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';

export const config = { maxDuration: 30 };

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.AI_ANALYSIS)) return;

  try {
    const { taskId } = req.body || {};
    if (!taskId) {
      return res.status(400).json({ error: 'Missing taskId' });
    }

    const db = getAdminDb();
    const taskDoc = await db.collection('tasks').doc(taskId).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskDoc.data()!;
    if (task.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const prompt = `Bir dijital ajans sahibi olarak bu görevi başka birine delege edip edemeyeceğini değerlendir.

Görev Bilgileri:
- Başlık: ${task.title}
- Açıklama: ${task.description || 'Yok'}
- Öncelik: ${task.priority}
- AI Öncelik Skoru: ${task.aiPriorityScore}
- Risk Seviyesi: ${task.aiRiskLevel}
- Son Tarih: ${task.dueDate ? 'Var' : 'Yok'}
- Etiketler: ${task.tags?.join(', ') || 'Yok'}
- Atanan: ${task.assigneeName || 'Atanmamış'}

Delegasyon Skoru Kriterleri (0-100):
Başlangıç: 50
- Standart/rutin iş (rapor, kurgu, tasarım): +30
- Net süreç/şablon ile yapılabilir: +20
- Karar gerektiren stratejik iş: -30
- Acil (≤1 gün deadline): -20
- Teknik uzmanlık gerektiren: -10
- Müşteri ile yüz yüze görüşme: -15
- Yaratıcı yönetim kararı: -25

JSON döndür:
{
  "delegationScore": 0-100,
  "delegationRationale": "Türkçe açıklama (1-2 cümle)",
  "delegationBlockers": ["engel1", "engel2"] veya [],
  "suggestedAssigneeRole": "videographer|designer|social_media_manager|editor|account_manager|project_manager|admin" veya null
}

Sadece geçerli JSON döndür.`;

    const result = await generateJSON(
      'flash',
      prompt,
      'delegation-scoring',
      { maxOutputTokens: 512, temperature: 0.4 }
    );

    // Update task with delegation score
    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (result.delegationScore != null) updates.delegationScore = result.delegationScore;
    if (result.delegationRationale) updates.delegationRationale = result.delegationRationale;
    if (result.delegationBlockers) updates.delegationBlockers = result.delegationBlockers;
    if (result.suggestedAssigneeRole) updates.suggestedAssigneeRole = result.suggestedAssigneeRole;

    await taskDoc.ref.update(updates);

    return res.status(200).json({
      taskId,
      delegationScore: result.delegationScore,
      delegationRationale: result.delegationRationale,
      delegationBlockers: result.delegationBlockers,
      suggestedAssigneeRole: result.suggestedAssigneeRole,
    });
  } catch (error: any) {
    console.error('tasks/score-delegation error:', error);
    return res.status(500).json({ error: String(error?.message || 'Delegation scoring failed') });
  }
});
