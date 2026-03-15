import { registerSectorEnrichment } from './types';
import type { SectorEnrichmentModule } from './types';

const tech: SectorEnrichmentModule = {
  sector: 'tech',
  dataFieldName: 'techData',
  frameworkReferences: ['Hook Model', 'Fogg B=MAP', 'Kano Model', 'Blue Ocean'],
  culturalBrandingLens: 'Otomasyon korkusu vs verimlilik vaadi, veri gizliliği kaygısı, "bir daha yazılım öğrenmek istemiyorum" yorgunluğu',

  culturalTensions: [
    {
      expectation: 'İyi ürün kendini satar',
      reality: 'Teknik olarak üstün ürünler pazarlama eksikliğinden ölüyor, vasat ürünler iyi pazarlamayla kazanıyor',
      opportunity: 'Ürün mükemmelliği + hikaye anlatımı dengesi — "neden" sorusunu cevaplayan marka',
    },
    {
      expectation: 'Teknoloji hayatı kolaylaştırır',
      reality: 'Dijital yorgunluk, ekran bağımlılığı, gizlilik endişesi — insanlar teknolojiden korkuyor',
      opportunity: '"İnsan için teknoloji" vaadi: güç değil, güven satan marka',
    },
    {
      expectation: 'Growth hacking = büyüme',
      reality: 'Agresif growth taktikleri kısa vadeli, kullanıcı güvenini sarsan, sürdürülemez',
      opportunity: 'Ürün odaklı organik büyüme (PLG) — kullanıcı mutluluğu en iyi pazarlama',
    },
    {
      expectation: 'Startup = inovasyon',
      reality: 'Çoğu startup var olan çözümleri kopyalıyor, gerçek inovasyon nadir',
      opportunity: 'Problem-first yaklaşım: "Hangi sorunu çözüyorsun?" sorusuyla başlayan konumlandırma',
    },
    {
      expectation: 'Yapay zeka her şeyi çözecek',
      reality: 'AI hype\'ı gerçek beklentileri aşıyor, müşteriler hayal kırıklığına uğruyor',
      opportunity: 'AI\'ı sihir değil, araç olarak konumlandıran dürüst iletişim',
    },
  ],

  deepResearchSteps: `

ADIM 6 — URUN & PLATFORM ANALIZI (TEKNOLOJIYE OZEL):
- "$BUSINESS_NAME" urun/platformunu bul: SaaS mi, mobil uygulama mi, donanim mi?
- Urun fiyatlama modeli: freemium, abonelik, tek seferlik, kullanim bazli?
- App Store/Play Store'da varsa: puan, indirme sayisi, yorum temalari.
- Product Hunt, G2, Capterra gibi platformlarda degerlendirme var mi?

ADIM 7 — TEKNOLOJI STACK & INOVASYON (TEKNOLOJIYE OZEL):
- Kullanilan teknolojiler hakkinda bilgi bul (job ilanlari, teknik blog, GitHub vb.).
- API/entegrasyon sunuyor mu? Partner/developer ekosistemi var mi?
- Patent, AR-GE yatirim, teknopark/kuluçka merkezi baglantisi var mi?
- Hangi sorunu ne kadar farkli cozdugu (differentiator)?

ADIM 8 — KULLANICI TABANI & BUYUME (TEKNOLOJIYE OZEL):
- Kullanici/musteri sayisi tahmini (aciklanan rakamlar).
- Hedef kullanici profili: bireysel mi, KOBi mi, enterprise mi?
- Yatirim aldiysa: tur, miktar, yatirimci (CrunchBase, basinda cikmis bilgiler).
- Buyume hizi ve traction gostergeleri (MRR, ARR, kullanici buyumesi — aciklananlar).

ADIM 9 — KOMUNITE & DEVELOPER EKOSISTEMI (TEKNOLOJIYE OZEL):
- GitHub, Stack Overflow, Discord/Slack komunitesi var mi?
- Teknik blog/dokumantasyon kalitesi.
- Developer advocacy / teknik pazarlama yapıyor mu?
- Konferans/etkinlik katilimi, sponsor aktiviteleri.`,

  terminologyOverrides: {
    productLabel: 'Hangi URUN/PLATFORM/HIZMETI sunuyor? (SaaS, mobil uygulama, API, donanim, danismanlik vb.)',
    priceDetail: ' — abonelik fiyati, plan tipleri, freemium/premium model',
    positioningExamples: 'startup/scaleup/enterprise/nis-cozum/platform/ajanlik',
    competitorAnalysisLabel: 'RAKIP TEKNOLOJI FIRMALARI/URUNLER ANALIZI',
    competitorSearchExample: 'Ornek: Eger "proje yonetim yazilimi" ise → "project management software Turkey alternatives" ara.',
    competitorMetrics: 'Rakip urunlerin fiyatlama, ozellikler, kullanici sayisi ve degerlendirmelerini karsilastir.',
    competitorStrengthsContext: 'teknoloji, kullanici deneyimi, fiyatlama, entegrasyon, musteri destegi, olceklenebilirlik',
    marketDataFocus: 'Turkiye teknoloji pazari: startup ekosistemi, yatirim hacimleri, dijital donusum verileri.',
    audienceLabel: 'Bu urun/hizmeti gercekte kimler kullaniyor? Kullanici segmentleri:',
    audienceDetails: [
      'Bireysel kullanici vs KOBi vs Enterprise, teknik vs non-teknik.',
      'Karar verici: CTO, urun muduru, developer, son kullanici.',
      'Kullanim senaryolari ve adoption sureci.',
    ],
    customerTerm: 'kullanicilar/musteriler',
    websiteAnalysisFocus: 'Urun tanitimi, demo/free trial, fiyatlama sayfasi, dokumantasyon, blog, entegrasyonlar.',
    researchType: 'TEKNOLOJI BAZLI',
  },

  extraGroundingQueries: (businessName: string, dateRule: string) => [
    {
      prompt: `"${businessName}" teknoloji urun platform yorum degerlendirme — G2, Capterra, Product Hunt, App Store puanlari. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-ProductReviews',
    },
    {
      prompt: `"${businessName}" startup yatirim kullanici sayisi buyume — CrunchBase, yatirim turu, MRR/ARR, kullanici tabanı. Turkce yaz.${dateRule}`,
      label: 'SectorResearch-Growth',
    },
  ],

  groundingPromptOverrides: {
    competitor: (businessName: string, dateRule: string) =>
      `Sen bir teknoloji sektor arastirmacisisin. "${businessName}" ile ayni kategoride rekabet eden teknoloji firmalarini/urunlerini arastir. Her rakip icin: firma adi, urun, fiyatlama modeli, kullanici tahmini, yatirim durumu, guclu/zayif yanlar bul. EN AZ 3, EN FAZLA 7 rakip. Turkce yaz.${dateRule}`,
    market: (businessName: string, dateRule: string) =>
      `Sen bir teknoloji pazar arastirmacisisin. "${businessName}" icin: hedef pazar buyuklugu (TAM/SAM/SOM), Turkiye ve global buyume orani, startup yatirim hacimleri, dijital donusum trendleri arastir. Somut rakamlar ver. Turkce yaz.${dateRule}`,
    trend: (businessName: string, dateRule: string) =>
      `Teknoloji sektoru "${businessName}" icin: AI/ML entegrasyonu, no-code/low-code trendi, PLG (product-led growth), developer deneyimi (DX), API-first yaklasim, bulut bilisim trendleri, siber guvenlik gereksinimleri. Turkce yaz.${dateRule}`,
  },

  extractionSchemaFragment: `,
  "techData": {
    "productProfile": {
      "productType": "SaaS / mobil uygulama / donanim / API / platform",
      "pricingModel": "Freemium / abonelik / kullanim bazli / tek seferlik",
      "plans": ["Fiyat planlari (varsa)"],
      "freeTrialAvailable": "Ucretsiz deneme var mi"
    },
    "marketplaceRatings": {
      "appStore": { "rating": "App Store puani", "reviewCount": "Yorum sayisi" },
      "playStore": { "rating": "Play Store puani", "downloadCount": "Indirme sayisi" },
      "g2": { "rating": "G2 puani", "reviewCount": "Yorum sayisi" },
      "capterra": { "rating": "Capterra puani", "reviewCount": "Yorum sayisi" }
    },
    "growthMetrics": {
      "userCount": "Kullanici/musteri sayisi tahmini",
      "fundingStage": "Yatirim turu (Seed/A/B/Bootstrapped)",
      "totalFunding": "Toplam yatirim miktari (varsa)",
      "investors": ["Yatirimcilar (varsa)"],
      "teamSize": "Takim buyuklugu"
    },
    "techStack": {
      "knownTechnologies": ["Bilinen teknolojiler"],
      "hasAPI": "API sunuyor mu",
      "integrations": ["Entegrasyonlar"],
      "openSource": "Acik kaynak bileseni var mi"
    },
    "communityPresence": {
      "github": "GitHub varlik durumu",
      "communityPlatforms": ["Discord/Slack/Forum vb."],
      "technicalBlog": "Teknik blog var mi",
      "documentationQuality": "Dokumantasyon kalitesi"
    },
    "reviewSentiment": {
      "positiveThemes": ["Olumlu yorum temalari — orn: kullanim kolayligi, destek, hiz"],
      "negativeThemes": ["Olumsuz yorum temalari — orn: fiyat, eksik ozellik, bug"],
      "overallSentiment": "Genel duygu tonu"
    }
  }`,

  extractionRules: `
6. TEKNOLOJI VERILERINI AYRI CIKAR: productProfile, marketplaceRatings, growthMetrics, techStack, communityPresence, reviewSentiment alanlarini doldur.
7. App Store, G2, Capterra puanlari metinde varsa MUTLAKA techData.marketplaceRatings'e ekle.
8. Yatirim, kullanici sayisi, buyume bilgisi varsa MUTLAKA techData.growthMetrics'e ekle.
9. API, entegrasyon, teknoloji stack bilgisi varsa MUTLAKA techData.techStack'e ekle.
10. Urun yorum temalari (UX, destek, fiyat vb.) varsa MUTLAKA techData.reviewSentiment'a ekle.
11. techData icindeki her alan icin: veri bulunamadiysa "Veri bulunamadi" yaz, ALANI SILME.`,

  formatForSynthesizer: (td: any): string => {
    if (!td) return '';
    const parts: string[] = [];
    if (td.productProfile) {
      parts.push(`Urun: ${td.productProfile.productType || 'N/A'}, Model: ${td.productProfile.pricingModel || 'N/A'}, Free trial: ${td.productProfile.freeTrialAvailable || 'N/A'}`);
    }
    if (td.marketplaceRatings) {
      const ratings: string[] = [];
      if (td.marketplaceRatings.appStore?.rating) ratings.push(`App Store: ${td.marketplaceRatings.appStore.rating}`);
      if (td.marketplaceRatings.playStore?.rating) ratings.push(`Play Store: ${td.marketplaceRatings.playStore.rating}`);
      if (td.marketplaceRatings.g2?.rating) ratings.push(`G2: ${td.marketplaceRatings.g2.rating}`);
      if (td.marketplaceRatings.capterra?.rating) ratings.push(`Capterra: ${td.marketplaceRatings.capterra.rating}`);
      if (ratings.length) parts.push(`Degerlendirmeler: ${ratings.join(', ')}`);
    }
    if (td.growthMetrics) {
      parts.push(`Buyume: ${td.growthMetrics.userCount || '?'} kullanici, Yatirim: ${td.growthMetrics.fundingStage || 'N/A'} (${td.growthMetrics.totalFunding || 'N/A'}), Takim: ${td.growthMetrics.teamSize || 'N/A'}`);
    }
    if (td.techStack) {
      parts.push(`Tech: API: ${td.techStack.hasAPI || 'N/A'}, Entegrasyonlar: ${td.techStack.integrations?.join(', ') || 'N/A'}`);
    }
    if (td.communityPresence) {
      parts.push(`Komunite: GitHub: ${td.communityPresence.github || 'N/A'}, Blog: ${td.communityPresence.technicalBlog || 'N/A'}, Dokumantasyon: ${td.communityPresence.documentationQuality || 'N/A'}`);
    }
    if (td.reviewSentiment) {
      if (td.reviewSentiment.positiveThemes?.length) parts.push(`Olumlu temalar: ${td.reviewSentiment.positiveThemes.join(', ')}`);
      if (td.reviewSentiment.negativeThemes?.length) parts.push(`Olumsuz temalar: ${td.reviewSentiment.negativeThemes.join(', ')}`);
    }
    if (!parts.length) return '';
    return `\n\n## Teknoloji Verileri (Sektor-Spesifik)\n${parts.join('\n')}`;
  },
};

registerSectorEnrichment(tech);

export default tech;
