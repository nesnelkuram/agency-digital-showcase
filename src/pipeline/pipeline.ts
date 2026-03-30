import type { PipelineInput, PipelineState, StrategistOutput, ChallengerOutput, BlogAdvisorOutput, SynthesizedAnalysis } from './types';
import { generateIntibaRoadmap } from './agents/roadmapGenerator';
import { runDataNormalizer } from './agents/dataNormalizer';
import { runSectorResearch } from './agents/sectorResearch';
import { runBrandStrategist } from './agents/brandStrategist';
import { runBrandChallenger } from './agents/brandChallenger';
import { runBlogStrategyAdvisor } from './agents/blogStrategyAdvisor';
import { runStrategySynthesizer } from './agents/strategySynthesizer';
import { buildEvidenceSummary, buildSectionEvidence, createEvidence } from './evidence';
import type { EvidenceChain, SectionEvidence, FrameworkScore } from './evidence';
import { buildCalibrationSignals, calibrateSection } from './calibration';
import { runPositioningConsensus } from './consensus';

// Re-exports for async pipeline endpoints
export { runDataNormalizer } from './agents/dataNormalizer';
export { runSectorResearch, extractResearchJSON } from './agents/sectorResearch';
export type { SectorResearchOptions } from './agents/sectorResearch';
export { runBrandStrategist } from './agents/brandStrategist';
export type { RevisionConfig } from './agents/brandStrategist';
export { runBrandChallenger } from './agents/brandChallenger';
export { runBlogStrategyAdvisor } from './agents/blogStrategyAdvisor';
export { runStrategySynthesizer } from './agents/strategySynthesizer';
export { runDigitalPresenceAnalyzer } from './agents/digitalPresenceAnalyzer';
export { runConsumerTest } from './agents/consumerTest';
export { runPositioningConsensus } from './consensus';
export type { ConsensusResult } from './consensus';
// Absorbed agents (no longer exported as standalone):
// - consultantIntroWriter → absorbed into strategySynthesizer
// - brandValueMaximizer → absorbed into strategySynthesizer
// - deliverableEnricher → absorbed into strategySynthesizer
// - frictionAnalyzer → distilled into strategySynthesizer prompt
// - brandStrategistRevision → revision mode in brandStrategist
// - competitorDiscovery → research provides competitor data
// - strategyHealthComparator → only for strategy refresh mode
export { fetchAndParseWebsite } from './utils/websiteFetcher';
export { scrapeInstagramPublic } from './utils/instagramScraper';
export type { InstagramPublicData } from './utils/instagramScraper';
export { fetchGooglePlacesData } from './utils/googlePlacesScraper';
export type { GooglePlacesData } from './utils/googlePlacesScraper';
export { gatherCompetitorIntelligence } from './utils/competitorIntelligence';
export type { CompetitorComparison, CompetitorProfile, ComparisonRow } from './utils/competitorIntelligence';
// Ensure sector enrichment modules are registered
import './sectorEnrichment';
export { startDeepResearch, pollDeepResearch } from './geminiClient';
export { buildDeepResearchPrompt } from './agents/sectorResearch';
export type { PipelineInput, NormalizedData, ResearchFindings, StrategistOutput, ChallengerOutput, BlogAdvisorOutput, SynthesizedAnalysis, DigitalPresenceAnalysis, CompetitorDiscoveryOutput, ConsumerTestOutput, ValueMaximizerOutput, DistilledAgentView, FrictionAnalysis, StrategicInsight } from './types';
export type { EvidenceChain, FrameworkScore, SectionEvidence, EvidenceSummaryV2, ConfidenceLevel, DataOrigin } from './evidence';
export { buildEvidenceSummary, buildSectionEvidence, createEvidence, getConfidenceLevel, calculateConfidence, getOriginLabel } from './evidence';
export { getSectorFrameworkConfig } from './sectorFrameworks';
export type { SectorFrameworkConfig } from './sectorFrameworks';
export { generateIntibaRoadmap } from './agents/roadmapGenerator';
export type { IntibaRoadmap, RoadmapPhase, RoadmapService } from './types';

const TIMEOUT_BUDGET = 290_000; // 290s (10s safety margin from 300s Vercel limit)

async function runAgent<T>(
  name: string,
  fn: () => Promise<T>,
  state: PipelineState,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    state.timings[name] = Date.now() - start;
    return result;
  } catch (error: any) {
    state.timings[name] = Date.now() - start;
    const msg = error.message || 'Unknown error';
    state.errors.push({ agent: name, error: msg, timestamp: Date.now() });
    console.error(`Agent "${name}" failed — pipeline halted:`, msg);
    throw new Error(`Agent "${name}" failed: ${msg}`);
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
  const [normalizedData, researchFindings] = await Promise.all([
    runAgent('dataNormalizer', () => runDataNormalizer(input), state),
    isLite
      ? Promise.resolve(null)
      : runAgent('sectorResearch', () => runSectorResearch(input), state),
  ]);

  state.normalizedData = normalizedData;
  state.researchFindings = researchFindings ?? undefined;

  // Step 2: Agent 3 (Strategist)
  if (remainingTime(startTime) < 10_000) {
    throw new Error('Timeout: not enough time for strategist agent');
  }

  const strategistOutput = await runAgent<StrategistOutput>(
    'brandStrategist',
    () => runBrandStrategist(normalizedData, researchFindings, input.businessContext),
    state,
  );
  state.strategistOutput = strategistOutput;

  // Step 2b: Multi-Model Consensus on positioning + archetype
  if (!isLite) {
    const consensusResult = await runAgent(
      'multiModelConsensus',
      () => runPositioningConsensus(
        normalizedData.businessName,
        normalizedData.sector,
        strategistOutput.positioningStatement,
        strategistOutput.archetype,
        `Profil: ${normalizedData.overallProfile}. Farklilik: ${strategistOutput.differentiator}. Rekabet avantaji: ${strategistOutput.competitiveAdvantage}.${researchFindings ? ` Pazar: ${researchFindings.marketData.marketSize}. Rakipler: ${researchFindings.competitors.map(c => c.name).join(', ')}.` : ''}`,
      ),
      state,
    );
    if (consensusResult) {
      state.consensusResults = [{
        question: `Konumlandirma ve arketip dogrulamasi`,
        consensusReached: consensusResult.consensusReached,
        consensusScore: consensusResult.consensusScore,
      }];
    }
  }

  // Step 3: Agent 4a (Challenger) + Agent 4b (Blog Advisor) — run in PARALLEL
  let challengerOutput: ChallengerOutput | null = null;
  let blogAdvisorOutput: BlogAdvisorOutput | null = null;

  if (!isLite) {
    if (remainingTime(startTime) < 22_000) {
      throw new Error('Timeout: not enough time for challenger and blog advisor agents');
    }
    const [challResult, blogResult] = await Promise.all([
      runAgent<ChallengerOutput>(
        'brandChallenger',
        () => runBrandChallenger(normalizedData, researchFindings, strategistOutput, input.businessContext),
        state,
      ),
      runAgent<BlogAdvisorOutput>(
        'blogStrategyAdvisor',
        () => runBlogStrategyAdvisor(normalizedData, researchFindings, strategistOutput),
        state,
      ),
    ]);
    challengerOutput = challResult;
    blogAdvisorOutput = blogResult;
  }
  state.challengerOutput = challengerOutput ?? undefined;
  state.blogAdvisorOutput = blogAdvisorOutput ?? undefined;

  // Step 4: Agent 5 (Synthesizer)
  if (remainingTime(startTime) < 8_000) {
    throw new Error('Timeout: not enough time for synthesizer agent');
  }
  const synthesizedAnalysis = await runAgent<SynthesizedAnalysis>(
    'strategySynthesizer',
    () => runStrategySynthesizer(normalizedData, researchFindings, strategistOutput, challengerOutput, blogAdvisorOutput, input.businessContext),
    state,
  );
  state.synthesizedAnalysis = synthesizedAnalysis;

  // Note: deliverableEnricher + brandValueMaximizer are now internal to strategySynthesizer
  // (they run as parallel Flash enrichment passes within the synthesizer function)

  // Step 5: Build Evidence Summary & Calibrate
  try {
    const evidenceResult = buildPipelineEvidence(state);
    state.evidenceSummary = evidenceResult.summary;
    state.frameworkScores = evidenceResult.frameworkScores;

    // Attach V2 evidence to synthesized analysis if present
    if (state.synthesizedAnalysis) {
      state.synthesizedAnalysis.evidenceSummaryV2 = evidenceResult.summary;
      state.synthesizedAnalysis.frameworkScores = evidenceResult.frameworkScores;
    }
  } catch (err: any) {
    console.error('Evidence building failed:', err.message);
    state.errors.push({
      agent: 'evidenceBuilder',
      error: err.message || 'Evidence building failed',
      timestamp: Date.now(),
    });
  }

  // Step 6: Intiba Roadmap
  if (!isLite) {
    if (remainingTime(startTime) < 5_000) {
      throw new Error('Timeout: not enough time for roadmap generator agent');
    }
    const roadmap = await runAgent(
      'roadmapGenerator',
      () => generateIntibaRoadmap(state.strategistOutput!, state.synthesizedAnalysis),
      state,
    );
    state.intibaRoadmap = roadmap;
  }

  state.timings.total = Date.now() - startTime;
  return state;
}

/** Build evidence summary from all pipeline outputs */
export function buildPipelineEvidence(state: PipelineState): {
  summary: import('./evidence').EvidenceSummaryV2;
  frameworkScores: FrameworkScore[];
} {
  const sections: SectionEvidence[] = [];
  const allFrameworkScores: FrameworkScore[] = [];
  const hasResearch = !!(state.researchFindings && state.researchFindings.sourcesUsed > 0);
  const dataQuality = state.normalizedData?.dataQualityScore || 50;

  const signals = buildCalibrationSignals(
    hasResearch,
    !!(state.strategistOutput?._frameworkScores?.length),
    !!(state.consensusResults?.length),
    dataQuality,
    false, // challengePoints are constructive, not conflicting evidence
  );

  // Data gap summary — missing fields reduce overall confidence
  const dataGaps = state.normalizedData?.dataGaps || [];
  const missingGaps = dataGaps.filter(g => g.status === 'missing').length;
  const totalGaps = dataGaps.length;
  const dataCompleteness = totalGaps > 0 ? Math.round(((totalGaps - missingGaps) / totalGaps) * 100) : 50;
  // Each missing gap reduces confidence by ~3 points (capped at -20)
  const gapPenalty = Math.min(missingGaps * 3, 20);

  // Determine research origin based on how data was acquired
  const researchOrigin: import('./evidence').DataOrigin = hasResearch
    ? ((state.researchFindings?.sourcesUsed ?? 0) >= 5 ? 'deep_research' : 'grounding_search')
    : 'ai_inference';
  const consensusScore = state.consensusResults?.[0]?.consensusScore;

  // Section: Research
  if (state.researchFindings) {
    const researchChains: EvidenceChain[] = [];
    const rf = state.researchFindings;

    researchChains.push(createEvidence(
      `Pazar verisi: ${rf.marketData?.marketSize || 'Bilgi yok'}`,
      'research',
      rf.sourceUrls?.map(s => s.url) || [],
      0, // auto-calculated from dataOrigin
      [],
      'Pazar büyüklüğü kaynağı doğrulanarak',
      researchOrigin,
    ));

    if (rf.competitors.length > 0) {
      researchChains.push(createEvidence(
        `${rf.competitors.length} rakip tespit edildi`,
        'research',
        rf.competitors.map(c => c.website).filter(Boolean),
        0,
        [],
        '',
        researchOrigin,
      ));
    }

    const researchSection = buildSectionEvidence('Sektör Araştırması', researchChains);
    sections.push(calibrateSection(researchSection, signals));
  }

  // Section: Brand Strategy
  if (state.strategistOutput) {
    const strategyChains: EvidenceChain[] = [];
    const so = state.strategistOutput;

    const archetypeOrigin: import('./evidence').DataOrigin = so.aakerPersonality ? 'deep_research' : 'ai_inference';
    strategyChains.push(createEvidence(
      `Arketip: ${so.archetype}`,
      so.aakerPersonality ? 'framework' : 'ai_inference',
      so.aakerPersonality ? ['Aaker Brand Personality 5 Boyut'] : [],
      0,
      so.aakerPersonality ? [] : ['Arketip seçimi framework puanlaması olmadan yapılmış'],
      'Farklı bir arketip ile aynı veriler analiz edilirse',
      archetypeOrigin,
      consensusScore,
    ));

    const positioningOrigin: import('./evidence').DataOrigin = consensusScore && consensusScore >= 60
      ? 'multi_model_validated'
      : hasResearch ? 'grounding_search' : 'ai_inference';
    strategyChains.push(createEvidence(
      `Konumlandırma: ${so.positioningStatement.slice(0, 100)}`,
      hasResearch ? 'research' : 'ai_inference',
      [],
      0,
      hasResearch ? [] : ['Araştırma verisi olmadan konumlandırma yapılmış'],
      'Rakip swap testi ile',
      positioningOrigin,
      consensusScore,
    ));

    // Collect framework scores from strategist
    if (so._frameworkScores) {
      allFrameworkScores.push(...so._frameworkScores);
    }

    const strategySection = buildSectionEvidence('Marka Stratejisi', strategyChains, so._frameworkScores);
    sections.push(calibrateSection(strategySection, signals));
  }

  // Section: Challenger Analysis
  if (state.challengerOutput) {
    const challengerChains: EvidenceChain[] = [];
    const co = state.challengerOutput;

    if (co.onlynessTest) {
      challengerChains.push(createEvidence(
        `Onlyness testi: ${co.onlynessTest.verdict}`,
        'framework',
        ['Neumeier Onlyness Test'],
        0, [], 'Rakip ismi değiştirilerek test tekrarlanabilir',
        hasResearch ? 'grounding_search' : 'ai_inference',
      ));
    }

    if (co.distinctivenessScore !== undefined) {
      challengerChains.push(createEvidence(
        `Benzersizlik skoru: ${co.distinctivenessScore}/100`,
        'framework',
        ['Neumeier Distinctiveness Assessment'],
        0, [], '',
        hasResearch ? 'grounding_search' : 'ai_inference',
      ));
    }

    co.challengePoints.forEach(point => {
      challengerChains.push(createEvidence(
        point.slice(0, 150),
        hasResearch ? 'research' : 'ai_inference',
        [], 0, [], '',
        hasResearch ? 'grounding_search' : 'ai_inference',
      ));
    });

    const challengerSection = buildSectionEvidence('Eleştirel Analiz', challengerChains);
    sections.push(calibrateSection(challengerSection, signals));
  }

  // Section: Consumer Test
  if (state.consumerTest) {
    const consumerChains: EvidenceChain[] = [];
    const ct = state.consumerTest;

    consumerChains.push(createEvidence(
      `Genel uygulanabilirlik: ${ct.overallViabilityScore}/100`,
      'ai_inference',
      [], 0,
      ['Sentetik persona testi — gerçek tüketici verisi değil'],
      'Gerçek müşteri görüşmeleri ile doğrulanabilir',
      'ai_inference',
    ));

    if (ct.jtbdScenarios && ct.jtbdScenarios.length > 0) {
      consumerChains.push(createEvidence(
        `JTBD Ortalama Uyum: ${Math.round(ct.jtbdScenarios.reduce((sum, s) => sum + s.strategyJobFitScore, 0) / ct.jtbdScenarios.length)}/100`,
        'framework',
        ['JTBD Switch Interview Framework'],
        0,
        ['Sentetik JTBD senaryoları — gerçek müşteri röportajı değil'],
        'Gerçek switch interview\'lar ile',
        'ai_inference',
      ));
    }

    const consumerSection = buildSectionEvidence('Tüketici Testi', consumerChains);
    sections.push(calibrateSection(consumerSection, signals));
  }

  // Section: Synthesis
  if (state.synthesizedAnalysis) {
    const synthChains: EvidenceChain[] = [];
    const sa = state.synthesizedAnalysis;

    synthChains.push(createEvidence(
      'Nihai sentez raporu',
      hasResearch ? 'framework' : 'ai_inference',
      sa.evidenceSummary.keySourceUrls?.map(s => s.url) || [],
      0,
      state.challengerOutput ? [] : ['Eleştirel analiz olmadan sentez yapılmış'],
      '',
      researchOrigin,
      consensusScore,
    ));

    if (sa.messagingArchitecture) {
      synthChains.push(createEvidence(
        'Mesajlaşma mimarisi', 'framework', [], 0,
        ['AI üretimi — gerçek pazar testi yapılmamış'], '',
        'ai_inference',
      ));
    }

    if (sa.customerJourney && sa.customerJourney.length > 0) {
      synthChains.push(createEvidence(
        'Müşteri yolculuğu haritası', 'ai_inference', [], 0,
        ['Sentetik yolculuk — gerçek kullanıcı gözlemi değil'], '',
        'ai_inference',
      ));
    }

    if (sa.kpiFramework) {
      synthChains.push(createEvidence(
        'KPI çerçevesi', 'framework', [], 0,
        ['Sektör kıyaslaması olmadan üretilmiş'], '',
        'ai_inference',
      ));
    }

    const synthSection = buildSectionEvidence('Nihai Sentez', synthChains);
    sections.push(calibrateSection(synthSection, signals));
  }

  const summary = buildEvidenceSummary(sections);

  // Apply data gap penalty to overall confidence
  if (gapPenalty > 0) {
    summary.overallConfidence = Math.max(10, summary.overallConfidence - gapPenalty);
    summary.keyAssumptions.push(`${missingGaps} veri alanı eksik — genel güvenilirlik ${gapPenalty} puan düşürüldü (veri tamlığı: %${dataCompleteness})`);
  }

  return {
    summary,
    frameworkScores: allFrameworkScores,
  };
}
