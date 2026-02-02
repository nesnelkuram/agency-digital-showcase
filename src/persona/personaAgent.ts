/**
 * Persona AI Agent — Orchestrator
 *
 * Flow per chat turn:
 *   1. Embed user query (~200ms)
 *   2. Search 432 articles via cosine similarity (<1ms)
 *   3. Assemble 3-layer prompt
 *   4. Call Gemini Flash (~4-8s)
 *   5. Return response with article references
 */

import type { PersonaProfile, PersonaMessage, EnrichedArticle } from './types';
import { loadArticles, searchArticles } from './embeddingSearch';
import { assembleContext, extractQueryTerms } from './contextAssembler';
import { generateSuggestedQuestions } from './personaPrompts';
import { generateEmbedding, generateText } from '../pipeline/geminiClient';

// Bundled JSON data — esbuild embeds these at build time
// @ts-ignore — JSON imports handled by esbuild loader
import enrichedArticlesData from './data/enrichedArticles.json';
// @ts-ignore — JSON imports handled by esbuild loader
import personaProfileData from './data/personaProfile.json';

let _profile: PersonaProfile | null = null;
let _initialized = false;

export interface PersonaChatResponse {
  reply: string;
  articlesReferenced: Array<{ id: number; title: string; relevanceScore: number }>;
}

export interface PersonaStartResponse {
  suggestedQuestions: string[];
}

/**
 * Initialize the persona engine with embedded data.
 * Auto-initializes on first use (lazy).
 */
function ensureInitialized(): PersonaProfile {
  if (!_initialized || !_profile) {
    const articles = enrichedArticlesData as unknown as EnrichedArticle[];
    const profile = personaProfileData as unknown as PersonaProfile;
    loadArticles(articles);
    _profile = profile;
    _initialized = true;
    console.log(`Persona initialized: ${articles.length} articles loaded`);
  }
  return _profile!;
}

/**
 * Start a new persona chat session.
 * Returns suggested opening questions.
 */
export function startChat(businessContext?: {
  businessName: string;
  sector: string;
}): PersonaStartResponse {
  ensureInitialized();

  return {
    suggestedQuestions: generateSuggestedQuestions(businessContext),
  };
}

/**
 * Process a single chat turn.
 * Embeds the query, finds relevant articles, assembles prompt, calls Gemini.
 */
export async function chat(
  message: string,
  history: PersonaMessage[] = [],
  preferences?: string[]
): Promise<PersonaChatResponse> {
  const profile = ensureInitialized();

  // 1. Embed user query
  const queryEmbedding = await generateEmbedding(message);

  // 2. Search relevant articles
  const queryTerms = extractQueryTerms(message);
  const articleResults = searchArticles(queryEmbedding, 10, queryTerms);

  // 3. Assemble 3-layer prompt (+ optional preferences from feedback)
  const { system, user, articlesUsed } = assembleContext(
    profile,
    articleResults,
    history,
    message,
    preferences
  );

  // 4. Call Gemini Flash
  const fullPrompt = `${system}\n\n---\n\nKullanici: ${user}`;
  const reply = await generateText('flash', fullPrompt, 'personaAgent', {
    temperature: 0.7,
    maxOutputTokens: 2048,
  });

  return {
    reply,
    articlesReferenced: articlesUsed,
  };
}
