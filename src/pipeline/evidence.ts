// Evidence Chain System — Epistemology layer for pipeline outputs

export type EvidenceType = 'research' | 'framework' | 'client_data' | 'ai_inference';
export type ConfidenceLevel = 'verified' | 'grounded' | 'inferred' | 'speculative';

export interface EvidenceChain {
  claim: string;
  evidenceType: EvidenceType;
  sources: string[];
  confidence: number; // 0-100
  assumptions: string[];
  falsifiableBy: string;
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

/** Build a single evidence chain entry */
export function createEvidence(
  claim: string,
  type: EvidenceType,
  sources: string[],
  confidence: number,
  assumptions: string[] = [],
  falsifiableBy: string = ''
): EvidenceChain {
  return {
    claim,
    evidenceType: type,
    sources,
    confidence: Math.max(0, Math.min(100, confidence)),
    assumptions,
    falsifiableBy,
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
