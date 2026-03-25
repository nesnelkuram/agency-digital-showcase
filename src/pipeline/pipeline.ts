import type { PipelineInput, PipelineState, StrategistOutput, ChallengerOutput, BlogAdvisorOutput, SynthesizedAnalysis } from './types';
import { generateIntibaRoadmap } from './agents/roadmapGenerator';
import { runDataNormalizer } from './agents/dataNormalizer';
import { runSectorResearch } from './agents/sectorResearch';
import { runBrandStrategist } from './agents/brandStrategist';
import { runBrandChallenger } from './agents/brandChallenger';
import { runBlogStrategyAdvisor } from './agents/blogStrategyAdvisor';
import { runStrategySynthesizer } from './agents/strategySynthesizer';
import { runDeliverableEnricher } from './agents/deliverableEnricher';
import { buildEvidenceSummary, buildSectionEvidence, createEvidence } from './evidence';
import type { EvidenceChain, SectionEvidence, FrameworkScore } from './evidence';
import { buildCalibrationSignals, calibrateSection } from './calibration';
import { runPositioningConsensus } from './consensus';

// Re-exports for async pipeline endpoints
export { runDataNormalizer } from './agents/dataNormalizer';
export { runSectorResearch, extractResearchJSON } from './agents/sectorResearch';
export type { SectorResearchOptions } from './agents/sectorResearch';
export { runBrandStrategist } from './agents/brandStrategist';
export { runBrandChallenger } from './agents/brandChallenger';
export { runBlogStrategyAdvisor } from './agents/blogStrategyAdvisor';
export { runStrategySynthesizer } from './agents/strategySynthesizer';
export { runConsultantIntroWriter } from './agents/consultantIntroWriter';
export { runBrandValueMaximizer } from './agents/brandValueMaximizer';
export { runDigitalPresenceAnalyzer } from './agents/digitalPresenceAnalyzer';
export { runCompetitorDiscovery } from './agents/competitorDiscovery';
export { runBrandStrategistRevision } from './agents/brandStrategistRevision';
export { runConsumerTest } from './agents/consumerTest';
export { runDeliverableEnricher } from './agents/deliverableEnricher';
export { runStrategyHealthComparator } from './agents/strategyHealthComparator';
export { runFrictionAnalyzer } from './agents/frictionAnalyzer';
export { runPositioningConsensus } from './consensus';
export type { ConsensusResult } from './consensus';
export { fetchAndParseWebsite } from './utils/websiteFetcher';
// Ensure sector enrichment modules are registered
import './sectorEnrichment';
export { startDeepResearch, pollDeepResearch } from './geminiClient';
export { buildDeepResearchPrompt } from './agents/sectorResearch';
export type { PipelineInput, NormalizedData, ResearchFindings, StrategistOutput, ChallengerOutput, BlogAdvisorOutput, SynthesizedAnalysis, DigitalPresenceAnalysis, CompetitorDiscoveryOutput, ConsumerTestOutput, ValueMaximizerOutput, DistilledAgentView, FrictionAnalysis, StrategicInsight } from './types';
export type { EvidenceChain, FrameworkScore, SectionEvidence, EvidenceSummaryV2, ConfidenceLevel } from './evidence';
export { buildEvidenceSummary, buildSectionEvidence, createEvidence, getConfidenceLevel } from './evidence';
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

  // Step 4b: Agent 5b (Deliverable Enricher) — runs after synthesizer, uses Flash model
  if (remainingTime(startTime) < 5_000) {
    throw new Error('Timeout: not enough time for deliverable enricher agent');
  }
  const enricherOutput = await runAgent(
    'deliverableEnricher',
    () => runDeliverableEnricher(
      state.synthesizedAnalysis!,
      normalizedData.businessName,
      normalizedData.sector,
      normalizedData.brandMaturity?.level,
    ),
    state,
  );
  if (enricherOutput.messagingArchitecture) {
    state.synthesizedAnalysis!.messagingArchitecture = enricherOutput.messagingArchitecture;
  }
  if (enricherOutput.customerJourney?.length > 0) {
    state.synthesizedAnalysis!.customerJourney = enricherOutput.customerJourney;
  }
  if (enricherOutput.socialMediaTemplates?.length > 0) {
    state.synthesizedAnalysis!.socialMediaTemplates = enricherOutput.socialMediaTemplates;
  }

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

  // Section: Research
  if (state.researchFindings) {
    const researchChains: EvidenceChain[] = [];
    const rf = state.researchFindings;

    researchChains.push(createEvidence(
      `Pazar verisi: ${rf.marketData?.marketSize || 'Bilgi yok'}`,
      'research',
      rf.sourceUrls?.map(s => s.url) || [],
      hasResearch ? 80 : 20,
      [],
      'Pazar büyüklüğü kaynağı doğrulanarak',
    ));

    if (rf.competitors.length > 0) {
      researchChains.push(createEvidence(
        `${rf.competitors.length} rakip tespit edildi`,
        'research',
        rf.competitors.map(c => c.website).filter(Boolean),
        rf.competitors.length >= 3 ? 80 : 50,
      ));
    }

    const researchSection = buildSectionEvidence('Sektör Araştırması', researchChains);
    sections.push(calibrateSection(researchSection, signals));
  }

  // Section: Brand Strategy
  if (state.strategistOutput) {
    const strategyChains: EvidenceChain[] = [];
    const so = state.strategistOutput;

    strategyChains.push(createEvidence(
      `Arketip: ${so.archetype}`,
      so.aakerPersonality ? 'framework' : 'ai_inference',
      so.aakerPersonality ? ['Aaker Brand Personality 5 Boyut'] : [],
      so.aakerPersonality ? 70 : 40,
      so.aakerPersonality ? [] : ['Arketip seçimi framework puanlaması olmadan yapılmış'],
      'Farklı bir arketip ile aynı veriler analiz edilirse',
    ));

    strategyChains.push(createEvidence(
      `Konumlandırma: ${so.positioningStatement.slice(0, 100)}`,
      hasResearch ? 'research' : 'ai_inference',
      [],
      hasResearch ? 65 : 35,
      hasResearch ? [] : ['Araştırma verisi olmadan konumlandırma yapılmış'],
      'Rakip swap testi ile',
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
        co.onlynessTest.verdict === 'strong' ? 85 : co.onlynessTest.verdict === 'weak' ? 50 : 25,
        [],
        'Rakip ismi değiştirilerek test tekrarlanabilir',
      ));
    }

    if (co.distinctivenessScore !== undefined) {
      challengerChains.push(createEvidence(
        `Benzersizlik skoru: ${co.distinctivenessScore}/100`,
        'framework',
        ['Neumeier Distinctiveness Assessment'],
        co.distinctivenessScore >= 60 ? 70 : 40,
      ));
    }

    co.challengePoints.forEach(point => {
      challengerChains.push(createEvidence(
        point.slice(0, 150),
        hasResearch ? 'research' : 'ai_inference',
        [],
        hasResearch ? 60 : 35,
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
      [],
      Math.min(50, ct.overallViabilityScore * 0.5),
      ['Sentetik persona testi — gerçek tüketici verisi değil'],
      'Gerçek müşteri görüşmeleri ile doğrulanabilir',
    ));

    if (ct.jtbdScenarios && ct.jtbdScenarios.length > 0) {
      const avgFit = ct.jtbdScenarios.reduce((sum, s) => sum + s.strategyJobFitScore, 0) / ct.jtbdScenarios.length;
      consumerChains.push(createEvidence(
        `JTBD Ortalama Uyum: ${Math.round(avgFit)}/100`,
        'framework',
        ['JTBD Switch Interview Framework'],
        Math.min(60, avgFit * 0.6),
        ['Sentetik JTBD senaryoları — gerçek müşteri röportajı değil'],
        'Gerçek switch interview\'lar ile',
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
      hasResearch ? 60 : 40,
      state.challengerOutput ? [] : ['Eleştirel analiz olmadan sentez yapılmış'],
    ));

    if (sa.messagingArchitecture) {
      synthChains.push(createEvidence(
        'Mesajlaşma mimarisi',
        'framework',
        [],
        45,
        ['AI üretimi — gerçek pazar testi yapılmamış'],
      ));
    }

    if (sa.customerJourney && sa.customerJourney.length > 0) {
      synthChains.push(createEvidence(
        'Müşteri yolculuğu haritası',
        'ai_inference',
        [],
        40,
        ['Sentetik yolculuk — gerçek kullanıcı gözlemi değil'],
      ));
    }

    if (sa.kpiFramework) {
      synthChains.push(createEvidence(
        'KPI çerçevesi',
        'framework',
        [],
        40,
        ['Sektör kıyaslaması olmadan üretilmiş'],
      ));
    }

    const synthSection = buildSectionEvidence('Nihai Sentez', synthChains);
    sections.push(calibrateSection(synthSection, signals));
  }

  return {
    summary: buildEvidenceSummary(sections),
    frameworkScores: allFrameworkScores,
  };
}
