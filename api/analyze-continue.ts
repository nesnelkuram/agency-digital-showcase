import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import {
  runSectorResearch,
  runBrandStrategist,
  runBrandChallenger,
  runStrategySynthesizer,
} from './_lib/pipeline-bundle.mjs';

export const config = {
  maxDuration: 300,
};

const BUDGET_MS = 290_000; // 10s safety margin

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const startTime = Date.now();
  const remaining = () => BUDGET_MS - (Date.now() - startTime);

  try {
    const { drInteractionId, normalizedData, researchFindings: existingFindings, input } = req.body;

    if (!normalizedData || !input) {
      return res.status(400).json({ error: 'Missing required fields: normalizedData, input' });
    }

    const timings: Record<string, number> = {};
    const errors: Array<{ agent: string; error: string; timestamp: number }> = [];
    const agentsRun: string[] = [];

    // ============================
    // PHASE A: Research (if needed)
    // ============================
    let researchFindings = existingFindings || null;

    if (!researchFindings) {
      const researchStart = Date.now();
      const drTimeout = Math.min(240_000, remaining() - 50_000); // leave 50s for extraction

      try {
        console.log(`analyze-continue: Running sectorResearch (drInteractionId=${drInteractionId || 'none'}, timeout=${drTimeout}ms)`);
        researchFindings = await runSectorResearch(input, {
          drInteractionId: drInteractionId || undefined,
          drTimeout: Math.max(drTimeout, 30_000), // at least 30s
        });
        timings.sectorResearch = Date.now() - researchStart;
        agentsRun.push('sectorResearch');
        console.log(`analyze-continue: sectorResearch done in ${timings.sectorResearch}ms`);
      } catch (error: any) {
        timings.sectorResearch = Date.now() - researchStart;
        errors.push({ agent: 'sectorResearch', error: error.message, timestamp: Date.now() });
        console.error('analyze-continue: sectorResearch failed:', error.message);
      }

      // Not enough time for pipeline? Return research and let client call again
      if (remaining() < 80_000) {
        console.log(`analyze-continue: Not enough time for pipeline (${remaining()}ms remaining), returning research`);
        return res.status(200).json({
          status: researchFindings ? 'research_complete' : 'failed',
          researchFindings,
          debug: { timings, errors, agentsRun },
        });
      }
    }

    // ============================
    // PHASE B: Pipeline agents
    // ============================

    // Agent 3: Brand Strategist (required)
    let strategistOutput = null;
    if (remaining() > 10_000) {
      const stratStart = Date.now();
      try {
        console.log('analyze-continue: Running brandStrategist...');
        strategistOutput = await runBrandStrategist(normalizedData, researchFindings);
        timings.brandStrategist = Date.now() - stratStart;
        agentsRun.push('brandStrategist');
      } catch (error: any) {
        timings.brandStrategist = Date.now() - stratStart;
        errors.push({ agent: 'brandStrategist', error: error.message, timestamp: Date.now() });
        console.error('analyze-continue: brandStrategist failed:', error.message);
      }
    }

    if (!strategistOutput) {
      return res.status(200).json({
        status: 'failed',
        error: 'Brand strategist failed',
        researchFindings,
        debug: { timings, errors, agentsRun },
      });
    }

    // Agent 4: Brand Challenger (optional)
    let challengerOutput = null;
    if (remaining() > 30_000) {
      const challStart = Date.now();
      try {
        console.log('analyze-continue: Running brandChallenger...');
        challengerOutput = await runBrandChallenger(normalizedData, researchFindings, strategistOutput);
        timings.brandChallenger = Date.now() - challStart;
        agentsRun.push('brandChallenger');
      } catch (error: any) {
        timings.brandChallenger = Date.now() - challStart;
        errors.push({ agent: 'brandChallenger', error: error.message, timestamp: Date.now() });
      }
    } else {
      console.log('analyze-continue: Skipping challenger (not enough time)');
    }

    // Agent 5: Strategy Synthesizer (optional with fallback)
    let synthesizedAnalysis = null;
    if (remaining() > 10_000) {
      const synthStart = Date.now();
      try {
        console.log('analyze-continue: Running strategySynthesizer...');
        synthesizedAnalysis = await runStrategySynthesizer(normalizedData, researchFindings, strategistOutput, challengerOutput);
        timings.strategySynthesizer = Date.now() - synthStart;
        agentsRun.push('strategySynthesizer');
      } catch (error: any) {
        timings.strategySynthesizer = Date.now() - synthStart;
        errors.push({ agent: 'strategySynthesizer', error: error.message, timestamp: Date.now() });
      }
    }

    // ============================
    // FORMAT ANALYSIS
    // ============================
    const synthesized = synthesizedAnalysis || buildFallbackSynthesis(strategistOutput);
    const totalDuration = Date.now() - startTime;
    timings.total = totalDuration;

    const analysis = {
      brandPersonality: synthesized.brandPersonality,
      visualWorld: synthesized.visualWorld,
      contentStrategy: synthesized.contentStrategy,
      analysis: synthesized.analysis,
      positioning: synthesized.positioning,

      sectorResearch: researchFindings
        ? {
            competitors: researchFindings.competitors,
            marketData: researchFindings.marketData,
            targetAudienceInsights: researchFindings.targetAudienceInsights,
            marketTrends: researchFindings.marketData?.consumerTrends || [],
            sectorBenchmarks: researchFindings.sectorBenchmarks,
            searchQueries: researchFindings.searchQueries,
            sourcesUsed: researchFindings.sourcesUsed,
            sourceUrls: researchFindings.sourceUrls,
          }
        : undefined,

      actionPlan: synthesized.actionPlan,
      evidenceSummary: synthesized.evidenceSummary,

      debate: strategistOutput
        ? {
            strategistPosition: `${strategistOutput.archetype}: ${strategistOutput.positioningStatement}`,
            challengerPosition: challengerOutput
              ? `${challengerOutput.alternativeArchetype}: ${challengerOutput.counterPosition}`
              : 'Muhalif degerlendirmesi yapilmadi',
            challengerAlternatives: challengerOutput?.alternativePositionings || [],
            synthesisRationale: synthesized.synthesisRationale || '',
            debateCompleted: !!challengerOutput,
          }
        : undefined,

      dataQuality: normalizedData
        ? {
            completeness: normalizedData.dataQualityScore,
            contradictions: normalizedData.contradictions,
            patterns: normalizedData.detectedPatterns,
            missingAreas: normalizedData.missingAreas,
          }
        : undefined,

      pipelineMetadata: {
        version: '3.1.0',
        agentsRun,
        totalDuration,
        agentDurations: Object.fromEntries(
          Object.entries(timings).filter(([k]) => k !== 'total')
        ),
        researchAvailable: !!researchFindings && (researchFindings.sourcesUsed !== 0),
        researchMethod: researchFindings?.sourcesUsed === -1 ? 'deep-research' : researchFindings?.sourcesUsed ? 'grounding' : 'none',
        fallbackUsed: !synthesizedAnalysis,
        asyncPipeline: true,
      },

      analyzedBy: 'gemini-multi-agent' as const,
      modelVersion: 'pipeline-v1.0',
      confidence: normalizedData?.dataQualityScore ?? 0.5,
    };

    return res.status(200).json({
      status: 'completed',
      analysis,
      debug: { timings, errors, agentsRun },
    });
  } catch (error: any) {
    console.error('analyze-continue error:', error);
    try {
      return res.status(500).json({
        status: 'failed',
        error: String(error?.message || 'Continue phase failed'),
        details: String(error?.stack || '').split('\n').slice(0, 3),
      });
    } catch {
      return res.status(500).end(JSON.stringify({ status: 'failed', error: 'Internal server error' }));
    }
  }
}

// Fallback synthesis when synthesizer is skipped
function buildFallbackSynthesis(strategistOutput: any) {
  const taObj = strategistOutput.targetAudience;
  const taSummary = typeof taObj === 'string'
    ? taObj
    : `${taObj?.primarySegment?.demographics || ''} davranissal segment`;

  return {
    brandPersonality: {
      archetype: strategistOutput.archetype,
      traits: strategistOutput.traits,
      tone: strategistOutput.tone,
      voice: strategistOutput.voice,
    },
    positioning: {
      statement: strategistOutput.positioningStatement,
      targetAudience: taSummary,
      valuePropositionReasoning: strategistOutput.valuePropositionReasoning || {
        whatBusinessProduces: '', coreBenefit: '', whoBenefits: '', pricePositioning: '', willingToPayProfile: '',
      },
      targetSegments: [taObj?.primarySegment, taObj?.secondarySegment].filter(Boolean),
      differentiator: strategistOutput.differentiator,
      competitiveAdvantage: strategistOutput.competitiveAdvantage,
      competitiveLandscape: '',
      alternativePositions: [],
    },
    visualWorld: { moodKeywords: [], colorPalette: [], typographyStyle: '', imageryStyle: '' },
    contentStrategy: { pillars: [], toneGuidelines: [], keyMessages: [], hashtags: [] },
    analysis: { strengths: [], opportunities: [], challenges: [], recommendations: [] },
    actionPlan: { immediate: [], shortTerm: [], mediumTerm: [] },
    evidenceSummary: {
      sourcesConsulted: 0,
      keySourceUrls: [],
      dataFreshness: 'Veri mevcut degil',
      confidenceLevel: 'Dusuk — Sentez asamasi atlanmistir',
    },
    synthesisRationale: 'Sentez asamasi atlanmistir, stratejist ciktisi dogrudan kullanilmistir.',
  };
}
