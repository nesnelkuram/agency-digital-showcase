import type { PipelineInput, PipelineState, NormalizedData, ResearchFindings, StrategistOutput, ChallengerOutput, SynthesizedAnalysis } from './types';
import { runDataNormalizer } from './agents/dataNormalizer';
import { runSectorResearch } from './agents/sectorResearch';
import { runBrandStrategist } from './agents/brandStrategist';
import { runBrandChallenger } from './agents/brandChallenger';
import { runStrategySynthesizer } from './agents/strategySynthesizer';

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
    () => runBrandStrategist(normalizedData, researchFindings),
    state,
    true
  );

  if (!strategistOutput) {
    throw new Error('Brand strategist failed — pipeline cannot continue');
  }
  state.strategistOutput = strategistOutput;

  // Step 3: Agent 4 (Challenger) — optional, skip if lite or low on time
  let challengerOutput: ChallengerOutput | null = null;
  if (!isLite && remainingTime(startTime) > 22_000) {
    challengerOutput = await runAgent<ChallengerOutput>(
      'brandChallenger',
      () => runBrandChallenger(normalizedData, researchFindings, strategistOutput),
      state,
      false
    );
  } else if (!isLite) {
    console.log('Skipping challenger: not enough time remaining');
    state.errors.push({
      agent: 'brandChallenger',
      error: 'Skipped due to timeout budget',
      timestamp: Date.now(),
    });
  }
  state.challengerOutput = challengerOutput ?? undefined;

  // Step 4: Agent 5 (Synthesizer) — optional with fallback
  let synthesizedAnalysis: SynthesizedAnalysis | null = null;
  if (remainingTime(startTime) > 8_000) {
    synthesizedAnalysis = await runAgent<SynthesizedAnalysis>(
      'strategySynthesizer',
      () => runStrategySynthesizer(normalizedData, researchFindings, strategistOutput, challengerOutput),
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
      : `${taObj.primaryPersona?.name || ''} ve benzeri profiller`;
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
        targetPersonas: [],
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
