import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { generateJSON } from '../_lib/gemini-bundle.mjs';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getActiveProjects, formatProjectsForPrompt } from '../_lib/getActiveProjects.js';

const PROMPT_TEMPLATE = (title: string, description: string, projectListBlock: string) => `
Bir dijital ajans görevi için analiz yap. Aşağıdaki görevi değerlendir ve JSON döndür.

Görev: ${title}
${description ? `Açıklama: ${description}` : ''}

## Aktif Projeler / Markalar
${projectListBlock}

## Kategori Sınıflandırması (ZORUNLU)
- "brand"    → Görev yukarıdaki aktif projelerden/markalardan biriyle ilgiliyse (Rakle, Dieci vb.)
- "admin"    → İdari iş: ekip yönetimi, faturalandırma, ofis, yazılım, satın alma, bordro, iş başvurusu, kurum içi süreç
- "personal" → Kişisel/özel iş: özel takvim, kişisel notlar, ajans dışı kişisel görevler

## Proje Eşleştirme
- Eğer category="brand" ise yukarıdaki listeden en uygun projenin **id**'sini "projectId" alanında döndür.
- Eşleşme net değilse veya proje listede yoksa: category="admin" yap, projectId=null bırak.
- Emin değilsen düşük confidence ver, yanlış marka atama!

## Diğer Kurallar
- projectName: Sadece liste dışı bir marka adı geçerse (eski/eksik proje), düz metin olarak döndür. Liste içindeyse "projectId" verince zaten otomatik dolacak — burayı null bırak.
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
- aiScoreRationale: 1 cümle Türkçe açıklama. Örnek: "Yarın deadline ve müşteri işi — bugünün önceliği."
- categoryConfidence: 0.0–1.0 arası, kategori atamasının güvenirliği.
- eisenhowerQuadrant: Eisenhower matrisi atama. Önemli = ajansın gelirine/müşteri ilişkisine/stratejik hedeflerine katkı. Acil = 1-3 gün içinde yapılmazsa kayıp/risk.
  * q1 = Önemli + Acil (müşteri teslimi yarın, kritik bug)
  * q2 = Önemli + Acil değil (uzun vadeli strateji, eğitim, prosedür yazımı)
  * q3 = Acil + Önemsiz (telefonlara cevap, küçük rica, başkasının deadline'ı)
  * q4 = İkisi de değil (büro temizliği, "bakılması gereken" arşiv)
  Şüphedeysen q2 ver — en güvenli default.

SADECE geçerli JSON döndür, başka hiçbir şey yazma:
{
  "category": "brand" | "admin" | "personal",
  "projectId": string | null,
  "categoryConfidence": number,
  "projectName": string | null,
  "clientName": string | null,
  "suggestedAssigneeRole": string,
  "priority": "critical" | "high" | "medium" | "low",
  "aiPriorityScore": number,
  "aiRiskLevel": "none" | "low" | "medium" | "high",
  "aiRiskFlags": string[],
  "tags": string[],
  "aiScoreRationale": string,
  "eisenhowerQuadrant": "q1" | "q2" | "q3" | "q4"
}`;

interface AnalysisResult {
  category: 'brand' | 'admin' | 'personal';
  projectId: string | null;
  categoryConfidence: number;
  projectName: string | null;
  clientName: string | null;
  suggestedAssigneeRole: string;
  priority: string;
  aiPriorityScore: number;
  aiRiskLevel: string;
  aiRiskFlags: string[];
  tags: string[];
  aiScoreRationale: string;
  eisenhowerQuadrant?: 'q1' | 'q2' | 'q3' | 'q4';
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

    // Frontend just wrote the doc — Admin SDK may need a beat to see it
    let taskDoc = await taskRef.get();
    for (let i = 0; i < 2 && !taskDoc.exists; i++) {
      await new Promise((r) => setTimeout(r, 250));
      taskDoc = await taskRef.get();
    }

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskData = taskDoc.data()!;
    if (taskData.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Don't overwrite manual category assignments
    const isManualCategory = taskData.categorySource === 'manual';

    const title = taskData.title || '';
    const description = taskData.description || '';

    const projects = await getActiveProjects(req.tenantId);
    const projectBlock = formatProjectsForPrompt(projects);

    // Son 10 kullanıcı tercih sinyali — AI'ya "bu ajansta bu tip işler nasıl önceliklenir" sezgisi
    let signalsBlock = '';
    try {
      const sigSnap = await db
        .collection('priority_signals')
        .where('tenantId', '==', req.tenantId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
      if (!sigSnap.empty) {
        const examples = sigSnap.docs
          .map((d) => d.data())
          .filter((s: any) => s.toColumn && s.taskTitle)
          .map((s: any) => {
            const moved = s.fromColumn === s.toColumn ? 'sıraladı' : `${s.fromColumn}→${s.toColumn}`;
            const flagged = s.wasFlagged ? ' [BAYRAKLI]' : '';
            const ctx = s.projectName ? ` (${s.projectName})` : '';
            return `- "${s.taskTitle}"${ctx}${flagged} → kullanıcı manuel ${moved}`;
          });
        if (examples.length > 0) {
          signalsBlock = `\n## Kullanıcının Son Manuel Öncelikleri (örnek olarak öğren)\n${examples.join('\n')}\n`;
        }
      }
    } catch {/* index yok ya da boş — sessiz geç */}

    const result = await generateJSON<AnalysisResult>(
      'flash',
      PROMPT_TEMPLATE(title, description, projectBlock) + signalsBlock,
      'task-analyze',
      { maxOutputTokens: 1024, temperature: 0.3 }
    );

    // Validate AI projectId actually exists in the active list
    let resolvedProjectId: string | undefined;
    let resolvedProjectName: string | undefined;
    if (result.projectId) {
      const match = projects.find((p) => p.id === result.projectId);
      if (match) {
        resolvedProjectId = match.id;
        resolvedProjectName = match.name;
      }
    }

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

    const validQuadrants = ['q1', 'q2', 'q3', 'q4'] as const;
    const quadrant = validQuadrants.includes(result.eisenhowerQuadrant as any)
      ? (result.eisenhowerQuadrant as 'q1' | 'q2' | 'q3' | 'q4')
      : 'q2';

    const updates: Record<string, any> = {
      priority: result.priority || 'medium',
      aiPriorityScore: result.aiPriorityScore ?? 50,
      aiRiskLevel: result.aiRiskLevel || 'none',
      aiRiskFlags: result.aiRiskFlags || [],
      tags: result.tags || [],
      aiScoreRationale: result.aiScoreRationale || '',
      suggestedAssigneeRole: result.suggestedAssigneeRole || '',
      eisenhowerQuadrant: quadrant,
      aiAnalyzed: true,
      updatedAt: new Date(),
    };

    // Category — only override when not manually set
    if (!isManualCategory) {
      updates.category = result.category || 'admin';
      updates.categorySource = 'ai';
      updates.categoryConfidence = typeof result.categoryConfidence === 'number'
        ? Math.max(0, Math.min(1, result.categoryConfidence))
        : 0.5;

      if (resolvedProjectId) {
        updates.projectId = resolvedProjectId;
        updates.projectName = resolvedProjectName;
      } else if (result.projectName) {
        updates.projectName = result.projectName;
      }
    }

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
