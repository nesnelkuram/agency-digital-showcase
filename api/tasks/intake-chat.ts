import type { VercelResponse } from '@vercel/node';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { generateJSON } from '../_lib/gemini-bundle.mjs';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';

export const config = {
  maxDuration: 60,
};

const SYSTEM_PROMPT = `Sen bir dijital ajans için AI görev direktörüsün. Türkçe konuşarak kullanıcıdan görev bilgilerini topluyorsun ve görevi önceliklendiriyorsun.

## Görevin
Maksimum 3 turda görev bilgilerini topla, öncelik skoru hesapla ve görevi kaydet.

## Tur Akışı
- Tur 1 (zorunlu): Görev başlığı, açıklama, son tarih, tahmini süre
- Tur 2 (gerekirse): Proje/müşteri bilgisi, bağımlılıklar, riskler
- Tur 3 (her zaman final): Özet + save_task aksiyonu

## Öncelik Skoru Hesaplama (0–100)
Başlangıç: 50
- Son tarih ≤ 1 gün: +40
- Son tarih ≤ 3 gün: +25
- Son tarih ≤ 7 gün: +10
- Müşteriye yönelik iş: +15
- Bağımlılık riski var: +10
- Revizyon/acil: +15

## Risk Seviyeleri
- high: skor ≥ 80
- medium: skor ≥ 60
- low: skor ≥ 40
- none: skor < 40

## Atama Önerileri (suggestedAssigneeRole)
- Video kurgu, prodüksiyon → videographer
- Grafik, tasarım, görsel → designer
- Sosyal medya, içerik → social_media_manager
- Proje yönetimi, koordinasyon → project_manager
- Metin, kopya, içerik → editor
- Teknik, geliştirme → admin
- Müşteri görüşmesi → account_manager

## save_task Aksiyonu
Son turda (veya yeterli bilgi toplandığında) taskDraft'ı tamamla ve save_task aksiyonunu döndür.

## Kurallar
- Türkçe konuş, samimi ama profesyonel ol
- Maksimum 3 soru sor, gereksiz uzatma
- Her turda taskDraft'ı güncelle (incremental değil, tam obje döndür)
- Final turda mutlaka save_task aksiyonu ekle

## Delegasyon Skoru Hesaplama (0-100)
Başlangıç: 50
- Standart/rutin iş (rapor, kurgu, tasarım): +30
- Net süreç/şablon ile yapılabilir: +20
- Karar gerektiren stratejik iş: -30
- Acil (≤1 gün deadline): -20
- Teknik uzmanlık gerektiren: -10
- Müşteri ile yüz yüze görüşme: -15
- Yaratıcı yönetim kararı: -25

## Yanıt Formatı (Geçerli JSON)
{
  "reply": "Kullanıcıya Türkçe yanıt",
  "action": "none" | "ask_more" | "save_task",
  "taskDraft": {
    "title": "string",
    "description": "string (opsiyonel)",
    "priority": "critical" | "high" | "medium" | "low",
    "aiPriorityScore": 0-100,
    "aiScoreRationale": "string",
    "aiRiskLevel": "none" | "low" | "medium" | "high",
    "aiRiskFlags": ["string"],
    "suggestedAssigneeRole": "string",
    "projectName": "string (opsiyonel)",
    "clientName": "string (opsiyonel)",
    "estimatedHours": 0,
    "dueDate": "ISO string veya null",
    "tags": ["string"],
    "delegationScore": 0-100,
    "delegationRationale": "Neden bu delegasyon skoru (1-2 cümle)",
    "delegationBlockers": ["engel1"] veya []
  }
}

ÖNEMLİ: Sadece geçerli JSON döndür. Başka hiçbir şey yazma.`;

interface IntakeResponse {
  reply: string;
  action: 'none' | 'ask_more' | 'save_task';
  taskDraft: Record<string, any> | null;
}

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.AI_TASK_INTAKE)) return;

  try {
    const { sessionId, message, forceSave } = req.body || {};

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, message' });
    }

    const db = getAdminDb();

    // Load session
    const sessionDoc = await db.collection('task_intake_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionData = sessionDoc.data()!;
    if (sessionData.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (sessionData.status === 'complete') {
      return res.status(400).json({ error: 'Session already completed' });
    }

    const history = sessionData.messages || [];
    const currentDraft = sessionData.taskDraft || null;
    const turnCount = Math.floor(history.length / 2); // user/assistant pairs

    // Build prompt
    const parts: string[] = [SYSTEM_PROMPT, ''];

    if (currentDraft) {
      parts.push('## Mevcut Görev Taslağı');
      parts.push('```json');
      parts.push(JSON.stringify(currentDraft, null, 2));
      parts.push('```');
      parts.push('');
    }

    const recentHistory = history.slice(-10);
    if (recentHistory.length > 0) {
      parts.push('## Konuşma Geçmişi');
      for (const msg of recentHistory) {
        parts.push(`${msg.role === 'user' ? 'Kullanıcı' : 'AI Direktör'}: ${msg.content}`);
      }
      parts.push('');
    }

    // Force final turn at turn 3
    if (turnCount >= 2) {
      parts.push('## ÖNEMLI: Bu son turdur (tur 3). taskDraft\'ı tamamla ve save_task aksiyonunu döndür.');
      parts.push('');
    }

    parts.push('## Kullanıcının Mesajı');
    parts.push(message);
    parts.push('');
    parts.push(`## Yanıt Formatı
Sadece geçerli JSON döndür:
{
  "reply": "Türkçe yanıt",
  "action": "none" | "ask_more" | "save_task",
  "taskDraft": { ... }
}`);

    const prompt = parts.join('\n');

    const result = await generateJSON<IntakeResponse>(
      'flash',
      prompt,
      'task-intake',
      { maxOutputTokens: 4096, temperature: 0.6 }
    );

    const reply = result.reply || 'Anlayamadım, lütfen tekrar deneyin.';
    let action = result.action || 'none';
    const taskDraft = result.taskDraft || currentDraft;

    // Force save on final turn or when client requests forceSave
    if ((turnCount >= 2 || forceSave) && taskDraft?.title) {
      action = 'save_task';
    }

    // Save messages
    const userMsg = { role: 'user' as const, content: message, timestamp: Date.now() };
    const assistantMsg = {
      role: 'assistant' as const,
      content: reply,
      action,
      timestamp: Date.now(),
    };

    const FieldValue = getFieldValue();
    const updateData: Record<string, any> = {
      messages: FieldValue.arrayUnion(userMsg, assistantMsg),
      updatedAt: Date.now(),
    };

    if (taskDraft) {
      updateData.taskDraft = taskDraft;
    }

    // If save_task, create the task in Firestore
    let createdTaskId: string | null = null;

    if (action === 'save_task' && taskDraft) {
      // Resolve suggested assignee by role
      let suggestedAssigneeId: string | undefined;
      let suggestedAssigneeName: string | undefined;

      if (taskDraft.suggestedAssigneeRole) {
        try {
          const usersSnap = await db.collection('users')
            .where('tenantId', '==', req.tenantId)
            .where('role', '==', taskDraft.suggestedAssigneeRole)
            .limit(5)
            .get();

          if (!usersSnap.empty) {
            // Pick first available (could be improved with workload check)
            const userDoc = usersSnap.docs[0];
            suggestedAssigneeId = userDoc.id;
            suggestedAssigneeName = userDoc.data().displayName || userDoc.data().name || '';
          }
        } catch (err) {
          console.warn('[intake-chat] Failed to resolve assignee:', err);
        }
      }

      // Parse dueDate — pass Date directly; Admin SDK converts automatically
      let dueDateValue: Date | null = null;
      if (taskDraft.dueDate) {
        try {
          const d = new Date(taskDraft.dueDate);
          if (!isNaN(d.getTime())) dueDateValue = d;
        } catch {
          // ignore parse error
        }
      }

      const taskRef = db.collection('tasks').doc();
      const now = new Date();

      const taskData: Record<string, any> = {
        id: taskRef.id,
        tenantId: req.tenantId,
        title: taskDraft.title || 'Yeni Görev',
        status: 'open',
        priority: taskDraft.priority || 'medium',
        aiPriorityScore: taskDraft.aiPriorityScore ?? 50,
        aiRiskLevel: taskDraft.aiRiskLevel || 'none',
        createdBy: req.userId,
        createdByName: req.userDisplayName || '',
        createdAt: now,
        updatedAt: now,
        intakeSessionId: sessionId,
      };

      // Optional fields (strip undefined)
      if (taskDraft.description) taskData.description = taskDraft.description;
      if (taskDraft.aiScoreRationale) taskData.aiScoreRationale = taskDraft.aiScoreRationale;
      if (taskDraft.aiRiskFlags?.length) taskData.aiRiskFlags = taskDraft.aiRiskFlags;
      if (taskDraft.suggestedAssigneeRole) taskData.suggestedAssigneeRole = taskDraft.suggestedAssigneeRole;
      if (suggestedAssigneeId) taskData.suggestedAssigneeId = suggestedAssigneeId;
      if (suggestedAssigneeName) taskData.suggestedAssigneeName = suggestedAssigneeName;
      if (taskDraft.projectName) taskData.projectName = taskDraft.projectName;
      if (taskDraft.clientName) taskData.clientName = taskDraft.clientName;
      if (taskDraft.estimatedHours) taskData.estimatedHours = taskDraft.estimatedHours;
      if (dueDateValue) taskData.dueDate = dueDateValue;
      if (taskDraft.tags?.length) taskData.tags = taskDraft.tags;
      if (taskDraft.delegationScore != null) taskData.delegationScore = taskDraft.delegationScore;
      if (taskDraft.delegationRationale) taskData.delegationRationale = taskDraft.delegationRationale;
      if (taskDraft.delegationBlockers?.length) taskData.delegationBlockers = taskDraft.delegationBlockers;
      taskData.source = 'intake';

      await taskRef.set(taskData);
      createdTaskId = taskRef.id;

      // Mark session complete
      updateData.status = 'complete';
      updateData.createdTaskId = createdTaskId;

      // Send notification to suggested assignee if different from creator
      if (suggestedAssigneeId && suggestedAssigneeId !== req.userId) {
        try {
          const notifRef = db.collection('notifications').doc();
          await notifRef.set({
            id: notifRef.id,
            tenantId: req.tenantId,
            userId: suggestedAssigneeId,
            type: 'workflow_step',
            title: 'Yeni Görev Önerisi',
            message: `"${taskData.title}" görevi için delegasyon önerisi var.`,
            link: `/admin/tasks?task=${taskRef.id}`,
            read: false,
            createdAt: new Date(),
          });
        } catch (notifErr) {
          console.warn('[intake-chat] Notification failed:', notifErr);
        }
      }
    }

    await db.collection('task_intake_sessions').doc(sessionId).update(updateData);

    return res.status(200).json({
      reply,
      action,
      taskDraft,
      createdTaskId,
    });
  } catch (error: any) {
    console.error('tasks/intake-chat error:', error);
    return res.status(500).json({ error: String(error?.message || 'Intake chat failed') });
  }
});
