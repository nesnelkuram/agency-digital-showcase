import type { VercelResponse } from '@vercel/node';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { generateJSON } from '../_lib/gemini-bundle.mjs';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';

export const config = {
  maxDuration: 60,
};

const SYSTEM_PROMPT = `Sen deneyimli bir Dijital Pazarlama Uzmanısın. Kullanıcılarla yapılandırılmış bir konuşma yürüterek eksiksiz, uygulanabilir pazarlama planları oluşturuyorsun.

## Rol
- Kullanıcıyı adım adım yönlendirerek bilgi topluyorsun
- Yeterli bilgi toplandığında tam yapılandırılmış bir pazarlama planı üretiyorsun
- Meta (Facebook/Instagram), Google, TikTok, LinkedIn kampanyaları oluşturabilirsin
- Kampanya durumlarını güncelleyebilir, bütçe ayarlayabilir, senkronizasyon tetikleyebilirsin

## Bilgi Toplama Akışı
Kullanıcıyla sohbet ederek şu bilgileri topla (sıra önemli değil, doğal akışta):
1. Marka/Sektör: Marka adı, sektör, ürün/hizmet açıklaması
2. Hedef Kitle: Yaş aralığı, cinsiyet, ilgi alanları, konum
3. Hedefler: Farkındalık mı, trafik mi, lead mi, satış mı?
4. Bütçe: Toplam bütçe ve para birimi
5. Platformlar: Meta, Google, TikTok, LinkedIn
6. Süre: Kampanya başlangıç ve bitiş tarihleri

Bilgiler tamamlanınca "create_marketing_plan" aksiyonunu tetikle ve tam planı üret.

## Kural
- Yanıtını SADECE geçerli JSON olarak dön
- reply: Kullanıcıya Türkçe, samimi ve yönlendirici açıklama
- actions: Gerçekleştirilen veya önerilen aksiyonlar listesi (boşsa [{ "type": "none" }] dön)
- Eksik bilgi varsa soru sor, create_marketing_plan aksiyon tetikleme
- Tüm bilgiler tamamlandığında plan oluştur ve kullanıcıyı bilgilendir

## Aksiyon Tipleri
- create_marketing_plan: Tam pazarlama planı oluştur (tüm bilgiler toplandığında)
- create_proposal: Kampanya önerisi oluştur
- update_campaign_status: Kampanya durumunu güncelle
- trigger_sync: Kampanya senkronizasyonu başlat (eski — yerine sync_campaigns kullan)
- sync_campaigns: Meta'dan kampanyaları çek ve Firestore'a kaydet (bağlı hesap gerektirir). Kullanıcı mevcut kampanyalarını sorduğunda MUTLAKA bu aksiyonu tetikle. payload: { platformAccountId? }
- adjust_budget: Kampanya bütçesini ayarla
- publish_plan: Pazarlama planını Meta'da yayınla (ONAY GEREKTİRİR). payload: { planId }
- pause_campaign: Meta kampanyasını duraklat (ONAY GEREKTİRİR). payload: { campaignId } — Meta campaign ID
- resume_campaign: Meta kampanyasını yeniden başlat (ONAY GEREKTİRİR). payload: { campaignId }
- delete_campaign: Meta kampanyasını arşivle/sil (ONAY GEREKTİRİR). payload: { campaignId }
- update_meta_budget: Meta reklam seti günlük bütçesini güncelle (ONAY GEREKTİRİR). payload: { adSetId, dailyBudget }
- update_campaign_budget: Meta kampanya spend cap güncelle (ONAY GEREKTİRİR). payload: { campaignId, spendCap }
- create_meta_ad: Meta'da yeni reklam oluştur (ONAY GEREKTİRİR). payload: { adSetId, adName, creative: { title, body, linkUrl, imageHash? } }
- upload_image: Meta'ya görsel yükle ve image_hash al (ONAY GEREKTİRİR). payload: { imageUrl }
- pause_adset: Meta reklam setini duraklat (ONAY GEREKTİRİR). payload: { adSetId }
- resume_adset: Meta reklam setini devam ettir (ONAY GEREKTİRİR). payload: { adSetId }
- update_adset_targeting: Meta reklam seti hedeflemesini güncelle (ONAY GEREKTİRİR). payload: { adSetId, targeting: { age_min?, age_max?, geo_locations?, interests?, genders? } }
- fetch_performance: Meta performans verilerini getir (ONAY GEREKTİRİR). payload: { campaignId, level?: "campaign"|"adset"|"ad", datePreset?: "last_7d"|"last_30d"|"last_90d" }
- none: Aksiyon yok, sadece bilgi ver veya soru sor

## İlk Mesaj Davranışı
- Konuşma başladığında (konuşma geçmişi boşsa veya ilk kullanıcı mesajında) bağlı platform hesaplarını otomatik olarak listele
- Her hesabı platform adı, hesap adı ve hesap ID'si ile göster
- Birden fazla hesap varsa: "Hangi hesap üzerinden işlem yapmak istersiniz?" diye sor
- Tek hesap varsa: "X hesabınız bağlı, bu hesap üzerinden devam ediyorum" de
- Hesap yoksa: Plan/strateji oluşturabileceğini belirt, platform aksiyonları için bağlama yönlendir
- Bu bilgiyi sunduktan sonra kullanıcının asıl sorusuna/isteğine de cevap ver

## Platform Hesap Bilgileri Kullanımı
- "Bağlı Platform Hesapları" listesindeki "id" alanı Firestore belge ID'sidir
- Platform aksiyonlarında hedef hesabı belirtmek için payload'a "platformAccountId" ekle
- Birden fazla aynı platform hesabı varsa kullanıcıya hangi hesabı kullanmak istediğini sor
- adAccountId: Meta reklam hesabı ID'si (act_xxx formatı)
- pageId: Facebook Sayfa ID'si (reklam oluşturmak için gerekli)

## Kampanya-Hesap İlişkisi
- Kampanyalar hesap bazında gruplanmış olarak sunulur
- Kullanıcı bir hesap adı söylediğinde (ör. "Dieci Moda"), SADECE o hesabın kampanyalarını referans al
- Diğer hesapların kampanyalarını karıştırma
- "Hesaba Bağlı Olmayan Kampanyalar" eski verilerdir, kullanıcıya re-sync önerilebilir

## Kampanya Keşfi & Senkronizasyon Kuralları
- Kullanıcı mevcut kampanyalarını sorduğunda, "kampanyaları göster" dediğinde veya "reklamlarım neler" dediğinde → sync_campaigns aksiyonunu tetikle
- sync_campaigns aksiyonu Meta API'den güncel kampanya listesini çeker ve Firestore'a kaydeder
- Kampanya listesi boşsa veya "kampanya bulunamadı" durumunda → önce sync_campaigns yap, sonra sonuçları paylaş
- Her konuşma başında kampanya verisi güncel olmayabilir, kullanıcı sorduğunda sync et

## Platform Aksiyonları Kuralları
- "ONAY GEREKTİRİR" aksiyonlar doğrudan çalıştırılmaz, kullanıcı onayına sunulur
- Her platform aksiyonunda "description" (ne yapılacak) ve "impact" (etkisi) alanları ZORUNLU
- Platform aksiyonları için payload'da gerekli ID'leri (campaignId, adSetId, planId) belirt
- Meta campaign/adset ID'leri Firestore'dan veya bağlamdan bul, kullanıcıya sor gerekirse
- create_meta_ad için önce upload_image ile image_hash alınması gerekebilir

## create_marketing_plan Formatı
{
  "type": "create_marketing_plan",
  "planData": {
    "name": "Plan adı (marka + dönem)",
    "brand": { "name": "...", "description": "...", "industry": "..." },
    "objectives": ["awareness"],
    "audience": { "ageMin": 25, "ageMax": 45, "genders": ["all"], "interests": ["..."], "locations": ["Türkiye"] },
    "budget": { "total": 5000, "currency": "TRY", "dailyBudget": 500 },
    "platforms": ["meta"],
    "timeline": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" },
    "campaigns": [
      {
        "name": "...",
        "objective": "awareness",
        "platform": "meta",
        "metaObjective": "OUTCOME_AWARENESS",
        "budget": 2000,
        "adSets": [
          {
            "name": "...",
            "targeting": "Genel hedefleme açıklaması",
            "dailyBudget": 500,
            "adFormat": "single_image",
            "creativeNotes": "Görsel yönlendirmesi"
          }
        ]
      }
    ],
    "kpis": { "impressions": 100000, "clicks": 5000, "conversions": 100 }
  }
}

## Meta Objective Mapping
- awareness → OUTCOME_AWARENESS
- traffic → OUTCOME_TRAFFIC
- engagement → OUTCOME_ENGAGEMENT
- leads → OUTCOME_LEADS
- sales → OUTCOME_SALES
- app_installs → OUTCOME_APP_PROMOTION
- video_views → OUTCOME_VIDEO_VIEWS

## Örnek Yanıt (bilgi toplama aşaması)
{
  "reply": "Merhaba! Ben dijital pazarlama uzmanınızım. Size özel bir pazarlama planı oluşturmak için birkaç soru sormam gerekiyor. Önce başlayalım: Hangi marka veya ürün için kampanya oluşturmak istiyorsunuz? Sektörünüzü de belirtir misiniz?",
  "actions": [{ "type": "none" }]
}`;

interface AgentAction {
  type: 'create_marketing_plan' | 'create_proposal' | 'update_campaign_status' | 'trigger_sync' | 'sync_campaigns' | 'adjust_budget'
    | 'publish_plan' | 'pause_campaign' | 'resume_campaign' | 'delete_campaign'
    | 'update_meta_budget' | 'update_campaign_budget'
    | 'create_meta_ad' | 'upload_image'
    | 'pause_adset' | 'resume_adset' | 'update_adset_targeting'
    | 'fetch_performance'
    | 'none';
  // create_marketing_plan fields
  planData?: Record<string, any>;
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
  // Platform action fields (require approval)
  description?: string;
  impact?: string;
  platform?: string;
  platformAccountId?: string;
  payload?: Record<string, any>;
}

// Platform action types that require user approval (not auto-executed)
const PLATFORM_ACTION_TYPES = new Set([
  'publish_plan', 'pause_campaign', 'resume_campaign', 'delete_campaign',
  'update_meta_budget', 'update_campaign_budget',
  'create_meta_ad', 'upload_image',
  'pause_adset', 'resume_adset', 'update_adset_targeting',
  'fetch_performance',
]);

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

    // Load recent campaigns + proposals + platform accounts
    const [campaignsSnap, proposalsSnap, platformsSnap] = await Promise.all([
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
      db.collection('platform_accounts')
        .where('tenantId', '==', req.tenantId)
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
        platformAccountId: data.platformAccountId || null,
        projectId: data.projectId || null,
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

    // Filter connected accounts in-memory to avoid composite index dependency
    const connectedDocs = platformsSnap.docs.filter((d) => d.data().status === 'connected');
    console.log(`[agent-chat] tenantId=${req.tenantId}, allPlatformAccounts=${platformsSnap.size}, connected=${connectedDocs.length}`);

    const platformAccounts = connectedDocs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        platform: data.platform,
        accountName: data.accountName,
        accountId: data.accountId,
        adAccountId: data.metadata?.adAccountId || null,
        pageId: data.metadata?.pageId || null,
        permissions: data.permissions || [],
        status: data.status,
        projectId: data.projectId || null,
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

    if (platformAccounts.length > 0) {
      parts.push('## Bağlı Platform Hesapları');
      parts.push('```json');
      parts.push(JSON.stringify(platformAccounts, null, 2));
      parts.push('```');
      parts.push('');
      parts.push('Özet: ' + platformAccounts.map(a =>
        `${a.platform} — ${a.accountName || a.accountId} (ID: ${a.id})`
      ).join(', '));
      parts.push('');
      parts.push('NOT: accessToken bu listede yer almaz. Platform aksiyonları onay sonrası server-side çalışır.');
      parts.push('');
    } else {
      parts.push('## Bağlı Platform Hesapları');
      parts.push('Henüz bağlı platform hesabı bulunamadı. Yine de pazarlama planı oluşturabilir, strateji geliştirebilir, kampanya önerisi sunabilirsin. Platform aksiyonları (yayınlama, duraklatma vb.) için kullanıcı Meta hesabını Platformlar sayfasından bağlamalı — sadece bu aksiyonlar istendiğinde belirt.');
      parts.push('');
    }

    // Build account name map + projectId→accountIds fallback for campaign grouping
    const accountNameMap = new Map<string, string>();
    const projectToAccountMap = new Map<string, string[]>();
    for (const acc of platformAccounts) {
      accountNameMap.set(acc.id, acc.accountName || acc.accountId);
      if (acc.projectId) {
        const existing = projectToAccountMap.get(acc.projectId) || [];
        existing.push(acc.id);
        projectToAccountMap.set(acc.projectId, existing);
      }
    }

    // Group campaigns by platformAccountId (with projectId + name heuristic fallbacks)
    const groupedCampaigns = new Map<string, typeof campaigns>();
    const ungroupedCampaigns: typeof campaigns = [];

    for (const c of campaigns) {
      let matchedAccountId = c.platformAccountId && accountNameMap.has(c.platformAccountId)
        ? c.platformAccountId
        : null;

      // Fallback 1: match via projectId → platform account (only if single account per project)
      if (!matchedAccountId && c.projectId) {
        const accountIds = projectToAccountMap.get(c.projectId);
        if (accountIds && accountIds.length === 1) {
          matchedAccountId = accountIds[0];
        }
      }

      // Fallback 2: campaign name contains account name (case-insensitive heuristic)
      if (!matchedAccountId && c.name) {
        const campaignNameLower = c.name.toLowerCase();
        for (const [accId, accName] of accountNameMap) {
          if (accName && campaignNameLower.includes(accName.toLowerCase())) {
            matchedAccountId = accId;
            break;
          }
        }
      }

      if (matchedAccountId) {
        const group = groupedCampaigns.get(matchedAccountId) || [];
        group.push(c);
        groupedCampaigns.set(matchedAccountId, group);
      } else {
        ungroupedCampaigns.push(c);
      }
    }

    if (groupedCampaigns.size > 0 || ungroupedCampaigns.length > 0) {
      parts.push('## Mevcut Kampanyalar (Hesaba Göre)');
      for (const [accId, camps] of groupedCampaigns) {
        parts.push(`### ${accountNameMap.get(accId)} Hesabı Kampanyaları`);
        parts.push('```json');
        parts.push(JSON.stringify(camps, null, 2));
        parts.push('```');
      }
      if (ungroupedCampaigns.length > 0) {
        parts.push('### Henüz Hesapla Eşleştirilmemiş Kampanyalar (re-sync ile düzeltilebilir)');
        parts.push('```json');
        parts.push(JSON.stringify(ungroupedCampaigns, null, 2));
        parts.push('```');
      }
      parts.push('');
    }

    if (proposals.length > 0) {
      parts.push('## Mevcut Öneriler');
      parts.push('```json');
      parts.push(JSON.stringify(proposals, null, 2));
      parts.push('```');
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
    const newPendingActions: Array<Record<string, any>> = [];

    for (const action of actions) {
      if (action.type === 'none') {
        actionResults.push({ type: 'none', success: true });
        continue;
      }

      // Platform actions require user approval — save as pending, don't execute
      if (PLATFORM_ACTION_TYPES.has(action.type)) {
        const pendingAction = {
          id: `pa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: action.type,
          status: 'pending_approval',
          platform: action.platform || 'meta',
          payload: action.payload || {},
          description: action.description || '',
          impact: action.impact || '',
          createdAt: Date.now(),
        };
        // Carry over relevant IDs into payload from action fields
        if (action.campaignId) pendingAction.payload.campaignId = action.campaignId;
        if (action.dailyBudget != null) pendingAction.payload.dailyBudget = action.dailyBudget;
        if (action.planData) pendingAction.payload.planData = action.planData;
        if (action.platformAccountId && !pendingAction.payload.platformAccountId) {
          pendingAction.payload.platformAccountId = action.platformAccountId;
        }

        newPendingActions.push(pendingAction);
        actionResults.push({
          type: 'pending_action',
          success: true,
          data: { actionId: pendingAction.id, actionType: action.type, description: pendingAction.description, impact: pendingAction.impact },
        });
        continue;
      }

      try {
        if (action.type === 'create_marketing_plan' && action.planData) {
          const planRef = db.collection('marketing_plans').doc();
          const planDoc = {
            id: planRef.id,
            tenantId: req.tenantId,
            sessionId,
            status: 'draft',
            planData: action.planData,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await planRef.set(planDoc);
          actionResults.push({
            type: 'marketing_plan_created',
            success: true,
            data: { planId: planRef.id, planData: action.planData },
          });
        } else if (action.type === 'create_proposal') {
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
        } else if (action.type === 'trigger_sync' || action.type === 'sync_campaigns') {
          // Server-side sync: call Meta API directly and save to Firestore
          const targetAccountId = action.platformAccountId || action.payload?.platformAccountId;

          // Collect target Meta account docs — specific account or ALL Meta accounts
          const metaDocs = targetAccountId
            ? connectedDocs.filter((d) => d.id === targetAccountId || d.data().accountId === targetAccountId)
            : connectedDocs.filter((d) => d.data().platform === 'meta');

          if (metaDocs.length === 0) {
            actionResults.push({ type: action.type, success: false, error: 'Bağlı Meta hesabı bulunamadı. Platformlar sayfasından Meta hesabınızı bağlayın.' });
          } else {
            let totalSynced = 0;
            const allSyncedCampaigns: Array<{ id: string; name: string; status: string; objective: string; metaId: string; accountName: string }> = [];
            const syncErrors: string[] = [];

            for (const metaDoc of metaDocs) {
              const metaData = metaDoc.data();
              const accessToken = metaData.accessToken || metaData.metadata?.accessToken;
              const adAccountId = metaData.accountId || metaData.metadata?.adAccountId;
              const accountLabel = metaData.accountName || metaData.metadata?.userName || adAccountId;

              if (!accessToken || !adAccountId) {
                syncErrors.push(`${accountLabel}: Access token veya Ad Account ID eksik`);
                continue;
              }

              try {
                const accountIdStr = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
                const campaignsUrl = `https://graph.facebook.com/v21.0/${accountIdStr}/campaigns?access_token=${accessToken}&fields=id,name,objective,status,effective_status,daily_budget,lifetime_budget,spend_cap,start_time,stop_time,created_time&limit=50`;
                const campaignsRes = await fetch(campaignsUrl);
                const campaignsData = await campaignsRes.json() as any;

                if (campaignsData.error) {
                  throw new Error(campaignsData.error.message || 'Meta API hatasi');
                }

                const metaCampaigns: any[] = campaignsData.data || [];
                const objectiveMap: Record<string, string> = {
                  OUTCOME_AWARENESS: 'awareness', OUTCOME_TRAFFIC: 'traffic', OUTCOME_ENGAGEMENT: 'engagement',
                  OUTCOME_LEADS: 'leads', OUTCOME_SALES: 'sales', OUTCOME_APP_PROMOTION: 'app_installs',
                  REACH: 'awareness', BRAND_AWARENESS: 'awareness', LINK_CLICKS: 'traffic',
                  CONVERSIONS: 'sales', VIDEO_VIEWS: 'video_views',
                };
                const statusMap: Record<string, string> = {
                  ACTIVE: 'active', PAUSED: 'paused', DELETED: 'completed', ARCHIVED: 'completed',
                };

                for (const mc of metaCampaigns) {
                  const objective = objectiveMap[mc.objective] || 'awareness';
                  const status = statusMap[mc.status] || 'draft';
                  const dailyBudget = mc.daily_budget ? parseInt(mc.daily_budget) / 100 : 0;
                  const lifetimeBudget = mc.lifetime_budget ? parseInt(mc.lifetime_budget) / 100 : 0;

                  const existing = await db.collection('marketing_campaigns')
                    .where('tenantId', '==', req.tenantId)
                    .where('platformCampaignIds.meta', '==', mc.id)
                    .limit(1).get();

                  const campaignDoc = {
                    platformAccountId: metaDoc.id,
                    name: mc.name,
                    objective,
                    platforms: ['meta'],
                    status,
                    effectiveStatus: mc.effective_status?.toLowerCase(),
                    budget: {
                      totalBudget: lifetimeBudget || dailyBudget * 30,
                      dailyLimit: dailyBudget,
                      currency: 'TRY',
                      platformSplit: { meta: 100 },
                    },
                    schedule: {
                      startDate: mc.start_time || new Date().toISOString(),
                      endDate: mc.stop_time || null,
                    },
                    platformCampaignIds: { meta: mc.id },
                    updatedAt: Date.now(),
                  };

                  if (!existing.empty) {
                    await existing.docs[0].ref.update(campaignDoc);
                  } else {
                    await db.collection('marketing_campaigns').doc().set({
                      ...campaignDoc,
                      tenantId: req.tenantId,
                      description: '',
                      targeting: {},
                      adSets: [],
                      approvalHistory: [],
                      timeline: [{
                        id: `evt-${Date.now()}`,
                        type: 'created',
                        title: 'Meta\'dan senkronize edildi',
                        description: 'AI Ajan tarafından otomatik senkronize edildi',
                        createdAt: Date.now(),
                        createdBy: 'system',
                        createdByName: 'Meta Sync',
                      }],
                      tags: ['meta-sync'],
                      createdAt: Date.now(),
                    });
                  }

                  totalSynced++;
                  allSyncedCampaigns.push({
                    id: existing.empty ? 'new' : existing.docs[0].id,
                    name: mc.name,
                    status,
                    objective,
                    metaId: mc.id,
                    accountName: accountLabel,
                  });
                }
              } catch (syncErr: any) {
                console.error(`[agent-chat] sync_campaigns failed for ${accountLabel}:`, syncErr?.message);
                syncErrors.push(`${accountLabel}: ${syncErr?.message}`);
              }
            }

            // Distinguish "0 campaigns found" (valid) from actual API errors
            const accountsChecked = metaDocs.length - syncErrors.length;
            if (syncErrors.length > 0 && accountsChecked === 0) {
              // All accounts failed — report as error
              actionResults.push({
                type: action.type,
                success: false,
                error: syncErrors.join('; '),
              });
            } else {
              const accountNames = totalSynced > 0
                ? [...new Set(allSyncedCampaigns.map(c => c.accountName))]
                : metaDocs.map(d => d.data().accountName || d.data().accountId);
              actionResults.push({
                type: 'sync_campaigns',
                success: true,
                data: {
                  synced: totalSynced,
                  accountNames,
                  campaigns: allSyncedCampaigns,
                  message: totalSynced > 0
                    ? `${totalSynced} kampanya Meta'dan senkronize edildi (${accountNames.join(', ')})`
                    : `Meta hesaplarında (${accountNames.join(', ')}) aktif kampanya bulunamadı`,
                  ...(syncErrors.length > 0 ? { warnings: syncErrors } : {}),
                },
              });
            }
          }
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

    // Save messages to session (including action results so Gemini can reference them next turn)
    const userMsg = { role: 'user' as const, content: message, timestamp: Date.now() };

    // Build assistant message — append action result summary so Gemini sees it in history
    const meaningfulResults = actionResults.filter(r => r.type !== 'none');
    let assistantContent = reply;
    if (meaningfulResults.length > 0) {
      const summaryLines = meaningfulResults.map(r => {
        if (r.success && r.data) {
          if (r.type === 'sync_campaigns') {
            const d = r.data;
            if (d.synced > 0) {
              const campNames = (d.campaigns || []).map((c: any) => `${c.name} (${c.status})`).join(', ');
              return `[Sync Sonucu] ${d.synced} kampanya senkronize edildi (${(d.accountNames || []).join(', ')}): ${campNames}`;
            }
            return `[Sync Sonucu] ${(d.accountNames || []).join(', ')} hesabında aktif kampanya bulunamadı`;
          }
          if (r.type === 'marketing_plan_created') return `[Plan Oluşturuldu] ID: ${r.data.planId}`;
          if (r.type === 'create_proposal') return `[Öneri Oluşturuldu] ${r.data.name} (ID: ${r.data.proposalId})`;
          if (r.type === 'pending_action') return `[Onay Bekliyor] ${r.data.actionType}: ${r.data.description}`;
          return `[${r.type}] Başarılı`;
        }
        if (!r.success && r.error) return `[${r.type} Hata] ${r.error}`;
        return null;
      }).filter(Boolean);

      if (summaryLines.length > 0) {
        assistantContent += '\n\n---\nAksiyon Sonuçları:\n' + summaryLines.join('\n');
      }
    }

    const assistantMsg = {
      role: 'assistant' as const,
      content: assistantContent,
      actions,
      timestamp: Date.now(),
    };

    const FieldValue = getFieldValue();
    const sessionUpdate: Record<string, any> = {
      messages: FieldValue.arrayUnion(userMsg, assistantMsg),
      updatedAt: Date.now(),
    };
    if (newPendingActions.length > 0) {
      sessionUpdate.pendingActions = FieldValue.arrayUnion(...newPendingActions);
    }
    await db.collection('marketing_agent_sessions').doc(sessionId).update(sessionUpdate);

    return res.status(200).json({
      reply,
      actions,
      results: actionResults,
      pendingActions: newPendingActions.length > 0 ? newPendingActions : undefined,
    });
  } catch (error: any) {
    console.error('marketing/agent-chat error:', error);
    return res.status(500).json({
      error: String(error?.message || 'Agent chat failed'),
    });
  }
});
