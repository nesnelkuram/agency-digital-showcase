import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 300,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  try {
    const {
      leadId,
      clientId,
      brandAnalysis,
      businessContext,
      businessName,
      sector,
      goals,
      availablePlatforms,
      totalBudget,
      currency,
      campaignDuration,
      adminNotes,
      revisionNotes,
      previousProposalId,
    } = req.body;

    // Validate required fields
    if (!leadId || !brandAnalysis || !goals || !availablePlatforms || !totalBudget) {
      return res.status(400).json({
        error: 'Missing required fields: leadId, brandAnalysis, goals, availablePlatforms, totalBudget',
      });
    }

    if (!brandAnalysis.brandPersonality || !brandAnalysis.positioning) {
      return res.status(400).json({
        error: 'brandAnalysis must include brandPersonality and positioning',
      });
    }

    // Dynamic import to avoid bundling issues
    // In production, this would import from pre-bundled marketing pipeline
    const { runMarketingPipeline } = await import('../../src/pipeline/marketing/marketingPipeline');

    const input = {
      leadId,
      clientId,
      brandAnalysis,
      businessContext,
      businessName: businessName || brandAnalysis.positioning?.targetAudience || 'Unknown',
      sector: sector || 'other',
      goals: {
        primaryObjective: goals.primaryObjective || 'awareness',
        secondaryObjectives: goals.secondaryObjectives || [],
        targetMetrics: goals.targetMetrics || {},
        specificRequirements: goals.specificRequirements || undefined,
      },
      availablePlatforms,
      totalBudget: Number(totalBudget),
      currency: currency || 'TRY',
      campaignDuration: Number(campaignDuration) || 30,
      adminNotes,
      revisionNotes,
      previousProposalId,
    };

    console.log(`[generate-proposal] Starting marketing pipeline for lead=${leadId}`);
    console.log(`[generate-proposal] Platforms: ${availablePlatforms.join(', ')}, Budget: ${totalBudget} ${currency || 'TRY'}`);

    const pipelineState = await runMarketingPipeline(input);

    // Map pipeline state to response
    const response = {
      success: true,
      proposal: pipelineState.assembledProposal,
      metadata: {
        version: '1.0',
        agentsRun: Object.keys(pipelineState.timings).filter(k => k !== 'total'),
        totalDuration: pipelineState.timings.total,
        agentDurations: pipelineState.timings,
        errors: pipelineState.errors,
      },
    };

    console.log(`[generate-proposal] Complete in ${pipelineState.timings.total}ms, agents: ${Object.keys(pipelineState.timings).join(', ')}`);

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('[generate-proposal] Pipeline error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Marketing pipeline failed',
      details: error.stack?.split('\n').slice(0, 3),
    });
  }
}
