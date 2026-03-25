import { generateJSON } from '../geminiClient';
import type {
  NormalizedData,
  ResearchFindings,
  StrategistOutput,
  DigitalPresenceAnalysis,
  BusinessContextInput,
  FrictionAnalysis,
} from '../types';

/**
 * Friction Analyzer — "Gerçeklik Testi" Ajanı
 *
 * Üç veri setini birbirine çarpıştırır:
 *   1. Müşterinin İddiaları  → wizard + businessContext (ne sandığı)
 *   2. Dijital Varlık Gerçeği → digitalPresence (ne göründüğü)
 *   3. Pazar/Rakip Gerçeği   → researchFindings (sektörün ne söylediği)
 *
 * Her anlamlı zıtlıktan bir "StrategicInsight" üretir:
 *   clientBelief + marketReality → theInsight → strategicPivot
 *
 * Amaç: strategySynthesizer'ın müşteriye "duymak istediğini" değil,
 * "bilmesi gerekeni" söylemesini sağlamak.
 *
 * Model: Flash (karşılaştırma işi, derin muhakeme gerektirmez)
 */
export async function runFrictionAnalyzer(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null,
  strategistOutput: StrategistOutput,
  digitalPresence: DigitalPresenceAnalysis | null,
  businessContext?: BusinessContextInput,
): Promise<FrictionAnalysis> {

  // ── Bacak 1: Müşterinin Beyanları (wizard + businessContext) ──────────────
  const clientClaims: string[] = [];

  // Wizard örüntülerinden inanç çıkar
  if (normalizedData.detectedPatterns.length > 0) {
    clientClaims.push(`Wizard Örüntüleri: ${normalizedData.detectedPatterns.join('; ')}`);
  }
  if (normalizedData.contradictions.length > 0) {
    clientClaims.push(`İç Çelişkiler: ${normalizedData.contradictions.join('; ')}`);
  }

  // BusinessContext'ten açık beyanlar
  const bc = businessContext;
  if (bc) {
    if (bc.businessDescription) clientClaims.push(`Kendini Nasıl Tanımladığı: ${bc.businessDescription}`);
    if (bc.brandWhy) clientClaims.push(`Varoluş Amacı Beyanı (WHY): ${bc.brandWhy}`);
    if (bc.customerPerception) clientClaims.push(`Müşteri Algısı Beyanı: ${bc.customerPerception}`);
    if (bc.existingBrandAssets) clientClaims.push(`Marka Varlıkları Beyanı: ${bc.existingBrandAssets}`);
    if (bc.futureVision) clientClaims.push(`3 Yıllık Vizyon Beyanı: ${bc.futureVision}`);
    if (bc.competitors) clientClaims.push(`Rakip Olarak Gördükleri: ${bc.competitors}`);
    if (bc.instagramFollowers) clientClaims.push(`Sosyal Medya Takipçi Beyanı: ${bc.instagramFollowers}`);
  }

  // Stratejistin çıktısı da örtük bir "müşteri inancı" yansıtır (wizard verisine dayanıyor)
  clientClaims.push(`Strateji Uzmanının Yorumu: Arketip=${strategistOutput.archetype}, Konumlandırma="${strategistOutput.positioningStatement.slice(0, 100)}"`);

  // ── Bacak 2: Dijital Varlık Gerçeği ──────────────────────────────────────
  const digitalRealities: string[] = [];

  if (digitalPresence) {
    digitalRealities.push(`Dijital Olgunluk Skoru: ${digitalPresence.overallDigitalScore}/10 (${digitalPresence.digitalMaturityLevel})`);
    if (digitalPresence.website) {
      const w = digitalPresence.website;
      if (w.status === 'analyzed') {
        digitalRealities.push(`Web Sitesi Tasarım Kalitesi: ${w.designQuality}/10`);
        if (w.weaknesses?.length) digitalRealities.push(`Web Zayıflıkları: ${w.weaknesses.slice(0, 3).join('; ')}`);
        if (w.trustSignals?.length) digitalRealities.push(`Güven Sinyalleri: ${w.trustSignals.slice(0, 3).join('; ')}`);
      } else {
        digitalRealities.push('Web Sitesi: Analiz edilemedi veya yok');
      }
    }
    if (digitalPresence.instagram) {
      const ig = digitalPresence.instagram;
      digitalRealities.push(`Instagram Takipçi Aralığı: ${ig.followerRange || 'Bilinmiyor'}, Etkileşim: ${ig.engagementLevel}`);
      if (ig.weaknesses?.length) digitalRealities.push(`Instagram Zayıflıkları: ${ig.weaknesses.slice(0, 2).join('; ')}`);
    }
    if (digitalPresence.criticalGaps?.length) {
      digitalRealities.push(`Kritik Dijital Eksikler: ${digitalPresence.criticalGaps.slice(0, 3).join('; ')}`);
    }
  } else {
    digitalRealities.push('Dijital varlık verisi mevcut değil');
  }

  // ── Bacak 3: Pazar/Rakip Gerçeği ─────────────────────────────────────────
  const marketRealities: string[] = [];

  if (researchFindings && researchFindings.sourcesUsed > 0) {
    marketRealities.push(`Pazar Büyüklüğü & Büyüme: ${researchFindings.marketData.marketSize}, ${researchFindings.marketData.growthRate}`);
    if (researchFindings.competitors.length > 0) {
      const topCompetitors = researchFindings.competitors.slice(0, 4)
        .map(c => `${c.name} — ${c.positioning.slice(0, 80)} (Güçlü: ${c.strengths.slice(0, 1).join('')})`)
        .join('\n');
      marketRealities.push(`Rakip Profilleri:\n${topCompetitors}`);
    }
    if (researchFindings.marketData.consumerTrends.length > 0) {
      marketRealities.push(`Tüketici Trendleri: ${researchFindings.marketData.consumerTrends.slice(0, 3).join('; ')}`);
    }
    if (researchFindings.opportunities.length > 0) {
      marketRealities.push(`Pazar Fırsatları: ${researchFindings.opportunities.slice(0, 2).join('; ')}`);
    }
    if (researchFindings.threats.length > 0) {
      marketRealities.push(`Pazar Tehditleri: ${researchFindings.threats.slice(0, 2).join('; ')}`);
    }
  } else {
    marketRealities.push('Sektör araştırması mevcut değil');
  }

  const prompt = `Sen bir "Gerçeklik Testi" (Reality Check) ajanısın. Görevin bir danışmanlık firmasının (McKinsey/Bain metodolojisi) yaptığı "triangulation" (üçgenleme) analizini yapmak:

Müşterinin ne SANDIĞINI (beyanları), dijital varlığının ne GÖRÜNDÜĞÜNÜ ve pazarın ne SÖYLEDİĞİNİ çarpıştır. Her anlamlı zıtlıktan bir stratejik içgörü (StrategicInsight) üret.

Amaç: "Müşteriye duymak istediğini değil, bilmesi gerekeni söyle."

---

## BACAK 1 — Müşteri Beyanları (Ne Sandığı)
${clientClaims.join('\n')}

## BACAK 2 — Dijital Varlık Gerçeği (Ne Göründüğü)
${digitalRealities.join('\n')}

## BACAK 3 — Pazar & Rakip Gerçeği (Sektörün Ne Söylediği)
${marketRealities.join('\n')}

---

## ÇIKTI KURALLARI

Aşağıdaki JSON yapısında 3-5 adet stratejik içgörü üret. Her içgörü:
- Gerçek bir zıtlığa dayanmalı (beyan ≠ gerçek)
- "theInsight" tek net cümle — soyut değil, somut
- "strategicPivot" yarın uygulanabilir bir eylem — "daha iyi yap" değil "X yap"
- "opportunityCostHint" varsa: "Bu inanç yüzünden hangi gelir/müşteri kaçırılıyor?"

⚠️ YASAK: "Dijital varlık güçlendirilmeli", "Strateji rafine edilmeli" gibi boş öneriler.
⚠️ ZORUNLU: Her "strategicPivot" en az bir rakip adı veya somut rakam içermeli (varsa).
⚠️ "So What?" filtresi: Her içgörünün sonunda "Bu bu müşteri için ne anlama geliyor?" sorusunu zaten cevaplamış olmalısın.

{
  "strategicInsights": [
    {
      "clientBelief": "Müşteri 'X' diye inanıyor — beyan veya örüntü kaynağı",
      "marketReality": "Ancak veri/dijital/araştırma Y'yi gösteriyor",
      "theInsight": "Zıtlıktan çıkan tek net 'Aha!' anı cümlesi",
      "strategicPivot": "Bu yüzden şunu yap: somut, ölçülebilir, atandırılabilir eylem",
      "evidenceSources": ["wizard", "digital", "research", "competitor"],
      "urgency": "critical / important / useful",
      "opportunityCostHint": "Bu inanç yüzünden kaybedilen somut fırsat (varsa, yoksa null)"
    }
  ],
  "biggestIllusion": "En kritik yanlış inanç — tek cümle. Bu inanç düzeltilmezse strateji boşa gider.",
  "opportunityCost": "Mevcut inançlar yüzünden kaybedilen toplam fırsatın özeti. Rakam veya rakip referansıyla. (2-3 cümle)"
}

KRİTİK: Sadece JSON dön. Türkçe yaz. Veri olmayan bacaklar için tahmin yürütme — "(veri yok)" yaz.`;

  const parsed = await generateJSON<FrictionAnalysis>('flash', prompt, 'FrictionAnalyzer', {
    temperature: 0.5,
    maxOutputTokens: 4096,
  });

  // Validate and fallback
  const insights = Array.isArray(parsed.strategicInsights) && parsed.strategicInsights.length > 0
    ? parsed.strategicInsights
        .filter((i: any) => i.clientBelief && i.theInsight && i.strategicPivot)
        .map((i: any) => ({
          clientBelief: String(i.clientBelief || ''),
          marketReality: String(i.marketReality || ''),
          theInsight: String(i.theInsight || ''),
          strategicPivot: String(i.strategicPivot || ''),
          evidenceSources: Array.isArray(i.evidenceSources) ? i.evidenceSources : ['wizard'],
          urgency: (['critical', 'important', 'useful'].includes(i.urgency) ? i.urgency : 'important') as 'critical' | 'important' | 'useful',
          opportunityCostHint: i.opportunityCostHint || undefined,
        }))
    : [];

  return {
    strategicInsights: insights,
    biggestIllusion: parsed.biggestIllusion || '',
    opportunityCost: parsed.opportunityCost || '',
  };
}
