import { registerSectorEnrichment } from './types';
import type { SectorEnrichmentModule } from './types';

const gastronomi: SectorEnrichmentModule = {
  sector: 'gastronomi',
  dataFieldName: 'gastronomiData',
  frameworkReferences: ['Byron Sharp CEPs', 'Hook Model', 'Cialdini', 'Kano Model'],
  culturalBrandingLens: 'Yemek kültürü, "instagramlık" deneyim vs otantik lezzet gerilimi, hızlı tüketim vs slow food',

  culturalTensions: [
    {
      expectation: 'İyi yemek pahalı olmalı',
      reality: 'Fine dining kültürü çöküyor, insanlar samimi ve dürüst mekanlara yöneliyor',
      opportunity: 'Fiyatla değil, deneyimin dürüstlüğüyle konumlanan "accessible excellence"',
    },
    {
      expectation: 'Instagram\'da güzel görünen yemek iyi yemektir',
      reality: 'Görsel odaklı menüler lezzetten kopuyor, "instagramlık" tabaklar tadı yok',
      opportunity: 'Lezzet önce, görsel sonra — "çirkin ama muhteşem" özgünlüğü',
    },
    {
      expectation: 'Paket servis bir zorunluluk',
      reality: 'Komisyonlar kârı eritiyor, yemek kalitesi düşüyor, marka deneyimi kayboluyor',
      opportunity: 'Yerinde deneyimi öyle güçlü yap ki müşteri "oraya gitmek" istesin',
    },
    {
      expectation: 'Müşteri her zaman haklıdır',
      reality: 'Herkesin beğenisine göre menü yapmak, mutfağın ruhunu öldürüyor',
      opportunity: 'Şefin vizyonuna sadık kalarak "bu menü biziz" diyebilme cesareti',
    },
    {
      expectation: 'Zincirler tutarlılığı sağlar',
      reality: 'İnsanlar kopya deneyimlerden bıktı, "sadece burada" olanı arıyor',
      opportunity: 'Tekrarlanamaz yerellik: o mahalle, o çiftçi, o mevsim',
    },
  ],

  deepResearchSteps: `

ADIM 6 — YORUM & ITIBAR ANALIZI (GASTRONOMIYE OZEL):
- "$BUSINESS_NAME" restoranini Google Maps, TripAdvisor, Foursquare, Yemeksepeti/Getir'de ara.
- Her platformdaki PUAN ve YORUM SAYISINI bul.
- Olumlu ve olumsuz yorumlardaki TEKRARLAYAN TEMALARI cikart (lezzet, servis, ambiyans, fiyat/performans vb.).
- Rakip restoranlarin ayni platformlardaki puanlarini karsilastir.

ADIM 7 — MENU & FIYATLAMA ANALIZI (GASTRONOMIYE OZEL):
- "$BUSINESS_NAME" menusunu bul (web sitesi, Yemeksepeti, Google).
- Menu genisligi: kac kategori, kac urun?
- Fiyat araligi: en dusuk — en yuksek urun fiyati.
- Ortalama kisi basi hesap tahmini.
- Ozel menuler var mi? (tadim menusu, brunch, set menu, sezonsal menu)
- Rakiplerin fiyat araligina karsilastir.

ADIM 8 — MUSTERI PROFILI & TRAFIK (GASTRONOMIYE OZEL):
- Restoranin musteri profili nasil? (aile, genc, is yemegi, turist, ozel gun)
- Yogun saatler/gunler: hafta ici vs hafta sonu, ogle vs aksam.
- Rezervasyon sistemi kullaniyor mu?
- Paket servis/online siparis yapiyor mu? Hangi platformlarda?

ADIM 9 — PAKET SERVIS & DIJITAL SIPARIS (GASTRONOMIYE OZEL):
- Yemeksepeti, Getir, Trendyol Yemek gibi platformlarda var mi?
- Platform komisyon yapisi nasil etkiliyor?
- Kendi online siparis sistemi var mi?
- Cloud kitchen / sadece paket servis modeli mi?`,

  terminologyOverrides: {
    productLabel: 'Hangi YEMEK ve ICERIK KATEGORILERI sunuyor? (ana yemek, mezeler, tatlilar, icecekler, brunch, set menu vb.)',
    priceDetail: ' — kisi basi ortalama hesap, menu fiyat araligi',
    positioningExamples: 'fine-dining/casual/fast-casual/cafe/sokak-lezzeti/cloud-kitchen',
    competitorAnalysisLabel: 'RAKIP RESTORAN ANALIZI',
    competitorSearchExample: 'Ornek: Eger "Karakoy brunch" ise → "Karakoy kahvalti restoran en iyi" ara.',
    competitorMetrics: 'Rakip menu fiyatlarini, Google/TripAdvisor puanlarini ve yorum sayilarini karsilastir.',
    competitorStrengthsContext: 'konum, lezzet kalitesi, servis hizi, ambiyans, fiyat/performans, menu cesitliligi',
    marketDataFocus: 'Restoranin bulundugu bolgenin (semt/ilce) yeme-icme pazar verileri: restoran yogunlugu, tuketici harcamalari.',
    audienceLabel: 'Bu restoranda gercekte kimler yemek yiyor? Musteri segmentleri:',
    audienceDetails: [
      'Aile vs genc vs is yemegi vs turist vs ozel gun kutlamasi.',
      'Hafta ici vs hafta sonu, ogle vs aksam yogunluk farki.',
      'Ortalama kisi basi hesap, ziyaret sikligi.',
    ],
    customerTerm: 'musteriler',
    websiteAnalysisFocus: 'Menu gosterimi, online rezervasyon, paket servis entegrasyonu, mobil uyumluluk.',
    researchType: 'GASTRONOMI BAZLI',
  },

  extraGroundingQueries: (businessName: string, dateRule: string) => [
    {
      prompt: `"${businessName}" restoran yorum puan Google Maps TripAdvisor Foursquare — puan, yorum sayisi, olumlu ve olumsuz yorum temalari. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-Reviews',
    },
    {
      prompt: `"${businessName}" restoran menu fiyat kisi basi hesap — ana yemek fiyat araligi, set menu fiyatlari, paket servis fiyatlari. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-Menu',
    },
  ],

  groundingPromptOverrides: {
    competitor: (businessName: string, dateRule: string) =>
      `Sen bir gastronomi sektor arastirmacisisin. "${businessName}" ile ayni bolge ve segmentte rekabet eden restoranlari arastir. Her rakip icin: restoran adi, konsept (fine dining/casual/cafe), Google puani, fiyat araligi, guclu/zayif yanlar bul. EN AZ 3, EN FAZLA 7 rakip. Turkce yaz.${dateRule}`,
    market: (businessName: string, dateRule: string) =>
      `Sen bir gastronomi pazar arastirmacisisin. "${businessName}" restoraninin bulundugu bolge icin: restoran yogunlugu, kisi basi dis yemek harcamasi, paket servis pazar buyumesi, gastronomi trendleri arastir. Somut rakamlar ver. Turkce yaz.${dateRule}`,
    trend: (businessName: string, dateRule: string) =>
      `Gastronomi sektoru "${businessName}" icin: paket servis vs yerinde yeme trendleri, sosyal medya etkisi (food influencer, Instagram yemek icerik), surdurulebilir gastronomi, yerel/mevsimsel menu trendleri, restoran teknolojisi (QR menu, online siparis). Turkce yaz.${dateRule}`,
  },

  extractionSchemaFragment: `,
  "gastronomiData": {
    "reviewScores": {
      "google": { "score": "Google puani (orn: 4.3/5)", "reviewCount": "Yorum sayisi" },
      "tripAdvisor": { "score": "TripAdvisor puani", "reviewCount": "Yorum sayisi" },
      "foursquare": { "score": "Foursquare puani", "reviewCount": "Yorum sayisi" }
    },
    "menuAnalysis": {
      "categoryCount": "Menu kategori sayisi",
      "totalItems": "Toplam menu ogesi tahmini",
      "priceRange": { "low": "En dusuk fiyat", "high": "En yuksek fiyat" },
      "avgCheckPerPerson": "Kisi basi ortalama hesap",
      "specialMenus": ["Ozel menu tipleri (tadim, brunch, set)"],
      "signatureDishes": ["Imza yemekleri (varsa)"]
    },
    "deliveryPresence": {
      "platforms": ["Aktif oldugu platformlar (Yemeksepeti, Getir, vb.)"],
      "hasOwnOrderSystem": "Kendi online siparis sistemi var mi",
      "deliveryRatio": "Paket servis orani tahmini"
    },
    "customerProfile": {
      "peakHours": "Yogun saatler (ogle/aksam, hafta ici/sonu)",
      "primarySegments": ["Ana musteri segmentleri"],
      "avgVisitFrequency": "Ortalama ziyaret sikligi",
      "reservationSystem": "Rezervasyon sistemi var mi"
    },
    "reviewSentiment": {
      "positiveThemes": ["Olumlu yorum temalari — orn: lezzet, servis, ambiyans"],
      "negativeThemes": ["Olumsuz yorum temalari — orn: bekleme, fiyat, porsiyon"],
      "overallSentiment": "Genel duygu tonu"
    }
  }`,

  extractionRules: `
6. GASTRONOMI VERILERINI AYRI CIKAR: reviewScores, menuAnalysis, deliveryPresence, customerProfile, reviewSentiment alanlarini doldur.
7. Google, TripAdvisor, Foursquare puanlari metinde varsa MUTLAKA gastronomiData.reviewScores'a ekle.
8. Menu fiyatlari ve kisi basi hesap bilgisi metinde varsa MUTLAKA gastronomiData.menuAnalysis'e ekle.
9. Paket servis platformlari bilgisi metinde varsa MUTLAKA gastronomiData.deliveryPresence'a ekle.
10. Yorum temalari (lezzet, servis, ambiyans vb.) varsa MUTLAKA gastronomiData.reviewSentiment'a ekle.
11. gastronomiData icindeki her alan icin: veri bulunamadiysa "Veri bulunamadi" yaz, ALANI SILME.`,

  formatForSynthesizer: (gd: any): string => {
    if (!gd) return '';
    const parts: string[] = [];
    if (gd.reviewScores) {
      const scores: string[] = [];
      if (gd.reviewScores.google?.score) scores.push(`Google: ${gd.reviewScores.google.score} (${gd.reviewScores.google.reviewCount || '?'} yorum)`);
      if (gd.reviewScores.tripAdvisor?.score) scores.push(`TripAdvisor: ${gd.reviewScores.tripAdvisor.score} (${gd.reviewScores.tripAdvisor.reviewCount || '?'} yorum)`);
      if (gd.reviewScores.foursquare?.score) scores.push(`Foursquare: ${gd.reviewScores.foursquare.score}`);
      if (scores.length) parts.push(`Review Puanlari: ${scores.join(', ')}`);
    }
    if (gd.menuAnalysis) {
      parts.push(`Menu: ${gd.menuAnalysis.categoryCount || '?'} kategori, kisi basi ort. ${gd.menuAnalysis.avgCheckPerPerson || 'N/A'}, fiyat araligi: ${gd.menuAnalysis.priceRange?.low || '?'} — ${gd.menuAnalysis.priceRange?.high || '?'}`);
      if (gd.menuAnalysis.signatureDishes?.length) parts.push(`  Imza yemekleri: ${gd.menuAnalysis.signatureDishes.join(', ')}`);
    }
    if (gd.deliveryPresence) {
      parts.push(`Paket Servis: ${gd.deliveryPresence.platforms?.join(', ') || 'Yok'}, Kendi sistemi: ${gd.deliveryPresence.hasOwnOrderSystem || 'N/A'}`);
    }
    if (gd.customerProfile) {
      parts.push(`Musteri Profili: ${gd.customerProfile.primarySegments?.join(', ') || 'N/A'}, Yogun: ${gd.customerProfile.peakHours || 'N/A'}`);
    }
    if (gd.reviewSentiment) {
      if (gd.reviewSentiment.positiveThemes?.length) parts.push(`Olumlu temalar: ${gd.reviewSentiment.positiveThemes.join(', ')}`);
      if (gd.reviewSentiment.negativeThemes?.length) parts.push(`Olumsuz temalar: ${gd.reviewSentiment.negativeThemes.join(', ')}`);
    }
    if (!parts.length) return '';
    return `\n\n## Gastronomi Verileri (Sektor-Spesifik)\n${parts.join('\n')}`;
  },
};

registerSectorEnrichment(gastronomi);

export default gastronomi;
