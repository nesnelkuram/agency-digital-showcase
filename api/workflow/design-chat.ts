import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { generateJSON } from '../_lib/gemini-bundle.mjs';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit';

export const config = {
  maxDuration: 60,
};

const SYSTEM_PROMPT = `Sen dijital ajans is sureci tasarlama uzmanisin. Kullanici ile Turkce konusarak workflow sablonlari olusturuyorsun.

## Gorev
Kullanicinin isteklerine gore is sureci (workflow) tasarla. Her yanitinda:
1. Kisa ve net bir aciklama yaz (Turkce)
2. Guncellenmis tam draft'i JSON olarak don

## Node Tipleri
- start: Surec baslangici (her workflow'da 1 tane)
- task: Manuel gorev
- ai_task: AI tarafindan otomatik yapilan gorev
- review: Inceleme adimi
- approval: Onay adimi (musteri veya yonetici)
- milestone: Kilometre tasi / faz sonu
- condition: Kosullu dallanma
- parallel_split: Paralel isler baslangici
- parallel_join: Paralel isler birlesimi
- notification: Bildirim gonderme
- end: Surec sonu (her workflow'da 1 tane)

## Edge Tipleri
- default: Normal akis
- conditional_true: Kosul dogru ise
- conditional_false: Kosul yanlis ise
- rejection: Red durumu
- escalation: Ust kademeye iletme

## Pozisyon Kurallari
- Dikey akis: ana hat x=300
- Paralel dallar: sol x=100, sag x=500
- Y araligi: 120px
- Baslangic y=50

## assigneeRole Degerleri
creative_director, videographer, editor, designer, social_media_manager, project_manager, client, admin

## Faz Yapisi
Her workflow mantiksal fazlara bolunmeli (ornek: Hazirlik, Uretim, Post-produksiyon, Teslimat).
Her faz'in bir rengi olsun: #3B82F6, #8B5CF6, #F59E0B, #10B981, #EF4444, #EC4899

## Kurallar
- Her yanitinda TAM draft'i don (incremental degil)
- Node id'leri benzersiz olmali (ornek: "node_1", "node_2", ...)
- Edge id'leri benzersiz olmali (ornek: "edge_1", "edge_2", ...)
- Phase id'leri benzersiz olmali (ornek: "phase_1", "phase_2", ...)
- sopResources her node'da bos dizi olabilir []
- estimatedDurationHours makul degerler ver
- defaultEstimatedDays tum surecin toplam tahmini gun sayisi`;

interface DesignResponse {
  reply: string;
  draft: {
    name: string;
    description: string;
    serviceCategory: string;
    defaultEstimatedDays: number;
    nodes: any[];
    edges: any[];
    phases: any[];
  } | null;
}

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.AI_WORKFLOW)) return;

  try {
    const { sessionId, message } = req.body || {};

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, message' });
    }

    // Load session from Firestore
    const db = getAdminDb();
    const sessionDoc = await db.collection('workflow_design_sessions').doc(sessionId).get();

    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionData = sessionDoc.data()!;

    // Verify tenant
    if (sessionData.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const history = sessionData.messages || [];
    const currentDraft = sessionData.currentDraft || null;

    // Build conversation for Gemini
    const conversationParts: string[] = [SYSTEM_PROMPT, ''];

    if (currentDraft) {
      conversationParts.push('## Mevcut Draft');
      conversationParts.push('```json');
      conversationParts.push(JSON.stringify(currentDraft, null, 2));
      conversationParts.push('```');
      conversationParts.push('');
    }

    // Add conversation history (last 20 messages)
    const recentHistory = history.slice(-20);
    if (recentHistory.length > 0) {
      conversationParts.push('## Konusma Gecmisi');
      for (const msg of recentHistory) {
        conversationParts.push(`${msg.role === 'user' ? 'Kullanici' : 'Asistan'}: ${msg.content}`);
      }
      conversationParts.push('');
    }

    conversationParts.push(`## Kullanicinin Son Mesaji`);
    conversationParts.push(message);
    conversationParts.push('');
    conversationParts.push(`## Yanit Formati
Yanitini asagidaki JSON formatinda don:
{
  "reply": "Kullaniciya Turkce aciklama mesaji",
  "draft": { ... tam WorkflowDraft objesi ... } veya null (eger henuz draft olusturulmadiysa)
}

ONEMLI: Sadece gecerli JSON don. Baska bir sey yazma.`);

    const prompt = conversationParts.join('\n');

    // Call Gemini via pre-bundled client
    const result = await generateJSON<DesignResponse>(
      'flash',
      prompt,
      'workflow-designer',
      { maxOutputTokens: 8192, temperature: 0.7 }
    );

    const reply = result.reply || 'Anlayamadim, lutfen tekrar deneyin.';
    const draft = result.draft || null;

    // Save messages + updated draft to Firestore
    const userMsg = { role: 'user' as const, content: message, timestamp: Date.now() };
    const assistantMsg = {
      role: 'assistant' as const,
      content: reply,
      timestamp: Date.now(),
      hasDraft: !!draft,
    };

    const updateData: Record<string, any> = {
      messages: FieldValue.arrayUnion(userMsg, assistantMsg),
      updatedAt: Date.now(),
    };

    if (draft) {
      updateData.currentDraft = draft;
    }

    await db.collection('workflow_design_sessions').doc(sessionId).update(updateData);

    return res.status(200).json({ reply, draft });
  } catch (error: any) {
    console.error('workflow/design-chat error:', error);
    return res.status(500).json({
      error: String(error?.message || 'Design chat failed'),
    });
  }
});
