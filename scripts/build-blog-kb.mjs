/**
 * Build-time script: Condenses 432 blog articles into a ~25KB TypeScript knowledge base.
 * No LLM needed — pure Node.js text processing.
 *
 * Input:  public/makaleler/tum_makaleler.json (2MB)
 * Output: src/pipeline/data/blogKnowledgeBase.ts (~25KB)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const INPUT = join(ROOT, 'public/makaleler/tum_makaleler.json');
const OUTPUT = join(ROOT, 'src/pipeline/data/blogKnowledgeBase.ts');

// --- Main ---
function main() {
  if (!existsSync(INPUT)) {
    console.warn('build-blog-kb: tum_makaleler.json not found, generating empty knowledge base');
    writeEmptyKB();
    return;
  }

  const raw = JSON.parse(readFileSync(INPUT, 'utf-8'));
  const articles = raw.articles || [];
  console.log(`build-blog-kb: Processing ${articles.length} articles...`);

  // Separate full vs truncated
  const fullArticles = [];
  const truncatedArticles = [];

  for (const a of articles) {
    const text = a.content_text || '';
    const isTruncated = text.includes('This post is for') || text.length < 200;
    if (isTruncated) {
      truncatedArticles.push(a);
    } else {
      fullArticles.push(a);
    }
  }

  console.log(`build-blog-kb: ${fullArticles.length} full, ${truncatedArticles.length} truncated`);

  // --- Tier 1: Principles (full articles) ---
  const principles = fullArticles.map(a => ({
    slug: a.slug || '',
    title: cleanTitle(a.title || ''),
    tags: normalizeTags(a.tags || []),
    excerpt: (a.excerpt || '').trim(),
    coreContent: extractCoreContent(a.content_text || '', 800),
  }));

  // --- Tier 2: Topic Index (all articles) ---
  const tagMap = {};
  for (const a of articles) {
    const tags = normalizeTags(a.tags || []);
    for (const tag of tags) {
      if (!tagMap[tag]) tagMap[tag] = [];
      tagMap[tag].push(cleanTitle(a.title || ''));
    }
  }

  const topicIndex = Object.entries(tagMap)
    .filter(([tag]) => tag.length > 2) // skip noise
    .sort((a, b) => b[1].length - a[1].length)
    .map(([tag, titles]) => ({
      tag,
      count: titles.length,
      topArticles: titles.slice(0, 5),
    }));

  // --- Tier 3: Quotes (from full articles) ---
  const quotes = [];
  for (const a of fullArticles) {
    const text = a.content_text || '';
    // Turkish/English quoted text
    const quoteMatches = text.match(/[""\u201C\u201D]([^""\u201C\u201D]{20,150})[""\u201C\u201D]/g) || [];
    for (const q of quoteMatches) {
      const clean = q.replace(/^[""\u201C\u201D]|[""\u201C\u201D]$/g, '').trim();
      if (clean.length >= 20 && clean.length <= 150 && !clean.includes('Subscribe') && !clean.includes('Sign in')) {
        quotes.push(clean);
      }
    }
  }

  // Deduplicate and limit to 40 best quotes (longest = most substantial)
  const uniqueQuotes = [...new Set(quotes)]
    .sort((a, b) => b.length - a.length)
    .slice(0, 40);

  // --- Author metadata ---
  const mainThemes = topicIndex
    .filter(t => t.count >= 5)
    .map(t => t.tag);

  // --- Generate TypeScript ---
  const ts = generateTypeScript(principles, topicIndex, uniqueQuotes, mainThemes, articles.length);

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, ts, 'utf-8');

  const sizeKB = (Buffer.byteLength(ts, 'utf-8') / 1024).toFixed(1);
  console.log(`build-blog-kb: Generated ${OUTPUT} (${sizeKB}KB)`);
  console.log(`  - ${principles.length} full article summaries`);
  console.log(`  - ${topicIndex.length} topic groups`);
  console.log(`  - ${uniqueQuotes.length} quotes`);
  console.log(`  - ${mainThemes.length} main themes`);
}

// --- Helpers ---

function cleanTitle(title) {
  // Remove emoji prefixes
  return title.replace(/^[\u{1F4CC}\u{1F396}\u{FE0F}\u{1F3C6}\u{2B50}\u{1F525}\u{1F4A1}\u{1F680}\u{270F}\u{FE0F}\u{1F4E2}]+\s*/gu, '').trim();
}

function normalizeTags(tags) {
  return tags
    .map(t => t.split(' - ')[0].trim()) // "Gayrinizami Markalama - Engin Tezcan..." → "Gayrinizami Markalama"
    .map(t => t.replace(/[\u{1F4CC}\u{1F396}\u{FE0F}]/gu, '').trim()) // Remove emoji from tags
    .filter(t => t.length > 2 && !t.includes('Engin Tezcan') && t !== 'burada.' && t !== 'buraya');
}

function extractCoreContent(text, maxLen) {
  // Remove paywall text
  const cut = text.indexOf('This post is for');
  const clean = cut > 0 ? text.slice(0, cut).trim() : text.trim();
  // Trim to maxLen at word boundary
  if (clean.length <= maxLen) return clean;
  const trimmed = clean.slice(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.7 ? trimmed.slice(0, lastSpace) : trimmed) + '...';
}

function writeEmptyKB() {
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `// Auto-generated — empty (source file not found)
export interface BlogArticleSummary {
  slug: string;
  title: string;
  tags: string[];
  excerpt: string;
  coreContent: string;
}
export const BLOG_AUTHOR_META = { name: 'Stratejik Danismanin', site: 'engintezcan.com', totalArticles: 0, mainThemes: [] as string[] };
export const BLOG_PRINCIPLES: BlogArticleSummary[] = [];
export const BLOG_TOPIC_INDEX: { tag: string; count: number; topArticles: string[] }[] = [];
export const BLOG_QUOTES: string[] = [];
`, 'utf-8');
  console.log('build-blog-kb: Wrote empty knowledge base');
}

function escapeTS(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
}

function generateTypeScript(principles, topicIndex, quotes, mainThemes, totalArticles) {
  let ts = `// Auto-generated by scripts/build-blog-kb.mjs — DO NOT EDIT
// Source: public/makaleler/tum_makaleler.json (${totalArticles} articles)

export interface BlogArticleSummary {
  slug: string;
  title: string;
  tags: string[];
  excerpt: string;
  coreContent: string;
}

export const BLOG_AUTHOR_META = {
  name: 'Stratejik Danismanin',
  site: 'engintezcan.com',
  totalArticles: ${totalArticles},
  mainThemes: [${mainThemes.map(t => `'${escapeTS(t)}'`).join(', ')}],
};

export const BLOG_PRINCIPLES: BlogArticleSummary[] = [\n`;

  for (const p of principles) {
    ts += `  { slug: '${escapeTS(p.slug)}', title: '${escapeTS(p.title)}', tags: [${p.tags.map(t => `'${escapeTS(t)}'`).join(', ')}], excerpt: '${escapeTS(p.excerpt)}', coreContent: '${escapeTS(p.coreContent)}' },\n`;
  }

  ts += `];\n\nexport const BLOG_TOPIC_INDEX: { tag: string; count: number; topArticles: string[] }[] = [\n`;

  for (const t of topicIndex) {
    ts += `  { tag: '${escapeTS(t.tag)}', count: ${t.count}, topArticles: [${t.topArticles.map(a => `'${escapeTS(a)}'`).join(', ')}] },\n`;
  }

  ts += `];\n\nexport const BLOG_QUOTES: string[] = [\n`;

  for (const q of quotes) {
    ts += `  '${escapeTS(q)}',\n`;
  }

  ts += `];\n`;

  return ts;
}

main();
