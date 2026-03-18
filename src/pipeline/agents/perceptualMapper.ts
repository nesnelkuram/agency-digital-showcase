import type { EnrichedCompetitorWithSite } from './competitorWebScanner';
import type { NormalizedData } from '../types';
import { generateJSON } from '../geminiClient';
import { getSectorFrameworkConfig } from '../sectorFrameworks';

export interface PerceptualPosition {
  name: string;
  x: number;   // -5 to +5 on xAxis
  y: number;   // -5 to +5 on yAxis
  positioning: string;  // brief description
  confidence: 'high' | 'medium' | 'low';
}

export interface PerceptualMap {
  xAxis: { label: string; lowEnd: string; highEnd: string };
  yAxis: { label: string; lowEnd: string; highEnd: string };
  customerPosition: PerceptualPosition;
  competitorPositions: PerceptualPosition[];
  gapAnalysis: {
    unclaimedRegions: string[];   // e.g. "Yüksek deneyim + Orta fiyat bölgesi sahipsiz"
    recommendedPosition: { x: number; y: number; rationale: string };
  };
}

export async function mapPerceptualPositions(
  competitors: EnrichedCompetitorWithSite[],
  normalizedData: NormalizedData,
): Promise<PerceptualMap> {
  const config = getSectorFrameworkConfig(normalizedData.sector);
  const { xAxis, yAxis } = config.perceptualMapAxes;

  // Build competitor summaries for the prompt
  const competitorEntries = competitors.map((c) => {
    const sitePreview = c.siteData?.status === 'ok' && c.siteData.text
      ? c.siteData.text.slice(0, 500)
      : null;
    return [
      `### ${c.name}`,
      `Konumlandırma: ${c.positioning}`,
      `Fiyat segmenti: ${c.priceSegment}`,
      `Güçlü yönler: ${c.strengths.join(', ')}`,
      `Zayıf yönler: ${c.weaknesses.join(', ')}`,
      `Farklılaştırıcılar: ${c.differentiators.join(', ')}`,
      sitePreview ? `Web sitesi özeti: ${sitePreview}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  });

  const prompt = `Sen bir marka stratejisti olarak perceptual map (algısal harita) analizi yapıyorsun.

## Sektör: ${normalizedData.sector}
## Müşteri: ${normalizedData.businessName}
## Müşteri Profili: ${normalizedData.overallProfile}

## Eksenler
- **X Ekseni (${xAxis.label}):** Sol = "${xAxis.lowEnd}" | Sağ = "${xAxis.highEnd}"
- **Y Ekseni (${yAxis.label}):** Alt = "${yAxis.lowEnd}" | Üst = "${yAxis.highEnd}"

Her eksen için koordinatlar -5 ile +5 arasında:
- -5: Tam sol/alt uç
- 0: Orta/nötr
- +5: Tam sağ/üst uç

## Rakip Verileri
${competitorEntries.join('\n\n')}

## Görev
1. Her rakibe X ve Y koordinatı ata (-5 ile +5 arası, 0.5 hassasiyetle)
2. Müşteri (${normalizedData.businessName}) için koordinat öner
3. Boş kalan bölgeleri (sahipsiz niş/fırsat) tespit et
4. En iyi pozisyonu (ideal rekabet boşluğu) belirle

**ÖNEMLİ:** Koordinatlar birbirinden farklı olmalı — tüm rakipleri aynı noktaya koyma. Gerçek farklılıkları yansıt.

JSON formatında cevap ver:
{
  "customerPosition": {
    "name": "${normalizedData.businessName}",
    "x": <sayı>,
    "y": <sayı>,
    "positioning": "<1-2 cümle>",
    "confidence": "high" | "medium" | "low"
  },
  "competitorPositions": [
    {
      "name": "<rakip adı>",
      "x": <sayı>,
      "y": <sayı>,
      "positioning": "<1-2 cümle>",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "gapAnalysis": {
    "unclaimedRegions": ["<bölge açıklaması>", ...],
    "recommendedPosition": {
      "x": <sayı>,
      "y": <sayı>,
      "rationale": "<neden bu koordinat ideal — 2-3 cümle>"
    }
  }
}`;

  type MapResult = {
    customerPosition: PerceptualPosition;
    competitorPositions: PerceptualPosition[];
    gapAnalysis: {
      unclaimedRegions: string[];
      recommendedPosition: { x: number; y: number; rationale: string };
    };
  };

  const result = await generateJSON<MapResult>('flash', prompt, 'perceptualMapper', {
    temperature: 0.3,
    maxOutputTokens: 2048,
  });

  // Clamp coordinates to -5..+5 range
  const clamp = (n: number) => Math.max(-5, Math.min(5, n));

  const clampPosition = (p: PerceptualPosition): PerceptualPosition => ({
    ...p,
    x: clamp(p.x),
    y: clamp(p.y),
  });

  return {
    xAxis,
    yAxis,
    customerPosition: clampPosition(result.customerPosition),
    competitorPositions: (result.competitorPositions || []).map(clampPosition),
    gapAnalysis: {
      unclaimedRegions: result.gapAnalysis?.unclaimedRegions || [],
      recommendedPosition: {
        x: clamp(result.gapAnalysis?.recommendedPosition?.x ?? 0),
        y: clamp(result.gapAnalysis?.recommendedPosition?.y ?? 0),
        rationale: result.gapAnalysis?.recommendedPosition?.rationale || '',
      },
    },
  };
}
