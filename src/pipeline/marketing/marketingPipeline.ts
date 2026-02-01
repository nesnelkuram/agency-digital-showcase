import type {
  MarketingPipelineInput,
  MarketingPipelineState,
  CampaignStrategyOutput,
  AudienceArchitectOutput,
  CreativeDirectorOutput,
  BudgetAllocatorOutput,
  AssembledProposal,
} from './types';
import { runCampaignStrategist } from './agents/campaignStrategist';
import { runAudienceArchitect } from './agents/audienceArchitect';
import { runCreativeDirector } from './agents/creativeDirector';
import { runBudgetAllocator } from './agents/budgetAllocator';

// Re-exports for API endpoints
export { runCampaignStrategist } from './agents/campaignStrategist';
export { runAudienceArchitect } from './agents/audienceArchitect';
export { runCreativeDirector } from './agents/creativeDirector';
export { runBudgetAllocator } from './agents/budgetAllocator';
export type {
  MarketingPipelineInput,
  MarketingPipelineState,
  CampaignStrategyOutput,
  AudienceArchitectOutput,
  CreativeDirectorOutput,
  BudgetAllocatorOutput,
  AssembledProposal,
} from './types';

const TIMEOUT_BUDGET = 290_000; // 290s (10s safety margin from 300s Vercel limit)

async function runAgent<T>(
  name: string,
  fn: () => Promise<T>,
  state: MarketingPipelineState,
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
    console.error(`Marketing Agent "${name}" failed:`, error.message);
    if (required) {
      throw new Error(`Required marketing agent "${name}" failed: ${error.message}`);
    }
    return null;
  }
}

function remainingTime(startTime: number): number {
  return TIMEOUT_BUDGET - (Date.now() - startTime);
}

/**
 * Run the full marketing pipeline:
 *   M1 (Campaign Strategist) → [parallel: M2 + M3 + M4] → Assemble Proposal
 */
export async function runMarketingPipeline(
  input: MarketingPipelineInput
): Promise<MarketingPipelineState> {
  const startTime = Date.now();

  const state: MarketingPipelineState = {
    input,
    errors: [],
    timings: {},
  };

  // ===== STEP 1: Campaign Strategist (required) =====
  console.log('[Marketing Pipeline] Step 1: Running Campaign Strategist...');

  const strategyOutput = await runAgent<CampaignStrategyOutput>(
    'campaignStrategist',
    () => runCampaignStrategist(input),
    state,
    true // required
  );

  if (!strategyOutput) {
    throw new Error('Campaign Strategist failed — marketing pipeline cannot continue');
  }
  state.strategyOutput = strategyOutput;

  // ===== STEP 2: Parallel agents (Audience + Creative + Budget) =====
  if (remainingTime(startTime) < 15_000) {
    throw new Error('Timeout: not enough time for parallel marketing agents');
  }

  console.log('[Marketing Pipeline] Step 2: Running Audience + Creative + Budget in parallel...');

  const [audienceOutput, creativeOutput, budgetOutput] = await Promise.all([
    runAgent<AudienceArchitectOutput>(
      'audienceArchitect',
      () => runAudienceArchitect(input, strategyOutput),
      state,
      true // required
    ),
    runAgent<CreativeDirectorOutput>(
      'creativeDirector',
      () => runCreativeDirector(input, strategyOutput),
      state,
      true // required
    ),
    runAgent<BudgetAllocatorOutput>(
      'budgetAllocator',
      () => runBudgetAllocator(input, strategyOutput),
      state,
      true // required
    ),
  ]);

  if (!audienceOutput || !creativeOutput || !budgetOutput) {
    throw new Error('One or more required parallel agents failed — pipeline cannot continue');
  }

  state.audienceOutput = audienceOutput;
  state.creativeOutput = creativeOutput;
  state.budgetOutput = budgetOutput;

  // ===== STEP 3: Assemble Proposal =====
  console.log('[Marketing Pipeline] Step 3: Assembling proposal...');

  const assembledProposal: AssembledProposal = {
    strategy: strategyOutput,
    audienceTargeting: audienceOutput,
    creatives: creativeOutput,
    budgetPlan: budgetOutput,
    expectedOutcomes: buildExpectedOutcomes(strategyOutput, budgetOutput),
    rationale: buildRationale(strategyOutput, audienceOutput, creativeOutput, budgetOutput),
  };

  state.assembledProposal = assembledProposal;
  state.timings.total = Date.now() - startTime;

  console.log(`[Marketing Pipeline] Complete in ${state.timings.total}ms`);
  return state;
}

/**
 * Build expected outcomes from strategy + budget outputs
 */
function buildExpectedOutcomes(
  strategy: CampaignStrategyOutput,
  budget: BudgetAllocatorOutput
): AssembledProposal['expectedOutcomes'] {
  const outcomes: AssembledProposal['expectedOutcomes'] = [];

  // Add reach/impression outcome
  const totalReach = budget.budgetPlan.platforms.reduce(
    (sum, p) => sum + (p.estimatedReach || 0), 0
  );
  if (totalReach > 0) {
    outcomes.push({
      metric: 'Tahmini Erisim',
      target: `${(totalReach / 1000).toFixed(0)}K+ kisi`,
      timeline: strategy.timeline.phase1.duration,
      confidence: 'medium',
    });
  }

  // Add click outcome
  const totalClicks = budget.budgetPlan.platforms.reduce(
    (sum, p) => sum + (p.estimatedClicks || 0), 0
  );
  if (totalClicks > 0) {
    outcomes.push({
      metric: 'Tahmini Tiklanma',
      target: `${totalClicks.toLocaleString()} tiklama/ay`,
      timeline: '30 gun',
      confidence: 'medium',
    });
  }

  // Add ROAS outcome from moderate scenario
  if (budget.scenarioAnalysis.moderate.expectedResults) {
    outcomes.push({
      metric: 'Beklenen Performans (Orta Senaryo)',
      target: budget.scenarioAnalysis.moderate.expectedResults,
      timeline: `${strategy.timeline.phase2.duration} sonunda`,
      confidence: 'medium',
    });
  }

  // Add platform-specific outcomes
  strategy.platformStrategies.forEach(ps => {
    outcomes.push({
      metric: `${ps.platform.toUpperCase()} Etkisi`,
      target: ps.estimatedImpact,
      timeline: strategy.timeline.phase1.duration,
      confidence: ps.priority === 'primary' ? 'high' : 'medium',
    });
  });

  return outcomes;
}

/**
 * Build human-readable rationale summarizing all agent outputs
 */
function buildRationale(
  strategy: CampaignStrategyOutput,
  audience: AudienceArchitectOutput,
  creative: CreativeDirectorOutput,
  budget: BudgetAllocatorOutput
): string {
  const platformCount = strategy.platformStrategies.length;
  const primaryPlatforms = strategy.platformStrategies
    .filter(ps => ps.priority === 'primary')
    .map(ps => ps.platform);

  return [
    strategy.overallApproach,
    `${platformCount} platformda (oncelik: ${primaryPlatforms.join(', ')}) kampanya yurutulecek.`,
    `Birincil hedef kitle: ${audience.primaryAudience.description} (tahmini ${audience.primaryAudience.estimatedSize}).`,
    `Yaratici strateji: ${creative.creativeStrategy}`,
    `Butce dagilimi mantigi: ${budget.allocationRationale}`,
    budget.warnings.length > 0 ? `Uyarilar: ${budget.warnings.join('; ')}` : '',
  ].filter(Boolean).join(' ');
}
