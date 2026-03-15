// Sector Enrichment Module Interface
// Each sector can define its own research steps, grounding queries,
// extraction schema, and downstream context formatting.

export interface CulturalTension {
  /** Toplumsal beklenti */
  expectation: string;
  /** Yaşanan gerçeklik */
  reality: string;
  /** Marka fırsatı */
  opportunity: string;
}

export interface SectorEnrichmentModule {
  /** Sector identifier matching brandLead.ts Sector type */
  sector: string;

  /** Hardcoded cultural tensions for this sector — zero hallucination */
  culturalTensions: CulturalTension[];

  /** Extra Deep Research prompt steps appended after ADIM 5 */
  deepResearchSteps: string;

  /** Customize ADIM 1-5 terminology (product→room type, customer→guest, etc.) */
  terminologyOverrides: {
    productLabel: string;         // "URUN ve HIZMETLERI" → "ODA TIPLERI ve HIZMETLERI"
    priceDetail: string;          // extra price context
    positioningExamples: string;  // "ucuz/orta/premium" → "butik/luks/is oteli/resort"
    competitorAnalysisLabel: string; // "URUN BAZLI RAKIP ANALIZI" → "RAKIP OTEL ANALIZI"
    competitorSearchExample: string;
    competitorMetrics: string;
    competitorStrengthsContext: string;
    marketDataFocus: string;
    audienceLabel: string;        // "urunleri gercekte kimler satin aliyor?" → "kimler konakliyor?"
    audienceDetails: string[];    // sector-specific audience questions
    customerTerm: string;         // "musteriler" → "misafirler"
    websiteAnalysisFocus: string;
    researchType: string;         // "URUN BAZLI" → "OTELCILIK BAZLI"
  };

  /** Extra grounding fallback queries (beyond the standard 3) */
  extraGroundingQueries: (businessName: string, dateRule: string) => Array<{
    prompt: string;
    label: string;
  }>;

  /** Sector-specific grounding prompt overrides for competitor/market/trend */
  groundingPromptOverrides: {
    competitor: (businessName: string, dateRule: string) => string;
    market: (businessName: string, dateRule: string) => string;
    trend: (businessName: string, dateRule: string) => string;
  };

  /** JSON schema fragment for extraction prompt (appended to base schema) */
  extractionSchemaFragment: string;

  /** Extra extraction rules (appended to base rules) */
  extractionRules: string;

  /** Format sector-specific data from ResearchFindings into prompt context for StrategySynthesizer */
  formatForSynthesizer: (sectorData: any) => string;

  /** Priority frameworks for this sector from sectorFrameworks.ts */
  frameworkReferences?: string[];

  /** Douglas/Holt cultural branding perspective */
  culturalBrandingLens?: string;

  /** Field name in ResearchFindings where sector data is stored */
  dataFieldName: string;
}

/** Registry of all sector enrichment modules */
const registry = new Map<string, SectorEnrichmentModule>();

export function registerSectorEnrichment(module: SectorEnrichmentModule): void {
  registry.set(module.sector, module);
}

export function getSectorEnrichment(sector: string): SectorEnrichmentModule | null {
  return registry.get(sector) || null;
}

export function hasSectorEnrichment(sector: string): boolean {
  return registry.has(sector);
}
