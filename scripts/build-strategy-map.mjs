#!/usr/bin/env node
// scripts/build-strategy-map.mjs
// Run: node scripts/build-strategy-map.mjs
// Dry run: node scripts/build-strategy-map.mjs --dry-run

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GoogleGenAI } from '@google/genai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDryRun = process.argv.includes('--dry-run');

// ─── Config ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;
const DRY_RUN_LIMIT = 10;
const INPUT_PATH = join(__dirname, '..', 'public', 'makaleler', 'tum_makaleler.json');
const OUTPUT_PATH = join(__dirname, '..', 'public', 'makaleler', 'strategy_map.json');

const MODEL_ID = 'gemini-2.0-flash';

// ─── Init Gemini ─────────────────────────────────────────────────────────────

// Load .env.local if GEMINI_API_KEY not already set
if (!process.env.GEMINI_API_KEY) {
  const envPath = join(__dirname, '..', '.env.local');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
    console.log('Loaded environment from .env.local');
  }
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('ERROR: GEMINI_API_KEY environment variable is not set.');
  console.error('Hint: create a .env.local file with GEMINI_API_KEY=your-key');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function generatePatternId(sector, brandMaturity, index) {
  const paddedIndex = String(index).padStart(3, '0');
  return `${sector}_${brandMaturity}_${paddedIndex}`;
}

/**
 * Process a batch of articles with Gemini Flash.
 * Returns an array of article annotations.
 */
async function processBatch(articles, batchIndex) {
  const articleList = articles
    .map(
      (a, i) =>
        `[${i + 1}] slug: "${a.slug}"
title: "${a.title}"
tags: ${JSON.stringify(a.tags || [])}
excerpt: "${(a.excerpt || '').slice(0, 200)}"
content: "${(a.content_text || '').slice(0, 400)}"`,
    )
    .join('\n\n');

  const prompt = `Sen bir marka stratejisi uzmanısın. Aşağıdaki blog makalelerini analiz et ve her biri için yapılandırılmış etiketleme yap.

## Makaleler (Batch ${batchIndex + 1})
${articleList}

## Görev
Her makale için şunları belirle:
- **sector**: Makalenin hangi sektörü/alanı ele aldığı (gastronomi, hospitality, retail, tech, fmcg, hizmet, eğitim, sağlık, gayrimenkul, finans, sanat, generic, vb.)
- **brandMaturity**: Hangi olgunluk seviyesindeki markalara hitap ettiği: "pre_brand" | "emerging" | "developing" | "mature" | "any"
- **approach**: Makalenin önerdiği/anlattığı stratejik yaklaşım (1-2 cümle, Türkçe)
- **insight**: Makalenin temel çıkarımı/dersi (1-2 cümle, Türkçe)
- **successPattern**: Ne işe yarıyor? (1 cümle, Türkçe, null olabilir)
- **avoidPattern**: Neden kaçınmak gerekiyor? (1 cümle, Türkçe, null olabilir)

JSON dizisi döndür:
[
  {
    "slug": "<makale slug>",
    "sector": "<sektör>",
    "brandMaturity": "<seviye>",
    "approach": "<yaklaşım>",
    "insight": "<çıkarım>",
    "successPattern": "<başarı örüntüsü veya null>",
    "avoidPattern": "<kaçınılacak şey veya null>"
  }
]`;

  const result = await ai.models.generateContent({
    model: MODEL_ID,
    contents: prompt,
    config: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  });

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Try to extract JSON array from text
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error(`Failed to parse JSON from batch ${batchIndex + 1}: ${text.slice(0, 200)}`);
    }
  }

  return Array.isArray(parsed) ? parsed : [];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Intiba Strategy Map Builder ===`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (first 10 articles)' : 'FULL RUN'}`);
  console.log(`Input: ${INPUT_PATH}`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log('');

  // Read input
  if (!existsSync(INPUT_PATH)) {
    console.error(`ERROR: Input file not found: ${INPUT_PATH}`);
    process.exit(1);
  }

  const raw = readFileSync(INPUT_PATH, 'utf-8');
  const data = JSON.parse(raw);
  let articles = data.articles || [];

  console.log(`Total articles in source: ${articles.length}`);

  if (isDryRun) {
    articles = articles.slice(0, DRY_RUN_LIMIT);
    console.log(`Dry run: processing only first ${articles.length} articles\n`);
  }

  // Process in batches
  const batches = chunkArray(articles, BATCH_SIZE);
  console.log(`Processing ${articles.length} articles in ${batches.length} batches of up to ${BATCH_SIZE}...\n`);

  const allAnnotations = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`  Batch ${i + 1}/${batches.length} (${batch.length} articles)...`);

    try {
      const annotations = await processBatch(batch, i);
      allAnnotations.push(...annotations);
      console.log(`    ✓ Got ${annotations.length} annotations`);
    } catch (err) {
      console.error(`    ✗ Batch ${i + 1} failed: ${err.message}`);
      // Continue with remaining batches — partial results are fine
    }

    // Small delay between batches to avoid rate limiting
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\nTotal annotations collected: ${allAnnotations.length}`);

  // Build lookup map for annotations by slug
  const annotationBySlug = new Map();
  for (const ann of allAnnotations) {
    if (ann.slug) annotationBySlug.set(ann.slug, ann);
  }

  // Each annotation → its own pattern (1:1).
  // sector + brandMaturity are filter fields, NOT grouping keys.
  const sectorCounters = new Map();

  const patterns = articles
    .filter((article) => annotationBySlug.has(article.slug))
    .map((article) => {
      const ann = annotationBySlug.get(article.slug);
      const sector = ann.sector || 'generic';
      const brandMaturity = ann.brandMaturity || 'any';

      const key = `${sector}_${brandMaturity}`;
      const count = (sectorCounters.get(key) || 0) + 1;
      sectorCounters.set(key, count);

      // Confidence based on richness of extracted data
      const hasBoth = !!(ann.successPattern && ann.avoidPattern);
      const hasOne = !!(ann.successPattern || ann.avoidPattern);
      const confidence = parseFloat((hasBoth ? 0.85 : hasOne ? 0.65 : 0.45).toFixed(2));

      return {
        id: generatePatternId(sector, brandMaturity, count),
        sector,
        brandMaturity,
        approach: ann.approach || '',
        insight: ann.insight || '',
        successPattern: ann.successPattern || null,
        avoidPattern: ann.avoidPattern || null,
        sourceArticles: [{ slug: article.slug, title: article.title }],
        confidence,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      totalArticles: articles.length,
      totalPatterns: patterns.length,
      isDryRun,
    },
    patterns,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n✓ Strategy map written to: ${OUTPUT_PATH}`);
  console.log(`  Total patterns: ${patterns.length}`);

  // Summary by sector
  const sectorCounts = new Map();
  for (const p of patterns) {
    sectorCounts.set(p.sector, (sectorCounts.get(p.sector) || 0) + 1);
  }
  console.log('\nPatterns by sector:');
  for (const [sector, count] of [...sectorCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sector}: ${count}`);
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
