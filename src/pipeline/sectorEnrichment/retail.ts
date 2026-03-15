import { registerSectorEnrichment } from './types';
import type { SectorEnrichmentModule } from './types';

const retail: SectorEnrichmentModule = {
  sector: 'retail',
  dataFieldName: 'retailData',

  culturalTensions: [
    {
      expectation: 'Online alışveriş her şeyi çözdü',
      reality: 'İade oranları %30+, müşteri ürünü görmeden güvenemiyor, deneyim eksik',
      opportunity: 'Fiziksel mağazayı "deneyim merkezi"ne dönüştüren phygital strateji',
    },
    {
      expectation: 'Daha fazla seçenek = daha iyi',
      reality: 'Seçenek felci (paradox of choice) — müşteri 100 ürün arasında kaybolup hiçbirini almıyor',
      opportunity: 'Küratörlük: "Sizin için seçtik" güveni, az ama doğru ürün',
    },
    {
      expectation: 'İndirim müşteriyi çeker',
      reality: 'Sürekli indirim marka değerini eritiyor, müşteri tam fiyat ödemeyi reddediyor',
      opportunity: 'Değer odaklı fiyatlama: indirim yerine eklenen değer (kişiselleştirme, özel servis)',
    },
    {
      expectation: 'Sadakat kartı = sadakat',
      reality: 'Herkesin cüzdanında 10 kart var, hiçbiri gerçek sadakat yaratmıyor',
      opportunity: 'Topluluk temelli sadakat: müşterinin markayı sahiplenmesi, puan değil aidiyet',
    },
    {
      expectation: 'Hızlı teslimat en önemli kriter',
      reality: 'Aynı gün teslimat beklentisi sürdürülebilir değil, marjları öldürüyor',
      opportunity: '"Beklemeye değer" ürün ve deneyim — slow commerce hareketi',
    },
  ],

  frameworkReferences: ['Aaker Identity', 'Fogg B=MAP', 'Kano Model', 'Byron Sharp CEPs'],
  culturalBrandingLens: 'Online vs mağaza deneyimi, sürdürülebilirlik baskısı, "ucuz ama kaliteli" paradoksu',

  deepResearchSteps: `

ADIM 6 — E-TICARET & ONLINE VARLIK (PERAKENDEYE OZEL):
- "$BUSINESS_NAME" markasini Trendyol, Hepsiburada, Amazon.com.tr, N11 gibi pazaryerlerinde ara.
- Her platformdaki MAGAZA PUANI, URUN SAYISI ve YORUM SAYISINI bul.
- Kendi e-ticaret sitesi var mi? Kullandigi altyapi (Shopify, WooCommerce, Ikas, vb.)?
- Online satis kanali vs fiziksel magaza orani tahmini.

ADIM 7 — FIYAT KONUMLANDIRMA & URUN ANALIZI (PERAKENDEYE OZEL):
- "$BUSINESS_NAME" urun fiyat araligini bul (en dusuk — en yuksek).
- Rakip markalarin benzer urunlerdeki fiyatlarini karsilastir.
- Urun kategorileri ve derinligi: kac kategori, kac SKU tahmini?
- Ozel kampanya/indirim stratejisi (sezonsal indirim, sadakat programi, ucretsiz kargo vb.)?

ADIM 8 — MUSTERI DENEYIMI & MAGAZA KONSEPTI (PERAKENDEYE OZEL):
- Fiziksel magaza sayisi ve konumlari.
- Magaza konsepti ve deneyimi nasil? (showroom, butik, chain store, pop-up)
- Musteri yorumlarindan tekrarlayan temalar (kalite, fiyat/performans, iade sureci vb.).
- Sadakat/CRM programi var mi?

ADIM 9 — OMNICHANNEL & LOJISTIK (PERAKENDEYE OZEL):
- Online siparis + magazadan teslim (click & collect) var mi?
- Kargo/teslimat suresi ve maliyeti.
- Iade politikasi ve musteri memnuniyeti.
- Sosyal ticaret (Instagram Shop, TikTok Shop) kullaniyor mu?`,

  terminologyOverrides: {
    productLabel: 'Hangi URUN KATEGORILERI sunuyor? (giyim, aksesuar, kozmetik, ev tekstili, elektronik, mobilya vb.)',
    priceDetail: ' — urun fiyat araligi, ortalama sepet tutari',
    positioningExamples: 'luks/premium/orta-ust/kitlesel/butik/indirimli',
    competitorAnalysisLabel: 'RAKIP MARKA/MAGAZA ANALIZI',
    competitorSearchExample: 'Ornek: Eger "kadin giyim butik Nisantasi" ise → "Nisantasi kadin giyim markalari" ara.',
    competitorMetrics: 'Rakip urun fiyatlarini, online magaza puanlarini, magaza sayilarini karsilastir.',
    competitorStrengthsContext: 'urun kalitesi, fiyat konumlandirma, magaza deneyimi, online varlik, marka bilinirlik',
    marketDataFocus: 'Perakende sektor verileri: pazar buyuklugu, e-ticaret buyume orani, tuketici harcama trendleri.',
    audienceLabel: 'Bu markanin urunlerini gercekte kimler satin aliyor? Musteri segmentleri:',
    audienceDetails: [
      'Yas ve gelir grubu, online vs fiziksel alisveris tercihi.',
      'Satin alma sikligi, ortalama sepet tutari, marka sadakati.',
      'Karar sureci: fiyat odakli mi, kalite odakli mi, trend odakli mi?',
    ],
    customerTerm: 'musteriler',
    websiteAnalysisFocus: 'Urun katalog yapisi, filtreleme, sepet sureci, mobil uyumluluk, odeme secenekleri.',
    researchType: 'PERAKENDE BAZLI',
  },

  extraGroundingQueries: (businessName: string, dateRule: string) => [
    {
      prompt: `"${businessName}" marka urun fiyat yorum Trendyol Hepsiburada — magaza puani, urun sayisi, musteri yorumlari, fiyat araligi. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-Marketplace',
    },
    {
      prompt: `"${businessName}" magaza konsepti sube sayisi musteri deneyimi — fiziksel magaza, online satis, kampanya stratejisi. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-StoreExperience',
    },
  ],

  groundingPromptOverrides: {
    competitor: (businessName: string, dateRule: string) =>
      `Sen bir perakende sektor arastirmacisisin. "${businessName}" ile ayni segment ve bolgedeki rakip markalari/magazalari arastir. Her rakip icin: marka adi, urun kategorisi, fiyat segmenti, magaza sayisi, online varlik durumu, guclu/zayif yanlar bul. EN AZ 3, EN FAZLA 7 rakip. Turkce yaz.${dateRule}`,
    market: (businessName: string, dateRule: string) =>
      `Sen bir perakende pazar arastirmacisisin. "${businessName}" icin: Turkiye perakende pazar buyuklugu, e-ticaret penetrasyonu, kategori bazli buyume oranlari, tuketici harcama trendleri, sezonsal satis kaliplari arastir. Somut rakamlar ver. Turkce yaz.${dateRule}`,
    trend: (businessName: string, dateRule: string) =>
      `Perakende sektoru "${businessName}" icin: omnichannel stratejiler, sosyal ticaret (Instagram Shop, TikTok), kisisellestirme ve AI kullanimi, surdurulebilir moda/urun trendleri, D2C (direct-to-consumer) modeli, hizli teslimat beklentileri. Turkce yaz.${dateRule}`,
  },

  extractionSchemaFragment: `,
  "retailData": {
    "marketplacePresence": {
      "platforms": ["Aktif oldugu platformlar (Trendyol, Hepsiburada, vb.)"],
      "avgRating": "Ortalama magaza puani",
      "totalProducts": "Toplam urun sayisi tahmini",
      "topSellingCategories": ["En cok satan kategoriler"]
    },
    "pricingAnalysis": {
      "priceRange": { "low": "En dusuk urun fiyati", "high": "En yuksek urun fiyati" },
      "avgBasketSize": "Ortalama sepet tutari",
      "priceSegment": "Fiyat segmenti (luks/premium/orta/butce)",
      "promotionStrategy": "Kampanya/indirim stratejisi"
    },
    "storeNetwork": {
      "physicalStoreCount": "Fiziksel magaza sayisi",
      "locations": ["Magaza konumlari/bolgeleri"],
      "storeFormat": "Magaza formati (butik/showroom/chain/pop-up)",
      "clickAndCollect": "Online siparis + magazadan teslim var mi"
    },
    "ecommerceCapability": {
      "hasOwnStore": "Kendi e-ticaret sitesi var mi",
      "platform": "E-ticaret altyapisi (Shopify, Ikas, vb.)",
      "paymentOptions": ["Odeme secenekleri"],
      "shippingPolicy": "Kargo politikasi"
    },
    "customerProfile": {
      "primarySegments": ["Ana musteri segmentleri"],
      "purchaseFrequency": "Satin alma sikligi",
      "onlineVsOffline": "Online vs fiziksel alisveris orani",
      "loyaltyProgram": "Sadakat programi var mi"
    },
    "reviewSentiment": {
      "positiveThemes": ["Olumlu yorum temalari — orn: kalite, tasarim, hizli kargo"],
      "negativeThemes": ["Olumsuz yorum temalari — orn: beden/olcu, iade sureci"],
      "overallSentiment": "Genel duygu tonu"
    }
  }`,

  extractionRules: `
6. PERAKENDE VERILERINI AYRI CIKAR: marketplacePresence, pricingAnalysis, storeNetwork, ecommerceCapability, customerProfile, reviewSentiment alanlarini doldur.
7. Trendyol, Hepsiburada gibi platformlardaki magaza puanlari metinde varsa MUTLAKA retailData.marketplacePresence'a ekle.
8. Urun fiyat araligi ve sepet tutari bilgisi metinde varsa MUTLAKA retailData.pricingAnalysis'e ekle.
9. Magaza sayisi ve konumlari bilgisi varsa MUTLAKA retailData.storeNetwork'e ekle.
10. Musteri yorum temalari (kalite, fiyat, kargo vb.) varsa MUTLAKA retailData.reviewSentiment'a ekle.
11. retailData icindeki her alan icin: veri bulunamadiysa "Veri bulunamadi" yaz, ALANI SILME.`,

  formatForSynthesizer: (rd: any): string => {
    if (!rd) return '';
    const parts: string[] = [];
    if (rd.marketplacePresence) {
      parts.push(`Pazaryeri Varligi: ${rd.marketplacePresence.platforms?.join(', ') || 'N/A'}, Puan: ${rd.marketplacePresence.avgRating || 'N/A'}, Urun: ${rd.marketplacePresence.totalProducts || 'N/A'}`);
    }
    if (rd.pricingAnalysis) {
      parts.push(`Fiyatlama: Aralik ${rd.pricingAnalysis.priceRange?.low || '?'} — ${rd.pricingAnalysis.priceRange?.high || '?'}, Segment: ${rd.pricingAnalysis.priceSegment || 'N/A'}, Ort. sepet: ${rd.pricingAnalysis.avgBasketSize || 'N/A'}`);
    }
    if (rd.storeNetwork) {
      parts.push(`Magaza Agi: ${rd.storeNetwork.physicalStoreCount || '?'} magaza, Format: ${rd.storeNetwork.storeFormat || 'N/A'}`);
    }
    if (rd.ecommerceCapability) {
      parts.push(`E-Ticaret: Kendi sitesi: ${rd.ecommerceCapability.hasOwnStore || 'N/A'}, Altyapi: ${rd.ecommerceCapability.platform || 'N/A'}`);
    }
    if (rd.customerProfile) {
      parts.push(`Musteri: ${rd.customerProfile.primarySegments?.join(', ') || 'N/A'}, Online/Offline: ${rd.customerProfile.onlineVsOffline || 'N/A'}`);
    }
    if (rd.reviewSentiment) {
      if (rd.reviewSentiment.positiveThemes?.length) parts.push(`Olumlu temalar: ${rd.reviewSentiment.positiveThemes.join(', ')}`);
      if (rd.reviewSentiment.negativeThemes?.length) parts.push(`Olumsuz temalar: ${rd.reviewSentiment.negativeThemes.join(', ')}`);
    }
    if (!parts.length) return '';
    return `\n\n## Perakende Verileri (Sektor-Spesifik)\n${parts.join('\n')}`;
  },
};

registerSectorEnrichment(retail);

export default retail;
