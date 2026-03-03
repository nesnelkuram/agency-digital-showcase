/**
 * Faz 4: Performance Analytics & Reporting Handlers
 *
 * Collections: marketing_campaigns, performance_snapshots, marketing_reports, budget_forecasts
 */

import type { ToolContext } from '../toolHandlers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcChange(current: number, previous: number): number | undefined {
  if (previous === 0) return current > 0 ? 100 : undefined;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function defaultDateRange(args: Record<string, any>): { startDate: string; endDate: string } {
  const endDate = args.dateEnd || new Date().toISOString().split('T')[0];
  const startDate =
    args.dateStart ||
    new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  return { startDate, endDate };
}

// ---------------------------------------------------------------------------
// 1. get_performance_summary (auto)
// ---------------------------------------------------------------------------

export async function handleGetPerformanceSummary(
  ctx: ToolContext,
  args: Record<string, any>,
) {
  const { startDate, endDate } = defaultDateRange(args);

  // Fetch campaigns
  let campaignsQuery = ctx.db
    .collection('marketing_campaigns')
    .where('tenantId', '==', ctx.tenantId);
  if (args.campaignId) {
    campaignsQuery = campaignsQuery.where('__name__', '==', args.campaignId);
  }
  const campaignsSnap = await campaignsQuery.get();
  const campaigns = campaignsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (campaigns.length === 0) {
    return { error: 'Kampanya bulunamadi.' };
  }

  // Collect snapshots for current period
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;

  for (const camp of campaigns) {
    const snap = await ctx.db
      .collection('performance_snapshots')
      .where('campaignId', '==', camp.id)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    snap.docs.forEach((d) => {
      const data = d.data();
      totalSpend += data.spend || 0;
      totalImpressions += data.impressions || 0;
      totalClicks += data.clicks || 0;
      totalConversions += data.conversions || 0;
    });
  }

  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const roas = totalSpend > 0 ? (totalConversions * cpa) / totalSpend : 0;

  // Previous period comparison
  const periodMs = new Date(endDate).getTime() - new Date(startDate).getTime();
  const prevStart = new Date(new Date(startDate).getTime() - periodMs).toISOString().split('T')[0];
  const prevEnd = new Date(new Date(startDate).getTime() - 86_400_000).toISOString().split('T')[0];

  let prevSpend = 0;
  let prevImpressions = 0;
  let prevClicks = 0;
  let prevConversions = 0;

  for (const camp of campaigns) {
    const snap = await ctx.db
      .collection('performance_snapshots')
      .where('campaignId', '==', camp.id)
      .where('date', '>=', prevStart)
      .where('date', '<=', prevEnd)
      .get();

    snap.docs.forEach((d) => {
      const data = d.data();
      prevSpend += data.spend || 0;
      prevImpressions += data.impressions || 0;
      prevClicks += data.clicks || 0;
      prevConversions += data.conversions || 0;
    });
  }

  const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
  const prevCpa = prevConversions > 0 ? prevSpend / prevConversions : 0;

  const kpis = [
    { label: 'Toplam Harcama', value: Number(totalSpend.toFixed(2)), change: calcChange(totalSpend, prevSpend), unit: 'TL' },
    { label: 'Gosterim', value: totalImpressions, change: calcChange(totalImpressions, prevImpressions), unit: '' },
    { label: 'Tiklama', value: totalClicks, change: calcChange(totalClicks, prevClicks), unit: '' },
    { label: 'Donusum', value: totalConversions, change: calcChange(totalConversions, prevConversions), unit: '' },
    { label: 'CTR', value: Number(ctr.toFixed(2)), change: calcChange(ctr, prevCtr), unit: '%' },
    { label: 'CPA', value: Number(cpa.toFixed(2)), change: calcChange(cpa, prevCpa), unit: 'TL' },
  ];

  return {
    kpis,
    dateRange: { startDate, endDate },
    campaignCount: campaigns.length,
    component: 'PerformanceSummaryCard',
  };
}

// ---------------------------------------------------------------------------
// 2. get_performance_breakdown (auto)
// ---------------------------------------------------------------------------

export async function handleGetPerformanceBreakdown(
  ctx: ToolContext,
  args: Record<string, any>,
) {
  const { startDate, endDate } = defaultDateRange(args);
  const breakdownType = args.breakdownType || 'campaign'; // platform | campaign | daily

  const campaignsSnap = await ctx.db
    .collection('marketing_campaigns')
    .where('tenantId', '==', ctx.tenantId)
    .get();

  const allSnapshots: any[] = [];

  for (const camp of campaignsSnap.docs) {
    const snap = await ctx.db
      .collection('performance_snapshots')
      .where('campaignId', '==', camp.id)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    snap.docs.forEach((d) => {
      allSnapshots.push({
        ...d.data(),
        campaignId: camp.id,
        campaignName: camp.data().name || 'Isimsiz',
      });
    });
  }

  const groups: Record<string, { spend: number; impressions: number; clicks: number; conversions: number }> = {};

  allSnapshots.forEach((s) => {
    let key = '';
    if (breakdownType === 'platform') key = s.platform || 'unknown';
    else if (breakdownType === 'daily') key = s.date || 'unknown';
    else key = `${s.campaignId}::${s.campaignName}`;

    if (!groups[key]) groups[key] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    groups[key].spend += s.spend || 0;
    groups[key].impressions += s.impressions || 0;
    groups[key].clicks += s.clicks || 0;
    groups[key].conversions += s.conversions || 0;
  });

  const rows = Object.entries(groups).map(([key, data]) => {
    const label = breakdownType === 'campaign' ? key.split('::')[1] || key : key;
    return {
      label,
      spend: Number(data.spend.toFixed(2)),
      impressions: data.impressions,
      clicks: data.clicks,
      conversions: data.conversions,
      ctr: data.impressions > 0 ? Number(((data.clicks / data.impressions) * 100).toFixed(2)) : 0,
    };
  });

  return {
    breakdownType,
    rows,
    dateRange: { startDate, endDate },
    component: 'PerformanceBreakdownCard',
  };
}

// ---------------------------------------------------------------------------
// 3. get_budget_overview (auto)
// ---------------------------------------------------------------------------

export async function handleGetBudgetOverview(
  ctx: ToolContext,
  _args: Record<string, any>,
) {
  const campaignsSnap = await ctx.db
    .collection('marketing_campaigns')
    .where('tenantId', '==', ctx.tenantId)
    .get();

  let totalBudget = 0;
  let totalSpent = 0;
  const campaigns: any[] = [];
  const alerts: any[] = [];

  for (const doc of campaignsSnap.docs) {
    const data = doc.data();
    const budget = data.budget?.totalBudget || data.lifetimeBudget || 0;

    // Sum spent from snapshots
    const snapSnap = await ctx.db
      .collection('performance_snapshots')
      .where('campaignId', '==', doc.id)
      .get();

    let spent = 0;
    snapSnap.docs.forEach((s) => {
      spent += s.data().spend || 0;
    });

    const utilizationPercent = budget > 0 ? (spent / budget) * 100 : 0;

    totalBudget += budget;
    totalSpent += spent;

    const camp = {
      id: doc.id,
      name: data.name || 'Isimsiz',
      budget: Number(budget.toFixed(2)),
      spent: Number(spent.toFixed(2)),
      remaining: Number((budget - spent).toFixed(2)),
      utilizationPercent: Number(utilizationPercent.toFixed(1)),
      status: data.status,
    };

    campaigns.push(camp);

    if (utilizationPercent > 85) {
      alerts.push({
        campaignId: doc.id,
        campaignName: data.name,
        utilizationPercent: camp.utilizationPercent,
        level: utilizationPercent > 95 ? 'critical' : 'warning',
      });
    }
  }

  return {
    totalBudget: Number(totalBudget.toFixed(2)),
    totalSpent: Number(totalSpent.toFixed(2)),
    totalRemaining: Number((totalBudget - totalSpent).toFixed(2)),
    totalUtilization: totalBudget > 0 ? Number(((totalSpent / totalBudget) * 100).toFixed(1)) : 0,
    campaigns,
    alerts,
    component: 'BudgetOverviewCard',
  };
}

// ---------------------------------------------------------------------------
// 4. get_budget_alerts (auto) — returns subset of budget overview
// ---------------------------------------------------------------------------

export async function handleGetBudgetAlerts(
  ctx: ToolContext,
  args: Record<string, any>,
) {
  const overview = await handleGetBudgetOverview(ctx, args);
  if (overview.error) return overview;

  return {
    alerts: overview.alerts,
    totalCampaigns: overview.campaigns.length,
    alertCount: overview.alerts.length,
    component: 'BudgetOverviewCard',
  };
}

// ---------------------------------------------------------------------------
// 5. get_reports_list (auto)
// ---------------------------------------------------------------------------

export async function handleGetReportsList(
  ctx: ToolContext,
  _args: Record<string, any>,
) {
  const snap = await ctx.db
    .collection('marketing_reports')
    .where('tenantId', '==', ctx.tenantId)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  const reports = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title || 'Rapor',
      type: data.type || 'performance',
      status: data.status || 'ready',
      dateRange: data.dateRange,
      createdAt: data.createdAt,
      createdBy: data.createdBy,
    };
  });

  return {
    reports,
    totalCount: reports.length,
    component: 'ReportListCard',
  };
}

// ---------------------------------------------------------------------------
// 6. generate_report (approval-required)
// ---------------------------------------------------------------------------

export async function handleGenerateReport(
  ctx: ToolContext,
  args: Record<string, any>,
) {
  const { startDate, endDate } = defaultDateRange(args);
  const reportType = args.reportType || 'performance';
  const title = args.title || `Performans Raporu (${startDate} — ${endDate})`;

  // Create report doc
  const reportRef = ctx.db.collection('marketing_reports').doc();
  await reportRef.set({
    tenantId: ctx.tenantId,
    title,
    type: reportType,
    status: 'generating',
    dateRange: { startDate, endDate },
    createdBy: ctx.userId,
    createdAt: new Date(),
  });

  // Gather data for AI summary
  const campaignsSnap = await ctx.db
    .collection('marketing_campaigns')
    .where('tenantId', '==', ctx.tenantId)
    .get();

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;

  for (const camp of campaignsSnap.docs) {
    const snap = await ctx.db
      .collection('performance_snapshots')
      .where('campaignId', '==', camp.id)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    snap.docs.forEach((d) => {
      const data = d.data();
      totalSpend += data.spend || 0;
      totalImpressions += data.impressions || 0;
      totalClicks += data.clicks || 0;
      totalConversions += data.conversions || 0;
    });
  }

  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0';
  const cpa = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : '0';

  // AI summary
  const { generateJSON } = await import('../../../_lib/gemini-bundle.mjs');

  const aiPrompt = `Pazarlama performans raporu olustur.

DONEM: ${startDate} - ${endDate}
KAMPANYA SAYISI: ${campaignsSnap.size}

KPI'lar:
- Toplam Harcama: ${totalSpend.toFixed(2)} TL
- Gosterim: ${totalImpressions}
- Tiklama: ${totalClicks}
- Donusum: ${totalConversions}
- CTR: %${ctr}
- CPA: ${cpa} TL

2-3 paragraflik yonetici ozeti, 3-5 onemli bulgu ve 3-5 aksiyon onerisini JSON olarak don:
{
  "summary": "string",
  "highlights": ["string"],
  "recommendations": ["string"]
}
Tum metinler Turkce olmali.`;

  const aiResult = await generateJSON('flash', aiPrompt, 'reportGenerator');

  // Update report doc
  await reportRef.update({
    status: 'ready',
    kpis: { totalSpend, totalImpressions, totalClicks, totalConversions, ctr: Number(ctr), cpa: Number(cpa) },
    aiSummary: aiResult.summary || '',
    highlights: aiResult.highlights || [],
    recommendations: aiResult.recommendations || [],
    completedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
  });

  return {
    reportId: reportRef.id,
    title,
    status: 'ready',
    kpis: { totalSpend, totalImpressions, totalClicks, totalConversions },
    summary: aiResult.summary,
    highlights: aiResult.highlights,
    recommendations: aiResult.recommendations,
    message: `Rapor "${title}" basariyla olusturuldu.`,
  };
}

// ---------------------------------------------------------------------------
// 7. get_optimization_suggestions (auto)
// ---------------------------------------------------------------------------

export async function handleGetOptimizationSuggestions(
  ctx: ToolContext,
  _args: Record<string, any>,
) {
  const campaignsSnap = await ctx.db
    .collection('marketing_campaigns')
    .where('tenantId', '==', ctx.tenantId)
    .get();

  // Gather recent performance data
  const last30 = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  const campaignSummaries: string[] = [];

  for (const camp of campaignsSnap.docs) {
    const data = camp.data();
    const snap = await ctx.db
      .collection('performance_snapshots')
      .where('campaignId', '==', camp.id)
      .where('date', '>=', last30)
      .get();

    let spend = 0, impressions = 0, clicks = 0, conversions = 0;
    snap.docs.forEach((d) => {
      const s = d.data();
      spend += s.spend || 0;
      impressions += s.impressions || 0;
      clicks += s.clicks || 0;
      conversions += s.conversions || 0;
    });

    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0';
    const cpa = conversions > 0 ? (spend / conversions).toFixed(2) : '-';

    campaignSummaries.push(
      `- ${data.name}: Harcama=${spend.toFixed(0)} TL, Gosterim=${impressions}, Tiklama=${clicks}, Donusum=${conversions}, CTR=%${ctr}, CPA=${cpa} TL, Durum=${data.status || 'unknown'}`,
    );
  }

  if (campaignSummaries.length === 0) {
    return { suggestions: [], message: 'Kampanya bulunamadi.', component: 'OptimizationSuggestionsCard' };
  }

  const { generateJSON } = await import('../../../_lib/gemini-bundle.mjs');

  const aiPrompt = `Sen bir dijital pazarlama optimizasyon uzmanisin. Asagidaki kampanya verilerini analiz ederek 3-5 spesifik optimizasyon onerisi ver.

KAMPANYALAR (Son 30 Gun):
${campaignSummaries.join('\n')}

Her oneri icin JSON formatinda don:
{
  "suggestions": [
    {
      "title": "string — Kisa baslik",
      "description": "string — Detayli aciklama ve adimlar",
      "impact": "low | medium | high",
      "category": "budget | targeting | creative | bidding | general"
    }
  ]
}
Tum metinler Turkce ve somut olmali. Jenerik ifadelerden kacin.`;

  const aiResult = await generateJSON('flash', aiPrompt, 'optimizationAdvisor');

  return {
    suggestions: aiResult.suggestions || [],
    campaignCount: campaignsSnap.size,
    component: 'OptimizationSuggestionsCard',
  };
}

// ---------------------------------------------------------------------------
// 8. forecast_budget (auto)
// ---------------------------------------------------------------------------

export async function handleForecastBudget(
  ctx: ToolContext,
  args: Record<string, any>,
) {
  const { campaignId } = args;
  if (!campaignId) return { error: 'campaignId gerekli.' };

  const campDoc = await ctx.db.collection('marketing_campaigns').doc(campaignId).get();
  if (!campDoc.exists) return { error: 'Kampanya bulunamadi.' };

  const campData = campDoc.data()!;

  // Get daily spend history
  const snapSnap = await ctx.db
    .collection('performance_snapshots')
    .where('campaignId', '==', campaignId)
    .orderBy('date', 'desc')
    .limit(60)
    .get();

  const dailyMap: Record<string, number> = {};
  snapSnap.docs.forEach((d) => {
    const data = d.data();
    const date = data.date || '';
    dailyMap[date] = (dailyMap[date] || 0) + (data.spend || 0);
  });

  const dailySpendHistory = Object.entries(dailyMap)
    .map(([date, spend]) => ({ date, spend }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalBudget = campData.budget?.totalBudget || campData.lifetimeBudget || 0;
  const spentToDate = dailySpendHistory.reduce((sum, d) => sum + d.spend, 0);

  try {
    const { runBudgetForecaster } = await import('../../../../src/pipeline/marketing/agents/budgetForecaster.js');

    const forecast = await runBudgetForecaster({
      campaignName: campData.name || 'Kampanya',
      totalBudget,
      currency: 'TL',
      spentToDate,
      dailySpendHistory,
      scheduledEndDate: campData.schedule?.endDate,
      objective: campData.objective || 'OUTCOME_AWARENESS',
      platforms: campData.platforms || ['meta'],
    });

    return {
      campaignName: campData.name,
      ...forecast,
      component: 'BudgetForecastCard',
    };
  } catch (err: any) {
    return { error: `Butce tahmini olusturulamadi: ${err.message}` };
  }
}
