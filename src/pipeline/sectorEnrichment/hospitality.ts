import { registerSectorEnrichment } from './types';
import type { SectorEnrichmentModule } from './types';

const hospitality: SectorEnrichmentModule = {
  sector: 'hospitality',
  dataFieldName: 'hospitalityData',

  culturalTensions: [
    {
      expectation: 'Otel "ev gibi rahat" olmalı',
      reality: 'Misafirler evlerinden daha iyi bir deneyim bekliyor — ama "ev" kelimesi lüksü öldürüyor',
      opportunity: 'Ev sıcaklığını lüksle harmanlayan "tanıdık yabancılık" konsepti',
    },
    {
      expectation: 'Booking puanı yüksek olan otel iyidir',
      reality: 'Puanlar manipüle ediliyor, sahte yorumlar artıyor, gezginler güvenini kaybediyor',
      opportunity: 'Radikal şeffaflık: gerçek misafir hikayeleri, filtresiz fotoğraflar, dürüst iletişim',
    },
    {
      expectation: 'Dijitalleşme misafir deneyimini iyileştirir',
      reality: 'Self check-in, QR menü, chatbot — insan teması azalıyor, misafirler yalnız hissediyor',
      opportunity: 'Teknolojiyi görünmez yapıp insan bağlantısını öne çıkaran "high-tech, high-touch" denge',
    },
    {
      expectation: 'Her misafire eşit hizmet verilmeli',
      reality: 'Herkese aynı hizmeti veren otel, kimseyi özel hissettirmiyor',
      opportunity: 'Cesur segmentasyon: "Bu otel herkes için değil" diyebilme özgüveni',
    },
    {
      expectation: 'Sürdürülebilirlik önemli (yeşil yıkama)',
      reality: '"Havlunuzu yere atmayın" tabelası sürdürülebilirlik değil, maliyet düşürme',
      opportunity: 'Gerçek sürdürülebilirlik eylemiyle misafir katılımı (yerel topluluk, karbon dengeleme)',
    },
  ],

  deepResearchSteps: `

ADIM 6 — OTA & KANAL ANALIZI (OTELCILIGE OZEL):
- "$BUSINESS_NAME" oteli Booking.com, TripAdvisor, Google Hotels, Expedia'da ara.
- Her platformdaki PUAN ve YORUM SAYISINI bul (ornegin: Booking 8.5/10, 1200 yorum).
- Olumlu ve olumsuz yorumlardaki TEKRARLAYAN TEMALARI cikart (temizlik, konum, kahvalti, personel vb.).
- Rakip otellerin ayni platformlardaki puanlarini karsilastir.
- Direkt rezervasyon motoru var mi? Booking engine teknolojisi ne?

ADIM 7 — FIYATLAMA & DOLULUK (OTELCILIGE OZEL):
- "$BUSINESS_NAME" icin guncel oda fiyatlarini Booking.com/Google Hotels uzerinden bul.
- Sezonsal fiyat farkliliklarini tespit et (yuksek sezon vs dusuk sezon fark orani).
- Ayni bolgedeki rakip otellerin fiyat araligini karsilastir.
- RevPAR, ADR benchmark verileri bulabilirsen dahil et (STR, TUROFED, TUROB raporlari).
- Oda tipleri ve kapasite (standart, suite, aile, deluxe vb.) bilgilerini listele.

ADIM 8 — MISAFIR PROFILI & SEZONSELLIK (OTELCILIGE OZEL):
- Otelin misafir profili nasil? (is seyahati vs tatil, yerli vs yabanci, aile vs cifter, solo gezgin)
- Yorumlardan ve otel tanitimlarindan misafir segmentlerini cikar.
- Bolgenin sezonsal turizm kaliplari: yuksek/orta/dusuk sezon aylari.
- Ozel etkinlikler ve donemler (Ramazan, yilbasi, kongre/fuar takvimi, yaz tatili).
- Ortalama konaklama suresi tahmini.

ADIM 9 — KANAL KARMASIMI TAHMINI (OTELCILIGE OZEL):
- Otelin OTA bagimliligi ne seviyede? (yuksek/orta/dusuk)
- Direkt web sitesi uzerinden rezervasyon yapisi var mi? (booking engine, fiyat garantisi vb.)
- Google Business Profile durumu: puan, yorum sayisi, fotograflar, soru-cevaplar.
- Email pazarlama / CRM kullaniyor mu?
- Tur operatorleri / seyahat acenteleriyle calisiyor mu?`,

  terminologyOverrides: {
    productLabel: 'Hangi ODA TIPLERI ve HIZMETLERI sunuyor? (standart, suite, deluxe, restoran, spa, hamam, toplanti salonu vb.)',
    priceDetail: ' — gecelik oda ucreti, yuksek/dusuk sezon fiyati',
    positioningExamples: 'butik/luks/is oteli/resort/butce-dostu',
    competitorAnalysisLabel: 'RAKIP OTEL ANALIZI',
    competitorSearchExample: 'Ornek: Eger "Sultanahmet butik otel" ise → "Sultanahmet 4 yildizli butik oteller" ara.',
    competitorMetrics: 'Rakip oda fiyatlarini, Booking puanlarini ve yorum sayilarini karsilastir.',
    competitorStrengthsContext: 'konum, hizmet kalitesi, fiyat, yorum puani, oda sayisi, tesis ozellikleri',
    marketDataFocus: 'Otelin bulundugu bolgenin (sehir/ilce) turizm verileri: yillik turist sayisi, konaklama istatistikleri.',
    audienceLabel: 'Bu otelde gercekte kimler konakliyor? Misafir segmentleri:',
    audienceDetails: [
      'Is seyahati vs tatil orani, yerli vs yabanci orani, aile vs cift vs solo gezgin.',
      'Rezervasyon kanali tercihi (Booking, dogrudan web, Expedia, tur op.).',
      'Ortalama konaklama suresi, harcama profili (oda + F&B + spa).',
    ],
    customerTerm: 'misafirler',
    websiteAnalysisFocus: 'Oda tipleri, fiyat gosterimi, rezervasyon motoru, mobil uyumluluk.',
    researchType: 'OTELCILIK BAZLI',
  },

  extraGroundingQueries: (businessName: string, dateRule: string) => [
    {
      prompt: `"${businessName}" otel yorum puan Booking.com Google TripAdvisor — puan, yorum sayisi, olumlu ve olumsuz yorum temalari, Google Maps puani, yanitlama orani. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-Reviews',
    },
    {
      prompt: `"${businessName}" otel oda fiyat gecelik ucret oda tipleri — standart, suite, deluxe fiyatlari, sezonsal fiyat farki, yuksek sezon dusuk sezon aylari. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-Pricing',
    },
  ],

  groundingPromptOverrides: {
    competitor: (businessName: string, dateRule: string) =>
      `Sen bir otelcilik sektor arastirmacisisin. "${businessName}" ile ayni bolge ve segmentte rekabet eden otelleri arastir. Her rakip icin: otel adi, web sitesi, yildiz/segment (butik/luks/is), oda sayisi, Booking.com puani, fiyat araligi, guclu/zayif yanlar bul. EN AZ 3, EN FAZLA 7 rakip otel. Turkce yaz.${dateRule}`,
    market: (businessName: string, dateRule: string) =>
      `Sen bir turizm ve otelcilik pazar arastirmacisisin. "${businessName}" otelinin bulundugu bolge icin: yillik turist sayisi, ortalama doluluk orani, RevPAR ve ADR benchmark degerleri, OTA komisyon oranlari, direkt rezervasyon trendleri, sezonsal turizm kaliplari arastir. Somut rakamlar ver. Turkce yaz.${dateRule}`,
    trend: (businessName: string, dateRule: string) =>
      `Otelcilik sektoru "${businessName}" icin: OTA vs direkt rezervasyon stratejisi, dijital pazarlama trendleri (kisa video, UGC, AI kisisellistirme), surdurulebilirlik/wellness trendleri, misafir deneyimi yenilikleri, itibar yonetimi en iyi uygulamalari arastir. Turkce yaz.${dateRule}`,
  },

  extractionSchemaFragment: `,
  "hospitalityData": {
    "reviewScores": {
      "booking": { "score": "Booking.com puani (orn: 8.5/10)", "reviewCount": "Yorum sayisi" },
      "google": { "score": "Google puani (orn: 4.5/5)", "reviewCount": "Yorum sayisi" },
      "tripAdvisor": { "score": "TripAdvisor puani", "reviewCount": "Yorum sayisi" }
    },
    "pricingData": {
      "averageDailyRate": "Ortalama gecelik fiyat (TL veya USD)",
      "seasonalRange": { "low": "Dusuk sezon fiyati", "high": "Yuksek sezon fiyati" },
      "competitorPriceRange": "Rakip fiyat araligi"
    },
    "channelMix": {
      "otaDependency": "yuksek/orta/dusuk",
      "directBookingCapability": "Direkt rezervasyon altyapisi aciklamasi",
      "bookingEngineType": "Rezervasyon motoru teknolojisi (varsa)"
    },
    "seasonality": {
      "highSeason": ["Yuksek sezon aylari"],
      "lowSeason": ["Dusuk sezon aylari"],
      "specialEvents": ["Ozel etkinlikler/donemler"]
    },
    "guestProfile": {
      "domesticVsInternational": "Yerli vs yabanci misafir orani",
      "businessVsLeisure": "Is vs tatil misafir orani",
      "averageStayDuration": "Ortalama konaklama suresi",
      "topSegments": ["Misafir segmenti 1", "Misafir segmenti 2"]
    },
    "roomTypes": [{ "type": "Oda tipi", "priceRange": "Fiyat araligi" }],
    "hotelKPIs": {
      "revPAR": "Revenue Per Available Room (varsa)",
      "adr": "Average Daily Rate (varsa)",
      "occupancyRate": "Doluluk orani (varsa)",
      "directBookingRatio": "Direkt rezervasyon orani (varsa)"
    },
    "googleBusinessProfile": {
      "rating": "Google Maps puani (orn: 4.5/5)",
      "reviewCount": "Google yorum sayisi",
      "photoCount": "Fotograf sayisi (varsa)",
      "responseRate": "Yorum yanitlama orani (varsa)",
      "topCategories": ["Google kategorileri"]
    },
    "reviewSentiment": {
      "positiveThemes": ["Olumlu yorum temalari — orn: temizlik, konum, kahvalti"],
      "negativeThemes": ["Olumsuz yorum temalari — orn: gurultu, wifi, park"],
      "overallSentiment": "Genel duygu tonu (agirlikli pozitif/notr/negatif)"
    }
  }`,

  extractionRules: `
6. OTELCILIK VERILERINI AYRI CIKAR: reviewScores, pricingData, channelMix, seasonality, guestProfile, roomTypes, hotelKPIs, googleBusinessProfile, reviewSentiment alanlarini doldur.
7. Booking.com, TripAdvisor, Google puanlari metinde varsa MUTLAKA hospitalityData.reviewScores'a ekle.
8. Oda fiyatlari ve sezonsal farklar metinde varsa MUTLAKA hospitalityData.pricingData'ya ekle.
9. Misafir profili (yerli/yabanci, is/tatil) bilgisi varsa MUTLAKA hospitalityData.guestProfile'a ekle.
10. Olumlu ve olumsuz yorum temalari (temizlik, konum, kahvalti, gurultu vb.) varsa MUTLAKA hospitalityData.reviewSentiment'a ekle.
11. hospitalityData icindeki her alan icin: veri bulunamadiysa "Veri bulunamadi" yaz, ALANI SILME.`,

  formatForSynthesizer: (hd: any): string => {
    if (!hd) return '';
    const parts: string[] = [];
    if (hd.reviewScores) {
      const scores: string[] = [];
      if (hd.reviewScores.booking?.score) scores.push(`Booking: ${hd.reviewScores.booking.score} (${hd.reviewScores.booking.reviewCount || '?'} yorum)`);
      if (hd.reviewScores.google?.score) scores.push(`Google: ${hd.reviewScores.google.score} (${hd.reviewScores.google.reviewCount || '?'} yorum)`);
      if (hd.reviewScores.tripAdvisor?.score) scores.push(`TripAdvisor: ${hd.reviewScores.tripAdvisor.score} (${hd.reviewScores.tripAdvisor.reviewCount || '?'} yorum)`);
      if (scores.length) parts.push(`Review Puanlari: ${scores.join(', ')}`);
    }
    if (hd.pricingData) {
      parts.push(`Fiyatlama: ADR ${hd.pricingData.averageDailyRate || 'N/A'}, Sezon araligi: ${hd.pricingData.seasonalRange?.low || '?'} — ${hd.pricingData.seasonalRange?.high || '?'}, Rakip fiyat araligi: ${hd.pricingData.competitorPriceRange || 'N/A'}`);
    }
    if (hd.channelMix) {
      parts.push(`Kanal Karmasimi: OTA bagimliligi ${hd.channelMix.otaDependency}, Direkt rezervasyon: ${hd.channelMix.directBookingCapability}`);
    }
    if (hd.guestProfile) {
      parts.push(`Misafir Profili: Yerli/Yabanci ${hd.guestProfile.domesticVsInternational}, Is/Tatil ${hd.guestProfile.businessVsLeisure}, Ort. konaklama ${hd.guestProfile.averageStayDuration}`);
      if (hd.guestProfile.topSegments?.length) parts.push(`  Ana segmentler: ${hd.guestProfile.topSegments.join(', ')}`);
    }
    if (hd.seasonality) {
      if (hd.seasonality.highSeason?.length) parts.push(`Yuksek Sezon: ${hd.seasonality.highSeason.join(', ')}`);
      if (hd.seasonality.lowSeason?.length) parts.push(`Dusuk Sezon: ${hd.seasonality.lowSeason.join(', ')}`);
      if (hd.seasonality.specialEvents?.length) parts.push(`Ozel Donemler: ${hd.seasonality.specialEvents.join(', ')}`);
    }
    if (hd.roomTypes?.length) {
      parts.push(`Oda Tipleri: ${hd.roomTypes.map((r: any) => `${r.type}${r.priceRange ? ` (${r.priceRange})` : ''}`).join(', ')}`);
    }
    if (hd.hotelKPIs) {
      const kpis: string[] = [];
      if (hd.hotelKPIs.revPAR) kpis.push(`RevPAR: ${hd.hotelKPIs.revPAR}`);
      if (hd.hotelKPIs.adr) kpis.push(`ADR: ${hd.hotelKPIs.adr}`);
      if (hd.hotelKPIs.occupancyRate) kpis.push(`Doluluk: ${hd.hotelKPIs.occupancyRate}`);
      if (hd.hotelKPIs.directBookingRatio) kpis.push(`Direkt oran: ${hd.hotelKPIs.directBookingRatio}`);
      if (kpis.length) parts.push(`Otel KPI'lari: ${kpis.join(', ')}`);
    }
    if (hd.googleBusinessProfile?.rating) {
      parts.push(`Google Business: ${hd.googleBusinessProfile.rating} (${hd.googleBusinessProfile.reviewCount || '?'} yorum, ${hd.googleBusinessProfile.photoCount || '?'} foto)`);
    }
    if (hd.reviewSentiment) {
      if (hd.reviewSentiment.positiveThemes?.length) parts.push(`Olumlu yorum temalari: ${hd.reviewSentiment.positiveThemes.join(', ')}`);
      if (hd.reviewSentiment.negativeThemes?.length) parts.push(`Olumsuz yorum temalari: ${hd.reviewSentiment.negativeThemes.join(', ')}`);
    }
    if (!parts.length) return '';
    return `\n\n## Otelcilik Verileri (Sektor-Spesifik)\n${parts.join('\n')}`;
  },
};

registerSectorEnrichment(hospitality);

export default hospitality;
