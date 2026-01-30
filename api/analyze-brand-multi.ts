import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { runPipeline } from './_lib/pipeline-bundle.mjs';

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
    const { contact, sector, wizard, requestedServices, leadId, mode } = req.body;

    if (!contact || !sector || !wizard) {
      return res.status(400).json({ error: 'Missing required fields: contact, sector, wizard' });
    }

    const input = {
      contact: {
        name: contact.name || '',
        businessName: contact.businessName || '',
        email: contact.email || '',
      },
      sector,
      wizard: {
        answers: wizard.answers || {},
        scores: wizard.scores || {},
        stageResults: wizard.stageResults || [],
      },
      requestedServices: requestedServices || [],
      leadId: leadId || 'unknown',
      mode: mode || 'full',
    };

    const state = await runPipeline(input);

    const synthesized = state.synthesizedAnalysis!;
    const analysis = {
      brandPersonality: synthesized.brandPersonality,
      visualWorld: synthesized.visualWorld,
      contentStrategy: synthesized.contentStrategy,
      analysis: synthesized.analysis,
      positioning: synthesized.positioning,

      sectorResearch: state.researchFindings
        ? {
            competitors: state.researchFindings.competitors,
            marketTrends: state.researchFindings.marketTrends,
            sectorBenchmarks: state.researchFindings.sectorBenchmarks,
            searchQueries: state.researchFindings.searchQueries,
            sourcesUsed: state.researchFindings.sourcesUsed,
          }
        : undefined,

      debate: state.strategistOutput
        ? {
            strategistPosition: `${state.strategistOutput.archetype}: ${state.strategistOutput.positioningStatement}`,
            challengerPosition: state.challengerOutput
              ? `${state.challengerOutput.alternativeArchetype}: ${state.challengerOutput.counterPosition}`
              : 'Muhalif degerlendirmesi yapilmadi',
            challengerAlternatives: state.challengerOutput?.alternativePositionings || [],
            synthesisRationale: synthesized.synthesisRationale,
            debateCompleted: !!state.challengerOutput,
          }
        : undefined,

      dataQuality: state.normalizedData
        ? {
            completeness: state.normalizedData.dataQualityScore,
            contradictions: state.normalizedData.contradictions,
            patterns: state.normalizedData.detectedPatterns,
            missingAreas: state.normalizedData.missingAreas,
          }
        : undefined,

      pipelineMetadata: {
        version: '1.0.0',
        agentsRun: Object.keys(state.timings).filter((k) => k !== 'total'),
        totalDuration: state.timings.total || 0,
        agentDurations: Object.fromEntries(
          Object.entries(state.timings).filter(([k]) => k !== 'total')
        ),
        researchAvailable: !!state.researchFindings && (state.researchFindings.sourcesUsed > 0),
        fallbackUsed: !state.synthesizedAnalysis || state.errors.some((e) => e.agent === 'strategySynthesizer'),
      },

      analyzedBy: 'gemini-multi-agent' as const,
      modelVersion: 'pipeline-v1.0',
      confidence: state.normalizedData?.dataQualityScore ?? 0.5,
    };

    return res.status(200).json({
      success: true,
      analysis,
      debug: {
        timings: state.timings,
        errors: state.errors,
        agentsRun: Object.keys(state.timings).filter((k) => k !== 'total'),
      },
    });
  } catch (error: any) {
    console.error('Multi-agent analysis error:', error);
    try {
      return res.status(500).json({
        error: String(error?.message || 'Multi-agent analysis failed'),
        details: String(error?.stack || '').split('\n').slice(0, 3),
      });
    } catch (jsonError) {
      console.error('Failed to serialize error response:', jsonError);
      return res.status(500).end(
        JSON.stringify({ error: 'Internal server error' })
      );
    }
  }
}
