import { generateJSON } from '../../geminiClient';
import type { MarketingPipelineInput, CampaignStrategyOutput } from '../types';

export async function runCampaignStrategist(
  input: MarketingPipelineInput
): Promise<CampaignStrategyOutput> {
  const { brandAnalysis, businessContext, goals, availablePlatforms, totalBudget, currency, campaignDuration, sector, businessName } = input;

  // Build brand context from SynthesizedAnalysis
  const brandContext = `
## Marka Analizi Ozeti
- Arketip: ${brandAnalysis.brandPersonality.archetype}
- Kisilik Ozellikleri: ${brandAnalysis.brandPersonality.traits.join(', ')}
- Ton: ${brandAnalysis.brandPersonality.tone}
- Ses: ${brandAnalysis.brandPersonality.voice}

## Konumlandirma
- Beyan: ${brandAnalysis.positioning.statement}
- Hedef Kitle: ${brandAnalysis.positioning.targetAudience}
- Farklilastirici: ${brandAnalysis.positioning.differentiator}
- Rekabet Avantaji: ${brandAnalysis.positioning.competitiveAdvantage}
${brandAnalysis.positioning.competitiveLandscape ? `- Rekabet Ortami: ${brandAnalysis.positioning.competitiveLandscape}` : ''}

## Hedef Segmentler
${brandAnalysis.positioning.targetSegments.map((seg, i) => `
### Segment ${i + 1}: ${seg.segmentLabel}
- Demografi: ${seg.demographics}
- Davranissal Profil: ${seg.behavioralProfile}
- Temel Ihtiyac: ${seg.coreNeed}
- Medya Aliskanliklari: ${seg.mediaHabits}
- Satin Alma Tetikleyicileri: ${seg.purchaseTriggers.join(', ')}
- Tahmini Segment Buyuklugu: ${seg.estimatedSegmentSize}
`).join('')}

## Icerik Stratejisi
- Sutunlar: ${brandAnalysis.contentStrategy.pillars.join(', ')}
- Anahtar Mesajlar: ${brandAnalysis.contentStrategy.keyMessages.join('; ')}
- Ton Yonergeleri: ${brandAnalysis.contentStrategy.toneGuidelines.join('; ')}
${brandAnalysis.contentStrategy.hashtags?.length ? `- Hashtag'ler: ${brandAnalysis.contentStrategy.hashtags.join(', ')}` : ''}

## SWOT
- Guclu Yanlar: ${brandAnalysis.analysis.strengths.join('; ')}
- Firsatlar: ${brandAnalysis.analysis.opportunities.join('; ')}
- Zorluklar: ${brandAnalysis.analysis.challenges.join('; ')}
`;

  // Build business context if available
  let businessInfo = '';
  if (businessContext) {
    businessInfo = `
## Isletme Baglami
- Isletme Tanimi: ${businessContext.businessDescription || 'Belirtilmemis'}
- Rakipler: ${businessContext.competitors || 'Belirtilmemis'}
- Cografi Kapsam: ${businessContext.geoScope || 'Belirtilmemis'}
- Dijital Mevcudiyet: ${businessContext.digitalPresence?.join(', ') || 'Belirtilmemis'}
- Instagram Takipci: ${businessContext.instagramFollowers || 'Belirtilmemis'}
- Aylik Butce: ${businessContext.monthlyBudget || 'Belirtilmemis'}
- Isletme Asamasi: ${businessContext.businessStage || 'Belirtilmemis'}
- Basvuru Nedeni: ${businessContext.triggerReason || 'Belirtilmemis'}
`;
  }

  // Build operational reality context — grounds the plan in production capacity,
  // performance baseline, seasonality and conversion mechanics so the strategy
  // does not propose more than the client can actually execute or measure.
  let operationalInfo = '';
  const ob = input.operationalBrief;
  if (ob) {
    const lines: string[] = [];
    if (ob.performance) {
      const p = ob.performance;
      const perf = [
        p.monthlyWebsiteVisitors && `aylik web ziyaretci: ${p.monthlyWebsiteVisitors}`,
        p.monthlyLeadsOrSales && `aylik lead/satis: ${p.monthlyLeadsOrSales}`,
        p.averageOrderValue && `ort. islem tutari: ${p.averageOrderValue}`,
        p.currentMonthlyAdSpend && `mevcut reklam harcamasi: ${p.currentMonthlyAdSpend}`,
        p.currentRoasOrCac && `mevcut ROAS/CAC: ${p.currentRoasOrCac}`,
      ].filter(Boolean).join(', ');
      if (perf) lines.push(`- Performans tabani (hedefleri buna gore GERCEKCI koy): ${perf}`);
    }
    if (ob.production) {
      const pr = ob.production;
      const prod = [
        pr.monthlyContentCapacityNeeded && `aylik icerik kapasitesi: ${pr.monthlyContentCapacityNeeded}`,
        pr.existingVisualAssets && `mevcut gorsel stok: ${pr.existingVisualAssets}`,
        typeof pr.canShootOnSite === 'boolean' && `sahada cekim: ${pr.canShootOnSite ? 'evet' : 'hayir'}`,
        pr.approvalTurnaround && `onay suresi: ${pr.approvalTurnaround}`,
      ].filter(Boolean).join(', ');
      if (prod) lines.push(`- Uretim kapasitesi (bunu ASMA — onerilen icerik hacmi buna uymali): ${prod}`);
    }
    if (ob.catalog?.heroProducts) lines.push(`- One cikarilacak urun/hizmet: ${ob.catalog.heroProducts}`);
    if (ob.seasonality) {
      const s = ob.seasonality;
      const seas = [
        s.peakPeriods && `yogun donem: ${s.peakPeriods}`,
        s.upcomingKeyDates && `kritik tarihler: ${s.upcomingKeyDates}`,
      ].filter(Boolean).join(', ');
      if (seas) lines.push(`- Sezonsallik (butce/flight planini buna gore dagit): ${seas}`);
    }
    if (ob.conversion?.primaryChannels?.length) {
      lines.push(`- Donusum kanallari (CTA/funnel bunlara yonlensin): ${ob.conversion.primaryChannels.join(', ')}`);
    }
    if (ob.constraints?.legalOrComplianceLimits) {
      lines.push(`- KISIT (bunlara aykiri mesaj URETME): ${ob.constraints.legalOrComplianceLimits}`);
    }
    if (lines.length) {
      operationalInfo = `\n## Operasyonel Gerceklik (musterinin sahadaki kapasitesi)\n${lines.join('\n')}\n`;
    }
  }

  // Build revision context if applicable
  let revisionContext = '';
  if (input.revisionNotes) {
    revisionContext = `
## ONEMLI: REVIZYON ISTEGI
Onceki kampanya onerisi reddedildi. Asagidaki notlara gore stratejiyi revize et:
${input.revisionNotes}
`;
  }

  const prompt = `Sen deneyimli bir dijital pazarlama stratejistisin. Bir marka icin kapsamli bir cok kanalli reklam kampanya stratejisi olusturacaksin.

${brandContext}
${businessInfo}
${operationalInfo}
${revisionContext}

## Kampanya Parametreleri
- Isletme Adi: ${businessName}
- Sektor: ${sector}
- Birincil Hedef: ${goals.primaryObjective}
${goals.secondaryObjectives?.length ? `- Ikincil Hedefler: ${goals.secondaryObjectives.join(', ')}` : ''}
- Kullanilabilir Platformlar: ${availablePlatforms.join(', ')}
- Toplam Butce: ${totalBudget} ${currency}/ay
- Kampanya Suresi: ${campaignDuration} gun
${goals.targetMetrics ? `- Hedef Metrikler: ${JSON.stringify(goals.targetMetrics)}` : ''}
${goals.specificRequirements ? `- Ozel Istekler: ${goals.specificRequirements}` : ''}
${input.adminNotes ? `- Admin Notlari: ${input.adminNotes}` : ''}

## KURALLAR
1. Her platform onerisi SOMUT ve UYGULANABILIR olmali
2. Marka tonuna SADIK kal — reklamlar markanin sesini yansitmali
3. Butceye GERCEKCI yaklasim — kucuk butcelerde 2-3 platforma odaklan, hepsine dagitma
4. Funnel stratejisi ACIK olmali — her asama icin hangi platform, neden?
5. Rakiplere karsi FARKLILASAN bir konumlanma olustur
6. Her platformun GUCLU oldugu alani kullan (Meta: gorsel + hedefleme, Google: niyet bazli, TikTok: video + genc kitle, LinkedIn: B2B, Email: sadik musteri)
7. Minimum butce kontrol: Eger butce bir platform icin yeterli degilse, o platformu ONERME
8. B2B isletmeler icin LinkedIn onceliklendirni, B2C icin Meta/TikTok
9. Yerel isletmeler icin cografi hedeflemeyi vurgula
10. ${totalBudget < 5000 ? 'DUSUK BUTCE: Maksimum 2 platforma odaklan' : totalBudget < 15000 ? 'ORTA BUTCE: 2-3 platform yeterli' : 'YUKSEK BUTCE: Tum uygun platformlari kullanabilirsin'}

## CIKTI FORMATI (JSON)
{
  "overallApproach": "string — 2-3 cumlelik genel strateji ozeti",
  "campaignName": "string — Turkce, akilda kalici kampanya adi",
  "platformStrategies": [
    {
      "platform": "meta | google | tiktok | linkedin | email",
      "campaignType": "string — platform-spesifik kampanya tipi",
      "objective": "awareness | traffic | engagement | leads | sales | video_views",
      "rationale": "string — neden bu platform ve tip?",
      "priority": "primary | secondary | supplementary",
      "estimatedImpact": "string — beklenen etki"
    }
  ],
  "messagingFramework": {
    "coreMessage": "string — ana reklam mesaji",
    "supportMessages": ["string — destekleyici mesajlar"],
    "toneAdaptation": "string — marka tonunun reklam diline cevrimi",
    "keyDifferentiators": ["string — reklamda one cikarilacak farkliliklar"],
    "avoidMessages": ["string — kacinilacak ifadeler"]
  },
  "funnelStrategy": {
    "topOfFunnel": { "platforms": ["meta"], "approach": "string" },
    "middleOfFunnel": { "platforms": ["meta"], "approach": "string" },
    "bottomOfFunnel": { "platforms": ["google"], "approach": "string" }
  },
  "timeline": {
    "phase1": { "name": "string", "duration": "string", "focus": "string" },
    "phase2": { "name": "string", "duration": "string", "focus": "string" },
    "phase3": { "name": "string", "duration": "string", "focus": "string" }
  },
  "competitivePositioning": "string — rakiplere karsi nasil konumlaniyoruz",
  "riskAssessment": ["string — potansiyel riskler ve azaltma yollari"]
}`;

  return generateJSON<CampaignStrategyOutput>(
    'pro',
    prompt,
    'campaignStrategist',
    { temperature: 0.7, maxOutputTokens: 8192 }
  );
}
