// Aaker Brand Identity System
// 4 perspectives: Brand-as-Product, Brand-as-Organization, Brand-as-Person, Brand-as-Symbol
// + Brand Personality 5 dimensions (Sincerity, Excitement, Competence, Sophistication, Ruggedness)

import type { FrameworkScore } from '../evidence';

export interface AakerPersonalityScores {
  sincerity: number;      // 0-20: Down-to-earth, honest, wholesome, cheerful
  excitement: number;     // 0-20: Daring, spirited, imaginative, up-to-date
  competence: number;     // 0-20: Reliable, intelligent, successful
  sophistication: number; // 0-20: Upper class, charming
  ruggedness: number;     // 0-20: Outdoorsy, tough
}

export interface AakerIdentityAssessment {
  brandAsProduct: {
    scope: number;           // 0-5: Product category coverage
    attributes: number;      // 0-5: Quality/value perception
    uses: number;            // 0-5: Use occasions clarity
    users: number;           // 0-5: User profile clarity
    countryOfOrigin: number; // 0-5: Geographic association strength
  };
  brandAsOrganization: {
    attributes: number;      // 0-5: Organizational values clarity
    localVsGlobal: number;   // 0-5: Local/global positioning clarity
  };
  brandAsPerson: {
    personality: AakerPersonalityScores;
    relationship: number;    // 0-10: Brand-customer relationship strength
  };
  brandAsSymbol: {
    visualImagery: number;   // 0-5: Visual identity strength
    heritage: number;        // 0-5: Brand heritage/legacy
  };
  coreVsExtended: {
    coreClarity: number;     // 0-10: How clear is the core identity?
    extendedConsistency: number; // 0-10: Extended elements consistent with core?
  };
}

export function scoreAakerPersonality(scores: AakerPersonalityScores): FrameworkScore {
  const total = scores.sincerity + scores.excitement + scores.competence +
    scores.sophistication + scores.ruggedness;

  // Dominant dimension
  const dimensions = Object.entries(scores) as [string, number][];
  const dominant = dimensions.sort((a, b) => b[1] - a[1])[0];

  const DIMENSION_LABELS: Record<string, string> = {
    sincerity: 'Samimiyet',
    excitement: 'Heyecan',
    competence: 'Yetkinlik',
    sophistication: 'Sofistike',
    ruggedness: 'Sağlamlık',
  };

  return {
    framework: 'Aaker Brand Personality',
    score: total,
    maxScore: 100,
    rationale: `Baskın boyut: ${DIMENSION_LABELS[dominant[0]]} (${dominant[1]}/20). Samimiyet: ${scores.sincerity}, Heyecan: ${scores.excitement}, Yetkinlik: ${scores.competence}, Sofistike: ${scores.sophistication}, Sağlamlık: ${scores.ruggedness}`,
    subscores: scores,
  };
}

/** Map Aaker personality dimensions to Jung archetypes */
export const PERSONALITY_TO_ARCHETYPE: Record<string, string[]> = {
  sincerity: ['Bakıcı', 'Sıradan Adam', 'Masum'],
  excitement: ['Kahraman', 'Sihirbaz', 'Asi'],
  competence: ['Bilge', 'Kral', 'Kahraman'],
  sophistication: ['Aşık', 'Kral', 'Sihirbaz'],
  ruggedness: ['Kaşif', 'Asi', 'Kahraman'],
};

export const AAKER_PROMPT_SNIPPET = `
## Aaker Marka Kişiliği 5 Boyut Puanlaması
Her boyutu 0-20 arasında puanla. Arketip seçimi bu puanlamanın SONUCU olarak çıkmalı:

**1. Samimiyet / Sincerity (0-20):** Dürüst, samimi, sıcak, yerli
   - 0-5: Soğuk/mesafeli, güven inşa edilmemiş
   - 6-10: Orta düzey samimiyet
   - 11-15: Sıcak ve güvenilir
   - 16-20: Topluluk hissi yaratan, "aile gibi"

**2. Heyecan / Excitement (0-20):** Cesur, enerjik, yaratıcı, güncel
   - 0-5: Sıkıcı, geleneksel
   - 6-10: Standart enerji
   - 11-15: Enerjik ve yenilikçi
   - 16-20: Trend belirleyen, provokatif

**3. Yetkinlik / Competence (0-20):** Güvenilir, zeki, başarılı
   - 0-5: Yetkinlik kanıtlanmamış
   - 6-10: Temel yetkinlik var
   - 11-15: Sektörde saygın
   - 16-20: Otorite, referans noktası

**4. Sofistike / Sophistication (0-20):** Üst sınıf, çekici, zarif
   - 0-5: Sade/bütçe odaklı
   - 6-10: Orta segment
   - 11-15: Premium hissi
   - 16-20: Lüks, ulaşılmaz

**5. Sağlamlık / Ruggedness (0-20):** Dayanıklı, güçlü, doğal
   - 0-5: Kırılgan/geçici
   - 6-10: Normal dayanıklılık
   - 11-15: Güçlü ve sağlam
   - 16-20: Aşırı dayanıklı, doğayla bağlantılı

**Arketip Türetme:** En yüksek 2 boyutun kesişimine göre arketip belirle:
- Samimiyet+Yetkinlik → Bakıcı veya Bilge
- Heyecan+Sağlamlık → Kaşif veya Asi
- Sofistike+Heyecan → Sihirbaz veya Aşık
- Yetkinlik+Sofistike → Kral
`;
