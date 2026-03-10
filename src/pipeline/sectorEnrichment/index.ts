// Auto-register all sector enrichment modules
import './hospitality';
import './gastronomi';
import './retail';
import './corporate';
import './tech';
import './health';
import './education';
import './fmcg';
import './showroom';

// Re-export registry functions
export { getSectorEnrichment, hasSectorEnrichment, registerSectorEnrichment } from './types';
export type { SectorEnrichmentModule, CulturalTension } from './types';
