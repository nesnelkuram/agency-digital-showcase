/**
 * Persona AI Agent — Prompt Templates
 *
 * Three-layer prompt architecture:
 *   Layer 1: Identity & Worldview (~800 tokens, static)
 *   Layer 2: Relevant Articles (~4000-6000 tokens, dynamic from RAG)
 *   Layer 3: Conversation History (~2000-3000 tokens, growing)
 */

import type { PersonaProfile, EnrichedArticle, PersonaMessage, ArticleSearchResult } from './types';

// ── Layer 1: System Prompt (Identity & Worldview) ──────────────────

export function buildSystemPrompt(profile: PersonaProfile): string {
  const beliefs = profile.coreBeliefs.map(b => `- ${b}`).join('\n');
  const antiPatterns = profile.antiPatterns.map(a => `- ${a}`).join('\n');
  const expertise = profile.topicExpertise.join(', ');
  const patterns = profile.thinkingPatterns
    .slice(0, 5)
    .map(p => `- ${p.pattern}`)
    .join('\n');
  const signatures = profile.signaturePhrases.map(s => `"${s}"`).join(', ');

  return `Sen ${profile.authorName} gibi dusunen ve konusan bir dijital pazarlama danismanisin. Sana sorulan sorulari ve verilen is verilerini ${profile.authorName}'in bakis acisiyla, dusunce bicimi ve uslubuyla degerlendirirsin.

## KIMLIK
${profile.worldview}

## DUSUNCE BICIMI
Sorulara su yontemlerle yaklasirsin:
${patterns}

## TEMEL INANCLAR
${beliefs}

## ILETISIM STILI
- Ton: ${profile.communicationStyle.tone}
- Kelime secimi: ${profile.communicationStyle.vocabulary}
- Cumle yapisi: ${profile.communicationStyle.sentenceStructure}
- Gecis kaliplari: ${profile.communicationStyle.favoriteTransitions.join(', ')}
- Imza ifadeler: ${signatures}

## UZMANLIK ALANLARI
${expertise}

## ASLA YAPMAYACAGIN SEYLER
${antiPatterns}

## KURALLAR
1. Yanitlarini her zaman ${profile.authorName}'in bakis acisiyla ver
2. Jenerik pazarlama tavsiyesi verme — provocatif, ozgun ve fikir sahibi ol
3. Sorulara dogrudan cevap ver, lafini dolandirma
4. Mumkunse blog yazilarindan referans ver ("Bir yazimda su konuya deginmistim..." gibi)
5. Kullanicinin is verilerini analiz ederken, sadece veriyi tekrarlama — o verinin ne anlama geldigini yorumla
6. Turkce yaz, dogal ve akici bir dille`;
}

// ── Layer 2: Article Context ───────────────────────────────────────

export function buildArticleContext(results: ArticleSearchResult[]): string {
  if (results.length === 0) return '';

  const sections: string[] = [];

  // Top 3: detailed view
  const top3 = results.slice(0, 3);
  for (const { article, finalScore } of top3) {
    const content = article.isFullContent
      ? article.content_text.slice(0, 2000)
      : article.excerpt;
    sections.push(
      `### "${article.title}" (Relevans: ${(finalScore * 100).toFixed(0)}%)
Tez: ${article.enrichment.thesis}
Prensip: ${article.enrichment.principleExtracted}
Uygulanabilir durumlar: ${article.enrichment.applicableSituations.join(', ')}
Ton: ${article.enrichment.emotionalTone}
${article.enrichment.keyQuotes.length > 0 ? `Onemli alintilar: ${article.enrichment.keyQuotes.map(q => `"${q}"`).join(' | ')}` : ''}
Icerik onizleme: ${content}`
    );
  }

  // 4-10: summary view
  const rest = results.slice(3, 10);
  if (rest.length > 0) {
    const summaries = rest.map(({ article, finalScore }) =>
      `- "${article.title}" (${(finalScore * 100).toFixed(0)}%): ${article.enrichment.thesis} | Prensip: ${article.enrichment.principleExtracted} | Metaforlar: ${article.enrichment.metaphors.join(', ')}`
    ).join('\n');

    sections.push(`### Ilgili Diger Yazilar\n${summaries}`);
  }

  return `\n## ILGILI BLOG YAZILARI\nAsagidaki yazilarin icerigini ve felsefesini yanitlarinda kullan. Dogrudan alintilar yapabilir, yazilara referans verebilirsin.\n\n${sections.join('\n\n')}`;
}

// ── Layer 3: Conversation History ──────────────────────────────────

const MAX_HISTORY_MESSAGES = 12; // 6 turns

export function buildConversationHistory(messages: PersonaMessage[]): string {
  if (messages.length === 0) return '';

  // Take last N messages (sliding window)
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);

  const formatted = recent.map(m => {
    const role = m.role === 'user' ? 'Kullanici' : 'Danisman';
    const content = m.content.length > 500
      ? m.content.slice(0, 500) + '...'
      : m.content;
    return `${role}: ${content}`;
  }).join('\n\n');

  return `\n## SOHBET GECMISI\n${formatted}`;
}

// ── Full Prompt Assembly ───────────────────────────────────────────

export function assembleFullPrompt(
  profile: PersonaProfile,
  articleResults: ArticleSearchResult[],
  history: PersonaMessage[],
  userMessage: string,
  preferences?: string[]
): { system: string; user: string } {
  const parts = [
    buildSystemPrompt(profile),
    buildArticleContext(articleResults),
    buildConversationHistory(history),
  ];

  if (preferences && preferences.length > 0) {
    parts.push(buildPreferencesBlock(preferences));
  }

  const system = parts.filter(Boolean).join('\n\n---\n\n');
  return { system, user: userMessage };
}

function buildPreferencesBlock(preferences: string[]): string {
  const items = preferences.map(p => `- ${p}`).join('\n');
  return `## KULLANICI TERCIHLERI\nKullanici daha once su geri bildirimleri vermistir. Yanitlarini buna gore ayarla:\n${items}`;
}

// ── Suggested Questions ────────────────────────────────────────────

export function generateSuggestedQuestions(businessContext?: {
  businessName: string;
  sector: string;
}): string[] {
  const generic = [
    'Bir markanin en buyuk korkusu ne olmali?',
    'Sektorun en buyuk yalani ne sence?',
    'Dijital pazarlamada en cok yapilan hata ne?',
    'Marka stratejisi neden onemli?',
    'Icerik pazarlamasinda neyi yanlis yapiyoruz?',
  ];

  if (!businessContext) return generic;

  return [
    `${businessContext.businessName} icin en buyuk stratejik firsat ne olabilir?`,
    `${businessContext.sector} sektorunde rakiplerden ayrilmanin en iyi yolu ne?`,
    `Bu markanin dijital varligi icin ilk 3 adim ne olmali?`,
    'Bir markanin en buyuk korkusu ne olmali?',
    'Dijital pazarlamada en cok yapilan hata ne?',
  ];
}
