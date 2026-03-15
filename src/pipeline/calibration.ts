// Confidence Calibration Layer
// Adjusts raw confidence scores based on evidence quality signals

import type { EvidenceChain, SectionEvidence } from './evidence';
import { getConfidenceLevel } from './evidence';

interface CalibrationSignals {
  hasResearchData: boolean;
  hasFrameworkScore: boolean;
  hasBlogEvidence: boolean;
  hasMultiModelConsensus: boolean;
  hasConflictingEvidence: boolean;
  hasClientData: boolean;
  dataQualityScore: number; // 0-100 from normalizer
}

const CALIBRATION_WEIGHTS = {
  researchData: 30,
  frameworkScore: 20,
  blogEvidence: 15,
  multiModelConsensus: 20,
  clientData: 10,
  conflictingEvidence: -15,
};

const CONFIDENCE_FLOOR = 10;
const CONFIDENCE_CEILING = 95;

/** Calibrate a single evidence chain's confidence based on supporting signals */
export function calibrateConfidence(
  chain: EvidenceChain,
  signals: CalibrationSignals
): number {
  let baseConfidence = chain.confidence;

  // Start from raw confidence, apply adjustments
  let adjustment = 0;

  if (signals.hasResearchData && chain.evidenceType === 'research') {
    adjustment += CALIBRATION_WEIGHTS.researchData;
  }
  if (signals.hasFrameworkScore) {
    adjustment += CALIBRATION_WEIGHTS.frameworkScore;
  }
  if (signals.hasBlogEvidence) {
    adjustment += CALIBRATION_WEIGHTS.blogEvidence;
  }
  if (signals.hasMultiModelConsensus) {
    adjustment += CALIBRATION_WEIGHTS.multiModelConsensus;
  }
  if (signals.hasClientData && chain.evidenceType === 'client_data') {
    adjustment += CALIBRATION_WEIGHTS.clientData;
  }
  if (signals.hasConflictingEvidence) {
    adjustment += CALIBRATION_WEIGHTS.conflictingEvidence;
  }

  // Data quality modifier: scale adjustment by data quality (0-100 → 0.5-1.0)
  const qualityMultiplier = 0.5 + (signals.dataQualityScore / 200);
  adjustment = Math.round(adjustment * qualityMultiplier);

  const calibrated = Math.max(CONFIDENCE_FLOOR, Math.min(CONFIDENCE_CEILING, baseConfidence + adjustment));
  return calibrated;
}

/** Calibrate all evidence chains in a section */
export function calibrateSection(
  section: SectionEvidence,
  signals: CalibrationSignals
): SectionEvidence {
  const calibratedChains = section.evidenceChains.map(chain => ({
    ...chain,
    confidence: calibrateConfidence(chain, signals),
  }));

  const avgConfidence = calibratedChains.length > 0
    ? Math.round(calibratedChains.reduce((sum, c) => sum + c.confidence, 0) / calibratedChains.length)
    : 0;

  return {
    ...section,
    evidenceChains: calibratedChains,
    overallConfidence: avgConfidence,
    confidenceLevel: getConfidenceLevel(avgConfidence),
  };
}

/** Build calibration signals from pipeline state */
export function buildCalibrationSignals(
  hasResearch: boolean,
  hasFrameworkScores: boolean,
  hasMultiModel: boolean,
  dataQualityScore: number,
  hasConflicts: boolean = false,
): CalibrationSignals {
  return {
    hasResearchData: hasResearch,
    hasFrameworkScore: hasFrameworkScores,
    hasBlogEvidence: false, // Will be set when RAG is implemented
    hasMultiModelConsensus: hasMultiModel,
    hasConflictingEvidence: hasConflicts,
    hasClientData: true, // Always have wizard data
    dataQualityScore,
  };
}
