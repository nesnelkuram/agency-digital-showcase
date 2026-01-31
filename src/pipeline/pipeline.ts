import type { PipelineInput, PipelineState, NormalizedData, ResearchFindings, StrategistOutput, ChallengerOutput, BlogAdvisorOutput, SynthesizedAnalysis } from './types';
import { runDataNormalizer } from './agents/dataNormalizer';
import { runSectorResearch } from './agents/sectorResearch';
import { runBrandStrategist } from './agents/brandStrategist';
import { runBrandChallenger } from './agents/brandChallenger';
import { runBlogStrategyAdvisor } from './agents/blogStrategyAdvisor';
import { runStrategySynthesizer } from './agents/strategySynthesizer';

// Re-exports for async pipeline endpoints
export { runDataNormalizer } from './agents/dataNormalizer';
export { runSectorResearch, extractResearchJSON } from './agents/sectorResearch';
export type { SectorResearchOptions } from './agents/sectorResearch';
export { runBrandStrategist } from './agents/brandStrategist';
export { runBrandChallenger } from './agents/brandChallenger';
export { runBlogStrategyAdvisor } from './agents/blogStrategyAdvisor';
export { runStrategySynthesizer } from './agents/strategySynthesizer';
export { startDeepResearch, pollDeepResearch } from './geminiClient';
export { buildDeepResearchPrompt } from './agents/sectorResearch';
export type { PipelineInput, NormalizedData, ResearchFindings, StrategistOutput, ChallengerOutput, BlogAdvisorOutput, SynthesizedAnalysis } from './types';

const TIMEOUT_BUDGET = 290_000; // 290s (10s safety margin from 300s Vercel limit)

async function runAgent<T>(
  name: string,
  fn: () => Promise<T>,
  state: PipelineState,
  required: boolean
): Promise<T | null> {
  const start = Date.now();
  try {
    const result = await fn();
    state.timings[name] = Date.now() - start;
    return result;
  } catch (error: any) {
    state.timings[name] = Date.now() - start;
    state.errors.push({
      agent: name,
      error: error.message || 'Unknown error',
      timestamp: Date.now(),
    });
    console.error(`Agent "${name}" failed:`, error.message);
    if (required) {
      throw new Error(`Required agent "${name}" failed: ${error.message}`);
    }
    return null;
  }
}

function remainingTime(startTime: number): number {
  return TIMEOUT_BUDGET - (Date.now() - startTime);
}

export async function runPipeline(input: PipelineInput): Promise<PipelineState> {
  const startTime = Date.now();
  const isLite = input.mode === 'lite';

  const state: PipelineState = {
    input,
    errors: [],
    timings: {},
  };

  // Step 1: Run Agent 1 (Normalizer) and Agent 2 (Research) in PARALLEL
  const parallelTasks: [Promise<NormalizedData | null>, Promise<ResearchFindings | null>] = [
    runAgent('dataNormalizer', () => runDataNormalizer(input), state, true),
    isLite
      ? Promise.resolve(null)
      : runAgent('sectorResearch', () => runSectorResearch(input), state, false),
  ];

  const [normalizedData, researchFindings] = await Promise.all(parallelTasks);

  if (!normalizedData) {
    throw new Error('Data normalization failed — pipeline cannot continue');
  }
  state.normalizedData = normalizedData;
  state.researchFindings = researchFindings ?? undefined;

  // Step 2: Agent 3 (Strategist) — required
  if (remainingTime(startTime) < 10_000) {
    throw new Error('Timeout: not enough time for strategist agent');
  }

  const strategistOutput = await runAgent<StrategistOutput>(
    'brandStrategist',
    () => runBrandStrategist(normalizedData, researchFindings, input.businessContext),
    state,
    true
  );

  if (!strategistOutput) {
    throw new Error('Brand strategist failed — pipeline cannot continue');
  }
  state.strategistOutput = strategistOutput;

  // Step 3: Agent 4a (Challenger) + Agent 4b (Blog Advisor) — run in PARALLEL
  let challengerOutput: ChallengerOutput | null = null;
  let blogAdvisorOutput: BlogAdvisorOutput | null = null;

  if (!isLite && remainingTime(startTime) > 22_000) {
    const [challResult, blogResult] = await Promise.all([
      runAgent<ChallengerOutput>(
        'brandChallenger',
        () => runBrandChallenger(normalizedData, researchFindings, strategistOutput),
        state,
        false
      ),
      runAgent<BlogAdvisorOutput>(
        'blogStrategyAdvisor',
        () => runBlogStrategyAdvisor(normalizedData, researchFindings, strategistOutput),
        state,
        false
      ),
    ]);
    challengerOutput = challResult;
    blogAdvisorOutput = blogResult;
  } else if (!isLite) {
    console.log('Skipping challenger + blog advisor: not enough time remaining');
    state.errors.push({
      agent: 'brandChallenger',
      error: 'Skipped due to timeout budget',
      timestamp: Date.now(),
    });
  }
  state.challengerOutput = challengerOutput ?? undefined;
  state.blogAdvisorOutput = blogAdvisorOutput ?? undefined;

  // Step 4: Agent 5 (Synthesizer) — optional with fallback
  let synthesizedAnalysis: SynthesizedAnalysis | null = null;
  if (remainingTime(startTime) > 8_000) {
    synthesizedAnalysis = await runAgent<SynthesizedAnalysis>(
      'strategySynthesizer',
      () => runStrategySynthesizer(normalizedData, researchFindings, strategistOutput, challengerOutput, blogAdvisorOutput, input.businessContext),
      state,
      false
    );
  }

  if (synthesizedAnalysis) {
    state.synthesizedAnalysis = synthesizedAnalysis;
  } else {
    // Fallback: map strategist output directly to SynthesizedAnalysis shape
    console.log('Using strategist output as fallback (synthesizer skipped or failed)');
    const taObj = strategistOutput.targetAudience;
    const taSummary = typeof taObj === 'string'
      ? taObj
      : `${taObj.primarySegment?.demographics || ''} davranissal segment`;
    state.synthesizedAnalysis = {
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
        targetSegments: [taObj.primarySegment, taObj.secondarySegment].filter(Boolean),
        differentiator: strategistOutput.differentiator,
        competitiveAdvantage: strategistOutput.competitiveAdvantage,
        competitiveLandscape: '',
        alternativePositions: [],
      },
      visualWorld: {
        moodKeywords: [],
        colorPalette: [],
        typographyStyle: '',
        imageryStyle: '',
      },
      contentStrategy: {
        pillars: [],
        toneGuidelines: [],
        keyMessages: [],
        hashtags: [],
      },
      analysis: {
        strengths: [],
        opportunities: [],
        challenges: [],
        recommendations: [],
      },
      actionPlan: {
        immediate: [],
        shortTerm: [],
        mediumTerm: [],
      },
      evidenceSummary: {
        sourcesConsulted: 0,
        keySourceUrls: [],
        dataFreshness: 'Veri mevcut degil',
        confidenceLevel: 'Dusuk — Sentez asamasi atlanmistir',
      },
      synthesisRationale: 'Sentez asamasi atlanmistir, stratejist ciktisi dogrudan kullanilmistir.',
    };
    state.errors.push({
      agent: 'strategySynthesizer',
      error: 'Fallback used — strategist output mapped directly',
      timestamp: Date.now(),
    });
  }

  state.timings.total = Date.now() - startTime;
  return state;
}
