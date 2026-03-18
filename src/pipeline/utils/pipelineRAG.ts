import type { BrandMaturityLevel } from '../types';
import { BLOG_PRINCIPLES } from '../data/blogKnowledgeBase';
import { generateJSON } from '../geminiClient';

export interface ArticleMatch {
  slug: string;
  title: string;
  excerpt: string;
  relevanceScore: number;  // 0-1
  relevanceReason: string;
}

export interface RAGResult {
  articles: ArticleMatch[];
  patternSummary: string;  // 3-4 sentence summary
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,;.!?()[\]{}"'\/\\-]+/)
    .filter((t) => t.length > 2);
}

function scoreArticle(
  queryTerms: string[],
  _slug: string,
  title: string,
  tags: string[],
  excerpt: string,
  coreContent: string,
): number {
  const titleTokens = tokenize(title);
  const tagTokens = tags.flatMap(tokenize);
  const excerptTokens = tokenize(excerpt);
  const coreTokens = tokenize(coreContent.slice(0, 200));

  let score = 0;

  for (const term of queryTerms) {
    // Tag match: highest weight
    if (tagTokens.includes(term)) score += 3;
    // Title match: high weight
    if (titleTokens.includes(term)) score += 2;
    // Excerpt match: medium weight
    if (excerptTokens.includes(term)) score += 1.5;
    // Core content match: lower weight
    if (coreTokens.includes(term)) score += 1;
  }

  // Normalize by total possible score
  const maxScore = queryTerms.length * (3 + 2 + 1.5 + 1);
  return maxScore > 0 ? Math.min(1, score / maxScore) : 0;
}

export async function queryBlogForStrategy(
  sector: string,
  overallProfile: string,
  brandMaturity: BrandMaturityLevel | undefined,
  topK?: number,
): Promise<RAGResult> {
  const k = topK ?? 7;

  // Build query terms
  const rawTerms = [
    sector,
    overallProfile,
    brandMaturity ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .split(/[\s,;.!?]+/)
    .filter((t) => t.length > 2);

  // Deduplicate
  const queryTerms = [...new Set(rawTerms)];

  // Score all articles
  const scored = BLOG_PRINCIPLES.map((article) => {
    const score = scoreArticle(
      queryTerms,
      article.slug,  // _slug — not used in scoring but kept for signature clarity
      article.title,
      article.tags,
      article.excerpt,
      article.coreContent,
    );
    return { article, score };
  });

  // Sort descending, take top K
  scored.sort((a, b) => b.score - a.score);
  const topArticles = scored.slice(0, k);

  const articles: ArticleMatch[] = topArticles.map(({ article, score }) => ({
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt || article.coreContent.slice(0, 120),
    relevanceScore: parseFloat(score.toFixed(3)),
    relevanceReason: `Sektör ve profil sorgusuyla eşleşme skoru: ${(score * 100).toFixed(0)}%`,
  }));

  // Generate pattern summary using Flash
  const articlesForPrompt = articles
    .map((a, i) => `${i + 1}. "${a.title}" — ${a.excerpt}`)
    .join('\n');

  const prompt = `Bir marka stratejisti olarak, aşağıdaki blog makalelerinden yola çıkarak kısa bir strateji özeti yaz.

**Bağlam:** ${sector} sektörü, ${overallProfile.slice(0, 200)}, olgunluk: ${brandMaturity ?? 'bilinmiyor'}

**İlgili Makaleler:**
${articlesForPrompt}

Bu profildeki markalarda gözlemlenen stratejik örüntüleri ve uygulanabilir dersleri 3-4 cümleyle özetle.
Doğrudan Türkçe yaz. Madde işareti kullanma, akıcı paragraf yaz.

JSON formatında:
{
  "patternSummary": "<3-4 cümlelik özet>"
}`;

  let patternSummary = '';
  try {
    const result = await generateJSON<{ patternSummary: string }>('flash', prompt, 'pipelineRAG', {
      temperature: 0.4,
      maxOutputTokens: 512,
    });
    patternSummary = result.patternSummary || '';
  } catch (err) {
    console.warn('[PipelineRAG] Pattern summary generation failed, using fallback:', err);
    patternSummary = `${sector} sektöründe bu profildeki markalar için ${articles.length} ilgili makale bulundu. Stratejik farklılaşma ve özgün konumlandırma ön plana çıkmaktadır.`;
  }

  return { articles, patternSummary };
}
