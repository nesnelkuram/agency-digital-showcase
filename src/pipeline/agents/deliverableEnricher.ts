import type { SynthesizedAnalysis } from '../types';
import { generateJSON } from '../geminiClient';

export interface DeliverableEnricherOutput {
  messagingArchitecture: NonNullable<SynthesizedAnalysis['messagingArchitecture']>;
  customerJourney: NonNullable<SynthesizedAnalysis['customerJourney']>;
  socialMediaTemplates: NonNullable<SynthesizedAnalysis['socialMediaTemplates']>;
}

export async function runDeliverableEnricher(
  synthesis: SynthesizedAnalysis,
  businessName: string,
  sector: string,
  maturityLevel?: string,
): Promise<DeliverableEnricherOutput> {
  const positioning = synthesis.positioning;
  const segments = positioning?.targetSegments || [];
  const pillars = synthesis.contentStrategy?.pillars || [];
  const brandNarrative = synthesis.brandNarrative;
  const strategicDepth = synthesis.strategicDepth;
  const kpi = synthesis.kpiFramework;

  // Max 4 pillars, 2 templates per pillar
  const templatePillars = pillars.slice(0, 4);
  const templateCount = templatePillars.length * 2;

  const prompt = `Sen bir marka iletisim ve icerik stratejisi uzmanisin. Asagidaki marka analizi verilerini kullanarak 2 yeni cikti uret.

## Marka Bilgisi
- Isletme: ${businessName}
- Sektor: ${sector}
- Konumlandirma: ${positioning?.statement || 'Belirtilmemis'}
- Donusum Ifadesi: ${strategicDepth?.transformationStatement || 'Belirtilmemis'}
- Elevator Pitch: ${brandNarrative?.elevatorPitch || 'Belirtilmemis'}
- North Star KPI: ${kpi?.northStar?.metric || 'Belirtilmemis'}
- Hedef Kitle Segmentleri: ${segments.map(s => s.segmentLabel).join(', ') || 'Belirtilmemis'}
- Icerik Sutunlari: ${pillars.join(', ') || 'Belirtilmemis'}
- Anahtar Mesajlar: ${synthesis.contentStrategy?.keyMessages?.join('; ') || 'Belirtilmemis'}
- Marka Tonu: ${synthesis.brandPersonality?.tone || 'Belirtilmemis'}
- Marka Sesi: ${synthesis.brandPersonality?.voice || 'Belirtilmemis'}
- Marka Olgunlugu: ${maturityLevel || 'Belirtilmemis'}

## Cikti 1: Mesajlasma Mimarisi (messagingArchitecture)
Musteriler en cok "ne yazacagim?" sorusunu sorar. Tek bir elevator pitch yeterli degil — farkli bağlamlar icin farkli versiyonlar gerekli.

- coreMessage: Marka vaadini 1 cumlede ozetle (konumlandirma + donusum ifadesinden turet)
- taglineCandidates: 3 slogan onerisi (5-8 kelime, akilda kalici, TURKCE)
- elevatorPitches:
  - thirtySecond: Networking event icin (mevcut elevator pitch'i rafine et veya yeniden yaz)
  - twoMinute: Website hakkimizda sayfasi icin (brandStory'yi zenginlestir)
  - investor: Yatirimci/iş ortagi pitch (veri ve buyume odakli)
- audienceMessages: Her segment icin ozel mesaj (segment sayisi kadar, max 4):
  - segment: Segment adi (targetSegments'ten)
  - headline: Bu segmente ozel baslik (dikkat cekici)
  - subheadline: Alt baslik (fayda odakli)
  - proof: Kanit noktasi (neden inanmali)

## Cikti 2: Sosyal Medya Icerik Sablonlari (socialMediaTemplates)
"Stratejiyi anladim ama yarin ne paylasacagimi bilmiyorum" sorununu cozer.
Her icerik sutunu icin 2 sablon, toplam ${templateCount} sablon.

Her sablon:
- pillar: Hangi icerik sutununa ait
- platform: Instagram/LinkedIn/TikTok (en uygun olan)
- format: Carousel/Reel/Story/Post
- hookLine: Dikkat cekici acilis cumlesi (ilk satir)
- bodyTemplate: Govde metni sablonu — [parantez] ile doldurulacak kisimlar icersin
- callToAction: CTA cumlesi
- exampleCaption: Tamamen yazilmis ornek caption (kopyala-yapistir hazir, hashtag dahil)

---

KURALLAR:
1. Tum metinler TURKCE olmali
2. Sektore ve isletmeye ozel, jenerik DEGIL
3. Marka tonuna uygun
4. Uygulanabilir — bir KOBİ sahibi hemen kullanabilmeli
5. "Dijital varlik guclendirilmeli" gibi bos laflar YASAK
6. Sadece JSON don

JSON yapisi:
{
  "messagingArchitecture": {
    "coreMessage": "...",
    "taglineCandidates": ["...", "...", "..."],
    "elevatorPitches": {
      "thirtySecond": "...",
      "twoMinute": "...",
      "investor": "..."
    },
    "audienceMessages": [
      { "segment": "...", "headline": "...", "subheadline": "...", "proof": "..." }
    ]
  },
  "socialMediaTemplates": [
    {
      "pillar": "...",
      "platform": "Instagram",
      "format": "Carousel",
      "hookLine": "...",
      "bodyTemplate": "...",
      "callToAction": "...",
      "exampleCaption": "..."
    }
  ]
}`;

  const parsed = await generateJSON<DeliverableEnricherOutput>('flash', prompt, 'DeliverableEnricher', {
    temperature: 0.7,
    maxOutputTokens: 6144,
  });

  // Validate and return with safe defaults
  return {
    messagingArchitecture: {
      coreMessage: parsed.messagingArchitecture?.coreMessage || positioning?.statement || '',
      taglineCandidates: Array.isArray(parsed.messagingArchitecture?.taglineCandidates)
        ? parsed.messagingArchitecture.taglineCandidates.slice(0, 3)
        : [],
      elevatorPitches: {
        thirtySecond: parsed.messagingArchitecture?.elevatorPitches?.thirtySecond || brandNarrative?.elevatorPitch || '',
        twoMinute: parsed.messagingArchitecture?.elevatorPitches?.twoMinute || brandNarrative?.brandStory || '',
        investor: parsed.messagingArchitecture?.elevatorPitches?.investor || '',
      },
      audienceMessages: Array.isArray(parsed.messagingArchitecture?.audienceMessages)
        ? parsed.messagingArchitecture.audienceMessages
        : [],
    },
    customerJourney: [], // No longer generated — removed from report
    socialMediaTemplates: Array.isArray(parsed.socialMediaTemplates)
      ? parsed.socialMediaTemplates.slice(0, templateCount)
      : [],
  };
}
