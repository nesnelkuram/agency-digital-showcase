/**
 * Context Assembler for Persona AI Agent.
 *
 * Orchestrates the three-layer prompt architecture:
 *   1. Identity & Worldview (static from personaProfile.json)
 *   2. Relevant Articles (dynamic from RAG search)
 *   3. Conversation History (sliding window)
 */

import type { PersonaProfile, PersonaMessage, ArticleSearchResult } from './types';
import { assembleFullPrompt } from './personaPrompts';

export interface AssembledContext {
  system: string;
  user: string;
  articlesUsed: Array<{ id: number; title: string; relevanceScore: number }>;
}

/**
 * Assemble the complete prompt context for a persona chat turn.
 */
export function assembleContext(
  profile: PersonaProfile,
  articleResults: ArticleSearchResult[],
  history: PersonaMessage[],
  userMessage: string
): AssembledContext {
  const { system, user } = assembleFullPrompt(profile, articleResults, history, userMessage);

  const articlesUsed = articleResults.slice(0, 10).map(r => ({
    id: r.article.id,
    title: r.article.title,
    relevanceScore: Math.round(r.finalScore * 100) / 100,
  }));

  return { system, user, articlesUsed };
}

/**
 * Extract search-friendly keywords from user message.
 * Used for tag matching bonus in re-ranking.
 */
export function extractQueryTerms(message: string): string[] {
  const stopWords = new Set([
    'bir', 'bu', 'su', 'o', 've', 'ile', 'de', 'da', 'mi', 'mu', 'ne',
    'nasil', 'neden', 'icin', 'gibi', 'en', 'cok', 'var', 'yok', 'olan',
    'benim', 'senin', 'onun', 'bizim', 'sizin', 'ben', 'sen', 'biz',
    'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall',
    'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'it', 'this', 'that', 'what', 'how', 'why',
  ]);

  return message
    .toLowerCase()
    .replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}
