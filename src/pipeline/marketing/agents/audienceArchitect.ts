import { generateJSON } from '../../geminiClient';
import type { MarketingPipelineInput, AudienceArchitectOutput, CampaignStrategyOutput } from '../types';

export async function runAudienceArchitect(
  input: MarketingPipelineInput,
  strategy: CampaignStrategyOutput
): Promise<AudienceArchitectOutput> {
  const { brandAnalysis, businessContext, sector } = input;

  // Extract target segments from brand analysis
  const segmentContext = brandAnalysis.positioning.targetSegments.map((seg, i) => `
### Segment ${i + 1}: ${seg.segmentLabel}
- Demografi: ${seg.demographics}
- Davranissal Profil: ${seg.behavioralProfile}
- Temel Ihtiyac: ${seg.coreNeed}
- Medya Aliskanliklari: ${seg.mediaHabits}
- Satin Alma Tetikleyicileri: ${seg.purchaseTriggers.join(', ')}
- Tahmini Buyukluk: ${seg.estimatedSegmentSize}
`).join('');

  // Extract platform strategies
  const platformList = strategy.platformStrategies.map(ps =>
    `- ${ps.platform}: ${ps.campaignType} (${ps.objective}) — ${ps.rationale}`
  ).join('\n');

  const prompt = `Sen dijital reklamcilikta hedef kitle mimarisiyle uzmanlasmis bir stratejistsin. Marka analizi ve kampanya stratejisine dayanarak, her platform icin detayli hedefleme setleri olusturacaksin.

## Marka Hedef Segmentleri
${segmentContext}

## Kampanya Stratejisi
${platformList}

## Marka Bilgileri
- Sektor: ${sector}
- Konum: ${brandAnalysis.positioning.statement}
- Hedef Kitle Ozeti: ${brandAnalysis.positioning.targetAudience}
${businessContext?.geoScope ? `- Cografi Kapsam: ${businessContext.geoScope}` : ''}
${businessContext?.competitors ? `- Rakipler: ${businessContext.competitors}` : ''}

## Mesajlasma Cercevesi
- Ana Mesaj: ${strategy.messagingFramework.coreMessage}
- Farklilastiriclar: ${strategy.messagingFramework.keyDifferentiators.join(', ')}

## KURALLAR
1. Her platformun hedefleme parametreleri O PLATFORMUN API'SINE uygun olmali
2. Meta: interest + behavior + custom audience + lookalike onerisi
3. Google: keyword listesi (broad/phrase/exact match type belirt) + in-market + affinity audience
4. TikTok: interest categories + behavior + hashtag targeting
5. LinkedIn: company size, industry, job title, seniority, skills
6. Email: segment kurallari, etiket bazli filtreleme
7. Her platform icin TAHMINI ERISIM buyuklugu ver
8. Retargeting stratejisi MUTLAKA dahil et
9. Negatif hedefleme (exclusion) onerileri ver
10. A/B test planinda en az 2 farkli hedef kitle testi olustur
11. Hedefleme GERCEKCI olmali — cok dar = pahalya cikar, cok genis = verimlilik duser

## CIKTI FORMATI (JSON)
{
  "primaryAudience": {
    "description": "string — ana hedef kitle tanimi",
    "estimatedSize": "string — tahmini kitle buyuklugu",
    "platforms": ["meta", "google"]
  },
  "secondaryAudience": {
    "description": "string — ikincil hedef kitle tanimi",
    "estimatedSize": "string",
    "platforms": ["meta"]
  },
  "platformTargeting": {
    "meta": {
      "targeting": {
        "ageRange": { "min": 25, "max": 45 },
        "genders": ["all"],
        "locations": [{ "type": "city", "name": "Istanbul" }],
        "languages": ["tr"],
        "meta": {
          "interests": ["string — Meta interest hedefleme"],
          "behaviors": ["string"],
          "customAudiences": ["string — olusturulmasi gereken custom audience"],
          "lookalikeSource": "string — lookalike kaynak kitle",
          "lookalikePercentage": 2,
          "excludedAudiences": ["string"],
          "placements": ["feed", "stories", "reels"]
        }
      },
      "estimatedReach": "string",
      "estimatedCPM": "string",
      "recommendations": ["string"]
    },
    "google": {
      "targeting": {
        "ageRange": { "min": 25, "max": 45 },
        "genders": ["all"],
        "locations": [{ "type": "country", "name": "Turkiye" }],
        "languages": ["tr"],
        "google": {
          "keywords": [{ "text": "string", "matchType": "broad | phrase | exact" }],
          "negativeKeywords": ["string"],
          "audiences": ["string — in-market / affinity"],
          "topics": ["string"]
        }
      },
      "estimatedReach": "string",
      "estimatedCPM": "string",
      "recommendations": ["string"]
    }
  },
  "retargetingStrategy": {
    "websiteVisitors": "string — site ziyaretcileri retargeting plani",
    "engagers": "string — sosyal medya etkilesimcileri retargeting",
    "lookalikeStrategy": "string — lookalike kitle olusturma stratejisi"
  },
  "exclusionRecommendations": ["string — haric tutulmasi gereken kitleler"],
  "audienceTestingPlan": "string — A/B kitle testi plani"
}

ONEMLI: Sadece kampanya stratejisinde belirtilen platformlar icin targeting olustur. Stratejide olmayan platformlari platformTargeting'e EKLEME.`;

  return generateJSON<AudienceArchitectOutput>(
    'flash',
    prompt,
    'audienceArchitect',
    { temperature: 0.5, maxOutputTokens: 6144 }
  );
}
