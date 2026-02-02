import { generateJSON, generateGroundedText } from '../geminiClient';
import type { NormalizedData, ResearchFindings, BusinessContextInput, CompetitorDiscoveryOutput, EnrichedCompetitor } from '../types';

export async function runCompetitorDiscovery(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null,
  businessContext?: BusinessContextInput,
): Promise<CompetitorDiscoveryOutput> {
  const businessName = normalizedData.businessName;
  const sector = normalizedData.sector;
  const geoScope = businessContext?.geoScope || 'Turkiye';
  const businessDesc = businessContext?.businessDescription || '';

  // Collect already-known competitors
  const declaredCompetitors = (businessContext?.competitors || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const researchCompetitors = (researchFindings?.competitors || []).map(c => c.name);
  const knownNames = [...new Set([...declaredCompetitors, ...researchCompetitors])];

  console.log(`CompetitorDiscovery: Known competitors = [${knownNames.join(', ')}], discovering more...`);

  // --- Phase A: Discover new competitors via grounding ---
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateRule = `\nONEMLI: Bugun ${today}. SADECE 2025-2026 guncel verileri ara.`;

  // Determine product category from business description
  const productHint = businessDesc
    ? `Bu isletme: "${businessDesc}". Bu isletmenin SPESIFIK urun/hizmet kategorisinde rakip ara.`
    : `"${businessName}" markasinin urun/hizmet kategorisinde rakip ara.`;

  const [sectorRes, productRes] = await Promise.all([
    generateGroundedText(
      `${sector} sektorunde ${geoScope} bolgesinde faaliyet gosteren en onemli markalar ve firmalar kimlerdir? Bilinen rakipler disinda yeni ve buyuyen markalari da dahil et. EN AZ 5 marka bul. Her biri icin: marka adi, web sitesi, konumlandirma, tahmini olcek bilgisi ver. Turkce yaz.${dateRule}`,
      'CompetitorDiscovery-Sector',
      { maxOutputTokens: 8192, modelTier: 'pro' },
    ),
    generateGroundedText(
      `${productHint} ${geoScope} pazarinda dogrudan ve dolayli rakipleri arastir. Bilinen rakipler: [${knownNames.join(', ')}] — bu isimleri TEKRARLAMA, yeni rakipler bul. Her biri icin: marka adi, web sitesi, fiyat segmenti, guclu/zayif yanlar belirt. Turkce yaz.${dateRule}`,
      'CompetitorDiscovery-Product',
      { maxOutputTokens: 8192, modelTier: 'pro' },
    ),
  ]);

  // Combine grounding texts + existing research data
  const existingCompetitorData = (researchFindings?.competitors || [])
    .map(c => `- ${c.name}: ${c.positioning}. Guclu: ${c.strengths.join(', ')}. Zayif: ${c.weaknesses.join(', ')}. Olcek: ${c.estimatedScale}`)
    .join('\n');

  const combinedText = `## SEKTOR BAZLI RAKIPLER\n${sectorRes.text}\n\n## URUN BAZLI RAKIPLER\n${productRes.text}\n\n## MEVCUT ARASTIRMADAN BILINEN RAKIPLER\n${existingCompetitorData || 'Yok'}`;

  // Collect source URLs
  const sourceUrls: string[] = [];
  for (const res of [sectorRes, productRes]) {
    if (res.groundingMetadata) {
      for (const chunk of res.groundingMetadata.groundingChunks) {
        if (chunk.web?.uri) sourceUrls.push(chunk.web.uri);
      }
    }
  }

  // --- Phase B: Enrich ALL competitors with structured analysis ---
  const enrichmentPrompt = `Sen bir rekabet analizi uzmanisin. "${businessName}" (${sector}) markasi icin TUM rakipleri analiz et.

## Bilinen (declared/research) Rakipler:
${knownNames.length > 0 ? knownNames.map(n => `- ${n}`).join('\n') : 'Yok'}

## Grounding Arastirma Sonuclari
${combinedText.slice(0, 20000)}

---

Asagidaki JSON yapisinda donus yap:
{
  "knownCompetitors": [
    {
      "name": "Marka adi",
      "website": "https://...",
      "instagramHandle": "handle",
      "positioning": "Konumlandirma aciklamasi",
      "priceSegment": "premium/orta/ekonomik",
      "strengths": ["Guclu yan 1"],
      "weaknesses": ["Zayif yan 1"],
      "estimatedScale": "Olcek bilgisi",
      "digitalPresenceScore": 6,
      "socialMediaSummary": "Sosyal medya ozeti",
      "differentiators": ["Farklilastirici 1"],
      "source": "declared"
    }
  ],
  "discoveredCompetitors": [
    {
      "name": "Yeni kesfedilen marka",
      "website": "...",
      "instagramHandle": "...",
      "positioning": "...",
      "priceSegment": "...",
      "strengths": [],
      "weaknesses": [],
      "estimatedScale": "...",
      "digitalPresenceScore": 5,
      "socialMediaSummary": "...",
      "differentiators": [],
      "source": "discovered"
    }
  ],
  "competitiveLandscapeSummary": "Rekabet ortaminin genel degerlendirmesi (3-5 cumle)",
  "marketConcentration": "dagilmis/orta/yogun/oligopol",
  "entryBarriers": ["Giris engeli 1"],
  "competitiveThreats": ["Rekabet tehdidi 1"],
  "competitiveOpportunities": ["Firsat 1"],
  "digitalBenchmark": {
    "avgWebsiteQuality": 6,
    "avgSocialFollowing": "ortalama takipci araligi",
    "avgPostingFrequency": "ortalama paylasim sikligi",
    "bestPracticeExamples": ["Iyi uygulama ornegi"]
  }
}

KURALLAR:
1. "knownCompetitors": [${knownNames.join(', ')}] isimleri burada olmali. source="declared" (musteri bildirdiyse) veya source="research" (arastirmada bulunmusssa).
2. "discoveredCompetitors": Bilinen rakipler DISINDAKI yeni kesfedilen markalar. source="discovered".
3. Toplam EN AZ 5, EN FAZLA 12 rakip (knownCompetitors + discoveredCompetitors).
4. digitalPresenceScore: 1-10, web sitesi + sosyal medya genel kalitesi.
5. Bilgi yoksa UYDURMADAN "Veri bulunamadi" yaz.
6. Tum metinler TURKCE.
7. "${businessName}" kendisini rakip olarak EKLEME.`;

  try {
    const parsed = await generateJSON<any>('pro', enrichmentPrompt, 'CompetitorDiscovery-Enrich', {
      temperature: 0.5,
      maxOutputTokens: 8192,
    });

    const mapCompetitor = (c: any, fallbackSource: 'declared' | 'research' | 'discovered'): EnrichedCompetitor => ({
      name: c.name || 'Bilinmiyor',
      website: c.website || undefined,
      instagramHandle: c.instagramHandle || undefined,
      positioning: c.positioning || '',
      priceSegment: c.priceSegment || 'belirtilmemis',
      strengths: Array.isArray(c.strengths) ? c.strengths : [],
      weaknesses: Array.isArray(c.weaknesses) ? c.weaknesses : [],
      estimatedScale: c.estimatedScale || '',
      digitalPresenceScore: Math.min(10, Math.max(1, c.digitalPresenceScore || 5)),
      socialMediaSummary: c.socialMediaSummary || '',
      differentiators: Array.isArray(c.differentiators) ? c.differentiators : [],
      source: c.source || fallbackSource,
    });

    const knownCompetitors = Array.isArray(parsed.knownCompetitors)
      ? parsed.knownCompetitors.map((c: any) => mapCompetitor(c, 'research'))
      : [];
    const discoveredCompetitors = Array.isArray(parsed.discoveredCompetitors)
      ? parsed.discoveredCompetitors.map((c: any) => mapCompetitor(c, 'discovered'))
      : [];

    console.log(`CompetitorDiscovery: Enriched ${knownCompetitors.length} known + ${discoveredCompetitors.length} discovered competitors`);

    return {
      knownCompetitors,
      discoveredCompetitors,
      competitiveLandscapeSummary: parsed.competitiveLandscapeSummary || '',
      marketConcentration: parsed.marketConcentration || 'bilinmiyor',
      entryBarriers: Array.isArray(parsed.entryBarriers) ? parsed.entryBarriers : [],
      competitiveThreats: Array.isArray(parsed.competitiveThreats) ? parsed.competitiveThreats : [],
      competitiveOpportunities: Array.isArray(parsed.competitiveOpportunities) ? parsed.competitiveOpportunities : [],
      digitalBenchmark: {
        avgWebsiteQuality: parsed.digitalBenchmark?.avgWebsiteQuality || 5,
        avgSocialFollowing: parsed.digitalBenchmark?.avgSocialFollowing || 'Bilinmiyor',
        avgPostingFrequency: parsed.digitalBenchmark?.avgPostingFrequency || 'Bilinmiyor',
        bestPracticeExamples: Array.isArray(parsed.digitalBenchmark?.bestPracticeExamples)
          ? parsed.digitalBenchmark.bestPracticeExamples
          : [],
      },
    };
  } catch (error: any) {
    console.error(`CompetitorDiscovery: Enrichment failed — ${error.message}`);
    // Graceful fallback: return known competitors with basic info
    const fallbackKnown: EnrichedCompetitor[] = knownNames.map(name => ({
      name,
      positioning: '',
      priceSegment: 'belirtilmemis',
      strengths: [],
      weaknesses: [],
      estimatedScale: '',
      digitalPresenceScore: 5,
      socialMediaSummary: '',
      differentiators: [],
      source: declaredCompetitors.includes(name) ? 'declared' as const : 'research' as const,
    }));

    return {
      knownCompetitors: fallbackKnown,
      discoveredCompetitors: [],
      competitiveLandscapeSummary: 'Rakip zenginlestirme basarisiz oldu — temel bilgiler kullanildi.',
      marketConcentration: 'bilinmiyor',
      entryBarriers: [],
      competitiveThreats: [],
      competitiveOpportunities: [],
      digitalBenchmark: {
        avgWebsiteQuality: 5,
        avgSocialFollowing: 'Bilinmiyor',
        avgPostingFrequency: 'Bilinmiyor',
        bestPracticeExamples: [],
      },
    };
  }
}
