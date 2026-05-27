import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { generateJSON } from '../_lib/gemini-bundle.mjs';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';
import { getActiveProjects, formatProjectsForPrompt } from '../_lib/getActiveProjects.js';

interface BreakdownStep {
  title: string;
  estimatedMinutes: number;
  alreadyDone?: boolean;       // bu görev "devam eden bir iş" ise AI önceden tamamlanmış olabileceğini düşündüğü step
  trainingResourceId?: string; // SOP'tan miras
}

interface SopMatch {
  matchedSopId: string | null;
  matchedSopName: string | null;
  confidence: number;        // 0–1
  reasoning: string;
}

interface BreakdownResult {
  shouldBreakdown: boolean;
  reason: string;
  steps: BreakdownStep[];
}

// ─── SOP matcher prompt ──────────────────────────────────────────────────────
const SOP_MATCH_PROMPT = (
  title: string,
  description: string,
  sopList: Array<{ id: string; name: string; description: string; keywords: string[] }>
) => `
Ajansın elinde aşağıdaki hazır iş kalıpları (SOP'lar) var. Yeni gelen göreve EN UYGUN olanı seç.

## Yeni Görev
Başlık: ${title}
${description ? `Açıklama: ${description}` : ''}

## Mevcut SOP Kalıpları
${sopList.length === 0 ? 'Hiç kalıp yok.' : sopList.map((s, i) => `${i + 1}. id="${s.id}" | "${s.name}" | ${s.description} | keywords: ${s.keywords.join(', ')}`).join('\n')}

## Karar
- En az %70 emin olduğun bir eşleşme varsa: matchedSopId + name + confidence (0.7–1.0) ver.
- Şüphedeysen veya hiç uygun yoksa: matchedSopId=null, confidence=0 ver. Generic AI üretimi devreye girecek.

JSON döndür:
{
  "matchedSopId": "id_or_null",
  "matchedSopName": "name_or_null",
  "confidence": 0.0,
  "reasoning": "kısa Türkçe açıklama"
}`;

// ─── Generic breakdown prompt (SOP yoksa) ────────────────────────────────────
const GENERIC_BREAKDOWN_PROMPT = (
  title: string,
  description: string,
  projectListBlock: string
) => `
Bir dijital ajans için tek bir görev başlığını okuyup, SOP (standart operasyon prosedürü) çıkarman gerekiyor.

Görev başlığı: "${title}"
${description ? `Açıklama: ${description}` : ''}

## Aktif Projeler / Markalar (bağlam için)
${projectListBlock}

## KARAR
Önce karar ver: bu görev "karmaşık" mı yoksa "atomik" mi?
- ATOMIK = tek oturumda yapılır, açıkça tek bir aksiyon. Örnek: "Selen'e mail at", "fatura onaylar".
- KARMAŞIK = çok adım gerektirir, bir süreç içerir. Örnek: "video çekilecek", "kampanya başlat".

ATOMIK ise: shouldBreakdown=false, steps=[], reason kısa.
KARMAŞIK ise: shouldBreakdown=true, 3–8 adımlık sıralı SOP.

## SOP Kuralları
- Her adım net bir aksiyon, emir kipinde.
- Sıralı ve mantıklı: hazırlık → üretim → onay/teslim.
- Her adım için estimatedMinutes (15–240).
- 3'ten az = küçük iş (shouldBreakdown=false).
- 8'den fazlaysa birleştir.

JSON döndür:
{
  "shouldBreakdown": boolean,
  "reason": "kısa Türkçe açıklama",
  "steps": [{ "title": "...", "estimatedMinutes": 30 }]
}`;

// ─── SOP'tan kişiselleştirme prompt ──────────────────────────────────────────
const PERSONALIZE_PROMPT = (
  title: string,
  sopName: string,
  sopSteps: Array<{ title: string; estimatedMinutes: number; assigneeRole?: string; trainingResourceId?: string }>,
  brandName: string | null,
  brandContext: string | null
) => `
"${sopName}" SOP'unu aşağıdaki göreve uyarla.

Görev: "${title}"
${brandName ? `Marka: ${brandName}` : ''}
${brandContext ? `Marka bağlamı: ${brandContext}` : ''}

## Mevcut SOP Adımları (orijinal sıra korunur — index 0'dan başlar)
${sopSteps.map((s, i) => `[${i}] ${s.title} (${s.estimatedMinutes}dk${s.assigneeRole ? `, ${s.assigneeRole}` : ''})`).join('\n')}

## DEVAM EDEN İŞ TESPİTİ — KRİTİK
Görev başlığı "2. bölüm", "ikinci episode", "devam", "sonraki", "yeni bölüm", "v2", "revizyon" gibi
ipuçları içeriyorsa veya aynı projeden tekrarlanan bir parça gibi görünüyorsa:
→ Genelde yalnızca BAŞLANGIÇTAKİ hazırlık/kurulum adımları zaten yapılmış olur.
→ Bu durumda o adımlar için "alreadyDone": true işaretle.
→ Belirsizse alreadyDone vermeden geç — kullanıcı modal'da işaretler.

Örnek: "Soner Şef 3. bölüm kurgusu" → "proje kurulum, kamera senkron, çekim" alreadyDone=true,
"kurgu, color, ses, render, upload, açıklama" yapılacak.

## Çıktı Kuralları
- Adımları olduğu gibi kullan AMA başlıklarını göreve özgü hâle getir.
  Örnek: "Brief'i müşteriden al" → "Brief'i Dieci'den al"
- sortIndex orijinal SOP step index'i (önemli — training video bağlantısı için)
- Süreleri makul tut, hafif ayarla (±30%).
- SADECE JSON döndür:

{
  "steps": [
    { "title": "...", "estimatedMinutes": 30, "sortIndex": 0, "alreadyDone": false }
  ]
}`;

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
    const taskRef = db.collection('tasks').doc(taskId);

    // Retry: Firestore write replication
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

    if (taskData.parentTaskId) {
      return res.status(200).json({ shouldBreakdown: false, reason: 'Alt görev — bölünmez.', steps: [], matchedSop: null });
    }
    if (typeof taskData.subTaskCount === 'number' && taskData.subTaskCount > 0) {
      return res.status(200).json({ shouldBreakdown: false, reason: 'Zaten bölünmüş.', steps: [], matchedSop: null });
    }

    const title = taskData.title || '';
    const description = taskData.description || '';

    // ─── Adım 1: SOP eşleşmesi dene ─────────────────────────────────────────
    const sopsSnap = await db
      .collection('agency_sops')
      .where('tenantId', '==', req.tenantId)
      .get();

    const availableSops = sopsSnap.docs.map((d) => {
      const s = d.data();
      return {
        id: d.id,
        name: s.name as string,
        description: (s.description as string) || '',
        keywords: (s.matchKeywords as string[]) || [],
        steps: (s.steps as Array<{
          title: string;
          estimatedMinutes: number;
          assigneeRole?: string;
          trainingResourceId?: string;
        }>) || [],
      };
    });

    let matchedSop: { id: string; name: string; steps: typeof availableSops[0]['steps'] } | null = null;

    if (availableSops.length > 0) {
      try {
        const matchResult = await generateJSON<SopMatch>(
          'flash',
          SOP_MATCH_PROMPT(title, description, availableSops.map((s) => ({ id: s.id, name: s.name, description: s.description, keywords: s.keywords }))),
          'sop-matcher',
          { maxOutputTokens: 512, temperature: 0.2 }
        );

        if (matchResult.matchedSopId && matchResult.confidence >= 0.7) {
          const found = availableSops.find((s) => s.id === matchResult.matchedSopId);
          if (found) {
            matchedSop = { id: found.id, name: found.name, steps: found.steps };
          }
        }
      } catch (err) {
        console.warn('[breakdown-task] SOP match failed, falling back to generic:', err);
      }
    }

    // ─── Adım 2A: SOP bulundu → kişiselleştir ───────────────────────────────
    if (matchedSop) {
      const personalized = await generateJSON<{
        steps: Array<BreakdownStep & { sortIndex?: number }>;
      }>(
        'flash',
        PERSONALIZE_PROMPT(
          title,
          matchedSop.name,
          matchedSop.steps,
          taskData.projectName || null,
          null // brand DNA Dalga 2'de
        ),
        'sop-personalize',
        { maxOutputTokens: 1024, temperature: 0.3 }
      );

      const rawSteps = Array.isArray(personalized.steps) ? personalized.steps : [];
      const steps: BreakdownStep[] = rawSteps
        .filter((s) => s && typeof s.title === 'string' && s.title.trim().length > 0)
        .slice(0, 12)
        .map((s) => {
          // SOP step'inden trainingResourceId taşı (AI sortIndex verirse o, yoksa pozisyondan)
          const idx = typeof s.sortIndex === 'number' ? s.sortIndex : -1;
          const trainingResourceId =
            idx >= 0 && idx < matchedSop!.steps.length
              ? matchedSop!.steps[idx]?.trainingResourceId
              : undefined;
          return {
            title: s.title.trim(),
            estimatedMinutes:
              typeof s.estimatedMinutes === 'number' && s.estimatedMinutes > 0
                ? Math.min(240, Math.max(15, Math.round(s.estimatedMinutes)))
                : 30,
            alreadyDone: Boolean(s.alreadyDone),
            ...(trainingResourceId ? { trainingResourceId } : {}),
          };
        });

      return res.status(200).json({
        shouldBreakdown: steps.length >= 2,
        reason: `"${matchedSop.name}" kalıbı kullanıldı`,
        steps,
        matchedSop: { id: matchedSop.id, name: matchedSop.name },
      });
    }

    // ─── Adım 2B: SOP yok → generic AI üretimi ──────────────────────────────
    const projects = await getActiveProjects(req.tenantId);
    const projectBlock = formatProjectsForPrompt(projects);

    const result = await generateJSON<BreakdownResult>(
      'flash',
      GENERIC_BREAKDOWN_PROMPT(title, description, projectBlock),
      'task-breakdown-generic',
      { maxOutputTokens: 1024, temperature: 0.4 }
    );

    const steps = sanitizeSteps(result.steps || []);
    const shouldBreakdown = Boolean(result.shouldBreakdown) && steps.length >= 3;

    return res.status(200).json({
      shouldBreakdown,
      reason: result.reason || '',
      steps: shouldBreakdown ? steps : [],
      matchedSop: null,
      isNewPattern: shouldBreakdown,  // önyüze "kalıp olarak kaydet" toggle göstermesi için
    });
  } catch (error: any) {
    console.error('tasks/breakdown-task error:', error);
    return res.status(500).json({ error: String(error?.message || 'Breakdown failed') });
  }
});

function sanitizeSteps(raw: any[]): BreakdownStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && typeof s.title === 'string' && s.title.trim().length > 0)
    .slice(0, 8)
    .map((s) => ({
      title: s.title.trim(),
      estimatedMinutes:
        typeof s.estimatedMinutes === 'number' && s.estimatedMinutes > 0
          ? Math.min(240, Math.max(15, Math.round(s.estimatedMinutes)))
          : 30,
      alreadyDone: Boolean(s.alreadyDone),
    }));
}
