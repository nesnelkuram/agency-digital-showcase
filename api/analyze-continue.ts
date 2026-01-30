import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import {
  runSectorResearch,
  extractResearchJSON,
  pollDeepResearch,
  runBrandStrategist,
  runBrandChallenger,
  runBlogStrategyAdvisor,
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

      if (drInteractionId) {
        // --- DR interaction exists: poll it (NO grounding fallback on timeout) ---
        const drPollTimeout = Math.min(250_000, remaining() - 40_000); // 40s buffer for JSON response
        console.log(`analyze-continue: Polling DR (${drInteractionId}), timeout=${Math.max(drPollTimeout, 30_000)}ms`);

        try {
          const drResult = await pollDeepResearch(drInteractionId, Math.max(drPollTimeout, 30_000));
          timings.drPoll = Date.now() - researchStart;

          if (drResult.status === 'completed' && drResult.text.length > 200) {
            // DR tamamlandi → JSON extraction
            console.log(`analyze-continue: DR completed (${drResult.text.length} chars), extracting JSON...`);
            const extractStart = Date.now();
            researchFindings = await extractResearchJSON(drResult.text, [], [], -1);
            timings.researchExtraction = Date.now() - extractStart;
            agentsRun.push('sectorResearch');
            const rc = researchFindings;
            console.log(`analyze-continue: Research extraction done in ${timings.researchExtraction}ms — competitors=${rc?.competitors?.length || 0}, sourcesUsed=${rc?.sourcesUsed}, marketSize=${rc?.marketData?.marketSize?.slice?.(0, 50) || 'N/A'}`);
          } else if (drResult.status === 'timeout') {
            // DR HALA CALISIYOR → client'a "tekrar dene" de (grounding'e DUSME)
            console.log(`analyze-continue: DR still running (poll timeout after ${timings.drPoll}ms), returning 'researching'`);
            return res.status(200).json({
              status: 'researching',
              debug: { timings, errors, agentsRun, drStatus: 'polling', remainingMs: remaining() },
            });
          } else {
            // DR GERCEKTEN BASARISIZ (failed/cancelled) → grounding fallback
            console.log(`analyze-continue: DR failed (${drResult.status}), falling back to grounding...`);
            try {
              researchFindings = await runSectorResearch(input, { drTimeout: 0, startTimeMs: startTime, budgetMs: BUDGET_MS });
              timings.sectorResearch = Date.now() - researchStart;
              agentsRun.push('sectorResearch');
              const rc = researchFindings;
              console.log(`analyze-continue: Grounding fallback done in ${timings.sectorResearch}ms — competitors=${rc?.competitors?.length || 0}, sourcesUsed=${rc?.sourcesUsed}`);
            } catch (error: any) {
              timings.sectorResearch = Date.now() - researchStart;
              errors.push({ agent: 'sectorResearch', error: error.message, timestamp: Date.now() });
              console.error('analyze-continue: Grounding fallback failed:', error.message);
            }
          }
        } catch (error: any) {
          timings.drPoll = Date.now() - researchStart;
          errors.push({ agent: 'drPoll', error: error.message, timestamp: Date.now() });
          console.error('analyze-continue: DR poll error:', error.message);
        }
      } else {
        // --- drInteractionId yok → dogrudan grounding ---
        console.log('analyze-continue: No DR interaction, running grounding research...');
        try {
          researchFindings = await runSectorResearch(input, { drTimeout: 0, startTimeMs: startTime, budgetMs: BUDGET_MS });
          timings.sectorResearch = Date.now() - researchStart;
          agentsRun.push('sectorResearch');
          const rc = researchFindings;
          console.log(`analyze-continue: Grounding research done in ${timings.sectorResearch}ms — competitors=${rc?.competitors?.length || 0}, sourcesUsed=${rc?.sourcesUsed}`);
        } catch (error: any) {
          timings.sectorResearch = Date.now() - researchStart;
          errors.push({ agent: 'sectorResearch', error: error.message, timestamp: Date.now() });
          console.error('analyze-continue: Grounding research failed:', error.message);
        }
      }

      // Not enough time for pipeline? Return research and let client call again
      if (researchFindings && remaining() < PIPELINE_BUDGET_MS) {
        console.log(`analyze-continue: Not enough time for pipeline (${remaining()}ms remaining < ${PIPELINE_BUDGET_MS}ms needed), returning research for next call`);
        return res.status(200).json({
          status: 'research_complete',
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

    // Agent 4a + 4b: Brand Challenger + Blog Strategy Advisor (PARALLEL, optional)
    let challengerOutput = null;
    let blogAdvisorOutput = null;
    if (remaining() > 30_000) {
      const parallelStart = Date.now();
      console.log('analyze-continue: Running brandChallenger + blogStrategyAdvisor in parallel...');

      const [challResult, blogResult] = await Promise.all([
        (async () => {
          const s = Date.now();
          try {
            const r = await runBrandChallenger(normalizedData, researchFindings, strategistOutput);
            timings.brandChallenger = Date.now() - s;
            agentsRun.push('brandChallenger');
            console.log(`analyze-continue: brandChallenger done in ${timings.brandChallenger}ms`);
            return r;
          } catch (error: any) {
            timings.brandChallenger = Date.now() - s;
            errors.push({ agent: 'brandChallenger', error: error.message, timestamp: Date.now() });
            console.error(`analyze-continue: brandChallenger failed in ${timings.brandChallenger}ms: ${error.message}`);
            return null;
          }
        })(),
        (async () => {
          const s = Date.now();
          try {
            const r = await runBlogStrategyAdvisor(normalizedData, researchFindings, strategistOutput);
            timings.blogStrategyAdvisor = Date.now() - s;
            agentsRun.push('blogStrategyAdvisor');
            console.log(`analyze-continue: blogStrategyAdvisor done in ${timings.blogStrategyAdvisor}ms`);
            return r;
          } catch (error: any) {
            timings.blogStrategyAdvisor = Date.now() - s;
            errors.push({ agent: 'blogStrategyAdvisor', error: error.message, timestamp: Date.now() });
            console.error(`analyze-continue: blogStrategyAdvisor failed in ${timings.blogStrategyAdvisor}ms: ${error.message}`);
            return null;
          }
        })(),
      ]);

      challengerOutput = challResult;
      blogAdvisorOutput = blogResult;
      console.log(`analyze-continue: parallel agents done in ${Date.now() - parallelStart}ms — challenger=${!!challResult}, blogAdvisor=${!!blogResult}`);
    } else {
      console.log(`analyze-continue: SKIPPING challenger+blogAdvisor — remaining=${remaining()}ms`);
    }

    // Agent 5: Strategy Synthesizer (optional with fallback)
    let synthesizedAnalysis = null;
    if (remaining() > 10_000) {
      const synthStart = Date.now();
      try {
        console.log('analyze-continue: Running strategySynthesizer...');
        synthesizedAnalysis = await runStrategySynthesizer(normalizedData, researchFindings, strategistOutput, challengerOutput, blogAdvisorOutput);
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
            blogAdvisorPosition: blogAdvisorOutput
              ? `Felsefi uyum: ${blogAdvisorOutput.philosophicalAlignment.score}/10 — ${blogAdvisorOutput.philosophicalAlignment.rationale}`
              : 'Blog danismani degerlendirmesi yapilmadi',
            challengerAlternatives: challengerOutput?.alternativePositionings || [],
            synthesisRationale: synthesized.synthesisRationale || '',
            debateCompleted: !!challengerOutput,
            blogAdvisorCompleted: !!blogAdvisorOutput,
          }
        : undefined,

      blogAdvisorInsights: blogAdvisorOutput
        ? {
            philosophicalAlignmentScore: blogAdvisorOutput.philosophicalAlignment.score,
            alignedPrinciples: blogAdvisorOutput.philosophicalAlignment.alignedPrinciples,
            conflictingPrinciples: blogAdvisorOutput.philosophicalAlignment.conflictingPrinciples,
            keyRecommendations: blogAdvisorOutput.strategicRecommendations.map(
              (r: any) => `[${r.area}] ${r.recommendation} (Ref: ${r.blogReference})`
            ),
            contentPillars: blogAdvisorOutput.contentStrategyInsights.contentPillars,
            topicSuggestions: blogAdvisorOutput.contentStrategyInsights.topicSuggestions,
            narrativeApproach: blogAdvisorOutput.contentStrategyInsights.narrativeApproach,
            unconventionalInsights: blogAdvisorOutput.unconventionalInsights,
            authorPerspective: blogAdvisorOutput.authorPerspective,
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
        version: '3.2.0',
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
