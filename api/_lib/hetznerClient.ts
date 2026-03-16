/**
 * Hetzner Pipeline Worker Client
 *
 * Provides semantic search via Qdrant vector DB running on Hetzner.
 * Falls back gracefully if Hetzner is unavailable.
 */

const HETZNER_URL = process.env.HETZNER_PIPELINE_URL || '';
const PIPELINE_SECRET = process.env.PIPELINE_API_SECRET || '';

function isConfigured(): boolean {
  return !!(HETZNER_URL && PIPELINE_SECRET);
}

async function hetznerFetch(path: string, body?: any, timeoutMs = 10_000): Promise<any> {
  if (!isConfigured()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${HETZNER_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-pipeline-secret': PIPELINE_SECRET,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error(`[hetzner] ${path} failed: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (error: any) {
    clearTimeout(timer);
    console.error(`[hetzner] ${path} error: ${error.message}`);
    return null;
  }
}

/**
 * Semantic search against Qdrant vector DB on Hetzner.
 * Returns top N matching blog articles for the given query.
 * Falls back to null if Hetzner is unavailable.
 */
export async function semanticSearch(
  collection: string,
  query: string,
  limit = 5,
): Promise<Array<{ score: number; payload: any }> | null> {
  const result = await hetznerFetch('/api/vector/search', { collection, query, limit });
  return result?.results || null;
}

/**
 * Search blog articles semantically.
 * Convenience wrapper for the most common use case.
 */
export async function searchBlogArticles(
  query: string,
  limit = 5,
): Promise<Array<{ title: string; slug: string; content: string; score: number; tags: string[] }> | null> {
  const results = await semanticSearch('blog_articles', query, limit);
  if (!results) return null;

  return results.map((r) => ({
    title: r.payload?.title || '',
    slug: r.payload?.slug || '',
    content: r.payload?.content_preview || r.payload?.text || '',
    score: r.score,
    tags: r.payload?.tags || [],
  }));
}

/**
 * Check if Hetzner worker is healthy
 */
export async function checkHealth(): Promise<boolean> {
  const result = await hetznerFetch('/health', undefined, 5000);
  return result?.status === 'healthy';
}

export { isConfigured as isHetznerConfigured };
