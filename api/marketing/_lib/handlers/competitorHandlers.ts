/**
 * Faz 6: Competitor Intelligence Handlers
 *
 * Collections: competitors, competitor_analyses
 * Types: shared/types/competitor.ts
 */

import type { ToolContext } from '../toolHandlers.js';

// ---------------------------------------------------------------------------
// 1. get_competitors (auto)
// ---------------------------------------------------------------------------

export async function handleGetCompetitors(
  ctx: ToolContext,
  _args: Record<string, any>,
) {
  const snap = await ctx.db
    .collection('competitors')
    .where('tenantId', '==', ctx.tenantId)
    .orderBy('createdAt', 'desc')
    .get();

  const competitors = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      website: data.website || null,
      sector: data.sector || null,
      platforms: data.platforms || [],
      status: data.status || 'active',
      frequency: data.frequency || 'weekly',
      lastAnalyzedAt: data.lastAnalyzedAt || null,
      createdAt: data.createdAt,
    };
  });

  return {
    competitors,
    totalCount: competitors.length,
    component: 'CompetitorListCard',
  };
}

// ---------------------------------------------------------------------------
// 2. get_competitor_analysis (auto)
// ---------------------------------------------------------------------------

export async function handleGetCompetitorAnalysis(
  ctx: ToolContext,
  args: Record<string, any>,
) {
  const { competitorId } = args;
  if (!competitorId) return { error: 'competitorId gerekli.' };

  // Verify competitor belongs to tenant
  const compDoc = await ctx.db.collection('competitors').doc(competitorId).get();
  if (!compDoc.exists || compDoc.data()?.tenantId !== ctx.tenantId) {
    return { error: 'Rakip bulunamadi.' };
  }

  // Get latest analysis
  const analysisSnap = await ctx.db
    .collection('competitor_analyses')
    .where('competitorId', '==', competitorId)
    .orderBy('analyzedAt', 'desc')
    .limit(1)
    .get();

  if (analysisSnap.empty) {
    return {
      competitorName: compDoc.data()?.name,
      error: 'Henuz analiz yapilmamis. "Analiz yap" komutunu kullanin.',
    };
  }

  const analysis = analysisSnap.docs[0].data();

  return {
    competitorName: compDoc.data()?.name,
    analysisId: analysisSnap.docs[0].id,
    analyzedAt: analysis.analyzedAt,
    adStrategySummary: analysis.adStrategySummary,
    estimatedMonthlySpend: analysis.estimatedMonthlySpend,
    primaryPlatforms: analysis.primaryPlatforms || [],
    targetAudience: analysis.targetAudience,
    messagingThemes: analysis.messagingThemes || [],
    creativeApproach: analysis.creativeApproach,
    strengths: analysis.strengths || [],
    weaknesses: analysis.weaknesses || [],
    opportunities: analysis.opportunities || [],
    threats: analysis.threats || [],
    adExamples: analysis.adExamples || [],
    recommendations: analysis.recommendations || [],
    overallThreatLevel: analysis.overallThreatLevel || 'medium',
    confidence: analysis.confidence || 0.5,
    component: 'CompetitorAnalysisCard',
  };
}

// ---------------------------------------------------------------------------
// 3. add_competitor (approval-required)
// ---------------------------------------------------------------------------

export async function handleAddCompetitor(
  ctx: ToolContext,
  args: Record<string, any>,
) {
  const { name, website, sector, platforms, frequency } = args;
  if (!name) return { error: 'Rakip adi (name) gerekli.' };

  const compRef = ctx.db.collection('competitors').doc();
  await compRef.set({
    tenantId: ctx.tenantId,
    name,
    website: website || null,
    sector: sector || null,
    platforms: platforms || ['meta'],
    status: 'active',
    frequency: frequency || 'weekly',
    lastAnalyzedAt: null,
    createdBy: ctx.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    competitorId: compRef.id,
    name,
    message: `Rakip "${name}" izleme listesine eklendi.`,
  };
}

// ---------------------------------------------------------------------------
// 4. analyze_competitor (approval-required)
// ---------------------------------------------------------------------------

export async function handleAnalyzeCompetitor(
  ctx: ToolContext,
  args: Record<string, any>,
) {
  const { competitorId } = args;
  if (!competitorId) return { error: 'competitorId gerekli.' };

  const compDoc = await ctx.db.collection('competitors').doc(competitorId).get();
  if (!compDoc.exists || compDoc.data()?.tenantId !== ctx.tenantId) {
    return { error: 'Rakip bulunamadi.' };
  }

  const compData = compDoc.data()!;

  try {
    const { runCompetitorAnalyzer } = await import(
      '../../../../src/pipeline/marketing/agents/competitorAnalyzer.js'
    );

    const analysis = await runCompetitorAnalyzer({
      competitorName: compData.name,
      competitorWebsite: compData.website || undefined,
      sector: compData.sector || undefined,
      platforms: compData.platforms || ['meta'],
    });

    // Save analysis
    const analysisRef = ctx.db.collection('competitor_analyses').doc();
    await analysisRef.set({
      tenantId: ctx.tenantId,
      competitorId,
      analyzedAt: new Date(),
      ...analysis,
    });

    // Update competitor lastAnalyzedAt
    await ctx.db.collection('competitors').doc(competitorId).update({
      lastAnalyzedAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      competitorName: compData.name,
      analysisId: analysisRef.id,
      ...analysis,
      message: `"${compData.name}" rakip analizi tamamlandi.`,
      component: 'CompetitorAnalysisCard',
    };
  } catch (err: any) {
    return { error: `Rakip analizi basarisiz: ${err.message}` };
  }
}
