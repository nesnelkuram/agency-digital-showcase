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
const PIPELINE_BUDGET_MS = 150_000; // strategist(50s) + challenger(27s) + synthesizer(67s) + buffer(6s)

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

    console.log(`analyze-continue: START — existingFindings=${!!existingFindings}, drInteractionId=${drInteractionId || 'none'}`);

    // ============================
    // PHASE A: Research (if needed)
    // ============================
    let researchFindings = existingFindings || null;

    if (!researchFindings) {
      const researchStart = Date.now();
      const drTimeout = Math.min(180_000, remaining() - 80_000); // leave 80s for grounding fallback + extraction

      try {
        console.log(`analyze-continue: Running sectorResearch (drInteractionId=${drInteractionId || 'none'}, timeout=${drTimeout}ms)`);
        researchFindings = await runSectorResearch(input, {
          drInteractionId: drInteractionId || undefined,
          drTimeout: Math.max(drTimeout, 30_000), // at least 30s
          startTimeMs: startTime,
          budgetMs: BUDGET_MS,
        });
        timings.sectorResearch = Date.now() - researchStart;
        agentsRun.push('sectorResearch');

        // Log research summary for debugging
        const rc = researchFindings;
        console.log(`analyze-continue: sectorResearch done in ${timings.sectorResearch}ms — competitors=${rc?.competitors?.length || 0}, sourcesUsed=${rc?.sourcesUsed}, marketSize=${rc?.marketData?.marketSize?.slice?.(0, 50) || 'N/A'}, hasRawSnippets=${(rc?.rawSnippets?.[0]?.length || 0) > 0}`);
      } catch (error: any) {
        timings.sectorResearch = Date.now() - researchStart;
        errors.push({ agent: 'sectorResearch', error: error.message, timestamp: Date.now() });
        console.error('analyze-continue: sectorResearch failed:', error.message);
      }

      // Not enough time for pipeline? Return research and let client call again
      if (remaining() < PIPELINE_BUDGET_MS) {
        console.log(`analyze-continue: Not enough time for pipeline (${remaining()}ms remaining < ${PIPELINE_BUDGET_MS}ms needed), returning research for next call`);
        return res.status(200).json({
          status: researchFindings ? 'research_complete' : 'failed',
          researchFindings,
          debug: { timings, errors, agentsRun, remainingMs: remaining() },
        });
      }
    } else {
      console.log(`analyze-continue: Using pre-existing research — competitors=${existingFindings?.competitors?.length || 0}, sourcesUsed=${existingFindings?.sourcesUsed}`);
    }

    // ============================
    // PHASE B: Pipeline agents
    // ============================
    console.log(`analyze-continue: PHASE B START — remaining=${remaining()}ms, hasResearch=${!!researchFindings}, sourcesUsed=${researchFindings?.sourcesUsed}`);

    // Agent 3: Brand Strategist (required)
    let strategistOutput = null;
    if (remaining() > 10_000) {
      const stratStart = Date.now();
      try {
        console.log('analyze-continue: Running brandStrategist...');
        strategistOutput = await runBrandStrategist(normalizedData, researchFindings);
        timings.brandStrategist = Date.now() - stratStart;
        agentsRun.push('brandStrategist');
        console.log(`analyze-continue: brandStrategist done in ${timings.brandStrategist}ms — archetype=${strategistOutput?.archetype}`);
      } catch (error: any) {
        timings.brandStrategist = Date.now() - stratStart;
        errors.push({ agent: 'brandStrategist', error: error.message, timestamp: Date.now() });
        console.error('analyze-continue: brandStrategist failed:', error.message);
      }
    } else {
      console.log(`analyze-continue: SKIPPING brandStrategist — remaining=${remaining()}ms`);
    }

    if (!strategistOutput) {
      console.error('analyze-continue: brandStrategist produced no output, returning failed');
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
        console.log(`analyze-continue: brandChallenger done in ${timings.brandChallenger}ms`);
      } catch (error: any) {
        timings.brandChallenger = Date.now() - challStart;
        errors.push({ agent: 'brandChallenger', error: error.message, timestamp: Date.now() });
        console.error(`analyze-continue: brandChallenger failed in ${timings.brandChallenger}ms: ${error.message}`);
      }
    } else {
      console.log(`analyze-continue: SKIPPING brandChallenger — remaining=${remaining()}ms`);
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
        console.log(`analyze-continue: strategySynthesizer done in ${timings.strategySynthesizer}ms`);
      } catch (error: any) {
        timings.strategySynthesizer = Date.now() - synthStart;
        errors.push({ agent: 'strategySynthesizer', error: error.message, timestamp: Date.now() });
        console.error(`analyze-continue: strategySynthesizer failed in ${timings.strategySynthesizer}ms: ${error.message}`);
      }
    } else {
      console.log(`analyze-continue: SKIPPING strategySynthesizer — remaining=${remaining()}ms`);
    }

    // ============================
    // FORMAT ANALYSIS
    // ============================
    const usedFallback = !synthesizedAnalysis;
    const synthesized = synthesizedAnalysis || buildFallbackSynthesis(strategistOutput);
    const totalDuration = Date.now() - startTime;
    timings.total = totalDuration;

    console.log(`analyze-continue: FORMAT — fallback=${usedFallback}, agents=[${agentsRun.join(',')}], total=${totalDuration}ms, remaining=${remaining()}ms`);

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
        fallbackUsed: usedFallback,
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
