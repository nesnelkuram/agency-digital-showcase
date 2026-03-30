// Evidence Chain System — Epistemology layer for pipeline outputs

export type EvidenceType = 'research' | 'framework' | 'client_data' | 'ai_inference';
export type ConfidenceLevel = 'verified' | 'grounded' | 'inferred' | 'speculative';

/** DataOrigin tracks WHERE data actually came from — drives honest confidence scoring */
export type DataOrigin =
  | 'deep_research'          // DR completed with real web sources
  | 'grounding_search'       // Gemini grounding, limited coverage
  | 'ai_inference'           // Model guess, no backing data
  | 'wizard_input'           // User self-reported (subjective)
  | 'website_scrape'         // Actual website content analyzed
  | 'multi_model_validated'; // Multiple providers confirmed

const ORIGIN_BASE_CONFIDENCE: Record<DataOrigin, number> = {
  deep_research: 70,
  grounding_search: 45,
  ai_inference: 25,
  wizard_input: 35,
  website_scrape: 60,
  multi_model_validated: 75,
};

/** Calculate honest confidence from data origin + optional consensus score.
 *  Hard cap at 85 — no AI output should claim higher certainty. */
export function calculateConfidence(origin: DataOrigin, consensusScore?: number): number {
  let score = ORIGIN_BASE_CONFIDENCE[origin];
  if (consensusScore !== undefined && consensusScore > 0) {
    score = Math.round((score + consensusScore) / 2);
  }
  return Math.min(score, 85);
}

/** Human-readable Turkish label for DataOrigin */
export function getOriginLabel(origin: DataOrigin): string {
  switch (origin) {
    case 'deep_research': return 'Pazar araştırması ile desteklenmektedir';
    case 'grounding_search': return 'Web arama verileriyle desteklenmektedir';
    case 'ai_inference': return 'AI tahminine dayanmaktadır';
    case 'wizard_input': return 'Müşteri beyanına dayanmaktadır';
    case 'website_scrape': return 'Web sitesi analizi ile desteklenmektedir';
    case 'multi_model_validated': return 'Birden fazla AI modeli tarafından doğrulanmıştır';
  }
}

export interface EvidenceChain {
  claim: string;
  evidenceType: EvidenceType;
  sources: string[];
  confidence: number; // 0-100
  assumptions: string[];
  falsifiableBy: string;
  dataOrigin?: DataOrigin; // v2: tracks actual data source for honest scoring
  originLabel?: string;    // v2: Turkish human-readable origin description
}

export interface FrameworkScore {
  framework: string;
  score: number;
  maxScore: number;
  rationale: string;
  subscores?: Record<string, number>;
}

export interface SectionEvidence {
  sectionName: string;
  confidenceLevel: ConfidenceLevel;
  overallConfidence: number;
  evidenceChains: EvidenceChain[];
  frameworkScores: FrameworkScore[];
}

export interface EvidenceSummaryV2 {
  overallConfidence: number;
  sectionBreakdown: SectionEvidence[];
  totalClaims: number;
  verifiedClaims: number;
  groundedClaims: number;
  inferredClaims: number;
  speculativeClaims: number;
  strongestSection: string;
  weakestSection: string;
  keyAssumptions: string[];
}

/** Derive confidence level label from numeric score */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 80) return 'verified';
  if (score >= 55) return 'grounded';
  if (score >= 30) return 'inferred';
  return 'speculative';
}

/** Build a single evidence chain entry.
 *  If dataOrigin is provided, confidence is auto-calculated (honesty mode). */
export function createEvidence(
  claim: string,
  type: EvidenceType,
  sources: string[],
  confidence: number,
  assumptions: string[] = [],
  falsifiableBy: string = '',
  dataOrigin?: DataOrigin,
  consensusScore?: number,
): EvidenceChain {
  const finalConfidence = dataOrigin
    ? calculateConfidence(dataOrigin, consensusScore)
    : Math.max(0, Math.min(100, confidence));
  return {
    claim,
    evidenceType: type,
    sources,
    confidence: finalConfidence,
    assumptions,
    falsifiableBy,
    dataOrigin,
    originLabel: dataOrigin ? getOriginLabel(dataOrigin) : undefined,
  };
}

/** Aggregate multiple evidence chains into a section summary */
export function buildSectionEvidence(
  sectionName: string,
  chains: EvidenceChain[],
  frameworkScores: FrameworkScore[] = []
): SectionEvidence {
  const avgConfidence = chains.length > 0
    ? Math.round(chains.reduce((sum, c) => sum + c.confidence, 0) / chains.length)
    : 0;

  return {
    sectionName,
    confidenceLevel: getConfidenceLevel(avgConfidence),
    overallConfidence: avgConfidence,
    evidenceChains: chains,
    frameworkScores,
  };
}

/** Build the full evidence summary from all sections */
export function buildEvidenceSummary(sections: SectionEvidence[]): EvidenceSummaryV2 {
  const allChains = sections.flatMap(s => s.evidenceChains);
  const totalClaims = allChains.length;

  const countByLevel = (level: ConfidenceLevel) =>
    allChains.filter(c => getConfidenceLevel(c.confidence) === level).length;

  const overallConfidence = totalClaims > 0
    ? Math.round(allChains.reduce((sum, c) => sum + c.confidence, 0) / totalClaims)
    : 0;

  const sorted = [...sections].sort((a, b) => b.overallConfidence - a.overallConfidence);

  const allAssumptions = [...new Set(allChains.flatMap(c => c.assumptions))];

  return {
    overallConfidence,
    sectionBreakdown: sections,
    totalClaims,
    verifiedClaims: countByLevel('verified'),
    groundedClaims: countByLevel('grounded'),
    inferredClaims: countByLevel('inferred'),
    speculativeClaims: countByLevel('speculative'),
    strongestSection: sorted[0]?.sectionName || '',
    weakestSection: sorted[sorted.length - 1]?.sectionName || '',
    keyAssumptions: allAssumptions.slice(0, 10),
  };
}
