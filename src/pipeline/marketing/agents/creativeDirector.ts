import { generateJSON } from '../../geminiClient';
import type { MarketingPipelineInput, CreativeDirectorOutput, CampaignStrategyOutput } from '../types';

export async function runCreativeDirector(
  input: MarketingPipelineInput,
  strategy: CampaignStrategyOutput
): Promise<CreativeDirectorOutput> {
  const { brandAnalysis } = input;

  // Build visual world context
  const visualContext = brandAnalysis.visualWorld ? `
## Gorsel Dunya
- Mood Anahtar Kelimeleri: ${brandAnalysis.visualWorld.moodKeywords.join(', ')}
- Renk Paleti: ${brandAnalysis.visualWorld.colorPalette.map(c => `${c.name} (${c.hex}) — ${c.usage}`).join('; ')}
- Tipografi Stili: ${brandAnalysis.visualWorld.typographyStyle}
- Gorsel Stili: ${brandAnalysis.visualWorld.imageryStyle}
` : '';

  // Build platform list from strategy
  const activePlatforms = strategy.platformStrategies.map(ps => ps.platform);

  // Build messaging context
  const messagingContext = `
## Mesajlasma Cercevesi
- Ana Mesaj: ${strategy.messagingFramework.coreMessage}
- Destekleyici Mesajlar: ${strategy.messagingFramework.supportMessages.join('; ')}
- Ton Adaptasyonu: ${strategy.messagingFramework.toneAdaptation}
- Farklilastiriclar: ${strategy.messagingFramework.keyDifferentiators.join('; ')}
- Kacinilacak Mesajlar: ${strategy.messagingFramework.avoidMessages.join('; ')}
`;

  const platformCreativesSchema = activePlatforms.map(platform => {
    const specs: Record<string, string> = {
      meta: `"meta": {
          "creatives": [
            {
              "headline": "string — max 40 karakter",
              "primaryText": "string — max 125 karakter, dikkat cekici",
              "description": "string — max 30 karakter",
              "callToAction": "Simdi Al | Daha Fazla Bilgi | Kayit Ol | Iletisime Gec | Teklif Al",
              "destinationUrl": "string — hedef URL",
              "imageGuidelines": "string — gorsel yonergesi (ne gorseli, kompozisyon, renk)",
              "variants": [
                { "id": "A", "label": "Varyant A", "headline": "string", "primaryText": "string" },
                { "id": "B", "label": "Varyant B", "headline": "string", "primaryText": "string" }
              ]
            }
          ],
          "formatNotes": "string — Meta reklam format onerileri (tek gorsel, carousel, video, stories)",
          "bestPractices": ["string — Meta-spesifik en iyi uygulamalar"]
        }`,
      google: `"google": {
          "creatives": [
            {
              "headline": "string — max 30 karakter (en az 5 farkli headline)",
              "primaryText": "string — max 90 karakter (en az 2 description)",
              "callToAction": "string",
              "destinationUrl": "string",
              "displayUrl": "string — gosterim URL'i",
              "variants": [
                { "id": "A", "label": "Varyant A", "headline": "string", "primaryText": "string" },
                { "id": "B", "label": "Varyant B", "headline": "string", "primaryText": "string" }
              ]
            }
          ],
          "formatNotes": "string — Google Ads format onerileri (Responsive Search, Performance Max)",
          "bestPractices": ["string"]
        }`,
      tiktok: `"tiktok": {
          "creatives": [
            {
              "headline": "string — max 100 karakter",
              "primaryText": "string — video aciklama metni",
              "callToAction": "string",
              "destinationUrl": "string",
              "videoScript": "string — 15-30 saniyelik video script onerisi",
              "imageGuidelines": "string — video thumbnail yonergesi",
              "variants": [
                { "id": "A", "label": "Varyant A", "headline": "string", "primaryText": "string" },
                { "id": "B", "label": "Varyant B", "headline": "string", "primaryText": "string" }
              ]
            }
          ],
          "formatNotes": "string — TikTok reklam format onerileri (In-Feed, TopView, Spark)",
          "bestPractices": ["string"]
        }`,
      linkedin: `"linkedin": {
          "creatives": [
            {
              "headline": "string — max 70 karakter",
              "primaryText": "string — max 150 karakter intro text",
              "description": "string",
              "callToAction": "string",
              "destinationUrl": "string",
              "imageGuidelines": "string — profesyonel gorsel yonergesi",
              "variants": [
                { "id": "A", "label": "Varyant A", "headline": "string", "primaryText": "string" },
                { "id": "B", "label": "Varyant B", "headline": "string", "primaryText": "string" }
              ]
            }
          ],
          "formatNotes": "string — LinkedIn reklam format onerileri (Sponsored Content, Message)",
          "bestPractices": ["string"]
        }`,
      email: `"email": {
          "creatives": [
            {
              "headline": "string — email baslik",
              "primaryText": "string — email govde ozeti",
              "callToAction": "string — CTA buton metni",
              "destinationUrl": "string",
              "emailSubject": "string — konu satiri (max 60 karakter, emoji opsiyonel)",
              "emailPreviewText": "string — on izleme metni (max 90 karakter)",
              "emailBody": "string — email govde yapisi ve icerik",
              "variants": [
                { "id": "A", "label": "Varyant A", "headline": "string", "primaryText": "string" },
                { "id": "B", "label": "Varyant B", "headline": "string", "primaryText": "string" }
              ]
            }
          ],
          "formatNotes": "string — Email format onerileri (plain text vs HTML, responsive)",
          "bestPractices": ["string"]
        }`,
    };
    return specs[platform] || '';
  }).filter(Boolean).join(',\n    ');

  const prompt = `Sen yaratici bir dijital reklam direktorusun. Marka kimligine sadik kalarak, her platform icin dikkat cekici ve donusum odakli reklam icerikleri olusturacaksin.

## Marka Kisiligi
- Arketip: ${brandAnalysis.brandPersonality.archetype}
- Ton: ${brandAnalysis.brandPersonality.tone}
- Ses: ${brandAnalysis.brandPersonality.voice}
- Kisilik: ${brandAnalysis.brandPersonality.traits.join(', ')}

${visualContext}
${messagingContext}

## Kampanya Adi: ${strategy.campaignName}
## Genel Yaklasim: ${strategy.overallApproach}

## Aktif Platformlar: ${activePlatforms.join(', ')}

## KURALLAR
1. Her metin KARAKTER LIMITINE uygun olmali
2. MARKA TONUNA sadik kal — jenerik reklam dili KULLANMA
3. Her platform icin EN AZ 2 A/B varyanti olustur
4. CTA'ler AKSIYON odakli ve SPESIFIK olmali
5. Gorsel yonergeleri SOMUT olmali (ne goruntulenmeli, hangi renkler, hangi kompozisyon)
6. TikTok icin VIDEO SCRIPT onerisi ver (15-30 sn, hook + body + CTA)
7. Email icin KONU SATIRI acilma oranini maksimize etmeli
8. Google icin EN AZ 5 farkli headline ve 2 farkli description ver
9. Her yaratici icerik KAMPANYA HEDEFINE hizmet etmeli
10. Turkce yaz, dogal ve akici Turkce kullan (argo veya abartili ifadelerden kacin)
11. ${brandAnalysis.contentStrategy.hashtags?.length ? `Hashtag'leri kullan: ${brandAnalysis.contentStrategy.hashtags.join(', ')}` : 'Uygun hashtag olustur'}

## CIKTI FORMATI (JSON)
{
  "creativeStrategy": "string — 2-3 cumlelik yaratici strateji ozeti",
  "platformCreatives": {
    ${platformCreativesSchema}
  },
  "visualGuidelines": {
    "colorUsage": "string — renk paletinin reklamlarda kullanimi",
    "imageryStyle": "string — gorsel stil yonergeleri",
    "typographyNotes": "string — yazi tipi onerileri",
    "brandConsistencyNotes": "string — platformlar arasi marka tutarliligi"
  },
  "abTestPlan": [
    {
      "testName": "string — test adi",
      "hypothesis": "string — test hipotezi",
      "variants": ["string — varyant aciklamalari"],
      "metric": "string — basari metrigi",
      "duration": "string — test suresi"
    }
  ]
}`;

  return generateJSON<CreativeDirectorOutput>(
    'pro',
    prompt,
    'creativeDirector',
    { temperature: 0.8, maxOutputTokens: 8192 }
  );
}
