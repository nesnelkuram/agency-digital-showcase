/**
 * build-persona-kb.ts
 *
 * Pre-processing pipeline for Persona AI Agent.
 * Reads 432 blog articles, enriches them via Gemini Flash,
 * generates embeddings, and produces:
 *   - src/persona/data/enrichedArticles.json
 *   - src/persona/data/personaProfile.json
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/build-persona-kb.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Types ──────────────────────────────────────────────────────────
interface RawArticle {
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

interface ArticleEnrichment {
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

interface EnrichedArticle {
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
  embedding: number[];
}

interface PersonaProfile {
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

// ── Load env files (try .env.vercel first, then .env.local) ────────
import dotenv from 'dotenv';
const projectRoot = path.resolve(__dirname, '..');
for (const envFile of ['.env.vercel', '.env.local']) {
  const envPath = path.join(projectRoot, envFile);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

// ── Config ─────────────────────────────────────────────────────────
const CONCURRENCY = 5;
const CHECKPOINT_INTERVAL = 50;
const EMBEDDING_BATCH_SIZE = 20;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ARTICLES_PATH = path.join(PROJECT_ROOT, 'public/makaleler/tum_makaleler.json');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'src/persona/data');
const ENRICHED_PATH = path.join(OUTPUT_DIR, 'enrichedArticles.json');
const PROFILE_PATH = path.join(OUTPUT_DIR, 'personaProfile.json');
const INTERIM_PATH = path.join(OUTPUT_DIR, '_interim_enrichments.json');

// ── Gemini Client ──────────────────────────────────────────────────
const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.log('GEMINI_API_KEY not found. Set it in .env.vercel or .env.local');
  process.exit(1);
}
console.log(`API key loaded: ${apiKey.slice(0, 5)}...${apiKey.slice(-4)} (${apiKey.length} chars)`);
const client = new GoogleGenAI({ apiKey });

// ── Helpers ────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === maxRetries) throw err;
      const waitMs = (2 ** i) * 1000 + Math.random() * 500;
      console.log(`  Retry ${i + 1}/${maxRetries} after ${Math.round(waitMs)}ms: ${err.message?.slice(0, 120)}`);
      await sleep(waitMs);
    }
  }
  throw new Error('Unreachable');
}

// ── Step 1: AI Enrichment ──────────────────────────────────────────
function buildEnrichmentPrompt(article: RawArticle): string {
  const isFullContent = article.content_text.length > 500;

  const articleContext = isFullContent
    ? `Baslik: ${article.title}\nEtiketler: ${article.tags.join(', ')}\nTam Icerik:\n${article.content_text}`
    : `Baslik: ${article.title}\nEtiketler: ${article.tags.join(', ')}\nOzet: ${article.excerpt}\n\n[NOT: Bu makalenin tam metni mevcut degil, sadece baslik, etiketler ve ozet bilgisi var. Mevcut bilgiden maksimum cikarim yap.]`;

  return `Sen bir icerik analiz uzmanisin. Asagidaki Turkce blog makalesini analiz et ve belirtilen JSON formatinda yapilandirilmis cikarim uret.

${articleContext}

Asagidaki JSON formatinda yanit ver (Turkce):
{
  "thesis": "Makalenin temel argumani (1-2 cumle)",
  "thinkingPattern": "Yazar probleme nasil yaklasıyor (ornegin: tezat ile acma, soruyla baslama, hikaye anlatma, veriyle destekleme)",
  "rhetoricalDevice": "Kullanilan ana retorik araç (hikaye, provokasyon, karsilastirma, soru, data, otorite referansi)",
  "metaphors": ["En fazla 3 anahtar metafor veya benzetme"],
  "applicableSituations": ["Bu makaledeki fikir hangi is durumlarinda uygulanabilir (en fazla 4)"],
  "emotionalTone": "Makalenin duygusal tonu (provokatif, analitik, ilham verici, uyarici, samimi, vs)",
  "keyQuotes": ["Akilda kalan en onemli cumleler (en fazla 3)"],
  "principleExtracted": "Bu makalenin altinda yatan temel kural veya prensip (1 cumle)",
  "relatedConcepts": ["Referans verilen pazarlama/is kavramlari"]
}

SADECE JSON don, baska bir sey yazma.`;
}

async function enrichArticle(article: RawArticle): Promise<ArticleEnrichment> {
  return retryWithBackoff(async () => {
    const result = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: buildEnrichmentPrompt(article),
      config: {
        temperature: 0.4,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const text = result.text ?? '';
    if (!text) throw new Error('Empty response');
    return JSON.parse(text) as ArticleEnrichment;
  });
}

async function runEnrichmentPhase(articles: RawArticle[]): Promise<Map<number, ArticleEnrichment>> {
  // Load interim results if available
  const enrichments = new Map<number, ArticleEnrichment>();
  if (fs.existsSync(INTERIM_PATH)) {
    const interim: Record<string, ArticleEnrichment> = JSON.parse(fs.readFileSync(INTERIM_PATH, 'utf-8'));
    for (const [id, enrichment] of Object.entries(interim)) {
      enrichments.set(Number(id), enrichment);
    }
    console.log(`  Loaded ${enrichments.size} interim enrichments from checkpoint`);
  }

  const remaining = articles.filter(a => !enrichments.has(a.id));
  console.log(`  ${remaining.length} articles to enrich (${enrichments.size} already done)`);

  let processed = 0;
  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (article) => {
        const enrichment = await enrichArticle(article);
        return { id: article.id, enrichment };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        enrichments.set(result.value.id, result.value.enrichment);
        processed++;
      } else {
        console.log(`  FAILED: ${result.reason?.message?.slice(0, 200)}`);
      }
    }

    // Save interim checkpoint
    if ((processed % CHECKPOINT_INTERVAL < CONCURRENCY) && processed > 0) {
      const interimObj: Record<string, ArticleEnrichment> = {};
      for (const [id, e] of enrichments) interimObj[String(id)] = e;
      fs.writeFileSync(INTERIM_PATH, JSON.stringify(interimObj));
      console.log(`  Checkpoint saved: ${enrichments.size}/${articles.length}`);
    }

    // Log progress
    const total = enrichments.size;
    console.log(`  Progress: ${total}/${articles.length} (${Math.round(total / articles.length * 100)}%)`);

    // Delay between batches to avoid rate limits
    if (i + CONCURRENCY < remaining.length) await sleep(1000);
  }

  // Clean up interim file
  if (fs.existsSync(INTERIM_PATH)) {
    fs.unlinkSync(INTERIM_PATH);
  }

  return enrichments;
}

// ── Step 2: Embedding Generation ───────────────────────────────────
function buildEmbeddingText(article: RawArticle, enrichment: ArticleEnrichment): string {
  const contentPreview = article.content_text.slice(0, 400);
  return `${article.title} | ${enrichment.thesis} | ${enrichment.principleExtracted} | ${enrichment.applicableSituations.join(', ')} | ${contentPreview}`;
}

async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  return retryWithBackoff(async () => {
    const result = await client.models.embedContent({
      model: 'text-embedding-004',
      contents: texts,
    });
    const embeddings = result.embeddings;
    if (!embeddings || embeddings.length !== texts.length) {
      throw new Error(`Expected ${texts.length} embeddings, got ${embeddings?.length ?? 0}`);
    }
    return embeddings.map(e => e.values ?? []);
  });
}

async function runEmbeddingPhase(
  articles: RawArticle[],
  enrichments: Map<number, ArticleEnrichment>
): Promise<Map<number, number[]>> {
  const embeddings = new Map<number, number[]>();
  const articlesWithEnrichments = articles.filter(a => enrichments.has(a.id));

  console.log(`  Generating embeddings for ${articlesWithEnrichments.length} articles...`);

  for (let i = 0; i < articlesWithEnrichments.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = articlesWithEnrichments.slice(i, i + EMBEDDING_BATCH_SIZE);
    const texts = batch.map(a => buildEmbeddingText(a, enrichments.get(a.id)!));
    const batchEmbeddings = await generateEmbeddingBatch(texts);

    for (let j = 0; j < batch.length; j++) {
      embeddings.set(batch[j].id, batchEmbeddings[j]);
    }

    console.log(`  Embeddings: ${embeddings.size}/${articlesWithEnrichments.length}`);
    if (i + EMBEDDING_BATCH_SIZE < articlesWithEnrichments.length) await sleep(100);
  }

  return embeddings;
}

// ── Step 3: Author DNA Profile ─────────────────────────────────────
async function buildPersonaProfile(
  articles: RawArticle[],
  enrichments: Map<number, ArticleEnrichment>
): Promise<PersonaProfile> {
  // Aggregate patterns for analysis
  const allPatterns: string[] = [];
  const allDevices: string[] = [];
  const allTones: string[] = [];
  const allMetaphors: string[] = [];
  const allConcepts: string[] = [];
  const allQuotes: string[] = [];
  const allTheses: string[] = [];
  const allPrinciples: string[] = [];

  for (const [, enrichment] of enrichments) {
    allPatterns.push(enrichment.thinkingPattern);
    allDevices.push(enrichment.rhetoricalDevice);
    allTones.push(enrichment.emotionalTone);
    allMetaphors.push(...enrichment.metaphors);
    allConcepts.push(...enrichment.relatedConcepts);
    allQuotes.push(...enrichment.keyQuotes);
    allTheses.push(enrichment.thesis);
    allPrinciples.push(enrichment.principleExtracted);
  }

  // Find author name from articles
  const authorName = articles[0]?.author || 'Bilinmeyen Yazar';

  // Sample data for the profile generation prompt
  const sampleTheses = allTheses.slice(0, 30).join('\n- ');
  const samplePrinciples = allPrinciples.slice(0, 30).join('\n- ');
  const sampleQuotes = allQuotes.slice(0, 20).join('\n- ');
  const patternFreq = countFrequency(allPatterns).slice(0, 10);
  const deviceFreq = countFrequency(allDevices).slice(0, 8);
  const toneFreq = countFrequency(allTones).slice(0, 8);

  const prompt = `Sen bir yazar analiz uzmanisin. Asagidaki verileri kullanarak bu yazarin "DNA profilini" olustur.
Bu yazar ${enrichments.size} blog makalesi yazmis bir Turkce pazarlama/marka stratejisti.

DUSUNCE KALIPLARI (en sik):
${patternFreq.map(p => `- ${p.item} (${p.count} kez)`).join('\n')}

RETORIK ARACLARI (en sik):
${deviceFreq.map(d => `- ${d.item} (${d.count} kez)`).join('\n')}

DUYGUSAL TONLAR (en sik):
${toneFreq.map(t => `- ${t.item} (${t.count} kez)`).join('\n')}

ORNEK TEZLER:
- ${sampleTheses}

ORNEK ILKELER:
- ${samplePrinciples}

ORNEK ALINTILAR:
- ${sampleQuotes}

Asagidaki JSON formatinda yanit ver (Turkce):
{
  "authorName": "${authorName}",
  "thinkingPatterns": [{"pattern": "...", "frequency": 0}],
  "coreBeliefs": ["En temel 8-12 inanc/prensip"],
  "communicationStyle": {
    "tone": "Genel iletisim tonu",
    "vocabulary": "Kelime secimi ozellikleri",
    "sentenceStructure": "Cumle yapisi tercihleri",
    "favoriteTransitions": ["Sik kullandigi gecis kelimeleri/kaliplari"]
  },
  "antiPatterns": ["Bu yazar ASLA yapmayacagi seyler (en az 5)"],
  "rhetoricalDevices": [{"device": "...", "frequency": 0}],
  "favoriteMetaphorCategories": ["Metafor kategorileri"],
  "topicExpertise": ["Uzmanlik alanlari"],
  "worldview": "Yazarin genel dunya gorusu ve is hayatina bakisi (3-4 cumle)",
  "signaturePhrases": ["Yazarin imza nitelgindeki ifade kaliplari (5-8 tane)"]
}

SADECE JSON don.`;

  return retryWithBackoff(async () => {
    const result = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.5,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    return JSON.parse(result.text ?? '{}') as PersonaProfile;
  });
}

function countFrequency(items: string[]): Array<{ item: string; count: number }> {
  const freq = new Map<string, number>();
  for (const item of items) {
    const normalized = item.toLowerCase().trim();
    if (normalized) freq.set(normalized, (freq.get(normalized) || 0) + 1);
  }
  return [...freq.entries()]
    .map(([item, count]) => ({ item, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('=== Persona Knowledge Base Builder ===\n');

  // Load articles — assign numeric IDs since source JSON has none
  console.log('Loading articles...');
  const raw = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf-8'));
  const rawArticles: any[] = raw.articles || raw;
  const articles: RawArticle[] = rawArticles.map((a, idx) => ({
    ...a,
    id: idx + 1,
  }));
  console.log(`Loaded ${articles.length} articles`);

  const fullCount = articles.filter(a => a.content_text.length > 500).length;
  const truncatedCount = articles.length - fullCount;
  console.log(`  Full content: ${fullCount}, Truncated: ${truncatedCount}\n`);

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Step 1: AI Enrichment
  console.log('Step 1: AI Enrichment (Gemini Flash)...');
  const startEnrich = Date.now();
  const enrichments = await runEnrichmentPhase(articles);
  console.log(`  Done in ${Math.round((Date.now() - startEnrich) / 1000)}s — ${enrichments.size} articles enriched\n`);

  // Step 2: Embedding Generation
  console.log('Step 2: Embedding Generation (text-embedding-004)...');
  const startEmbed = Date.now();
  const embeddings = await runEmbeddingPhase(articles, enrichments);
  console.log(`  Done in ${Math.round((Date.now() - startEmbed) / 1000)}s — ${embeddings.size} embeddings\n`);

  // Assemble enriched articles
  const enrichedArticles: EnrichedArticle[] = articles
    .filter(a => enrichments.has(a.id) && embeddings.has(a.id))
    .map(a => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      content_text: a.content_text,
      date: a.date,
      tags: a.tags,
      categories: a.categories,
      url: a.url,
      isFullContent: a.content_text.length > 500,
      enrichment: enrichments.get(a.id)!,
      embedding: embeddings.get(a.id)!,
    }));

  // Save enriched articles
  fs.writeFileSync(ENRICHED_PATH, JSON.stringify(enrichedArticles, null, 0));
  const fileSizeMB = (fs.statSync(ENRICHED_PATH).size / 1024 / 1024).toFixed(2);
  console.log(`Saved ${enrichedArticles.length} enriched articles → ${ENRICHED_PATH} (${fileSizeMB}MB)`);

  // Step 3: Author DNA Profile
  console.log('\nStep 3: Building Author DNA Profile...');
  const startProfile = Date.now();
  const profile = await buildPersonaProfile(articles, enrichments);
  console.log(`  Done in ${Math.round((Date.now() - startProfile) / 1000)}s`);

  fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2));
  console.log(`Saved persona profile → ${PROFILE_PATH}`);

  console.log('\n=== Build Complete ===');
  console.log(`  Articles: ${enrichedArticles.length}/${articles.length}`);
  console.log(`  Enriched: ${enrichments.size}`);
  console.log(`  Embeddings: ${embeddings.size}`);
  console.log(`  Total time: ${Math.round((Date.now() - startEnrich) / 1000)}s`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
