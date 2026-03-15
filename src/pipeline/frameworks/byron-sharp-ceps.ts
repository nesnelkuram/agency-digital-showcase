// Byron Sharp — How Brands Grow
// Category Entry Points (CEPs) & Mental Availability

import type { FrameworkScore } from '../evidence';

/** Sector-specific Category Entry Points */
export const SECTOR_CEPS: Record<string, string[]> = {
  gastronomi: [
    'Özel bir gece planı yaparken',
    'Hızlı ve kaliteli öğle yemeği ararken',
    'Arkadaşlarla buluşma mekanı seçerken',
    'Sosyal medyada yemek fotoğrafı paylaşmak isterken',
    'Yeni tatlar keşfetmek isterken',
    'İş yemeği düzenlerken',
    'Paket sipariş verirken',
    'Özel diyet ihtiyacı olduğunda',
    'Kutlama/doğum günü planlarken',
    'Tatilde yöresel lezzet ararken',
    'Ailece dışarı çıkmak isterken',
    'Brunch planı yaparken',
    'Kahve/tatlı molası verirken',
    'Ev yemeğinden sıkılınca',
    'Romantik akşam yemeği isterken',
  ],
  hospitality: [
    'Tatil planlarken',
    'İş seyahati için otel ararken',
    'Aile tatili düzenlerken',
    'Hafta sonu kaçamağı yaparken',
    'Düğün/organizasyon mekanı ararken',
    'Wellness/spa deneyimi isterken',
    'Doğa tatili planlarken',
    'Şehir turu yaparken',
    'Balayı planlarken',
    'Konferans/toplantı mekanı ararken',
    'Deniz tatili isterken',
    'Kış tatili planlarken',
    'Günübirlik kaçamak yaparken',
    'Yıl dönümü kutlaması planlarken',
    'Uzaktan çalışma mekanı ararken',
  ],
  retail: [
    'Hediye ararken',
    'Mevsimlik alışveriş yaparken',
    'Kampanya/indirim dönemi',
    'Yeni ürün keşfetmek isterken',
    'Kaliteli ürün aradığında',
    'Online alışveriş yaparken',
    'Mağaza deneyimi yaşamak isterken',
    'İade/değişim kolaylığı aradığında',
    'Güvenilir marka aradığında',
    'Bütçe dostu seçenek ararken',
    'Lüks/premium ürün isterken',
    'Arkadaş tavsiyesi üzerine',
    'Sosyal medyada görüp merak edince',
    'Acil ihtiyaç olduğunda',
    'Sadakat programı kullanırken',
  ],
  tech: [
    'Yeni yazılım/araç ararken',
    'Mevcut çözümden memnun olmadığında',
    'Büyüme aşamasında ölçeklendirirken',
    'Maliyet optimizasyonu yaparken',
    'Entegrasyon ihtiyacı olduğunda',
    'Demo/deneme talep ederken',
    'Kullanıcı yorumlarını araştırırken',
    'Karşılaştırma yaparken',
    'Güvenlik endişesi olduğunda',
    'Müşteri desteği gerektiğinde',
    'Yeni özellik talebi olduğunda',
    'Eğitim/onboarding sürecinde',
    'Fiyatlandırma karşılaştırırken',
    'Rakip ürüne geçmeyi düşündüğünde',
    'API/SDK entegrasyonu yaparken',
  ],
  fmcg: [
    'Market rafında seçim yaparken',
    'Yeni ürün denemek isterken',
    'Alışkanlık/otomatik satın almada',
    'Fiyat karşılaştırması yaparken',
    'Promosyon/kampanya gördüğünde',
    'Sağlıklı alternatif aradığında',
    'Marka sadakati hissedildiğinde',
    'Sosyal medyada gördüğünde',
    'Tavsiye üzerine denediğinde',
    'Ambalaj dikkat çektiğinde',
    'Süpermarket dışında görüldüğünde',
    'Mevsimsel ürün aradığında',
  ],
  corporate: [
    'Profesyonel hizmet ararken',
    'Teklif/fiyat talebi oluşturduğunda',
    'Referans araştırırken',
    'İş ortaklığı düşündüğünde',
    'Kriz anında uzman desteği gerektiğinde',
    'Stratejik planlama yaparken',
    'Dijital dönüşüm başlatırken',
    'Mevcut tedarikçiden memnun olmadığında',
    'Sektörel etkinlikte karşılaştığında',
    'LinkedIn üzerinden keşfettiğinde',
  ],
  health: [
    'Sağlık sorunu araştırırken',
    'Doktor/uzman ararken',
    'Online randevu alırken',
    'Tedavi seçeneklerini karşılaştırırken',
    'Güvenilir klinik/hastane ararken',
    'Sigorta kapsamında hizmet ararken',
    'Check-up yaptırmak isterken',
    'İkinci görüş almak isterken',
    'Estetik/kozmetik işlem düşünürken',
    'Yakınına sağlık hizmeti ararken',
  ],
  education: [
    'Kariyer değişikliği düşünürken',
    'Yeni beceri öğrenmek isterken',
    'Çocuğu için okul/kurs ararken',
    'Online eğitim platformu karşılaştırırken',
    'Sertifika/akreditasyon ararken',
    'Kurs ücreti karşılaştırırken',
    'Mezun başarı hikayeleri araştırırken',
    'Ücretsiz deneme/demo isterken',
    'İş güvencesi için eğitim ararken',
    'Hobi olarak öğrenmek isterken',
  ],
};

export interface CEPAssessment {
  sector: string;
  coveredCEPs: string[];        // CEPs the brand is associated with
  strongCEPs: string[];         // CEPs where brand is #1 or #2
  missedCEPs: string[];         // Important CEPs brand is absent from
  competitorDominatedCEPs: Array<{ cep: string; competitor: string }>;
}

export function scoreMentalAvailability(assessment: CEPAssessment): FrameworkScore {
  const sectorCEPs = SECTOR_CEPS[assessment.sector] || [];
  const totalCEPs = Math.max(sectorCEPs.length, 1);
  const coverageRatio = assessment.coveredCEPs.length / totalCEPs;
  const strengthRatio = assessment.strongCEPs.length / Math.max(assessment.coveredCEPs.length, 1);

  // Score: coverage (60%) + strength (40%)
  const score = Math.round((coverageRatio * 60 + strengthRatio * 40));

  return {
    framework: 'Byron Sharp Mental Availability',
    score,
    maxScore: 100,
    rationale: `${assessment.coveredCEPs.length}/${totalCEPs} CEP kapsama (${Math.round(coverageRatio * 100)}%), ${assessment.strongCEPs.length} güçlü CEP, ${assessment.missedCEPs.length} kaçırılan CEP`,
    subscores: {
      coverage: Math.round(coverageRatio * 100),
      strength: Math.round(strengthRatio * 100),
      missed: assessment.missedCEPs.length,
    },
  };
}

export const BYRON_SHARP_PROMPT_SNIPPET = `
## Byron Sharp Mental Availability Değerlendirmesi
Markanın "akla gelme" gücünü Category Entry Points (CEP) ile ölç:

1. **CEP Kapsama:** Bu sektördeki kaç farklı satın alma durumunda marka akla geliyor?
2. **CEP Gücü:** Hangi durumlarda marka İLK akla gelen (#1-2)?
3. **Kaçırılan CEP'ler:** Hangi önemli satın alma durumlarında marka GÖRÜNMEZ?
4. **Rakip Dominansı:** Hangi CEP'lerde rakipler baskın?

Sonuç olarak:
- coveredCEPs: Markanın ilişkilendirildiği satın alma durumları
- strongCEPs: Markanın #1-2 olduğu durumlar
- missedCEPs: Önemli ama kaçırılan durumlar
- competitorDominatedCEPs: Rakiplerin hâkim olduğu durumlar
`;
