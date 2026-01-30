import { generateJSON } from '../geminiClient';
import { searchWeb, buildSearchQueries } from '../webSearch';
import type { PipelineInput, ResearchFindings } from '../types';

const EMPTY_RESEARCH: ResearchFindings = {
  competitors: [],
  marketTrends: [],
  sectorBenchmarks: [],
  opportunities: [],
  threats: [],
  searchQueries: [],
  sourcesUsed: 0,
  rawSnippets: [],
};

export async function runSectorResearch(input: PipelineInput): Promise<ResearchFindings> {
  const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  const { contact, sector } = input;
  const businessName = contact.businessName;

  // If search API keys are not configured, return empty research
  if (!searchApiKey || !searchEngineId) {
    console.warn('SectorResearch: GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_ENGINE_ID not configured. Skipping web search.');
    return EMPTY_RESEARCH;
  }

  // Step 1: Build search queries
  const queries = buildSearchQueries(businessName, sector);

  // Step 2: Execute all searches in parallel
  let allSnippets: string[] = [];
  let sourcesUsed = 0;

  try {
    const searchResults = await Promise.all(
      queries.map((query) => searchWeb(query, searchApiKey, searchEngineId))
    );

    for (const results of searchResults) {
      for (const result of results) {
        sourcesUsed++;
        if (result.snippet) {
          allSnippets.push(`[${result.title}]: ${result.snippet} (${result.link})`);
        }
      }
    }
  } catch (error) {
    console.error('SectorResearch: Web search failed:', error);
    return { ...EMPTY_RESEARCH, searchQueries: queries };
  }

  // If no snippets were found, return empty research with queries
  if (allSnippets.length === 0) {
    return { ...EMPTY_RESEARCH, searchQueries: queries, sourcesUsed };
  }

  // Step 3: Build context from collected snippets
  const snippetContext = allSnippets.slice(0, 30).join('\n\n');
  const rawSnippetsForOutput = allSnippets.slice(0, 5);

  // Step 4: Send to Gemini Pro for synthesis
  const prompt = `Sen sektor arastirmacisisin. Asagidaki web arama sonuclarini analiz et ve ${sector} sektoru icin bir rekabet ve pazar analizi olustur.

## Isletme Bilgileri
- Isletme Adi: ${businessName}
- Sektor: ${sector}

## Web Arama Sonuclari
${snippetContext}

---

Yukaridaki arama sonuclarini analiz ederek asagidaki JSON yapisinda bir sektor arastirmasi raporu olustur:

{
  "competitors": [
    {
      "name": "Rakip marka/isletme adi",
      "positioning": "Rakibin pazar konumlandirmasi",
      "strengths": ["Rakibin guclu yanlari (2-3 adet)"],
      "weaknesses": ["Rakibin zayif yanlari (1-2 adet)"]
    }
  ],
  "marketTrends": ["Sektordeki guncel pazar trendleri (3-5 adet)"],
  "sectorBenchmarks": ["Sektor standartlari ve olcutler (2-4 adet)"],
  "opportunities": ["Isletme icin firsatlar (3-4 adet)"],
  "threats": ["Isletme icin tehditler (2-3 adet)"]
}

ONEMLI KURALLAR:
1. "competitors" dizisinde sektordeki en az 2, en fazla 5 rakibi analiz et. Her rakip icin konumlandirma, guclu yanlar ve zayif yanlar belirt.
2. "marketTrends" alaninda sektordeki guncel trendleri, dijital donusum egilimlerini ve tuketici davranis degisikliklerini belirt.
3. "sectorBenchmarks" alaninda sektordeki basari olcutlerini, ortalama performans degerlerini ve standartlari belirt.
4. "opportunities" alaninda ${businessName} icin somut firsatlari ve avantajlari listele.
5. "threats" alaninda ${businessName} icin potansiyel riskleri ve tehditleri listele.
6. Eger arama sonuclari yetersizse, genel sektor bilgini kullanarak en iyi tahmini yap ama spekuelasyon yaptigini belirt.
7. Tum metinler TURKCE olmali.
8. Sadece JSON don, baska bir sey yazma.`;

  const parsed = await generateJSON<Omit<ResearchFindings, 'searchQueries' | 'sourcesUsed' | 'rawSnippets'>>(
    'pro', prompt, 'SectorResearch', {
      temperature: 0.5,
      maxOutputTokens: 3072,
    }
  );

  return {
    competitors: parsed.competitors || [],
    marketTrends: parsed.marketTrends || [],
    sectorBenchmarks: parsed.sectorBenchmarks || [],
    opportunities: parsed.opportunities || [],
    threats: parsed.threats || [],
    searchQueries: queries,
    sourcesUsed,
    rawSnippets: rawSnippetsForOutput,
  };
}
