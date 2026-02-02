/**
 * Embedding-based article search for Persona AI Agent.
 * Loads enriched articles into memory and performs cosine similarity search.
 * 432 articles × 768 floats ≈ 1.3MB — fits comfortably in memory.
 */

import type { EnrichedArticle, ArticleSearchResult } from './types';

let _articles: EnrichedArticle[] | null = null;

/**
 * Load enriched articles from the bundled JSON.
 * Called once on cold start (~50ms).
 */
export function loadArticles(data: EnrichedArticle[]): void {
  _articles = data;
}

export function getArticles(): EnrichedArticle[] {
  if (!_articles) throw new Error('Articles not loaded. Call loadArticles() first.');
  return _articles;
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Calculate tag match bonus.
 * Returns a score [0, 1] based on how many query terms match article tags.
 */
function tagMatchScore(article: EnrichedArticle, queryTerms: string[]): number {
  if (!queryTerms.length || !article.tags.length) return 0;
  const articleTags = article.tags.map(t => t.toLowerCase());
  const matchCount = queryTerms.filter(qt =>
    articleTags.some(at => at.includes(qt) || qt.includes(at))
  ).length;
  return matchCount / Math.max(queryTerms.length, 1);
}

/**
 * Calculate recency bonus.
 * More recent articles get a slight boost [0, 1].
 */
function recencyScore(dateStr: string): number {
  const articleDate = new Date(dateStr).getTime();
  if (isNaN(articleDate)) return 0;
  const now = Date.now();
  const ageMs = now - articleDate;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  // Articles less than 180 days old get full bonus, decays over 2 years
  if (ageDays < 180) return 1;
  if (ageDays > 730) return 0;
  return 1 - (ageDays - 180) / 550;
}

/**
 * Search articles by embedding similarity with re-ranking.
 * Final score = cosine (70%) + tag match (20%) + recency (10%)
 *
 * @param queryEmbedding - 768-dim vector from text-embedding-004
 * @param topK - Number of results to return (default 10)
 * @param queryTerms - Extracted keywords from query for tag matching
 */
export function searchArticles(
  queryEmbedding: number[],
  topK: number = 10,
  queryTerms: string[] = []
): ArticleSearchResult[] {
  const articles = getArticles();

  const results: ArticleSearchResult[] = articles.map(article => {
    const score = cosineSimilarity(queryEmbedding, article.embedding);
    const tagBonus = tagMatchScore(article, queryTerms);
    const recencyBonus = recencyScore(article.date);
    const finalScore = score * 0.7 + tagBonus * 0.2 + recencyBonus * 0.1;

    return {
      article,
      score,
      tagMatchBonus: tagBonus,
      recencyBonus,
      finalScore,
    };
  });

  return results
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topK);
}
