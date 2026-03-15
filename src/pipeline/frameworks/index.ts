// Framework Library — Central export for all framework modules

export { CBBE_PROMPT_SNIPPET, scoreCBBE } from './keller-cbbe';
export type { CBBEAssessment } from './keller-cbbe';

export { AAKER_PROMPT_SNIPPET, scoreAakerPersonality, PERSONALITY_TO_ARCHETYPE } from './aaker-identity';
export type { AakerPersonalityScores, AakerIdentityAssessment } from './aaker-identity';

export { BYRON_SHARP_PROMPT_SNIPPET, SECTOR_CEPS, scoreMentalAvailability } from './byron-sharp-ceps';
export type { CEPAssessment } from './byron-sharp-ceps';

export { FOGG_PROMPT_SNIPPET, assessAction, scoreFogg } from './fogg-behavior';
export type { FoggAssessment, ActionMAP } from './fogg-behavior';

export { CIALDINI_PROMPT_SNIPPET } from './cialdini-persuasion';
export type { CialdiniAssessment } from './cialdini-persuasion';

export { HOOK_PROMPT_SNIPPET } from './hook-model';
export type { HookAssessment } from './hook-model';

export { BLUE_OCEAN_PROMPT_SNIPPET, scoreBlueOcean } from './blue-ocean';
export type { ERRCMatrix, ValueCurvePoint } from './blue-ocean';

export { KANO_PROMPT_SNIPPET } from './kano-model';
export type { KanoClassification } from './kano-model';
