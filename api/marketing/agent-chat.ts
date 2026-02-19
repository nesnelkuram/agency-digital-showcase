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

const SYSTEM_PROMPT = `Sen Meta Ads ve dijital pazarlama yönetim uzmanısın. Kullanıcının reklam stratejisini anlıyor, kampanyalar oluşturuyor, bütçe yönetiyor ve performans analizi yapıyorsun.

## Rol
- TOFU (Farkındalık), MOFU (Değerlendirme), BOFU (Dönüşüm) huni yapısını anlıyorsun
- Meta (Facebook/Instagram), Google, TikTok, LinkedIn kampanyaları oluşturabilirsin
- Kampanya durumlarını güncelleyebilir, bütçe ayarlayabilir, senkronizasyon tetikleyebilirsin

## Kural
- Yanıtını SADECE geçerli JSON olarak dön
- reply: Kullanıcıya Türkçe, kısa ve net açıklama
- actions: Gerçekleştirilen veya önerilen aksiyonlar listesi (boşsa [{ type: "none" }] dön)

## Aksiyon Tipleri
- create_proposal: Yeni kampanya önerisi oluştur
- update_campaign_status: Kampanya durumunu güncelle
- trigger_sync: Kampanya senkronizasyonu başlat
- adjust_budget: Kampanya bütçesini ayarla
- none: Aksiyon yok, sadece bilgi ver

## Örnek Yanıt
{
  "reply": "TOFU kampanyası için Meta Ads önerisi oluşturdum. 28.000 TL bütçe ile farkındalık hedefli.",
  "actions": [
    {
      "type": "create_proposal",
      "name": "Dieci Moda - TOFU Awareness",
      "objective": "AWARENESS",
      "platforms": ["facebook", "instagram"],
      "budget": 28000,
      "currency": "TRY",
      "targeting": { "ageMin": 18, "ageMax": 45, "interests": ["fashion", "shopping"] }
    }
  ]
}`;

interface AgentAction {
  type: 'create_proposal' | 'update_campaign_status' | 'trigger_sync' | 'adjust_budget' | 'none';
  // create_proposal fields
  name?: string;
  objective?: string;
  platforms?: string[];
  budget?: number;
  currency?: string;
  targeting?: Record<string, any>;
  adSets?: any[];
  // update_campaign_status fields
  campaignId?: string;
  status?: string;
  // trigger_sync fields
  message?: string;
  // adjust_budget fields
  dailyBudget?: number;
  totalBudget?: number;
}

interface AgentResponse {
  reply: string;
  actions: AgentAction[];
}

interface ActionResult {
  type: string;
  success: boolean;
  data?: any;
  error?: string;
}

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.MARKETING_AGENT)) return;

  try {
    const { sessionId, message } = req.body || {};

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, message' });
    }

    const db = getAdminDb();

    // Load session
    const sessionDoc = await db.collection('marketing_agent_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionData = sessionDoc.data()!;
    if (sessionData.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Load recent campaigns + proposals (last 10 each)
    const [campaignsSnap, proposalsSnap] = await Promise.all([
      db.collection('marketing_campaigns')
        .where('tenantId', '==', req.tenantId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get(),
      db.collection('campaign_proposals')
        .where('tenantId', '==', req.tenantId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get(),
    ]);

    const campaigns = campaignsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        status: data.status,
        objective: data.objective,
        platforms: data.platforms,
        budget: data.budget,
        currency: data.currency,
      };
    });

    const proposals = proposalsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        status: data.status,
        objective: data.objective,
        platforms: data.platforms,
        budget: data.budget,
      };
    });

    const history: Array<{ role: string; content: string }> = sessionData.messages || [];

    // Build prompt
    const parts: string[] = [SYSTEM_PROMPT, ''];

    if (sessionData.strategyContext) {
      parts.push('## Strateji Bağlamı');
      parts.push(sessionData.strategyContext);
      parts.push('');
    }

    if (campaigns.length > 0 || proposals.length > 0) {
      parts.push('## Mevcut Kampanyalar ve Öneriler');
      if (campaigns.length > 0) {
        parts.push('### Aktif Kampanyalar');
        parts.push('```json');
        parts.push(JSON.stringify(campaigns, null, 2));
        parts.push('```');
      }
      if (proposals.length > 0) {
        parts.push('### Mevcut Öneriler');
        parts.push('```json');
        parts.push(JSON.stringify(proposals, null, 2));
        parts.push('```');
      }
      parts.push('');
    }

    const recentHistory = history.slice(-20);
    if (recentHistory.length > 0) {
      parts.push('## Konuşma Geçmişi');
      for (const msg of recentHistory) {
        parts.push(`${msg.role === 'user' ? 'Kullanıcı' : 'Asistan'}: ${msg.content}`);
      }
      parts.push('');
    }

    parts.push('## Kullanıcının Son Mesajı');
    parts.push(message);
    parts.push('');
    parts.push('## Yanıt Formatı');
    parts.push('Yanıtını aşağıdaki JSON formatında dön:');
    parts.push('{ "reply": "Türkçe açıklama", "actions": [...] }');
    parts.push('');
    parts.push('ÖNEMLİ: Sadece geçerli JSON dön. Başka bir şey yazma.');

    const prompt = parts.join('\n');

    // Call Gemini
    const result = await generateJSON<AgentResponse>(
      'flash',
      prompt,
      'marketing-agent',
      { maxOutputTokens: 4096, temperature: 0.7 }
    );

    const reply = result.reply || 'Anlayamadım, lütfen tekrar deneyin.';
    const actions: AgentAction[] = Array.isArray(result.actions) ? result.actions : [{ type: 'none' }];

    // Execute server-side actions
    const actionResults: ActionResult[] = [];

    for (const action of actions) {
      if (action.type === 'none') {
        actionResults.push({ type: 'none', success: true });
        continue;
      }

      try {
        if (action.type === 'create_proposal') {
          const proposalRef = db.collection('campaign_proposals').doc();
          const proposalData = {
            id: proposalRef.id,
            tenantId: req.tenantId,
            projectId: sessionData.projectId || null,
            name: action.name || 'AI Kampanya Önerisi',
            objective: action.objective || 'AWARENESS',
            platforms: action.platforms || ['facebook'],
            budget: action.budget || 0,
            currency: action.currency || 'TRY',
            targeting: action.targeting || {},
            adSets: action.adSets || [],
            status: 'draft',
            source: 'ai_agent',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await proposalRef.set(proposalData);
          actionResults.push({ type: 'create_proposal', success: true, data: { proposalId: proposalRef.id, name: proposalData.name } });
        } else if (action.type === 'update_campaign_status' && action.campaignId) {
          await db.collection('marketing_campaigns').doc(action.campaignId).update({
            status: action.status,
            updatedAt: Date.now(),
          });
          actionResults.push({ type: 'update_campaign_status', success: true, data: { campaignId: action.campaignId, status: action.status } });
        } else if (action.type === 'trigger_sync') {
          // Fetch access token from platform_accounts
          const platformSnap = await db.collection('platform_accounts')
            .where('tenantId', '==', req.tenantId)
            .where('platform', '==', 'meta')
            .limit(1)
            .get();

          if (!platformSnap.empty) {
            const accessToken = platformSnap.docs[0].data().accessToken;
            // Fire-and-forget internal sync
            fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/marketing/sync-campaigns`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-internal-token': accessToken },
              body: JSON.stringify({ tenantId: req.tenantId }),
            }).catch(() => {});
          }
          actionResults.push({ type: 'trigger_sync', success: true, data: { message: action.message || 'Sync tetiklendi' } });
        } else if (action.type === 'adjust_budget' && action.campaignId) {
          const updateFields: Record<string, any> = { updatedAt: Date.now() };
          if (action.dailyBudget != null) updateFields['budget.dailyBudget'] = action.dailyBudget;
          if (action.totalBudget != null) updateFields['budget.totalBudget'] = action.totalBudget;
          await db.collection('marketing_campaigns').doc(action.campaignId).update(updateFields);
          actionResults.push({ type: 'adjust_budget', success: true, data: { campaignId: action.campaignId } });
        }
      } catch (actionErr: any) {
        console.error(`Action ${action.type} failed:`, actionErr?.message);
        actionResults.push({ type: action.type, success: false, error: actionErr?.message });
      }
    }

    // Save messages to session
    const userMsg = { role: 'user' as const, content: message, timestamp: Date.now() };
    const assistantMsg = {
      role: 'assistant' as const,
      content: reply,
      actions,
      timestamp: Date.now(),
    };

    await db.collection('marketing_agent_sessions').doc(sessionId).update({
      messages: FieldValue.arrayUnion(userMsg, assistantMsg),
      updatedAt: Date.now(),
    });

    return res.status(200).json({ reply, actions, results: actionResults });
  } catch (error: any) {
    console.error('marketing/agent-chat error:', error);
    return res.status(500).json({
      error: String(error?.message || 'Agent chat failed'),
    });
  }
});
