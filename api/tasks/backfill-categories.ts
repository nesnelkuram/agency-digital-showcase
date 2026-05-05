import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { generateJSON } from '../_lib/gemini-bundle.mjs';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getActiveProjects, formatProjectsForPrompt } from '../_lib/getActiveProjects.js';

export const config = {
  maxDuration: 60,
};

const PROMPT = (title: string, description: string, projectBlock: string) => `
Bir dijital ajans görevi için sadece kategori sınıflandırması yap.

Görev: ${title}
${description ? `Açıklama: ${description}` : ''}

## Aktif Projeler / Markalar
${projectBlock}

## Kategoriler
- "brand"    → Yukarıdaki projelerden/markalardan biriyle ilgili
- "admin"    → İdari iş (faturalandırma, ekip, ofis, satın alma, yazılım)
- "personal" → Kişisel iş

Eğer category="brand" ise listedeki bir id'yi döndür. Liste dışında bir marka adı varsa "projectName" alanına yaz, projectId=null bırak.

SADECE geçerli JSON döndür:
{
  "category": "brand" | "admin" | "personal",
  "projectId": string | null,
  "projectName": string | null,
  "categoryConfidence": number
}`;

interface ClassifyResult {
  category: 'brand' | 'admin' | 'personal';
  projectId: string | null;
  projectName: string | null;
  categoryConfidence: number;
}

const BATCH_SIZE = 10;

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin/manager only — fetch user role from Firestore
  const db = getAdminDb();
  const userDoc = await db.collection('users').doc(req.userId).get();
  const role = userDoc.data()?.role;
  if (!['admin', 'account_manager', 'project_manager'].includes(role)) {
    return res.status(403).json({ error: 'Yetkisiz: yalnızca yönetici çalıştırabilir' });
  }

  try {
    // Find tasks missing category for this tenant
    const tasksSnap = await db
      .collection('tasks')
      .where('tenantId', '==', req.tenantId)
      .get();

    const pending = tasksSnap.docs.filter((d) => !d.data().category).slice(0, BATCH_SIZE);

    if (pending.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Sınıflandırılacak görev kalmadı',
        processed: 0,
        remaining: 0,
      });
    }

    const projects = await getActiveProjects(req.tenantId);
    const projectBlock = formatProjectsForPrompt(projects);

    const results = await Promise.allSettled(
      pending.map(async (taskDoc) => {
        const data = taskDoc.data();
        const result = await generateJSON<ClassifyResult>(
          'flash',
          PROMPT(data.title || '', data.description || '', projectBlock),
          'task-backfill',
          { maxOutputTokens: 256, temperature: 0.2 }
        );

        const update: Record<string, any> = {
          category: result.category || 'admin',
          categorySource: 'ai',
          categoryConfidence: typeof result.categoryConfidence === 'number'
            ? Math.max(0, Math.min(1, result.categoryConfidence))
            : 0.5,
          updatedAt: new Date(),
        };

        if (result.category === 'brand' && result.projectId) {
          const matched = projects.find((p) => p.id === result.projectId);
          if (matched) {
            update.projectId = matched.id;
            update.projectName = matched.name;
          } else if (result.projectName) {
            update.projectName = result.projectName;
          }
        } else if (result.projectName) {
          update.projectName = result.projectName;
        }

        await taskDoc.ref.update(update);
        return taskDoc.id;
      })
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;

    // Re-count remaining (after this batch)
    const remainingSnap = await db
      .collection('tasks')
      .where('tenantId', '==', req.tenantId)
      .get();
    const remaining = remainingSnap.docs.filter((d) => !d.data().category).length;

    return res.status(200).json({
      success: true,
      processed: succeeded,
      failed,
      remaining,
      hasMore: remaining > 0,
    });
  } catch (error: any) {
    console.error('tasks/backfill-categories error:', error);
    return res.status(500).json({ error: String(error?.message || 'Backfill failed') });
  }
});
