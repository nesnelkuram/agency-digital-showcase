// Persona AI Agent — Type definitions

/** Original article from tum_makaleler.json */
export interface RawArticle {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content_text: string;
  date: string;
  tags: string[];
  categories: string[];
  author: string;
  url: string;
  featured_image: string;
}

/** AI-enriched metadata extracted per article */
export interface ArticleEnrichment {
  thesis: string;
  thinkingPattern: string;
  rhetoricalDevice: string;
  metaphors: string[];
  applicableSituations: string[];
  emotionalTone: string;
  keyQuotes: string[];
  principleExtracted: string;
  relatedConcepts: string[];
}

/** Enriched article with original data + AI enrichment + embedding */
export interface EnrichedArticle {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content_text: string;
  date: string;
  tags: string[];
  categories: string[];
  url: string;
  isFullContent: boolean;
  enrichment: ArticleEnrichment;
  embedding: number[]; // 768-dim vector from text-embedding-004
}

/** Author DNA profile — cross-analysis of all articles */
export interface PersonaProfile {
  authorName: string;
  thinkingPatterns: Array<{ pattern: string; frequency: number }>;
  coreBeliefs: string[];
  communicationStyle: {
    tone: string;
    vocabulary: string;
    sentenceStructure: string;
    favoriteTransitions: string[];
  };
  antiPatterns: string[];
  rhetoricalDevices: Array<{ device: string; frequency: number }>;
  favoriteMetaphorCategories: string[];
  topicExpertise: string[];
  worldview: string;
  signaturePhrases: string[];
}

/** Chat session stored in Firestore */
export interface PersonaSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  leadId?: string;
  businessContext?: {
    businessName: string;
    sector: string;
    description?: string;
  };
  messages: PersonaMessage[];
  articleRefsUsed: number[];
}

/** Single message in a persona chat */
export interface PersonaMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  articlesReferenced?: Array<{
    id: number;
    title: string;
    relevanceScore: number;
  }>;
}

/** Search result from embedding similarity */
export interface ArticleSearchResult {
  article: EnrichedArticle;
  score: number;
  tagMatchBonus: number;
  recencyBonus: number;
  finalScore: number;
}
