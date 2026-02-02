/**
 * End-to-end test for Persona AI Agent.
 * Usage: npx tsx scripts/test-persona.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env.vercel') });
dotenv.config({ path: path.join(projectRoot, '.env.local') });

import type { EnrichedArticle, PersonaProfile } from '../src/persona/types';
import { loadArticles, searchArticles } from '../src/persona/embeddingSearch';
import { assembleContext, extractQueryTerms } from '../src/persona/contextAssembler';
import { generateSuggestedQuestions } from '../src/persona/personaPrompts';
import { generateEmbedding, generateText } from '../src/pipeline/geminiClient';

// Load data
const articles: EnrichedArticle[] = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'src/persona/data/enrichedArticles.json'), 'utf-8')
);
const profile: PersonaProfile = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'src/persona/data/personaProfile.json'), 'utf-8')
);

console.log(`Loaded ${articles.length} articles, profile: "${profile.authorName}"`);
console.log(`Embedding dim: ${articles[0].embedding.length}`);
console.log(`Sample enrichment: "${articles[0].enrichment.thesis.slice(0, 80)}..."`);

// Init search engine
loadArticles(articles);

// Test 1: Suggested questions
console.log('\n=== TEST 1: Suggested Questions ===');
const questions = generateSuggestedQuestions({ businessName: 'Cafe Milano', sector: 'Yeme-Icme' });
questions.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));

// Test 2: Embedding + Search
console.log('\n=== TEST 2: Embedding Search ===');
const query = 'Bir cafe markasi icin en onemli strateji ne olmali?';
console.log(`Query: "${query}"`);

const t0 = Date.now();
const queryEmbedding = await generateEmbedding(query);
console.log(`Embedding generated in ${Date.now() - t0}ms (dim=${queryEmbedding.length})`);

const queryTerms = extractQueryTerms(query);
console.log(`Query terms: [${queryTerms.join(', ')}]`);

const t1 = Date.now();
const results = searchArticles(queryEmbedding, 10, queryTerms);
console.log(`Search completed in ${Date.now() - t1}ms`);
console.log('\nTop 5 results:');
results.slice(0, 5).forEach((r, i) => {
  console.log(`  ${i + 1}. [score=${r.finalScore.toFixed(3)}] "${r.article.title}"`);
  console.log(`     Thesis: ${r.article.enrichment.thesis.slice(0, 100)}`);
});

// Test 3: Full chat turn
console.log('\n=== TEST 3: Full Chat Turn ===');
const { system, user, articlesUsed } = assembleContext(profile, results, [], query);
console.log(`System prompt: ${system.length} chars`);
console.log(`Articles used: ${articlesUsed.length}`);

const fullPrompt = `${system}\n\n---\n\nKullanici: ${user}`;
const t2 = Date.now();
const reply = await generateText('flash', fullPrompt, 'personaAgent', {
  temperature: 0.7,
  maxOutputTokens: 2048,
});
const elapsed = Date.now() - t2;

console.log(`\nReply (${elapsed}ms, ${reply.length} chars):`);
console.log('─'.repeat(60));
console.log(reply);
console.log('─'.repeat(60));

console.log('\nReferenced articles:');
articlesUsed.slice(0, 5).forEach(a => {
  console.log(`  - [${a.relevanceScore}] ${a.title}`);
});

console.log('\n=== ALL TESTS PASSED ===');
