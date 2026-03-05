/**
 * Agent Memory — Persistent facts/preferences for marketing agent sessions
 *
 * Memories are extracted from conversations and injected into the system prompt
 * to give the agent long-term context about client preferences, brand info, etc.
 */

export type MemoryCategory =
  | 'brand'           // Brand name, voice, guidelines
  | 'audience'        // Target audience insights
  | 'preference'      // User preferences (reporting style, language, etc.)
  | 'campaign'        // Campaign learnings, what worked/didn't
  | 'budget'          // Budget constraints, spending patterns
  | 'competitor'      // Competitor intelligence
  | 'platform'        // Platform-specific notes (Meta, Google, TikTok)
  | 'general';        // Other useful facts

export interface AgentMemory {
  id?: string;
  tenantId: string;
  category: MemoryCategory;
  fact: string;              // The actual memory content
  confidence: number;        // 0-1, how confident the extraction was
  source: 'extracted' | 'manual';  // AI-extracted or manually added
  sourceSessionId?: string;  // Which session it was extracted from
  createdAt: number;
  updatedAt: number;
  isActive: boolean;         // Soft delete
}

/** Facts the AI extracts from a conversation turn */
export interface ExtractedFact {
  category: MemoryCategory;
  fact: string;
  confidence: number;
}

/** Category labels for UI */
export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  brand: 'Marka',
  audience: 'Hedef Kitle',
  preference: 'Tercih',
  campaign: 'Kampanya',
  budget: 'Bütçe',
  competitor: 'Rakip',
  platform: 'Platform',
  general: 'Genel',
};

/** Category colors for UI badges */
export const MEMORY_CATEGORY_COLORS: Record<MemoryCategory, string> = {
  brand: 'bg-purple-100 text-purple-800',
  audience: 'bg-blue-100 text-blue-800',
  preference: 'bg-green-100 text-green-800',
  campaign: 'bg-orange-100 text-orange-800',
  budget: 'bg-red-100 text-red-800',
  competitor: 'bg-yellow-100 text-yellow-800',
  platform: 'bg-cyan-100 text-cyan-800',
  general: 'bg-gray-100 text-gray-800',
};
