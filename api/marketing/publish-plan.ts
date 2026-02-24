import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

export const config = {
  maxDuration: 120,
};

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * POST /api/marketing/publish-plan
 *
 * Converts a marketing_plans document into real Meta campaigns + ad sets.
 * Campaigns are created as PAUSED — user activates them in Meta Business Manager.
 *
 * Body: { planId: string }
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { planId } = req.body || {};
  if (!planId) {
    return res.status(400).json({ error: 'Missing required field: planId' });
  }

  const db = getAdminDb();

  // 1. Load marketing plan
  const planSnap = await db.collection('marketing_plans').doc(planId).get();
  if (!planSnap.exists) {
    return res.status(404).json({ error: 'Marketing plan not found' });
  }

  const plan = planSnap.data()!;
  if (plan.tenantId !== req.tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // 2. Load Meta platform account — single-field query to avoid composite index dependency
  const allPlatformsSnap = await db.collection('platform_accounts')
    .where('tenantId', '==', req.tenantId)
    .get();

  const metaDocs = allPlatformsSnap.docs.filter((d) => {
    const data = d.data();
    return data.platform === 'meta' && data.status === 'connected';
  });

  if (metaDocs.length === 0) {
    return res.status(400).json({ error: 'Meta hesabı bağlı değil. Lütfen önce Meta hesabınızı bağlayın.' });
  }

  const platformAccount = metaDocs[0].data();
  const accessToken: string = platformAccount.accessToken || platformAccount.metadata?.accessToken;
  const adAccountId: string = platformAccount.accountId || platformAccount.metadata?.adAccountId;

  if (!accessToken || !adAccountId) {
    return res.status(400).json({ error: 'Meta erişim token veya reklam hesabı ID bulunamadı.' });
  }

  // Ensure act_ prefix
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  const planData = plan.planData;
  const metaResults: Record<string, { campaignId: string; adSetIds: string[] }> = {};
  const errors: Array<{ campaign: string; error: string }> = [];

  // 3. Create campaigns on Meta
  for (const campaign of (planData.campaigns || []) as any[]) {
    if (campaign.platform !== 'meta') continue;

    try {
      // Create campaign
      const campaignPayload = new URLSearchParams({
        name: campaign.name,
        objective: campaign.metaObjective || 'OUTCOME_AWARENESS',
        status: 'PAUSED',
        special_ad_categories: '[]',
        access_token: accessToken,
      });

      const campaignRes = await fetch(`${META_API_BASE}/${accountId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: campaignPayload.toString(),
      });

      const campaignJson = await campaignRes.json();

      if (campaignJson.error) {
        errors.push({ campaign: campaign.name, error: campaignJson.error.message });
        continue;
      }

      const metaCampaignId: string = campaignJson.id;
      const adSetIds: string[] = [];

      // Determine optimization goal from objective
      const optimizationGoal = getOptimizationGoal(campaign.metaObjective);

      // Create ad sets for this campaign
      for (const adSet of (campaign.adSets || []) as any[]) {
        try {
          const dailyBudgetCents = Math.round((adSet.dailyBudget || planData.budget?.dailyBudget || 500) * 100);

          const adSetPayload = new URLSearchParams({
            name: adSet.name,
            campaign_id: metaCampaignId,
            daily_budget: String(dailyBudgetCents),
            billing_event: 'IMPRESSIONS',
            optimization_goal: optimizationGoal,
            status: 'PAUSED',
            access_token: accessToken,
          });

          // Add targeting
          const targeting: Record<string, any> = {
            age_min: planData.audience?.ageMin || 18,
            age_max: planData.audience?.ageMax || 65,
            geo_locations: { countries: ['TR'] },
          };

          // Add gender targeting
          const genders = planData.audience?.genders || ['all'];
          if (!genders.includes('all')) {
            const genderMap: Record<string, number> = { male: 1, female: 2 };
            targeting.genders = genders
              .map((g: string) => genderMap[g])
              .filter(Boolean);
          }

          adSetPayload.set('targeting', JSON.stringify(targeting));

          const adSetRes = await fetch(`${META_API_BASE}/${accountId}/adsets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: adSetPayload.toString(),
          });

          const adSetJson = await adSetRes.json();

          if (adSetJson.error) {
            console.warn(`[publish-plan] Ad set creation failed for "${adSet.name}": ${adSetJson.error.message}`);
          } else {
            adSetIds.push(adSetJson.id);
          }
        } catch (adSetErr: any) {
          console.warn(`[publish-plan] Ad set error for "${adSet.name}":`, adSetErr?.message);
        }
      }

      metaResults[campaign.name] = { campaignId: metaCampaignId, adSetIds };
    } catch (campaignErr: any) {
      errors.push({ campaign: campaign.name, error: campaignErr?.message });
    }
  }

  // 4. Update plan status in Firestore
  await db.collection('marketing_plans').doc(planId).update({
    status: Object.keys(metaResults).length > 0 ? 'published' : 'draft',
    metaResults,
    publishErrors: errors.length > 0 ? errors : null,
    updatedAt: Date.now(),
  });

  return res.status(200).json({
    success: Object.keys(metaResults).length > 0,
    metaResults,
    errors,
    publishedCampaigns: Object.keys(metaResults).length,
  });
});

function getOptimizationGoal(metaObjective: string): string {
  const map: Record<string, string> = {
    OUTCOME_AWARENESS: 'REACH',
    OUTCOME_TRAFFIC: 'LINK_CLICKS',
    OUTCOME_ENGAGEMENT: 'POST_ENGAGEMENT',
    OUTCOME_LEADS: 'LEAD_GENERATION',
    OUTCOME_SALES: 'OFFSITE_CONVERSIONS',
    OUTCOME_APP_PROMOTION: 'APP_INSTALLS',
    OUTCOME_VIDEO_VIEWS: 'VIDEO_VIEWS',
  };
  return map[metaObjective] || 'REACH';
}
