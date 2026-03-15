// Knowledge Corpus — Search and retrieval for brand strategy knowledge base

import { BRAND_STRATEGY_CORPUS } from './brandStrategyCorpus';
import type { KnowledgeEntry } from './brandStrategyCorpus';

export type { KnowledgeEntry };
export { BRAND_STRATEGY_CORPUS };

/** Search the knowledge corpus by keywords with relevance scoring */
export function searchKnowledgeCorpus(
  keywords: string[],
  options?: {
    category?: KnowledgeEntry['category'];
    sector?: string;
    maxResults?: number;
  }
): KnowledgeEntry[] {
  const max = options?.maxResults ?? 5;
  const normalizedKeywords = keywords
    .map(k => k.toLowerCase().replace(/[^a-zöüçğışİ0-9\s-]/gi, '').trim())
    .filter(k => k.length > 2);

  if (normalizedKeywords.length === 0) return [];

  const scored = BRAND_STRATEGY_CORPUS
    .filter(entry => {
      if (options?.category && entry.category !== options.category) return false;
      if (options?.sector && entry.sector.length > 0 && !entry.sector.includes(options.sector)) return false;
      return true;
    })
    .map(entry => {
      let score = 0;
      const searchText = `${entry.title} ${entry.tags.join(' ')} ${entry.frameworks.join(' ')} ${entry.keyPrinciples.join(' ')}`.toLowerCase();
      const contentText = entry.content.toLowerCase();

      for (const keyword of normalizedKeywords) {
        // Title + tags + frameworks match (high weight)
        const tagMatches = (searchText.match(new RegExp(keyword, 'g')) || []).length;
        score += tagMatches * 3;

        // Content match (lower weight)
        const contentMatches = (contentText.match(new RegExp(keyword, 'g')) || []).length;
        score += Math.min(contentMatches, 5); // Cap at 5 to avoid long-content bias
      }

      return { entry, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);

  return scored.map(item => item.entry);
}

/** Get knowledge entries by specific frameworks mentioned */
export function getEntriesByFramework(frameworkName: string): KnowledgeEntry[] {
  const lower = frameworkName.toLowerCase();
  return BRAND_STRATEGY_CORPUS.filter(entry =>
    entry.frameworks.some(f => f.toLowerCase().includes(lower))
  );
}

/** Get all entries for a specific category */
export function getEntriesByCategory(category: KnowledgeEntry['category']): KnowledgeEntry[] {
  return BRAND_STRATEGY_CORPUS.filter(entry => entry.category === category);
}

/** Build a context string for injection into agent prompts */
export function buildKnowledgeContext(entries: KnowledgeEntry[], maxChars: number = 3000): string {
  if (entries.length === 0) return '';

  let context = '## Bilgi Bankası Referansları\n';
  let charCount = context.length;

  for (const entry of entries) {
    const section = `\n### ${entry.title} (${entry.author})\n` +
      `Frameworks: ${entry.frameworks.join(', ')}\n` +
      `Temel Prensipler:\n${entry.keyPrinciples.map(p => `- ${p}`).join('\n')}\n` +
      `İçerik Özeti: ${entry.content.slice(0, 400)}...\n`;

    if (charCount + section.length > maxChars) break;
    context += section;
    charCount += section.length;
  }

  return context;
}
