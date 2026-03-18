import type { StrategistOutput, SynthesizedAnalysis } from '../types';
import { generateJSON } from '../geminiClient';

export interface RoadmapService {
  category: string;      // from services.ts category
  name: string;
  rationale: string;     // why this service in this phase
  expectedImpact: string;
  priority: 'kritik' | 'onemli' | 'opsiyonel';
}

export interface RoadmapPhase {
  label: string;           // "Kimlik İnşası", "Dijital Motor", "Büyüme"
  durationDays: number;
  focus: string;
  services: RoadmapService[];
  milestone: string;
}

export interface IntibaRoadmap {
  rationale: string;
  phases: RoadmapPhase[];
}

const INTIBA_SERVICE_CATEGORIES = [
  {
    id: 'brand_strategy',
    label: 'Marka Stratejisi',
    description: 'Marka kimliği, konumlandırma, arketip geliştirme, isim/slogan danışmanlığı',
  },
  {
    id: 'graphic_design',
    label: 'Grafik Tasarım',
    description: 'Logo, kurumsal kimlik, sosyal medya görselleri, baskı materyalleri',
  },
  {
    id: 'photography',
    label: 'Fotoğraf Çekimi',
    description: 'Ürün, mekan, portre, kurumsal fotoğraf projeleri',
  },
  {
    id: 'video_production',
    label: 'Video Prodüksiyon',
    description: 'Tanıtım filmi, reklam spotu, sosyal medya videosu, marka filmi',
  },
  {
    id: 'social_media',
    label: 'Sosyal Medya Yönetimi',
    description: 'İçerik planlama, yönetimi, topluluk moderasyonu, kampanya yürütme',
  },
  {
    id: 'digital_marketing',
    label: 'Dijital Pazarlama',
    description: 'Google Ads, Meta Ads, SEO, e-posta pazarlama, performans kampanyaları',
  },
  {
    id: 'event_coverage',
    label: 'Etkinlik Kapsamı',
    description: 'Açılış, lansman, fuar, konferans fotoğraf ve video kapsamı',
  },
  {
    id: 'drone_shooting',
    label: 'Drone Çekimi',
    description: 'Hava fotoğrafı ve video, mimari, turizm, gayrimenkul çekimleri',
  },
  {
    id: 'scriptwriting',
    label: 'Senaryo Yazarlığı',
    description: 'Reklam senaryosu, brand story, video script, içerik metni',
  },
  {
    id: 'ecommerce_content',
    label: 'E-Ticaret İçeriği',
    description: 'Ürün fotoğrafı, 360° çekim, marketplace görselleri, katalog',
  },
];

export async function generateIntibaRoadmap(
  strategyOutput: StrategistOutput,
  synthesis?: SynthesizedAnalysis | null,
): Promise<IntibaRoadmap> {
  const brandMaturity = synthesis?.brandPersonality
    ? (synthesis as any).brandMaturity?.level
    : undefined;

  const categoriesText = INTIBA_SERVICE_CATEGORIES.map(
    (c) => `- **${c.id}** (${c.label}): ${c.description}`,
  ).join('\n');

  const positioningContext = [
    `Arketip: ${strategyOutput.archetype}`,
    `Konumlandırma: ${strategyOutput.positioningStatement}`,
    `Farklılaştırıcı: ${strategyOutput.differentiator}`,
    `Rekabet avantajı: ${strategyOutput.competitiveAdvantage}`,
    brandMaturity ? `Marka olgunluğu: ${brandMaturity}` : '',
    strategyOutput.valueLevel ? `Değer seviyesi: ${strategyOutput.valueLevel}` : '',
    strategyOutput.brandEnemy ? `Marka düşmanı: ${strategyOutput.brandEnemy}` : '',
    strategyOutput.transformationStatement
      ? `Dönüşüm: ${strategyOutput.transformationStatement}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `Sen Intiba Ajans'ın kıdemli strateji direktörüsün. Bir müşteri için 3 fazlı, somut hizmet yol haritası oluşturuyorsun.

## Müşteri Strateji Özeti
${positioningContext}

## Intiba'nın Hizmet Kategorileri
${categoriesText}

## Yol Haritası Kuralları
- **Faz 1 (0-90 gün) — Kimlik İnşası:** Temel marka kimliği ve görsel dil oluşturma. Dijital varlık hazırlığı.
- **Faz 2 (90-180 gün) — Dijital Motor:** İçerik üretimi ve dijital pazarlama makinesi kurma.
- **Faz 3 (180-365 gün) — Büyüme:** Ölçeklendirme, optimizasyon, yeni kanallar.

Her fazda 2-4 Intiba hizmeti öner. Hizmet seçimi:
1. Müşterinin marka olgunluk seviyesine uygun olmalı
2. Konumlandırma stratejisiyle tutarlı olmalı
3. Mantıksal sırayla ilerlemeli (kimlik→içerik→büyüme)
4. Kritik/önemli/opsiyonel öncelik ata

JSON formatında YOL HARİTASI yaz:
{
  "rationale": "<neden bu sırayla bu hizmetler — 2-3 cümle>",
  "phases": [
    {
      "label": "Kimlik İnşası",
      "durationDays": 90,
      "focus": "<bu fazın ana hedefi — 1 cümle>",
      "services": [
        {
          "category": "<hizmet kategorisi id>",
          "name": "<somut hizmet adı>",
          "rationale": "<neden bu fazda — müşteri stratejisiyle bağlantı>",
          "expectedImpact": "<ne değişecek — somut sonuç>",
          "priority": "kritik" | "onemli" | "opsiyonel"
        }
      ],
      "milestone": "<bu fazın sonunda ne elde edilmiş olacak>"
    },
    {
      "label": "Dijital Motor",
      "durationDays": 90,
      ...
    },
    {
      "label": "Büyüme",
      "durationDays": 185,
      ...
    }
  ]
}`;

  const result = await generateJSON<IntibaRoadmap>('flash', prompt, 'roadmapGenerator', {
    temperature: 0.4,
    maxOutputTokens: 3000,
  });

  // Validate and sanitize
  const phases = (result.phases || []).map((phase) => ({
    ...phase,
    services: (phase.services || []).map((svc) => ({
      ...svc,
      category: svc.category || 'brand_strategy',
      priority: (['kritik', 'onemli', 'opsiyonel'] as const).includes(svc.priority)
        ? svc.priority
        : 'onemli',
    })),
  }));

  return {
    rationale: result.rationale || '',
    phases,
  };
}
